import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,lstatSync,readFileSync,openSync,writeFileSync,closeSync,renameSync,unlinkSync,existsSync,chmodSync} from 'node:fs';
import {tolerantFsyncSync} from '../fsync-tracker.mjs';
import {realpath} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {withLspClient,getLspManager,currentLspContext,configuration,availableLspCommand} from './lsp-client.mjs';
export {parseLspRequestContext,runWithRequestContext} from './lsp-client.mjs';
const position=args=>{if(!Number.isInteger(args.line)||args.line<1||!Number.isInteger(args.character)||args.character<0)throw Error('Invalid LSP line/character');return {line:args.line-1,character:args.character};};
async function execute(name,args,signal){
 const context=currentLspContext();signal?.throwIfAborted();
 if(name==='status'){const root=await realpath(context.cwd);const snapshots=(await getLspManager().status()).filter(s=>s.root===root),config=await configuration(context),servers=await Promise.all(Object.entries(config).map(async([id,settings])=>({id,installed:!!await availableLspCommand(id,settings,context),extensions:settings.extensions||[],disabled:settings.disabled===true,source:settings.source,priority:settings.priority||0})));return {servers,snapshots};}
 if(name==='install_decision'){
  if(!context.capabilities.installDecisionTool)throw Error('LSP installation decisions are not permitted');if(typeof args.server_id!=='string'||!/^[\w.-]+$/.test(args.server_id)||!['allowed','declined'].includes(args.decision))throw Error('Invalid LSP installation decision');
  if(!(args.server_id in await configuration(context)))throw Error('Unknown LSP server ID');const path=context.installDecisionsPath;if(typeof path!=='string')throw Error('Installation decision path not configured');mkdirSync(dirname(path),{recursive:true,mode:0o700});const lock=path+'.lock.sqlite';for(const target of [path,lock])if(existsSync(target)&&(!lstatSync(target).isFile()||lstatSync(target).isSymbolicLink()))throw Error('Unsafe installation decision file');const db=new DatabaseSync(lock);let temporary;
  try{chmodSync(lock,0o600);db.exec('PRAGMA busy_timeout=3000; BEGIN IMMEDIATE');signal?.throwIfAborted();let data={};try{data=JSON.parse(readFileSync(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid installation decision data');const record={decision:args.decision,decidedAt:new Date().toISOString()};Object.defineProperty(data,args.server_id,{value:record,enumerable:true,writable:true,configurable:true});temporary=path+'.'+randomUUID()+'.tmp';const fd=openSync(temporary,'wx',0o600);try{writeFileSync(fd,JSON.stringify(data,null,2)+'\n');tolerantFsyncSync(fd);}finally{closeSync(fd);}signal?.throwIfAborted();renameSync(temporary,path);temporary=null;db.exec('COMMIT');return {server_id:args.server_id,...record};}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{db.close();if(temporary)try{unlinkSync(temporary);}catch{}}

 }
 if(['rename','format'].includes(name))throw Error('LSP mutations require the host filesystem adapter');
 return withLspClient(args.filePath,async(client,_root,path)=>{
  const uri=await client.openFile(path,signal),textDocument={uri};let result;
  if(name==='diagnostics'){if(args.severity!==undefined&&!['error','warning','information','hint','all'].includes(args.severity))throw Error('Invalid diagnostic severity');
   if(client.capabilities.diagnosticProvider){result=await client.sendRequest('textDocument/diagnostic',{textDocument},{signal});const diagnostics=(result.items||[]).filter(d=>!args.severity||args.severity==='all'||d.severity===({error:1,warning:2,information:3,hint:4})[args.severity]);return {filePath:args.filePath,severity:args.severity||'all',mode:'file',diagnostics,totalDiagnostics:diagnostics.length,truncated:false,kind:result.kind};}
   const published=await client.waitForDiagnostics(uri,{signal,version:client.getOpenDocumentVersion(path)});const diagnostics=(published?.diagnostics||[]).filter(d=>!args.severity||args.severity==='all'||d.severity===({error:1,warning:2,information:3,hint:4})[args.severity]);return {filePath:args.filePath,severity:args.severity||'all',mode:'file',diagnostics,totalDiagnostics:diagnostics.length,truncated:false,pending:!published,documentVersionVerified:published?.version===client.getOpenDocumentVersion(path)};
  }
  if(name==='symbols'){
   if(!['document','workspace'].includes(args.scope))throw Error('Invalid symbol scope');if(args.limit!==undefined&&(!Number.isSafeInteger(args.limit)||args.limit<1))throw Error('Invalid symbol limit');result=await client.sendRequest(args.scope==='workspace'?'workspace/symbol':'textDocument/documentSymbol',args.scope==='workspace'?{query:args.query||''}:{textDocument},{signal});const symbols=result||[];return {filePath:args.filePath,scope:args.scope,...(args.scope==='workspace'?{query:args.query||''}:{}),symbols:args.limit?symbols.slice(0,args.limit):symbols,totalSymbols:symbols.length,truncated:!!args.limit&&symbols.length>args.limit};
  }
  const point=position(args),method={goto_definition:'textDocument/definition',find_references:'textDocument/references',prepare_rename:'textDocument/prepareRename'}[name];if(!method)throw Error('Unknown LSP operation');result=await client.sendRequest(method,{textDocument,position:point,...(name==='find_references'?{context:{includeDeclaration:args.includeDeclaration!==false}}:{})},{signal});return {filePath:args.filePath,line:args.line,character:args.character,...(name==='goto_definition'?{locations:Array.isArray(result)?result:result?[result]:[]}:name==='find_references'?{references:result||[],totalReferences:result?.length||0,truncated:false}:{result})};
 },name,{signal});
}
const field=(type,extra={})=>({type,...extra}),file={filePath:field('string')},point={...file,line:field('number'),character:field('number')};
const specifications=[
 ['status',{},[], '言語サーバーの実行状態を確認する。'],
 ['diagnostics',{...file,severity:field('string',{enum:['error','warning','information','hint','all']})},['filePath'],'言語サーバーの診断を取得する。未到着はpendingとして表示する。'],
 ['goto_definition',point,['filePath','line','character'],'指定した記号の定義位置を取得する。'],
 ['find_references',{...point,includeDeclaration:field('boolean')},['filePath','line','character'],'指定した記号の参照位置を取得する。'],
 ['symbols',{...file,scope:field('string',{enum:['document','workspace']}),query:field('string'),limit:field('number')},['filePath','scope'],'ファイルまたはワークスペースの記号を検索する。'],
 ['prepare_rename',point,['filePath','line','character'],'記号の名前変更が可能か確認する。'],
 ['rename',{...point,newName:field('string')},['filePath','line','character','newName'],'DSHの更新確認を通して記号の名前を変更する。'],
 ['format',file,['filePath'],'DSHの更新確認を通してファイルを整形する。'],
 ['install_decision',{server_id:field('string'),decision:field('string',{enum:['declined','allowed']})},['server_id','decision'],'言語サーバーの導入判断を保存する。保存自体はインストールを実行しない。']
];
export const LSP_MCP_TOOLS=specifications.map(([name,properties,required,description])=>({name,aliases:['lsp_'+name],description,inputSchema:{type:'object',properties,required},execute:async(args,signal)=>{const details=await execute(name,args,signal);return {content:[{type:'text',text:JSON.stringify(details)}],details,isError:false};}}));
