import test from 'node:test';import assert from 'node:assert/strict';import {createClaudeModeAdapter} from './claude-mode.mjs';
test('Auto preserves its native predecessor across cold resume and ignores inherited ownership',()=>{
 const events=[],session={id:'parent',snapshotEvents:()=>events,append:(type,data)=>events.push({type,data})};let preset='standard';const ctx={permissionPresets:{names:['standard','auto'],current:()=>preset,set:(_session,value)=>preset=value}},parent={session};
 createClaudeModeAdapter(ctx)(parent,'auto');assert.equal(preset,'auto');assert.equal(events.at(-1).data.previous,'standard');
 const restored={session:{...session}};createClaudeModeAdapter(ctx)(restored,'default');assert.equal(preset,'standard');assert.equal(events.at(-1).data.active,false);
 createClaudeModeAdapter(ctx)(parent,'auto');const child={session:{...session,id:'child'}};createClaudeModeAdapter(ctx)(child,'default');assert.equal(preset,'auto');
 preset='standard';createClaudeModeAdapter(ctx)(parent,'default');assert.equal(preset,'standard');
});
test('unknown saved predecessor fails without silently keeping Auto',()=>{const agent={session:{id:'parent',snapshotEvents:()=>[{type:'scrum/claude-auto-previous',data:{ownerSessionId:'parent',previous:'removed',active:true}}]}};let changes=0;const mode=createClaudeModeAdapter({permissionPresets:{names:['standard','auto'],current:()=> 'auto',set:()=>changes++}});assert.throws(()=>mode(agent,'default'),/cannot be restored/);assert.equal(changes,0);});
