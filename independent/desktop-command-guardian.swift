import Foundation
import Darwin

// The controller's stdin pipe is a lifetime lease. Children get a separate
// process group and cannot inherit the control/report descriptors.
let arguments=CommandLine.arguments
if arguments.count<3 {exit(64)}
let executable=arguments[1]
guard executable.hasPrefix("/"),let timeout=Int(arguments[2]),timeout>0,timeout<=60000 else{exit(64)}
var actions:posix_spawn_file_actions_t?=nil,attributes:posix_spawnattr_t?=nil
guard posix_spawn_file_actions_init(&actions)==0,posix_spawnattr_init(&attributes)==0 else{exit(70)}
defer{posix_spawn_file_actions_destroy(&actions);posix_spawnattr_destroy(&attributes)}
guard posix_spawn_file_actions_addopen(&actions,STDIN_FILENO,"/dev/null",O_RDONLY,0)==0,posix_spawn_file_actions_addclose(&actions,3)==0 else{exit(70)}
var defaults=sigset_t();sigemptyset(&defaults);sigaddset(&defaults,SIGTERM);sigaddset(&defaults,SIGINT)
let flags=Int16(POSIX_SPAWN_SETPGROUP|POSIX_SPAWN_SETSIGDEF)
guard posix_spawnattr_setflags(&attributes,flags)==0,posix_spawnattr_setpgroup(&attributes,0)==0,posix_spawnattr_setsigdefault(&attributes,&defaults)==0 else{exit(70)}
let argv=([executable]+Array(arguments.dropFirst(3))).map{strdup($0)}+[nil]
let env=ProcessInfo.processInfo.environment.map{strdup("\($0.key)=\($0.value)")}+[nil]
defer{for value in argv{if let value=value{free(value)}};for value in env{if let value=value{free(value)}}}
signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN)
var child:pid_t=0,argvCopy=argv,envCopy=env
let launched=argvCopy.withUnsafeMutableBufferPointer{argv in envCopy.withUnsafeMutableBufferPointer{env in executable.withCString{path in posix_spawn(&child,path,&actions,&attributes,argv.baseAddress!,env.baseAddress!)}}}
guard launched==0,child>1 else{exit(71)}
let report=String(child)+"\n";report.withCString{bytes in _=Darwin.write(3,bytes,strlen(bytes))}
let queue=DispatchQueue(label:"scrum.desktop.command-lifetime"),lock=NSLock()
var stopping=false,finished=false
func stopChild(){
    lock.lock();if stopping || finished{lock.unlock();return};stopping=true;lock.unlock()
    kill(-child,SIGTERM)
    queue.asyncAfter(deadline:.now()+0.15){lock.lock();let live = !finished;lock.unlock();if live{kill(-child,SIGKILL)}}
}
signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN)
let term=DispatchSource.makeSignalSource(signal:SIGTERM,queue:queue),interrupt=DispatchSource.makeSignalSource(signal:SIGINT,queue:queue)
term.setEventHandler{stopChild()};interrupt.setEventHandler{stopChild()};term.resume();interrupt.resume()
let timer=DispatchSource.makeTimerSource(queue:queue);timer.schedule(deadline:.now()+Double(timeout)/1000);timer.setEventHandler{stopChild()};timer.resume()
FileHandle.standardInput.readabilityHandler={handle in if handle.availableData.isEmpty{handle.readabilityHandler=nil;stopChild()}else{stopChild()}}
var status:Int32=0,result:pid_t
repeat{result=waitpid(child,&status,0)}while result == -1 && errno==EINTR
lock.lock();finished=true;lock.unlock()
// A command may fork and exit before its descendants. They still belong to the
// owned group and must not retain capture or input after this command ends.
kill(-child,SIGKILL)
FileHandle.standardInput.readabilityHandler=nil;timer.cancel();term.cancel();interrupt.cancel()
guard result==child else{exit(72)}
let code=(status & 0x7f)==0 ? (status >> 8)&0xff : 128+(status & 0x7f)
exit(code)
