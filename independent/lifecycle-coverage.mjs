import {execFileSync} from 'node:child_process';import {existsSync,readFileSync} from 'node:fs';import {dirname,extname,join,relative,resolve} from 'node:path';
const sourceExtensions=new Set(['.c','.cpp','.cs','.dart','.ex','.exs','.go','.java','.js','.jsx','.kt','.lua','.php','.py','.rb','.rs','.scala','.swift','.ts','.tsx']);
const excludedDirectories=new Set(['build','vendor','coverage','target','__pycache__','node_modules','dist','.git']);
export function isCovered(path,root){
 const boundary=resolve(root??path);let current=resolve(path);
 if(relative(boundary,current).startsWith('..'))return false;
 for(;;){if(existsSync(join(current,'AGENTS.md')))return true;if(current===boundary)return false;const parent=dirname(current);if(parent===current)return false;current=parent}
}
export function computeCandidateDirs(root){
 root=resolve(root);let files;
 try{files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']}).split('\0').filter(Boolean)}catch{return []}
 const counts=new Map();
 for(const file of files){if(!sourceExtensions.has(extname(file))||file.split('/').some(part=>excludedDirectories.has(part)))continue;const path=dirname(resolve(root,file));let loc;try{loc=readFileSync(resolve(root,file),'utf8').split('\n').length}catch{continue}const old=counts.get(path)??{path,files:0,loc:0};old.files++;old.loc+=loc;counts.set(path,old)}
 return [...counts.values()].filter(row=>row.files>=8||row.loc>=500).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(row=>({...row,covered:isCovered(row.path,root)}));
}
export function computeCoverageRatio(root){const candidates=computeCandidateDirs(root);if(!candidates.length)return null;const coveredDirs=candidates.filter(row=>row.covered).length;return {coverage:coveredDirs/candidates.length,missingRatio:1-coveredDirs/candidates.length,candidateDirs:candidates.length,coveredDirs}}
export function shouldProposeInit(root){const coverage=computeCoverageRatio(root);return Boolean(coverage&&coverage.missingRatio>=.5)}
