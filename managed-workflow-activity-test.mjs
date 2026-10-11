import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,utimes,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {managedWorkflowActivity} from './managed-workflow-activity.mjs';

test('workflow activity reads only recorded owned transcripts and retains real filesystem activity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-workflow-activity-'));
 try{
  const file=join(dir,'session.jsonl');await writeFile(file,'owned transcript\n');
  const time=Date.now()-120000;await utimes(file,time/1000,time/1000);
  const sessions={child:{id:'child',path:file},foreign:{id:'foreign',path:file}};
  const runtime={s:{all:()=>[{value:JSON.stringify({parentSession:'parent',sessions:['parent','previous-parent'],events:[{type:'handoff',from:'previous-parent',to:'parent'}]})}],setting:()=>sessions},ownerOf:id=>id==='child'?{parentSession:'parent'}:null};
  assert.ok(Math.abs(await managedWorkflowActivity(runtime,'child','parent')-time)<2);
  await assert.rejects(managedWorkflowActivity(runtime,'foreign','parent'),/outside parent/);
  assert.equal(await managedWorkflowActivity(runtime,'previous-parent','parent'),null);
  await rm(file);assert.equal(await managedWorkflowActivity(runtime,'child','parent'),null);
  sessions.child.path=dir;await assert.rejects(managedWorkflowActivity(runtime,'child','parent'),/not a file/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
