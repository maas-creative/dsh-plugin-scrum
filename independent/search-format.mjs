// Scrum rendering policy: preserve every match unless the caller explicitly limits it.
export function formatCountResult(entries){return entries.length?entries.map(({file,count})=>`${count}: ${file}`).join('\n'):'No matches found';}
export function formatGrepResult({matches}){
 if(!matches.length)return 'No matches found';
 const paths=new Set(matches.map(row=>row.file));
 return `${paths.size} file(s)\n`+matches.map(row=>row.line>0?`${row.file}\n${row.line}: ${row.text}`:row.file).join('\n');
}
