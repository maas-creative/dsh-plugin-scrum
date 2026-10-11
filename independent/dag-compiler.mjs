// Scrum's dependency compiler. Definition strings belong to the caller;
// graph analysis uses only IDs, edges and explicitly provided route fields.
export function compileDag(definition,{now='1970-01-01T00:00:00.000Z'}={}) {
 const nodes=[],edges=[],errors=[],diagnostics=[];
 const fail=(code,message,nodeIds=[])=>{errors.push({code,message,nodeIds});diagnostics.push({kind:'run_flag',message,at:now});};
 if(!definition||typeof definition!=='object'||!Array.isArray(definition.nodes))fail('invalid_definition','A DAG requires a nodes array.');
 const inputs=Array.isArray(definition?.nodes)?definition.nodes:[];
 if(!inputs.length)fail('empty_graph','A DAG requires at least one node.');
 const ids=new Set();
 for(const source of inputs){
  if(!source||typeof source!=='object'||typeof source.id!=='string'||!source.id.trim()){fail('invalid_node','Each node needs a nonempty ID.');continue;}
  const id=source.id.trim();if(ids.has(id)){fail('duplicate_node','Node IDs must be unique.',[id]);continue;}ids.add(id);
  const category=typeof source.category==='string'&&source.category.trim(),agent=typeof source.subagent_type==='string'&&source.subagent_type.trim();
  if(Boolean(category)===Boolean(agent))fail('invalid_route','Each node needs exactly one category or agent route.',[id]);
  if(typeof source.prompt!=='string'||!source.prompt.trim())fail('invalid_prompt','Each node needs a prompt.',[id]);
  if(source.dependsOn!==undefined&&(!Array.isArray(source.dependsOn)||source.dependsOn.some(dep=>typeof dep!=='string'||!dep.trim())))fail('invalid_dependencies','Dependencies must be nonempty node IDs.',[id]);
  const dependsOn=[...new Set(Array.isArray(source.dependsOn)?source.dependsOn.filter(dep=>typeof dep==='string').map(dep=>dep.trim()):[])];
  const node={id,prompt:source.effectivePrompt??source.prompt,route:category?{kind:'category',category}:{kind:'agent',agent},dependsOn,state:'pending',attempt:0,createdAt:now};
  if(source.model!==undefined)node.route.model=source.model;
  nodes.push(node);
 }
 const byId=new Map(nodes.map(node=>[node.id,node])),children=new Map(nodes.map(node=>[node.id,[]]));
 for(const node of nodes)for(const dependency of node.dependsOn){if(!byId.has(dependency)){fail('missing_dependency','Dependency does not name an existing node.',[node.id,dependency]);continue;}edges.push({from:dependency,to:node.id});children.get(dependency).push(node.id);}
 const degree=new Map(nodes.map(node=>[node.id,node.dependsOn.filter(id=>byId.has(id)).length])),waves=[],ordered=[];
 let frontier=nodes.filter(node=>degree.get(node.id)===0).map(node=>node.id);
 while(frontier.length){waves.push({index:waves.length,nodeIds:frontier});ordered.push(...frontier);const next=[];for(const id of frontier)for(const child of children.get(id)){degree.set(child,degree.get(child)-1);if(degree.get(child)===0)next.push(child);}frontier=next;}
 if(ordered.length<nodes.length)fail('cycle','Dependency cycle prevents execution.',nodes.filter(node=>degree.get(node.id)>0).map(node=>node.id));
 const paths=new Map();for(const id of ordered){const parents=byId.get(id).dependsOn.map(dep=>paths.get(dep)||[]),longest=parents.reduce((best,path)=>path.length>best.length?path:best,[]);paths.set(id,[...longest,id]);}
 const criticalPath=[...paths.values()].reduce((best,path)=>path.length>best.length?path:best,[]);
 const descendants=id=>{const found=new Set(),pending=[...(children.get(id)||[])];while(pending.length){const child=pending.pop();if(child===id||found.has(child))continue;found.add(child);pending.push(...(children.get(child)||[]));}return found.size;};
 const bottlenecks=nodes.map(node=>({nodeId:node.id,blockedCount:descendants(node.id)})).sort((a,b)=>b.blockedCount-a.blockedCount);
 return {ok:!errors.length,nodes,edges,waves,criticalPath,bottlenecks,diagnostics,errors};
}
