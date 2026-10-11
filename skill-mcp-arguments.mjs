import {parseSkillMcpArguments,applyGrepFilter} from './independent/mcp-arguments.mjs';
export {applyGrepFilter};
export function normalizeSkillMcpArguments(input){
 const args={...input};if(args.mcp_name&&args.server_name&&args.mcp_name!==args.server_name)throw Error('Conflicting MCP server names');args.server_name=args.mcp_name||args.server_name;if(!args.server_name?.trim())throw Error('MCP server name required');
 const operations=[args.tool_name&&'tool',args.resource_name&&'resource',args.prompt_name&&'prompt'].filter(Boolean);if(operations.length>1)throw Error('Exactly one of tool_name, resource_name or prompt_name must be provided');
 if(operations.length){if(args.operation&&args.operation!==operations[0])throw Error('Conflicting MCP operation');args.operation=operations[0];}
 if(args.resource_name){if(args.uri&&args.uri!==args.resource_name)throw Error('Conflicting resource URI');args.uri=args.resource_name;}
 if(args.prompt_name)args.tool_name=args.prompt_name;
 args.arguments=parseSkillMcpArguments(args.arguments);if(Array.isArray(args.arguments))throw Error('MCP arguments must be an object');if(args.operation==='prompt')args.arguments=Object.fromEntries(Object.entries(args.arguments).map(([key,value])=>[key,String(value)]));
 if(args.mcp_name&&!args.operation)throw Error('Exactly one operation must be provided');return args;
}
export function skillMcpResult(result,grep){if(!grep)return result;const parsed=JSON.parse(result);return JSON.stringify({scrumFilteredText:applyGrepFilter(JSON.stringify(parsed,null,2),grep),scrumImages:parsed.scrumImages||[]});}
