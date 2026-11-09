// Public DSH SDK dshBin entry. The SDK continues to own framing and compaction.
import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';

const sandbox=process.env.SCRUM_DOCKER_SANDBOX;
const executable=process.env.SCRUM_SBX_BIN;
if(!/^scrum-worker-[a-f0-9-]{36}$/.test(sandbox||'')||!isAbsolute(executable||'')){
 process.stderr.write('Scrum Docker worker has no validated sandbox binding\n');
 process.exit(125);
}
if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['--profile','sdk'])){
 process.stderr.write('Scrum Docker worker accepts only its preconfigured SDK profile\n');
 process.exit(125);
}
// No shell, host fallback, host environment forwarding, or Docker socket mount.
const child=spawn(executable,['--no-input','exec','-i',sandbox,'docker','start','--attach','--interactive','scrum-dsh'],{
 stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME},
});
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
 if(stopping)return;stopping=true;
 const stop=spawn(executable,['--no-input','stop',sandbox],{stdio:['ignore','ignore','inherit'],env:{PATH:process.env.PATH,HOME:process.env.HOME}});
 stop.once('error',()=>process.exit(125));
 stop.once('exit',code=>{if(code!==0)process.exit(125)});
});
child.once('error',()=>{process.stderr.write('Scrum Docker transport could not start\n');process.exitCode=125});
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?125:0)});
