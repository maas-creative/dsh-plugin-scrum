import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function isMain(url) {
 try{return !!process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(url)}catch{return false}
}
export function browserCliOptions(args) {
 const options={json:false,help:false};
 for(const arg of args) {
  if(arg==='--json')options.json=true;
  else if(arg==='--help')options.help=true;
  else if(arg.startsWith('--browser=')) {
   const browser=arg.slice(10);
   if(!/^[a-z][a-z0-9-]{0,40}$/.test(browser))throw Error('Invalid browser identifier');
   options.browser=browser;
  } else if(arg.startsWith('--wait-ms=')) {
   const value=arg.slice(10);
   if(!/^\d+$/.test(value)||Number(value)>180000)throw Error('Wait must be between 0 and 180000 milliseconds');
   options.waitTotalMs=Number(value);
  } else throw Error('Unknown browser option: '+arg);
 }
 return options;
}
