import {randomUUID} from 'node:crypto';
import {IndependentDesktopSessions} from './independent/desktop-sessions.mjs';
import {loadNativeDesktopBuild,peekabooExecutable} from './independent/desktop-build-loader.mjs';
export {IndependentDesktopSessions as DesktopSessions};
export async function desktopDoctor(){
 const result={platform:process.platform,arch:process.arch,implementation:'scrum-independent',binaryPresent:false,available:false};
 if(process.platform!=='darwin'||!['arm64','x64'].includes(process.arch))return {...result,error:'Native desktop capture and input require macOS arm64 or x64'};
 let sessions;
 try{
  const build=await loadNativeDesktopBuild();const executable=peekabooExecutable();
  sessions=new IndependentDesktopSessions({peekabooPath:executable,observerPath:build.observe,stopPath:build.stop,guardianPath:build.guardian});
  const capabilities=await sessions.open(`doctor-${randomUUID()}`);
  return {...result,enginePath:build.observe,binaryPresent:true,available:true,capabilities,remediation:capabilities.capture&&capabilities.input&&capabilities.ax?null:'Grant Screen Recording and Accessibility in macOS System Settings to the responsible application; doctor does not request permissions.'};
 }catch(error){return {...result,error:error.message,remediation:'Install the optional Peekaboo dependency and build the shipped native helpers with node desktop-build.mjs. Check macOS permissions if helper startup fails.'}}
 finally{await sessions?.dispose()}
}
