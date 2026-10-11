// Own build adapter for the included separately MIT-licensed source.
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const r=await build({absWorkingDir:root,entryPoints:['vendor/session-finder-independent/src/cli.ts'],bundle:true,platform:'node',format:'esm',target:'node24',write:false});
const bytes=r.outputFiles[0].contents;
if(!Buffer.from(bytes).equals(await readFile(resolve(root,'vendor/session-finder-independent/runtime/cli.mjs'))))throw new Error('Session finder source rebuild differs');
console.log(JSON.stringify({exactReproduction:true,sha256:createHash('sha256').update(bytes).digest('hex')}));
