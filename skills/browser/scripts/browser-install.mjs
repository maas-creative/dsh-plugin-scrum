import {bskOnboard} from '../runtime/omowright/index.js';
import {isMain,browserCliOptions} from './browser-cli-options.mjs';
// Installation happens only through an explicit call, never module import.
export async function onboardBrowser(options={},onboard=bskOnboard) {
 return onboard({...options,waitTotalMs:options.waitTotalMs??180000});
}
if(isMain(import.meta.url)) {
 try {
  const {json,help,...options}=browserCliOptions(process.argv.slice(2));
  if(help)console.log('Browser setup: node browser-install.mjs [--browser=chrome] [--wait-ms=180000] [--json]. Runs official BrowserSkill onboarding; human extension consent remains required.');
  else {
   const report=await onboardBrowser({...options,onHumanStep:step=>{if(!json)console.log(step.step)}});
   console.log(JSON.stringify(report,null,json?0:2));
   if(!report.ready)process.exitCode=2;
  }
 } catch(error) {console.error(error.message);process.exitCode=1;}
}
