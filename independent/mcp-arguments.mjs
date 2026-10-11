import {createHash} from 'node:crypto';
export function parseSkillMcpArguments(input){
 if(input===undefined||input===null)return {};
 let value=input;if(typeof value==='string'){value=value.trim();if(value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);value=JSON.parse(value);}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('MCP arguments must be an object');return value;
}
export function applyGrepFilter(text,pattern){let regex;try{regex=new RegExp(pattern);}catch{return text;}const lines=text.split('\n').filter(line=>regex.test(line));return lines.length?lines.join('\n'):'No lines matched the requested filter.';}
export function buildSkillMcpClientKey({sessionID,skillName,serverName},options={}){if(typeof sessionID!=='string'||!sessionID)throw Error('MCP session ID required');return sessionID+':'+createHash('sha256').update(JSON.stringify([skillName||'',serverName,options.cdpUrl||''])).digest('hex');}
export function withInjectedCdpEndpoint(config,options={}){if(!options.cdpUrl)return config;const url=new URL(options.cdpUrl);if(!['http:','https:','ws:','wss:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid CDP endpoint');if(!config.command||config.url)throw Error('CDP endpoint requires stdio MCP');const args=[...(config.args||[])];for(let i=args.length-1;i>=0;i--)if(args[i]==='--cdp-endpoint')args.splice(i,2);args.push('--cdp-endpoint',options.cdpUrl);return {...config,args};}
