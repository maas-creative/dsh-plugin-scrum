// Host code is independently written; catalog inputs are separately licensed Apache-2.0 metadata.
import {readFileSync,constants} from 'node:fs';
import {access,stat} from 'node:fs/promises';
import {resolve,join,isAbsolute,delimiter,basename,extname} from 'node:path';
const catalog=JSON.parse(readFileSync(new URL('../vendor/lsp-registry/servers.json',import.meta.url),'utf8'));
const recipes=JSON.parse(readFileSync(new URL('../vendor/lsp-registry/recipes.json',import.meta.url),'utf8'));
// Bound wrapper RTS capabilities: the native macOS acceptance otherwise stalled
// before initialize. Explicit user command arrays still replace this default.
export const builtinLspServers=()=>{const servers=structuredClone(catalog);servers['haskell-language-server'].command.push('+RTS','-N2','-RTS');return servers;};
export const lspInstallRecipe=name=>recipes[name]?structuredClone(recipes[name]):null;
export async function findLspExecutable(command,{cwd,env=process.env}={}){
 if(typeof command!=='string'||!command)return null;
 const paths=isAbsolute(command)||command.includes('/')||command.includes('\\')?[resolve(cwd,command)]:[join(cwd,'node_modules','.bin',command),...(env.PATH||'').split(delimiter).filter(Boolean).map(directory=>resolve(directory,command))];
 for(const path of [...new Set(paths)])try{await access(path,constants.X_OK);if((await stat(path)).isFile())return path;}catch{}
 return null;
}
export async function resolveLspCommand(settings,context){
 const candidates=[settings.command,...(settings.alternativeCommands||[])];
 for(const command of candidates){if(!Array.isArray(command)||!command.length||command.some(value=>typeof value!=='string'||!value))throw Error('Invalid LSP command array');const executable=await findLspExecutable(command[0],{cwd:context.cwd,env:{...process.env,...settings.env}});if(executable)return [executable,...command.slice(1)];}
 return null;
}

export function lspLanguageId(path){const extension=extname(path).toLowerCase();return ({'.ts':'typescript','.mts':'typescript','.cts':'typescript','.tsx':'typescriptreact','.js':'javascript','.mjs':'javascript','.cjs':'javascript','.jsx':'javascriptreact','.py':'python','.pyi':'python','.rb':'ruby','.rake':'ruby','.gemspec':'ruby','.ru':'ruby','.cs':'csharp','.fs':'fsharp','.fsi':'fsharp','.fsx':'fsharp','.fsscript':'fsharp','.ex':'elixir','.exs':'elixir','.swift':'swift','.m':'objective-c','.mm':'objective-cpp','.cc':'cpp','.cxx':'cpp','.c++':'cpp','.hpp':'cpp','.hh':'cpp','.hxx':'cpp','.h++':'cpp','.h':'c','.sh':'shellscript','.bash':'shellscript','.zsh':'shellscript','.ksh':'shellscript','.yaml':'yaml','.yml':'yaml','.ml':'ocaml','.mli':'ocaml.interface','.tex':'latex','.bib':'bibtex','.typ':'typst','.typc':'typst','.hs':'haskell','.lhs':'haskell','.kt':'kotlin','.kts':'kotlin','.jl':'julia','.clj':'clojure','.cljs':'clojure','.cljc':'clojure','.edn':'clojure','.gql':'graphql','.tf':'terraform','.tfvars':'terraform','.razor':'razor','.cshtml':'razor'})[extension]||(basename(path)==='Dockerfile'?'dockerfile':extension.slice(1));}
export const lspFileExtension=path=>basename(path)==='Dockerfile'?'.dockerfile':extname(path).toLowerCase();
