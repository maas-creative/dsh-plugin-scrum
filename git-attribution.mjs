import {loadScrumConfiguration} from './configuration.mjs';
export function gitAttribution(cwd){
 const footer=loadScrumConfiguration({cwd}).config.git_master?.commit_footer;
 if(footer!==true&&(typeof footer!=='string'||!footer.trim()))return undefined;
 const text=footer===true?'Assisted by Scrum HardTackle.':footer;
 return '<commit_attribution>\nUse this configured commit-body footer: '+JSON.stringify(text)+'\nPreserve the existing Git author and committer. Do not invent a Co-authored-by trailer.\n</commit_attribution>';
}
export function registerGitAttribution(ctx){ctx.on('tools/post-execute',async(exec,result,next)=>{
 const decision=await next();if(decision.kind!=='accept'||result.isError)return decision;
 const path=exec.arguments?.file_path||exec.arguments?.path||'',loaded=exec.name==='skill'&&exec.arguments?.name==='git-master'||exec.name==='read'&&path.replaceAll('\\','/').endsWith('/git-master/SKILL.md');if(!loaded)return decision;
 const directive=gitAttribution(exec.agent?.session.header.cwd||process.cwd());if(!directive)return decision;
 const content=decision.content??result.content;if(content.some(block=>block.type==='text'&&block.text.includes('<commit_attribution>')))return decision;
 return {...decision,content:[...content,{type:'text',text:directive}]};
 });}
