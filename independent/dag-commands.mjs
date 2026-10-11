// Read-only DAG inspection. All record lookups stay in the invoking session.
const clean=value=>String(value??'').replace(/\x1b\[[0-9;]*[A-Za-z]/g,'').replace(/[\x00-\x1f\x7f]/g,' ').trim();
export function registerDagCommands(host,manager){
 host.registerCommand('dag',{description:'Inspect this session’s dependency runs and worker results.',handler:async(input,ctx)=>{
  const parent=ctx.sessionManager.getSessionId(),id=String(input||'').trim();
  if(!id){const runs=manager.list(parent,{limit:100});ctx.ui.notify(runs.length?runs.map(run=>`${clean(run.runId)} · ${clean(run.name)} · ${clean(run.status)} · ${run.counts?.completed||0}/${run.counts?.total||0} done`).join('\n'):'No dag runs in this session.','info');return;}
  let run;try{run=manager.snapshot(id,parent);}catch{ctx.ui.notify('No dag run in this session: '+clean(id),'warning');return;}
  const lines=[`${clean(run.name)} (${clean(run.runId)}) · ${clean(run.status)}`];
  for(const wave of run.waves||[]){lines.push(`wave ${wave.index+1}/${run.waves.length}`);for(const nodeId of wave.nodeIds){const node=run.nodes.find(node=>node.id===nodeId);if(!node)continue;const route=node.route||{};lines.push(`  ${clean(node.id)} · ${clean(node.label||node.id)} · ${clean(node.state)} · ${route.kind==='agent'?'agent:'+clean(route.agent):'category:'+clean(route.category)}${route.model?' · model:'+clean(route.model):''}${node.dependsOn?.length?' · after '+node.dependsOn.map(clean).join(', '):''} · attempt ${node.attempt||0}${node.error?' · '+clean(typeof node.error==='string'?node.error:node.error.message||node.error.code):''}`);}}
  lines.push('critical path: '+(run.criticalPath||[]).map(clean).join(' -> '));
  const bottlenecks=(run.bottlenecks||[]).filter(row=>row.blockedCount);if(bottlenecks.length)lines.push('dependent nodes: '+bottlenecks.map(row=>clean(row.nodeId)+'='+row.blockedCount).join(', '));
  ctx.ui.notify(lines.join('\n'),'info');
 }});
}
