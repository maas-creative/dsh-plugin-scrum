// Scrum plan interface uses top-level labeled checklist entries. Fenced examples
// and nested checklist details never count as independently completed work.
export function planRows(content){
 const rows=[];let section=null,fence=null;
 for(const line of String(content).split(/\r?\n/)){
  const marker=/^\s*(`{3,}|~{3,})/.exec(line);
  if(marker){if(!fence)fence=marker[1][0];else if(fence===marker[1][0])fence=null;continue;}
  if(fence)continue;
  const heading=/^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
  if(heading){const name=heading[1].toLowerCase();section=/^(todos?|tasks?)(?:\s|$)/.test(name)?'todo':/^final verification(?: wave)?$/.test(name)?'final':null;continue;}
  if(!section)continue;
  const item=/^[-*+]\s+\[([ xX~])\]\s+(.+)$/.exec(line);if(!item)continue;
  const label=/^((?:T|F)?\d+)\.\s+(.+)$/.exec(item[2]);
  rows.push({section,status:item[1].toLowerCase(),text:item[2],valid:!!label,label:label?.[1],title:label?.[2]});
 }
 return rows;
}
export function parsePlanChecklist(content){const rows=planRows(content).filter(row=>row.valid);return {completed:rows.filter(row=>row.status==='x').length,remaining:rows.filter(row=>row.status===' ').length,total:rows.length,nextTaskLabel:rows.find(row=>row.status===' ')?.text??null};}
export function parseCurrentTopLevelTask(content){const row=planRows(content).find(row=>row.valid&&row.status===' ');return row?{key:row.section+':'+row.label.toLowerCase(),section:row.section,label:row.label,title:row.title}:null;}
export function analyzeStructuredSections(content){const rows=planRows(content);const text=String(content);const sections=[...text.matchAll(/^#{1,6}\s+(TODOs?|Final Verification Wave)\s*$/gim)].map(m=>/^todo/i.test(m[1])?'todo':'final');return {recognized:sections.length>0,rawCount:rows.length,hasMalformedRows:rows.some(row=>!row.valid),hasEmptySection:sections.some(section=>!rows.some(row=>row.section===section&&row.valid))};}
export function normalizePlanEffort(content){
 const match=/^(\s*\*\*Effort:\*\*\s*)(\d+(?:\.\d+)?)\s*(hours?|days?|weeks?)[ \t]*$/im.exec(content);if(!match)return null;
 const hours=Number(match[2])*(/^day/i.test(match[3])?8:/^week/i.test(match[3])?40:1);
 const band=hours<=2?'Small':hours<=8?'Medium':hours<=40?'Large':'XL';
 return {band,content:content.slice(0,match.index)+match[1]+band+content.slice(match.index+match[0].length),original:match[0].trim()};
}
export function buildEffortWarning(result){return 'Effort estimate normalized to '+result.band+'. Review the estimate against the planned output.';}
export function buildWarning(rawCount,validCount,empty){return 'Plan validation: '+(validCount?'found '+validCount+' valid task rows':'no valid task rows')+'. '+rawCount+' checklist rows inspected.'+(empty?' A required section has no valid tasks.':'');}
export function isPlanFilePath(path){return /(?:^|[/\\])\.(?:omo|sisyphus|scrum)[/\\]plans[/\\][^\0]+\.md$/i.test(path);}
