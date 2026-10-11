#!/usr/bin/env node
// Independent Scrum source-policy checks using the public TypeScript AST.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');

export function discoverFiles(inputs: string[]): string[] {
  const files = new Set<string>();
  function collect(candidate: string): void {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(candidate)) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) collect(path.join(candidate, item));
      }
    } else if (/\.(?:ts|tsx|mts|cts)$/.test(candidate) && !/\.d\.(?:ts|mts|cts)$/.test(candidate)) files.add(candidate);
  }
  for (const input of inputs) collect(input);
  return [...files].sort();
}

export function analyzeFile(filePath: string, sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true)) {
  const findings: {rule: string; file: string; line: number; col: number}[] = [];
  function add(rule: string, position: number): void {
    const point = sourceFile.getLineAndCharacterOfPosition(position);
    findings.push({rule, file: filePath, line: point.line + 1, col: point.character + 1});
  }
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, sourceFile.text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      const text = scanner.getTokenText();
      for (const [marker, rule] of [['@ts-ignore', 'no-ts-ignore'], ['@ts-expect-error', 'no-ts-expect-error']]) {
        if (text.includes(marker)) add(rule, scanner.getTokenPos());
      }
    }
  }
  function visit(node): void {
    const start = node.getStart(sourceFile);
    if (ts.isAsExpression(node)) {
      if (node.type.kind === ts.SyntaxKind.AnyKeyword) add('no-any-assertion', start);
      if (node.type.kind === ts.SyntaxKind.UnknownKeyword) add('no-unknown-assertion', start);
    }
    if (ts.isEnumDeclaration(node)) add('no-enum', start);
    if (ts.isNonNullExpression(node)) add('no-non-null-assertion', start);
    if (ts.isThrowStatement(node) && node.expression && (ts.isStringLiteral(node.expression)
      || ts.isNumericLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression)
      || ts.isTemplateExpression(node.expression))) add('no-throw-literal', start);
    if (ts.isCatchClause(node) && node.block.statements.length === 0) add('empty-catch', start);
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const parent = node.parent;
      if (ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent)
        || ts.isPropertySignature(parent)) add('no-any-annotation', start);
      else if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)
        || ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) add('no-explicit-any-return', start);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}

export function main(inputs = process.argv.slice(2)): number {
  if (!inputs.length) {
    console.error('usage: check-no-excuse-rules.ts <file-or-directory> ...');
    return 2;
  }
  try {
    const files = discoverFiles(inputs);
    const findings = files.flatMap(file => analyzeFile(file));
    for (const item of findings) console.error(`${item.file}:${item.line}:${item.col}: [${item.rule}] Source policy requires review.`);
    if (findings.length) console.error(`${findings.length} source-policy diagnostic(s).`);
    return findings.length ? 1 : 0;
  } catch (error) {
    console.error(`Source inspection failed: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main();
