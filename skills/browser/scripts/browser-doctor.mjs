import {bskDoctor} from '../runtime/omowright/index.js';
import {isMain,browserCliOptions} from './browser-cli-options.mjs';
export async function diagnoseBrowser(options={},doctor=bskDoctor) {
 return doctor({...options,waitForBrowserMs:0});
}
if(isMain(import.meta.url)) {
 try {
  const {json,help,...options}=browserCliOptions(process.argv.slice(2));
  if(help)console.log('Browser diagnosis: node browser-doctor.mjs [--browser=chrome] [--json]');
  else {
   const report=await diagnoseBrowser(options);
   console.log(json?JSON.stringify(report):JSON.stringify({ready:report.ready,cli:report.cli,daemon:report.daemon,identification:report.identification,nextStep:report.nextStep},null,2));
   if(!report.ready)process.exitCode=2;
  }
 } catch(error) {console.error(error.message);process.exitCode=1;}
}
