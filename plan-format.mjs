import {normalizePlanEffort,analyzeStructuredSections,buildWarning,buildEffortWarning,isPlanFilePath} from './independent/plan-parser.mjs';
import {parsePlanChecklist} from './independent/plan-parser.mjs';
export async function planFormatHint(ctx,exec,result){
 if(result.isError||!['write','edit','hashline_edit'].includes(exec.name))return null;
 const path=exec.arguments?.filePath??exec.arguments?.file_path??exec.arguments?.path??exec.arguments?.file;
 if(typeof path!=='string'||!isPlanFilePath(path))return null;
 const fs=ctx.get('fs'),policy=ctx.get('sandboxPolicy');if(!fs||!policy)return null;
 const sandbox=policy.resolve(exec.agent?{session:exec.agent.session}:{}),target=await fs.resolve(path,{cwd:sandbox.workspaceRoot,signal:exec.signal}),stat=await fs.stat(target,exec.signal);
 if(!stat||stat.type!=='file')return null;if(stat.size>1024*1024)return 'Plan format validation skipped: plan exceeds the 1 MiB validation limit.';
 let content=await fs.readText(target,exec.signal);const hints=[],effort=normalizePlanEffort(content);
 if(effort){const written=await fs.writeText(target,effort.content,{kind:'replaceIfVersion',version:stat.version},exec.signal,sandbox);ctx.emit?.('fs/observed',target,{kind:'present',version:written.version},exec);content=effort.content;hints.push(buildEffortWarning(effort));}
 const stats=analyzeStructuredSections(content);if(stats.recognized&&(stats.hasEmptySection||stats.hasMalformedRows))hints.push(buildWarning(stats.rawCount,parsePlanChecklist(content).total,stats.hasEmptySection));
 return hints.join('\n')||null;
}
