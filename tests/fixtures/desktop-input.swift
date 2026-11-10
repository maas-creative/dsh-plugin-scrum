import AppKit
import Foundation
let statePath=CommandLine.arguments[1],title=CommandLine.arguments[2]
let app=NSApplication.shared,previous=NSWorkspace.shared.frontmostApplication
app.setActivationPolicy(.accessory)
class Controller:NSObject,NSTextFieldDelegate {
 var clicks=0,dragEvents=0,replacements=0
 var scroll:NSScrollView?
 let field=NSTextField(frame:NSRect(x:30,y:40,width:400,height:30))
 func save(){let value:[String:Any]=["replacements":replacements,"clicks":clicks,"text":field.stringValue,"dragEvents":dragEvents,"scrollOffset":scroll?.contentView.bounds.origin.y ?? 0,"pid":ProcessInfo.processInfo.processIdentifier];if let data=try? JSONSerialization.data(withJSONObject:value){try? data.write(to:URL(fileURLWithPath:statePath),options:.atomic)}}
 @objc func increment(_ sender:Any){clicks+=1;save()}
 func controlTextDidChange(_ obj:Notification){save()}
}
class DragView:NSView {
 var controller:Controller?
 override func acceptsFirstMouse(for event:NSEvent?)->Bool{return true}
 override func mouseDown(with event:NSEvent){controller?.dragEvents += 1;controller?.save()}
 override func mouseDragged(with event:NSEvent){controller?.dragEvents += 1;controller?.save()}
 override func mouseUp(with event:NSEvent){controller?.dragEvents += 1;controller?.save()}
 override func draw(_ dirtyRect:NSRect){NSColor.systemBlue.setFill();bounds.fill()}
}
let controller=Controller()
let window=NSWindow(contentRect:NSRect(x:100,y:150,width:500,height:280),styleMask:[.titled,.closable],backing:.buffered,defer:false)
window.title=title;window.isReleasedWhenClosed=false
var button=NSButton(frame:NSRect(x:30,y:130,width:200,height:40));button.title="Increment acceptance counter";button.target=controller;button.action=#selector(Controller.increment(_:));button.setAccessibilityIdentifier("scrum-counter")
controller.field.delegate=controller;controller.field.setAccessibilityIdentifier("scrum-text")
let drag=DragView(frame:NSRect(x:300,y:150,width:150,height:80));drag.controller=controller
let scroll=NSScrollView(frame:NSRect(x:300,y:80,width:150,height:60));scroll.hasVerticalScroller=true;scroll.documentView=NSView(frame:NSRect(x:0,y:0,width:130,height:1000));controller.scroll=scroll
window.contentView?.addSubview(drag);window.contentView?.addSubview(scroll)
window.contentView?.addSubview(button);window.contentView?.addSubview(controller.field)
scroll.contentView.scroll(to:NSPoint(x:0,y:400));scroll.reflectScrolledClipView(scroll.contentView)
window.makeKeyAndOrderFront(nil);app.activate(ignoringOtherApps:true);controller.save()
let refresh=Timer.scheduledTimer(withTimeInterval:0.1,repeats:true){_ in controller.save()}
DispatchQueue.main.asyncAfter(deadline:.now()+0.15){previous?.activate(options:[])}
signal(SIGUSR2,SIG_IGN)
let replace=DispatchSource.makeSignalSource(signal:SIGUSR2,queue:.main)
replace.setEventHandler{
 let next=NSButton(frame:button.frame);next.title=button.title;next.target=controller;next.action=#selector(Controller.increment(_:));next.setAccessibilityIdentifier("scrum-counter")
 window.contentView?.replaceSubview(button,with:next);button=next;controller.replacements += 1;controller.save()
};replace.resume()
signal(SIGUSR1,SIG_IGN)
let restore=DispatchSource.makeSignalSource(signal:SIGUSR1,queue:.main)
restore.setEventHandler{previous?.activate(options:[])};restore.resume()
signal(SIGTERM,SIG_IGN)
let stop=DispatchSource.makeSignalSource(signal:SIGTERM,queue:.main)
stop.setEventHandler{window.close();app.terminate(nil)};stop.resume()
app.run()
