import{execFileSync}from'node:child_process';import{parseMemoryFile}from'./memory-text.mjs';
const objectId=/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
// Enumerate committed objects, then ask Git's batch-command protocol for only
// uncached blob IDs. Files in the worktree are never opened.
export function createCommittedMemoryCorpus(memory,{runGit=(args,input)=>execFileSync('git',['-C',memory.directory,...args],{input,maxBuffer:64*1024*1024})}={}){
 let cachedRevision,documents=[],byPath=new Map(),blobCache=new Map();
 return ()=>{
  const revision=memory.head();if(revision===cachedRevision)return {revision,documents};
  if(!revision){cachedRevision=revision;documents=[];byPath.clear();blobCache.clear();return {revision,documents};}
  if(!objectId.test(revision))throw Error('Memory revision must be a Git object ID');
  const listing=runGit(['ls-tree','-r','-z','--full-tree','--format=%(objectmode) %(objecttype) %(objectname)%x09%(path)',revision]).toString('utf8'),entries=[];
  for(const line of listing.split('\0')){if(!line)continue;const separator=line.indexOf('\t');if(separator<0)throw Error('Malformed memory tree record');const fields=line.slice(0,separator).split(' '),path=line.slice(separator+1);if(fields.length!==3||!objectId.test(fields[2]))throw Error('Malformed memory object identity');if(fields[0]!=='100644'||fields[1]!=='blob'||!path.endsWith('.md')||path.startsWith('system/'))continue;entries.push({path,oid:fields[2]});}
  const needed=[...new Set(entries.map(entry=>entry.oid))].filter(id=>!blobCache.has(id)),incoming=new Map();
  if(needed.length){const output=runGit(['cat-file','--batch-command'],needed.map(id=>'contents '+id).join('\n')+'\n');let position=0;
   for(const requested of needed){const boundary=output.indexOf(10,position);if(boundary<0)throw Error('Incomplete memory object header');const metadata=output.subarray(position,boundary).toString('ascii').split(' '),length=Number(metadata[2]);if(metadata.length!==3||metadata[0]!==requested||metadata[1]!=='blob'||!Number.isSafeInteger(length)||length<0||boundary+1+length>=output.length||output[boundary+1+length]!==10)throw Error('Memory object reply does not match the requested blob');incoming.set(requested,output.subarray(boundary+1,boundary+1+length).toString('utf8'));position=boundary+length+2;}
   if(position!==output.length)throw Error('Unexpected trailing memory object data');
  }
  const nextPaths=new Map(),nextBlobs=new Map(),nextDocuments=[];
  for(const {path,oid}of entries){const body=incoming.has(oid)?incoming.get(oid):blobCache.get(oid);nextBlobs.set(oid,body);let item=byPath.get(path);if(item?.oid!==oid){let document;try{const parsed=parseMemoryFile(body);document={path,description:parsed.frontmatter.description,body:parsed.body};}catch{}item={oid,document};}nextPaths.set(path,item);if(item.document)nextDocuments.push(item.document);}
  nextDocuments.sort((first,second)=>first.path.localeCompare(second.path));
  // Publish caches only after the entire Git reply is validated.
  cachedRevision=revision;documents=nextDocuments;byPath=nextPaths;blobCache=nextBlobs;return {revision,documents};
 };
}
