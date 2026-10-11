import {ensurePythonDependencies,ensureJavaScriptDependencies,setupUv} from './data-environment.mjs';
const [operation,...args]=process.argv.slice(2);
try{
 if(args.includes('--help')){console.log(operation==='ensure-py-deps'?'ensure-py-deps.sh [python-executable]':operation==='ensure-js-deps'?'ensure-js-deps.sh':'setup-uv: install or update official uv without modifying shell profiles');}
 else if(operation==='ensure-py-deps')console.log(ensurePythonDependencies(args[0]||'python3'));
 else if(operation==='ensure-js-deps')console.log(ensureJavaScriptDependencies());
 else if(operation==='setup-uv'){const result=await setupUv();console.log('uv ready: '+result.version+' ('+result.executable+')');}
 else throw Error('Unknown data environment operation');
}catch(error){console.error('Data environment setup failed: '+error.message);process.exitCode=1;}
