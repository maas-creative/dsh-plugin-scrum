import {detectProjectLsp,verifyProjectLsp} from './lsp-setup.mjs';
export async function runLspSetupCli(mode,args=process.argv.slice(2)){
 if(args.includes('--help')){console.log(`${mode}-lsp --cwd DIRECTORY [--config JSONC] ${mode==='verify'?'--file SOURCE':'[--file SOURCE ...] [--limit COUNT]'}`);return;}
 const input={cwd:process.cwd(),files:[],projectConfigPaths:[]};for(let i=0;i<args.length;i++){const flag=args[i],value=args[++i];if(!value||!['--cwd','--file','--config','--limit'].includes(flag))throw Error('Invalid LSP setup argument');if(flag==='--cwd')input.cwd=value;else if(flag==='--file'){input.files.push(value);input.file=value;}else if(flag==='--config')input.projectConfigPaths.push(value);else input.limit=Number(value);}
 if(!input.files.length)delete input.files;if(mode==='verify'&&input.files?.length!==1)throw Error('Verification requires exactly one --file');console.log(JSON.stringify(await(mode==='verify'?verifyProjectLsp(input):detectProjectLsp(input)),null,2));
}
