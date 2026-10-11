import {createRequire} from 'node:module';import {access} from 'node:fs/promises';import {constants} from 'node:fs';import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
// npm optional platform packages and @ast-grep/cli's postinstall own provisioning.
// This native adapter never substitutes text grep or downloads a runtime binary.
export async function resolveAstGrepBinary({resolvePackage=()=>require.resolve('@ast-grep/cli/package.json'),platform=process.platform}={}){
 try{const binary=join(dirname(resolvePackage()),platform==='win32'?'sg.exe':'sg');await access(binary,platform==='win32'?constants.F_OK:constants.X_OK);return binary}
 catch(error){throw Error('AST-grep unavailable for '+platform+'/'+process.arch+'. Install platform optional dependencies with npm install --include=optional @ast-grep/cli, then npm rebuild @ast-grep/cli (postinstall must be enabled). No grep fallback. Cause: '+error.message)}
}
