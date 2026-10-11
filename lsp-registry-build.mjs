import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// Rebuild only from the pinned, licensed inputs shipped with this package.
// Launch commands and file associations are maintained in servers.json.
const root = new URL('./vendor/lsp-registry/', import.meta.url);
const provenance = JSON.parse(await readFile(new URL('PROVENANCE.json', root), 'utf8'));
for (const [file, expected] of Object.entries(provenance.files)) {
  if (!/^(mason|nvim-lspconfig)\/[\w.-]+$/.test(file)) throw new Error('Invalid registry input path');
  const bytes = await readFile(new URL(file, root));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Registry input changed: ${file}`);
}
const servers = JSON.parse(await readFile(new URL('servers.json', root), 'utf8'));
const recipes = {};
for (const server of Object.values(servers)) {
  const name = server.recipe;
  if (!name || recipes[name]) continue;
  if (!/^[\w.-]+$/.test(name)) throw new Error('Invalid recipe name');
  const file = `mason/${name}.yaml`;
  if (!Object.hasOwn(provenance.files, file)) throw new Error(`Unpinned input: ${file}`);
  const recipe = yaml.load(await readFile(new URL(file, root), 'utf8'));
  if (recipe.name !== name) throw new Error(`Recipe identity mismatch: ${name}`);
  recipes[name] = { name: recipe.name, homepage: recipe.homepage, licenses: recipe.licenses, source: recipe.source, bin: recipe.bin };
}
const output = JSON.stringify(recipes, null, 2) + '\n';
const target = new URL('recipes.json', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== output) throw new Error('recipes.json differs from pinned inputs');
} else {
  await writeFile(target, output);
}
console.log(`${Object.keys(recipes).length} pinned recipes verified: ${fileURLToPath(target)}`);
