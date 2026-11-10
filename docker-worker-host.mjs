import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {readdir,lstat,realpath,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,relative,resolve,isAbsolute} from 'node:path';

export function runProcess(command,args,{input,timeout=120000,exitCodes=[0]}={}){
 return new Promise((accept,reject)=>{
  const child=spawn(command,args,{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
  child.stdout.on('data',data=>{stdout=(stdout+data).slice(-1048576)});
  child.stderr.on('data',data=>{stderr=(stderr+data).slice(-65536)});
  child.on('error',error=>{clearTimeout(timer);reject(error)});
  child.on('close',code=>{clearTimeout(timer);exitCodes.includes(code)?accept(stdout):reject(Error(`Sandbox operation failed (${code}): ${stderr.slice(-2000)}`))});
  child.stdin.on('error',()=>{});
  if(input?.pipe)input.pipe(child.stdin);else child.stdin.end(input);
 });
}
export function workerSandboxName(id){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw Error('Invalid worker run identity');
 return 'scrum-worker-'+id;
}
export async function captureWorkerSource(cwd,additionalInputs=[],excludedFiles=[]){
 const source=await realpath(cwd);
  const names=await readdir(source),inputs=[];
  // A snapshot of source files only. No host mounts, session DB, Git metadata or credentials.
  for(const file of names){if(file.startsWith('.')||!/[.](mjs|js|ts|tsx|json|md|yml|yaml)$/.test(file)||/credential|secret|connection|token/i.test(file))continue;const stat=await lstat(resolve(source,file));if(stat.isFile()&&stat.nlink===1)inputs.push(file)}
  for(const directory of ['independent','vendor','skills','tests']){async function collect(path){let entries;try{entries=await readdir(resolve(source,path),{withFileTypes:true})}catch(error){if(error.code==='ENOENT')return;throw error}for(const entry of entries){const file=path+'/'+entry.name;if(entry.name.startsWith('.')||(/credential|secret|connection|token/i.test(entry.name)&&!/[.](mjs|js|ts)$/.test(entry.name)))continue;if(entry.isDirectory())await collect(file);else if(entry.isFile()&&(/[.](mjs|js|ts|json|md|yml|yaml)$/.test(entry.name)||(path==='tests'||path.startsWith('tests/'))&&/[.](py|swift)$/.test(entry.name))){const full=resolve(source,file),stat=await lstat(full);if(stat.nlink===1&&await realpath(full)===full)inputs.push(file)}}}await collect(directory)}
  for(const file of additionalInputs){const full=resolve(source,file),suffix=relative(source,full),stat=await lstat(full);if(suffix.startsWith('..')||isAbsolute(suffix)||!stat.isFile()||stat.nlink!==1||await realpath(full)!==full)throw Error('Additional worker input is outside the approved source');if(!inputs.includes(suffix))inputs.push(suffix)}
  if(!inputs.length)throw Error('No approved source files for worker snapshot');
  const hashes=new Map();for(const file of inputs)hashes.set(file,createHash('sha256').update(await readFile(resolve(source,file))).digest('hex'));
 const excluded=new Set(excludedFiles);
 const fingerprint=createHash('sha256').update(JSON.stringify([...hashes].filter(([file])=>!excluded.has(file)).sort(([a],[b])=>a<b?-1:a>b?1:0))).digest('hex');
 return {source,inputs,hashes,fingerprint};
}
export class DockerWorkerHost{
 constructor(config){
  if(!isAbsolute(config.sbxBin||'')||!isAbsolute(config.imageArchive||'')||!/^sha256:[a-f0-9]{64}$/.test(config.imageId||''))throw Error('Pinned Docker worker image and sbx executable are required');
  this.config=config;
 }
 sbx(...args){return runProcess(this.config.sbxBin,['--no-input',...args])}
 exec(name,args,options){return runProcess(this.config.sbxBin,['--no-input','exec',...(options?.input?['-i']:[]),name,...args],options)}
 async exists(binding){return (await this.sbx('ls','-q')).split(/\r?\n/).includes(binding.name)}
 async prepare({id,cwd,policy,instruction,approvedInputs=[],historyPath,historyRoot,providerPatch,credential,reportPath}){
  const name=workerSandboxName(id),source=await realpath(cwd);
  if(source!==resolve(cwd)||/[\r\n,\0]/.test(cwd))throw Error('Worker source must be a physical directory representable by Docker mounts');
  const excludedFiles=reportPath&&relative(source,reportPath)&&!relative(source,reportPath).startsWith('..')&&!isAbsolute(relative(source,reportPath))?[relative(source,reportPath)]:[];
  const {inputs,hashes,fingerprint}=await captureWorkerSource(source,this.config.additionalInputs||[],excludedFiles);
  await this.sbx('create','shell','--name',name,'--skills','off','--static-mcp','none','--cpus','2','--memory','3g');
  try{
   await this.sbx('cp',this.config.imageArchive,name+':/tmp/scrum-worker-image.tar');
   await this.exec(name,['sudo','chmod','644','/tmp/scrum-worker-image.tar']);
   await this.exec(name,['docker','load','-i','/tmp/scrum-worker-image.tar']);
   await this.exec(name,['sudo','mkdir','-p','/srv/scrum/config','/srv/scrum/state/sessions','/srv/scrum/workspace','/srv/scrum/output','/srv/scrum/inputs']);
   await this.exec(name,['sudo','chown','-R','1000:1000','/srv/scrum']);
   for(const file of inputs){if(dirname(file)!=='.')await this.exec(name,['mkdir','-p','/srv/scrum/workspace/'+dirname(file)]);await this.sbx('cp',resolve(source,file),name+':/srv/scrum/workspace/'+file)}
   for(const file of inputs)if(createHash('sha256').update(await readFile(resolve(source,file))).digest('hex')!==hashes.get(file))throw Error('Worker source changed while taking its snapshot');
   for(const input of approvedInputs){if(!/^[a-zA-Z0-9_.-]+$/.test(input.name)||input.content.length>200000)throw Error('Invalid approved worker input');await this.exec(name,['sh','-c','cat > "$1"','sh','/srv/scrum/inputs/'+input.name],{input:input.content})}
   let historySuffix;
   if(historyPath){
    const suffix=relative(historyRoot,historyPath);historySuffix=suffix;
    if(suffix.startsWith('..')||isAbsolute(suffix)||!suffix.endsWith('.jsonl'))throw Error('Unsupported worker history location');
    const target='/srv/scrum/state/sessions/'+suffix;
    await this.exec(name,['mkdir','-p',dirname(target)]);
    await this.sbx('cp',historyPath,name+':'+target);
   }
   await this.sbx('cp',fileURLToPath(new URL('./docker-worker-policy.mjs',import.meta.url)),name+':/srv/scrum/config/worker-policy.mjs');
   await this.exec(name,['ln','-s','/opt/dsh/node_modules','/srv/scrum/config/node_modules']);
   await this.exec(name,['ln','-s','/opt/dsh/node_modules','/srv/scrum/workspace/node_modules']);
   const patch=[{id:'session-persistence-jsonl',config:{root:'/state/sessions',compression:'none'}},providerPatch,{insert:[{id:'scrum-worker-policy',name:'/config/worker-policy.mjs',config:{allow:policy.allow||['bash','read','write','edit','glob','grep'],readOnly:policy.readOnly===true,instruction}}]}];
   await this.exec(name,['sh','-c','umask 077; cat > /srv/scrum/config/worker.json'],{input:JSON.stringify(patch)});
   if(typeof credential!=='string'||/[\r\n]/.test(credential))throw Error('Worker model credential is missing or invalid');
   await this.exec(name,['sh','-c','umask 077; cat > /srv/scrum/config/worker.env'],{input:'SCRUM_WORKER_MODEL_KEY='+credential+'\n'});
   const base=new URL(this.config.baseURL);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('Invalid model endpoint');
   await this.sbx('policy','allow','network','--sandbox',name,base.host);
   await this.exec(name,['sudo','chown','-R','1000:1000','/srv/scrum']);
   await this.exec(name,['git','-C','/srv/scrum/workspace','init','--quiet']);
   await this.exec(name,['git','-C','/srv/scrum/workspace','add','--all']);
   await this.exec(name,['git','-C','/srv/scrum/workspace','-c','user.name=Scrum snapshot','-c','user.email=snapshot@invalid','-c','core.hooksPath=/dev/null','commit','--quiet','-m','Approved worker input snapshot']);
   const baseCommit=(await this.exec(name,['git','-C','/srv/scrum/workspace','rev-parse','HEAD'])).trim();
   await this.exec(name,['docker','create','--name','scrum-dsh','--interactive','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--tmpfs','/tmp:rw,exec,nosuid,size=256m',
    '--mount','type=bind,source=/srv/scrum/workspace,target='+cwd+(policy.readOnly?',readonly':''),
    '--mount','type=bind,source=/srv/scrum/state,target=/state',
    '--mount','type=bind,source=/srv/scrum/inputs,target=/inputs,readonly',
    '--mount','type=bind,source=/srv/scrum/output,target=/output',
    '--mount','type=bind,source=/srv/scrum/config,target=/config,readonly',
    '--workdir',cwd,'--env-file','/srv/scrum/config/worker.env',this.config.imageId]);
   return {name,id,cwd,imageId:this.config.imageId,historySuffix,baseCommit,sourceSnapshot:{cwd:source,fingerprint,excludedFiles,imageId:this.config.imageId}};
  }catch(error){await this.sbx('stop',name).catch(()=>{});await this.sbx('rm','--force',name).catch(()=>{});throw error}
 }
 async resetPolicyProof(binding){await this.exec(binding.name,['rm','-f','/srv/scrum/output/worker-policy.json'])}
 async assertPolicy(binding,policy){
  const raw=await this.exec(binding.name,['python3','-c','import os,stat; p="/srv/scrum/output/worker-policy.json"; f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW); s=os.fstat(f); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<20000; print(os.read(f,20000).decode())']);
  const proof=JSON.parse(raw),forbidden=['subagent','subagent_fork','create_goal','update_goal','workpool','session_list','session_read','session_search','memory_read','memory_search',...(policy.readOnly?['write','edit']:[])];
  if(proof.sessionId!==binding.id||proof.readOnly!==(policy.readOnly===true)||!Array.isArray(proof.tools)||!proof.tools.includes('scrum_report')||proof.tools.some(name=>forbidden.includes(name)))throw Error('Docker worker policy did not activate with the assigned tool permissions');
  return proof;
 }
 async report(binding){
  // Do not follow a model-created link or copy a directory onto the host.
  return this.exec(binding.name,['python3','-c','import os,stat,sys; p="/srv/scrum/output/report.md"; f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW); s=os.fstat(f); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<=200000; sys.stdout.buffer.write(os.read(f,200001))']);
 }
 async refreshProvider(binding,providerPatch){
  const running=(await this.exec(binding.name,['docker','inspect','scrum-dsh','--format','{{.State.Running}}'])).trim();
  if(running!=='false')throw Error('Refusing to reconfigure a running worker');
  await this.exec(binding.name,['python3','-c','import json,sys; p="/srv/scrum/config/worker.json"; rows=json.load(open(p)); patch=json.load(sys.stdin); assert patch["id"]=="llm-pi-ai"; rows=[patch if row.get("id")=="llm-pi-ai" else row for row in rows]; open(p,"w").write(json.dumps(rows))'],{input:JSON.stringify(providerPatch)});
 }
 async running(binding){return (await this.exec(binding.name,['docker','inspect','scrum-dsh','--format','{{.State.Running}}'])).trim()==='true'}
 async historyEvents(binding,from,to){
  const suffix=binding.historySuffix;if(!suffix||suffix.startsWith('..')||isAbsolute(suffix))throw Error('Worker history binding is missing');
  const raw=await this.exec(binding.name,['python3','-c','import json,sys; p=sys.argv[1]; a=int(sys.argv[2]); b=int(sys.argv[3]); rows=[json.loads(line) for line in open(p)]; print(json.dumps([r for r in rows if isinstance(r.get("seq"),int) and a<=r["seq"]<b]))','/srv/scrum/state/sessions/'+suffix,String(from),String(to)]);
  const events=JSON.parse(raw);if(events.length!==to-from||events.some((event,index)=>event.seq!==from+index))throw Error('Docker history export is incomplete');return events;
 }
 async historyCount(binding){
  const suffix=binding.historySuffix;if(!suffix||suffix.startsWith('..')||isAbsolute(suffix))throw Error('Worker history binding is missing');
  return Number((await this.exec(binding.name,['python3','-c','import json,sys; print(sum(1 for line in open(sys.argv[1]) if isinstance(json.loads(line).get("seq"),int)))','/srv/scrum/state/sessions/'+suffix])).trim());
 }
 async changes(binding){
  if(!/^[a-f0-9]{40}$/.test(binding.baseCommit||''))throw Error('Worker snapshot baseline is missing');
  const git=['git','--git-dir=/srv/scrum/workspace/.git','--work-tree=/srv/scrum/workspace','-C','/srv/scrum/workspace','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.attributesFile=/dev/null'];
  let patch=await this.exec(binding.name,[...git,'diff','--no-ext-diff','--no-textconv','--binary',binding.baseCommit,'--']);
  const files=(await this.exec(binding.name,[...git,'ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
  if(files.length>30)throw Error('Worker has more than 30 new files; retained for explicit review');
  for(const file of files){
   if(file.split('/').some(part=>part==='..'||part.startsWith('.'))||isAbsolute(file))throw Error('Worker output includes an unapproved path');
   await this.exec(binding.name,['python3','-c','import os,stat,sys; s=os.lstat(sys.argv[1]); assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_size<=1048576','/srv/scrum/workspace/'+file]);
   patch+=await this.exec(binding.name,[...git,'diff','--no-ext-diff','--no-textconv','--binary','--no-index','--','/dev/null',file],{exitCodes:[0,1]});
  }
  if(/(?:new file mode|old mode|new mode|deleted file mode) (?:120000|160000)/.test(patch))throw Error('Worker links and submodules require explicit review');
  if(Buffer.byteLength(patch)>900000)throw Error('Worker patch exceeds the bounded transfer size');return patch;
 }
 stop(binding){return this.sbx('stop',binding.name)}
 remove(binding){return this.sbx('rm','--force',binding.name)}
}
