import {readFile,writeFile,rename,rm} from 'node:fs/promises';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
const marker='// Scrum grep output modes use the native validated subprocess and full match parser.';
export async function installGrepCompatibility(){
 const path=createRequire(import.meta.url).resolve('@deepseek-ai/dsh-tool-fs-search'),original=await readFile(path,'utf8'),importLine='import {formatScrumGrep,validateScrumGrep} from '+JSON.stringify(new URL('./grep-output.mjs',import.meta.url).href)+';';let source=original;
 if(source.includes(marker)){
  const pattern=/^import \{formatScrumGrep,validateScrumGrep\} from "[^\n]+";/m;if(!pattern.test(source)||!source.includes('validateScrumGrep(args);'))throw Error('Incomplete DSH grep adapter');source=source.replace(pattern,importLine);
 }else{
  const begin=source.indexOf('function applyGrepTool(ctx, caps) {'),end=source.indexOf('//#endregion',begin);if(begin<0||end<0)throw Error('Unsupported DSH grep registration');let body=source.slice(begin,end);
  const replace=(old,value)=>{if(body.split(old).length!==2)throw Error('Unsupported DSH grep anchor: '+old.slice(0,60));body=body.replace(old,value);};
  replace('parameters: {','parameters: {\n\t\t\toutput_mode: {type:"string",enum:["content","files_with_matches","count"],description:"Output mode; defaults to files_with_matches."},\n\t\t\thead_limit: {type:"integer",description:"First N entries; omitted or 0 means unlimited."},');
  replace('render: (_args, value) => [{','render: (args, value) => [{');
  replace('text: formatRetainedGrep(retainGrepMatches(value.matches, caps.maxMatches, caps.maxLineBytes))','text: formatScrumGrep(args, value.matches)');
  replace('async execute(args, exec) {','async execute(args, exec) {\n\t\t\tvalidateScrumGrep(args);');
  replace('presentationMeta: (_args, value) => grepSearchMeta(retainGrepMatches(value.matches, caps.maxMatches, caps.maxLineBytes), caps.maxMetaBytes)','presentationMeta: (args, value) => ({scrumGrep:{outputMode:args.output_mode||"files_with_matches",headLimit:args.head_limit||0,matchingLines:value.matches.length}})');
  const hook=body.indexOf('\tctx.on("tools/post-execute"');if(hook<0||!body.trimEnd().endsWith('\t});\n}'))throw Error('Unsupported DSH grep spill hook');body=body.slice(0,hook)+'}\n';
  body=body.replace(/description: `Search file contents[^\n]+/, 'description: "Search file contents using native ripgrep. Modes: content, files_with_matches (default), count. head_limit=0 is unlimited. Capture/timeout failures are errors, never complete partial results.",');
  source=importLine+'\n'+marker+'\n'+source.slice(0,begin)+body+source.slice(end);
 }
 if(source===original)return {installed:false,path};const temporary=path+'.scrum-'+randomUUID()+'.tmp';try{await writeFile(temporary,source,{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}return {installed:true,path};
}
