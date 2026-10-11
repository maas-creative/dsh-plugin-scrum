// OMO pinned builtin-mcps component: lazy Context7 and grep.app, trusted overrides win.
const roles=['planner','researcher','reviewer','explore','librarian','plan-consultant','plan-reviewer','architect','designer','writer','executor','validator'];
const allowed=tools=>Object.fromEntries(roles.map(role=>[role,tools]));
export function hasContext7ApiKey(value){if(typeof value!=='string')return false;const normalized=value.trim().toLowerCase().replace(/[<>"'`]/g,'').replace(/[\s_-]+/g,' ');return normalized.length>0&&normalized!=='your api key'}
export function builtinMcps(){return {context7:{type:'http',url:'https://mcp.context7.com/mcp',enabled:true,lifecycle:'lazy',exposure:'search',bearerTokenEnv:'CONTEXT7_API_KEY',allowTools:allowed(['resolve-library-id','query-docs'])},grep_app:{type:'http',url:'https://mcp.grep.app',enabled:true,lifecycle:'lazy',exposure:'search',allowTools:allowed(['searchGitHub'])}}}
export function connectionHeaders(config,env=process.env){const headers={...config.headers};if(config.bearerTokenEnv){const value=env[config.bearerTokenEnv];if(hasContext7ApiKey(value))headers.Authorization='Bearer '+value.trim()}return headers}
