import {configurationAllows,loadScrumConfiguration} from './configuration.mjs';
// Read receiving-session settings at each action, including after awaited I/O.
export function sourceHookEnabled(agent,name,readConfiguration=({cwd})=>loadScrumConfiguration({cwd}).config){
 const value=readConfiguration({cwd:agent?.session?.header?.cwd||process.cwd(),agent});
 return configurationAllows(value?.config||value||{},'hooks',name);
}
