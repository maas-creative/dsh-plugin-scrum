// Scrum X-search adapter using the public xAI Responses API.
import{readFileSync,existsSync}from'node:fs';import{join}from'node:path';import{homedir}from'node:os';
import{redactSecretLikeMaterial}from'./secret-filter.mjs';
export function resolveAgentHome({env=process.env}={}){return env.PI_CODING_AGENT_DIR||join(env.HOME||homedir(),'.pi','agent')}
export function hasXaiCredential({agentDir=resolveAgentHome(),env=process.env}={}){const path=join(agentDir,'auth.json');if(existsSync(path)){try{const auth=JSON.parse(readFileSync(path,'utf8')).xai;return auth?.type==='api_key'&&Boolean((auth.key||auth.apiKey)?.trim())}catch{return false}}return Boolean(env.XAI_API_KEY?.trim())}
function fail(code,message){const error=new Error(message);error.code=code;throw error}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('INVALID_DATE','Search dates must be real calendar dates in YYYY-MM-DD format');return value}
function handles(value){if(!Array.isArray(value)||value.length>20||value.some(item=>typeof item!=='string'||!/^@?[A-Za-z0-9_]{1,15}$/.test(item)))fail('INVALID_HANDLES','Search handles require at most twenty valid account names');return [...new Set(value.map(item=>item.replace(/^@/,'')))]}
async function bodyJson(response){if(!response.body)return{};const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024)fail('RESPONSE_TOO_LARGE','Search response exceeded the supported size');parts.push(value)}return JSON.parse(Buffer.concat(parts).toString('utf8'))}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}}
export function createXSearchTool({env=process.env,fetchImpl=globalThis.fetch,resolveBearer}={}){
 return{description:'Search public X posts with date and account filters. Returns source links, executed queries and provider usage.',async execute(callId,args,signal,unused,context){
  if(typeof args.query!=='string'||!args.query.trim())fail('INVALID_QUERY','Provide a nonempty search query');
  const filter={type:'x_search',enable_image_understanding:false,enable_video_understanding:false};
  for(const key of ['from_date','to_date'])if(args[key]!==undefined)filter[key]=date(args[key]);
  if(filter.from_date&&filter.to_date&&filter.from_date>filter.to_date)fail('INVALID_DATE','Search start date must precede its end date');
  for(const key of ['allowed_x_handles','excluded_x_handles'])if(args[key]!==undefined)filter[key]=handles(args[key]);
  if(filter.allowed_x_handles?.length&&filter.excluded_x_handles?.length)fail('INVALID_HANDLES','Choose either included accounts or excluded accounts');
  for(const key of ['enable_image_understanding','enable_video_understanding'])if(args[key]!==undefined){if(typeof args[key]!=='boolean')fail('INVALID_FILTER','Media search flags must be boolean');filter[key]=args[key]}
  if(args.mode!==undefined&&!['latest','top'].includes(args.mode))fail('INVALID_MODE','Search mode must be latest or top');
  const limit=args.max_results??10;if(!Number.isInteger(limit)||limit<1||limit>100)fail('INVALID_LIMIT','Search result count must be an integer from one to one hundred');
  const auth=await resolveBearer?.({modelRegistry:context?.modelRegistry});if(!auth?.bearer?.trim())fail('MISSING_CREDENTIAL','X search requires a configured xAI credential');
  const prompt=`Search X using this literal query: ${JSON.stringify(args.query.trim())}. Prefer ${args.mode==='top'?'relevant':'recent'} posts. List up to ${limit} source links with brief factual descriptions. Omit unsupported claims.`;
  let response;try{response=await fetchImpl('https://api.x.ai/v1/responses',{method:'POST',signal,headers:{authorization:'Bearer '+auth.bearer.trim(),'content-type':'application/json'},body:JSON.stringify({model:env.SCRUM_X_SEARCH_MODEL||'grok-4.20-0309-non-reasoning',input:[{role:'user',content:prompt}],tools:[filter],tool_choice:'required',max_turns:1,parallel_tool_calls:false,max_output_tokens:4000,store:false})})}catch(error){if(signal?.aborted)throw error;fail('SEARCH_TRANSPORT','X search could not reach its provider')}
  if(!response.ok){await response.body?.cancel().catch(()=>{});fail('SEARCH_HTTP','X search provider returned HTTP '+response.status)}
  let raw;try{raw=await bodyJson(response)}catch(error){if(error.code||signal?.aborted)throw error;fail('SEARCH_RESPONSE','X search provider returned invalid JSON')}
  if(raw.error)fail('SEARCH_RESPONSE','X search provider rejected the request');
  const output=Array.isArray(raw.output)?raw.output:[],texts=[],citations=[],queries=[];
  for(const item of output){if(item.type==='custom_tool_call'&&typeof item.input==='string'){try{const input=JSON.parse(item.input);if(typeof input.query==='string')queries.push(input.query)}catch{}}
   if(item.type==='message'&&Array.isArray(item.content))for(const part of item.content){if(typeof part.text==='string')texts.push(part.text);for(const cite of part.annotations||[])if(cite.type==='url_citation'&&typeof cite.url==='string')citations.push(cite)}
  }
  const text=redactSecretLikeMaterial(texts.join('\n')),seen=new Set(),results=[];
  for(const cite of citations){let url;try{url=new URL(cite.url)}catch{continue}if(url.protocol!=='https:'||!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname))continue;const id=url.pathname.match(/\/status\/(\d+)/)?.[1];if(!id||seen.has(id))continue;seen.add(id);results.push({id,url:url.href,title:redactSecretLikeMaterial(cite.title||url.href),snippet:text.split('\n').find(line=>line.includes(id))||''});if(results.length>=limit)break}
  const usage={xSearchCalls:raw.usage?.server_side_tool_usage_details?.x_search_calls??raw.usage?.server_side_tool_usage?.x_search_calls??output.filter(item=>item.type==='custom_tool_call'&&/^x_/.test(item.name||'')).length,costTicks:raw.usage?.cost_in_usd_ticks??0};
  return{content:[{type:'text',text:results.length?text:'No cited X posts were returned.'}],details:{results,queries:queries.map(query=>redactSecretLikeMaterial(query)),usage}};
 }};
}
