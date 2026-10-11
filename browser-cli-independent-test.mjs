import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {diagnoseBrowser} from './skills/browser/scripts/browser-doctor.mjs';
import {onboardBrowser} from './skills/browser/scripts/browser-install.mjs';
import {browserCliOptions} from './skills/browser/scripts/browser-cli-options.mjs';

test('browser CLI imports do not diagnose, install or wait; help is also inert',()=>{
  for(const name of ['browser-doctor.mjs','browser-install.mjs']) {
    const path=fileURLToPath(new URL('./skills/browser/scripts/'+name,import.meta.url));
    const imported=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('./skills/browser/scripts/'+name,import.meta.url).href)+')'],{encoding:'utf8',timeout:5000});
    assert.equal(imported.status,0,imported.stderr);
    assert.equal(imported.stdout,'');
    const help=spawnSync(process.execPath,[path,'--help'],{encoding:'utf8',timeout:5000});
    assert.equal(help.status,0,help.stderr);
    assert.match(help.stdout,/Browser/);
  }
});

test('doctor performs an immediate public diagnostic; setup retains explicit browser choice and bounded CLI wait',async()=>{
  let seen;
  assert.deepEqual(await diagnoseBrowser({browser:'chrome',waitForBrowserMs:999},async options=>{seen=options;return {ready:false,nextStep:'Enable extension'}}),{ready:false,nextStep:'Enable extension'});
  assert.equal(seen.waitForBrowserMs,0);
  assert.equal(seen.browser,'chrome');
  await onboardBrowser({browser:'brave',waitTotalMs:0},async options=>{seen=options;return {ready:true}});
  assert.equal(seen.browser,'brave');
  assert.equal(seen.waitTotalMs,0);
  assert.equal(browserCliOptions(['--wait-ms=180000']).waitTotalMs,180000);
  for(const args of [['--wait-ms=-1'],['--wait-ms=180001'],['--browser=../chrome'],['--unknown']])assert.throws(()=>browserCliOptions(args));
});
