const prefixes=new Set(['IDENTITY','ATTRIBUTE','RELATIONSHIP','INSTRUCTION']);
const sections=new Set(['Explicit','Deductive','Inductive','Contradiction']);
export const sanitizeToSlug=name=>String(name??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'')||'agent';
export const sanitizePersonSlug=sanitizeToSlug;
export const isReservedSlug=slug=>String(slug).toLowerCase()==='human';
export function resolveSlugCollision(slug,existing){let result=slug,index=2;while(existing.has(result))result=`${slug}-${index++}`;return result;}

export function parsePeopleCard(body,{maxEntries=40,maxEntryChars=200}={}){
 const card={entries:[]},diagnostics=[];let section;
 const report=(index,message)=>diagnostics.push(`line ${index+1}: ${message}`);
 for(const [index,raw]of String(body).split(/\r?\n/).entries()){
  const line=raw.trim();if(!line)continue;
  if(/^#\s/.test(line))continue;
  const heading=/^##\s+(.+)$/.exec(line);
  if(heading){section=heading[1];if(!sections.has(section)){report(index,'Unsupported observation section');section=null;}continue;}
  if(section){
   const observation=/^-\s+\[(\d{4}-\d{2}-\d{2})\]\s+(.+?)(?:\s*<!--\s*([\s\S]*?)\s*-->)?$/.exec(line);
   if(!observation)continue;
   const entry={date:observation[1],content:observation[2]};
   for(const field of (observation[3]||'').split(';')){const match=/^\s*(src|confidence):\s*(.*?)\s*$/.exec(field);if(match)entry[match[1]]=match[2];}
   card.observations??=[];let group=card.observations.find(group=>group.section===section);if(!group){group={section,entries:[]};card.observations.push(group);}group.entries.push(entry);continue;
  }
  const entry=/^([A-Z]+):\s*(.+)$/.exec(line);
  if(!entry){report(index,'Expected a prefixed card entry');continue;}
  if(!prefixes.has(entry[1])){report(index,'Unsupported card entry prefix');continue;}
  card.entries.push({prefix:entry[1],content:entry[2]});
  if(entry[2].length>maxEntryChars)report(index,`Entry is longer than ${maxEntryChars} characters`);
 }
 if(card.entries.length>maxEntries)diagnostics.push(`Card exceeds the ${maxEntries}-entry limit`);
 return {card,diagnostics};
}

export function serializePeopleCard(card,limits){
 if(!card||!Array.isArray(card.entries))throw Error('Person card requires entries');
 const lines=card.entries.map(entry=>{if(!prefixes.has(entry.prefix)||typeof entry.content!=='string'||!entry.content.trim()||/[\r\n]/.test(entry.content))throw Error('Invalid structured card entry');return `${entry.prefix}: ${entry.content}`;});
 for(const group of card.observations||[]){if(!sections.has(group.section)||!Array.isArray(group.entries))throw Error('Invalid structured observation section');lines.push('',`## ${group.section}`,'');for(const entry of group.entries){if(typeof entry.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||typeof entry.content!=='string'||!entry.content.trim()||/[\r\n]/.test(entry.content)||['src','confidence'].some(key=>entry[key]!==undefined&&(typeof entry[key]!=='string'||/[\r\n]/.test(entry[key]))))throw Error('Invalid structured observation');const metadata=['src','confidence'].filter(key=>entry[key]!==undefined).map(key=>`${key}: ${entry[key]}`).join('; ');lines.push(`- [${entry.date}] ${entry.content}${metadata?' <!-- '+metadata+' -->':''}`);}}
 const body=lines.join('\n'),parsed=parsePeopleCard(body,limits);
 if(parsed.diagnostics.length)throw Error(parsed.diagnostics.join('; '));
 return body;
}
