import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildBrowserRuntime} from './browser-runtime-build.mjs';

test('browser bundle reproduces from shipped MIT preferred source and exposes the IPC interface',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'scrum-browser-build-'));
  try {
    const actual=await buildBrowserRuntime(directory);
    const shipped=JSON.parse(readFileSync(new URL('./skills/browser/runtime/omowright/manifest.json',import.meta.url),'utf8'));
    assert.deepEqual(actual.files,shipped.files);
    assert.deepEqual(actual.dependencies,shipped.dependencies);
    assert.ok(actual.inputs.length>0);
    assert.ok(actual.inputs.every(row=>row.path.startsWith('vendor/browser-independent/')||row.path.startsWith('node_modules/ws/')||row.path.startsWith('node_modules/zod/')));
    const runtime=await import(pathToFileURL(join(directory,'index.js')).href);
    assert.equal(typeof runtime.BskIpcClient,'function');
    assert.match(readFileSync(join(directory,'LICENSE'),'utf8'),/^MIT License/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
