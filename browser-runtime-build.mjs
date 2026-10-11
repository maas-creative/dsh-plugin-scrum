import {build} from 'esbuild';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
export async function buildBrowserRuntime(outputDirectory) {
  const output=resolve(outputDirectory),source=join(root,'vendor/browser-independent');
  mkdirSync(output,{recursive:true});
  const result=await build({absWorkingDir:root,entryPoints:['vendor/browser-independent/src/index.js'],
    outfile:join(output,'index.js'),bundle:true,format:'esm',platform:'node',target:'node24',
    external:['bun:sqlite'],metafile:true,
    banner:{js:'import {createRequire as scrumCreateRequire} from "node:module";const require=scrumCreateRequire(import.meta.url);'}});
  copyFileSync(join(source,'src/page-bundle.js'),join(output,'page-bundle.js'));
  copyFileSync(join(source,'LICENSE'),join(output,'LICENSE'));
  for(const [name,target] of [['ws','WS-LICENSE'],['zod','ZOD-LICENSE']])
    copyFileSync(join(root,'node_modules',name,'LICENSE'),join(output,target));
  const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
  const manifest={source:'https://github.com/code-yeongyu/omowright',
    commit:'293ca5002cbd4c8b0c104c5934683385ef7e0d3a',license:'MIT',
    transformation:'Independent reproducible esbuild ESM recipe; public upstream preferred source shipped in vendor/browser-independent',
    files:Object.fromEntries(['index.js','page-bundle.js','LICENSE','WS-LICENSE','ZOD-LICENSE'].map(name=>[name,digest(join(output,name))])),
    dependencies:Object.fromEntries(['ws','zod','esbuild'].map(name=>{const metadata=JSON.parse(readFileSync(join(root,'node_modules',name,'package.json'),'utf8'));return[name,{version:metadata.version,license:metadata.license}]})),
    inputs:Object.keys(result.metafile.inputs).map(path=>({path,sha256:digest(join(root,path))})),
    fullAcceptanceComplete:false};
  writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv[2])throw new Error('Provide an output directory');
  const manifest=await buildBrowserRuntime(process.argv[2]);
  console.log(JSON.stringify({inputs:manifest.inputs.length,files:manifest.files}));
}
