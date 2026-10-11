import Foundation
import Darwin
import AppKit
import CoreGraphics
import ApplicationServices

func output(_ value: Any) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed])
    FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([10]))
}
func windows() -> [[String: Any]] {
    guard let rows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return [] }
    let activePID = NSWorkspace.shared.frontmostApplication?.processIdentifier
    return rows.compactMap { row in
        guard let number = row[kCGWindowNumber as String] as? NSNumber, let pid = row[kCGWindowOwnerPID as String] as? NSNumber, let bounds = row[kCGWindowBounds as String] as? [String: Any], let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary) else { return nil }
        return ["id": number.stringValue, "title": row[kCGWindowName as String] as? String ?? "", "app": row[kCGWindowOwnerName as String] as? String ?? "", "pid": pid.intValue, "x": rect.origin.x, "y": rect.origin.y, "width": rect.width, "height": rect.height, "focused": false, "elevated": NSNull(), "frontmostApp": pid.int32Value == activePID, "layer": row[kCGWindowLayer as String] as? Int ?? 0]
    }
}
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}
func focusedWindow() throws -> [String: Any] {
    guard AXIsProcessTrusted(), let app = NSWorkspace.shared.frontmostApplication, let value = attribute(AXUIElementCreateApplication(app.processIdentifier), kAXFocusedWindowAttribute), CFGetTypeID(value) == AXUIElementGetTypeID() else { throw NSError(domain:"scrum.desktop",code:1) }
    let window = unsafeBitCast(value, to: AXUIElement.self)
    guard let position = attribute(window,kAXPositionAttribute), let size = attribute(window,kAXSizeAttribute), CFGetTypeID(position) == AXValueGetTypeID(), CFGetTypeID(size) == AXValueGetTypeID() else { throw NSError(domain:"scrum.desktop",code:2) }
    var point=CGPoint.zero, extent=CGSize.zero
    guard AXValueGetValue(unsafeBitCast(position,to:AXValue.self),.cgPoint,&point), AXValueGetValue(unsafeBitCast(size,to:AXValue.self),.cgSize,&extent) else { throw NSError(domain:"scrum.desktop",code:3) }
    let title = attribute(window,kAXTitleAttribute) as? String ?? ""
    let matches=windows().filter { row in
        row["pid"] as? Int == Int(app.processIdentifier) && abs((row["x"] as? CGFloat ?? .infinity)-point.x)<1 && abs((row["y"] as? CGFloat ?? .infinity)-point.y)<1 && abs((row["width"] as? CGFloat ?? .infinity)-extent.width)<1 && abs((row["height"] as? CGFloat ?? .infinity)-extent.height)<1
    }
    guard matches.count == 1, let id=matches[0]["id"] else { throw NSError(domain:"scrum.desktop",code:4) }
    return ["id":id,"app":app.localizedName ?? "","title":title,"pid":Int(app.processIdentifier),"bounds":["x":point.x,"y":point.y,"width":extent.width,"height":extent.height],"focused":true]
}
func displays() throws -> [[String: Any]] {
    var count:UInt32=0
    guard CGGetActiveDisplayList(0,nil,&count) == .success, count <= 1024 else { throw NSError(domain:"scrum.desktop",code:5) }
    var ids=[CGDirectDisplayID](repeating:0,count:Int(count))
    guard CGGetActiveDisplayList(count,&ids,&count) == .success else { throw NSError(domain:"scrum.desktop",code:6) }
    return ids.prefix(Int(count)).enumerated().map { index,id in
        let bounds=CGDisplayBounds(id),pixelsWide=CGDisplayPixelsWide(id),pixelsHigh=CGDisplayPixelsHigh(id)
        let scale=bounds.width>0 ? Double(pixelsWide)/bounds.width : 1
        return ["id":String(id),"name":"Display \(index+1)","x":bounds.origin.x,"y":bounds.origin.y,"width":bounds.width,"height":bounds.height,"scale":scale,"pixelX":bounds.origin.x*scale,"pixelY":bounds.origin.y*scale,"pixelWidth":pixelsWide,"pixelHeight":pixelsHigh,"isPrimary":id == CGMainDisplayID()]
    }
}
func children(_ element: AXUIElement) -> [AXUIElement] {
    return attribute(element,kAXChildrenAttribute) as? [AXUIElement] ?? []
}
func stringAttribute(_ element: AXUIElement, _ name: String) -> String {
    return attribute(element,name) as? String ?? ""
}
func fingerprint(_ element: AXUIElement) -> [String:String] {
    return ["nativeIdentity":String(CFHash(element)),"role":stringAttribute(element,kAXRoleAttribute),"title":stringAttribute(element,kAXTitleAttribute),"identifier":stringAttribute(element,kAXIdentifierAttribute)]
}
func processGeneration(_ pid:pid_t) throws -> String {
    var info=proc_bsdinfo()
    let size=MemoryLayout<proc_bsdinfo>.size
    guard proc_pidinfo(pid,PROC_PIDTBSDINFO,0,&info,Int32(size))==Int32(size),info.pbi_start_tvsec>0 else{throw NSError(domain:"scrum.desktop",code:56)}
    return "\(info.pbi_start_tvsec):\(info.pbi_start_tvusec)"
}
func childEdge(_ parent:AXUIElement,_ child:AXUIElement) throws -> [String:Any] {
    let values=children(parent)
    guard values.count<=10000 else{throw NSError(domain:"scrum.desktop",code:12)}
    if let index=values.firstIndex(where:{CFEqual($0,child)}){return ["attribute":kAXChildrenAttribute,"index":index]}
    var names:CFArray?
    guard AXUIElementCopyAttributeNames(parent,&names) == .success,let keys=names as? [String],keys.count<=1000 else{throw NSError(domain:"scrum.desktop",code:12)}
    for key in keys where key != kAXParentAttribute && key != kAXChildrenAttribute {
        guard let value=attribute(parent,key) else{continue}
        if CFGetTypeID(value)==AXUIElementGetTypeID(),CFEqual(value,child){return ["attribute":key]}
        if let values=value as? [AXUIElement],values.count<=10000,let index=values.firstIndex(where:{CFEqual($0,child)}){return ["attribute":key,"index":index]}
    }
    throw NSError(domain:"scrum.desktop",code:12)
}
func elementRef(_ element: AXUIElement) throws -> String {
    var pid:pid_t=0
    guard AXUIElementGetPid(element,&pid) == .success else { throw NSError(domain:"scrum.desktop",code:10) }
    let generation=try processGeneration(pid),root=AXUIElementCreateApplication(pid)
    var cursor=element,path=[[String:Any]](),visited=0
    while !CFEqual(cursor,root) {
        visited += 1;guard visited<=64,let value=attribute(cursor,kAXParentAttribute),CFGetTypeID(value)==AXUIElementGetTypeID() else{throw NSError(domain:"scrum.desktop",code:11)}
        let parent=unsafeBitCast(value,to:AXUIElement.self);path.insert(try childEdge(parent,cursor),at:0);cursor=parent
    }
    let value:[String:Any]=["v":2,"pid":Int(pid),"generation":generation,"path":path,"fingerprint":fingerprint(element)]
    let data=try JSONSerialization.data(withJSONObject:value,options:[.sortedKeys])
    guard data.count<=12000 else{throw NSError(domain:"scrum.desktop",code:12)}
    return "scrum-ax:"+data.base64EncodedString()
}
func extendedRef(_ ref:String,attribute:String,index:Int? = nil,element:AXUIElement) throws -> String {
    guard let data=Data(base64Encoded:String(ref.dropFirst(9))),var value=try JSONSerialization.jsonObject(with:data) as? [String:Any],var path=value["path"] as? [[String:Any]],path.count<64 else{throw NSError(domain:"scrum.desktop",code:57)}
    var pid:pid_t=0;guard AXUIElementGetPid(element,&pid) == .success else{throw NSError(domain:"scrum.desktop",code:10)}
    if value["pid"] as? Int != Int(pid){return try elementRef(element)}
    var edge:[String:Any]=["attribute":attribute];if let index=index{edge["index"]=index};path.append(edge);value["path"]=path;value["fingerprint"]=fingerprint(element)
    let encoded=try JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]);guard encoded.count<=12000 else{throw NSError(domain:"scrum.desktop",code:57)};return "scrum-ax:"+encoded.base64EncodedString()
}
func resolveRef(_ ref: String) throws -> AXUIElement {
    guard ref.hasPrefix("scrum-ax:"),ref.utf8.count<=16384,let data=Data(base64Encoded:String(ref.dropFirst(9))),let value=try JSONSerialization.jsonObject(with:data) as? [String:Any],value["v"] as? Int == 2,let rawPID=value["pid"] as? Int,rawPID>0,rawPID<=Int(Int32.max),let generation=value["generation"] as? String,let path=value["path"] as? [[String:Any]],path.count<=64,let expected=value["fingerprint"] as? [String:String],try processGeneration(pid_t(rawPID))==generation else{throw NSError(domain:"scrum.desktop",code:13)}
    var element=AXUIElementCreateApplication(pid_t(rawPID))
    for step in path {
        guard let name=step["attribute"] as? String,name.count<=200,let value=attribute(element,name) else{throw NSError(domain:"scrum.desktop",code:14)}
        if let index=step["index"] as? Int {guard let values=value as? [AXUIElement],values.count<=10000,index>=0,index<values.count else{throw NSError(domain:"scrum.desktop",code:14)};element=values[index]}
        else {guard CFGetTypeID(value)==AXUIElementGetTypeID() else{throw NSError(domain:"scrum.desktop",code:14)};element=unsafeBitCast(value,to:AXUIElement.self)}
    }
    guard fingerprint(element)==expected else{throw NSError(domain:"scrum.desktop",code:15)};return element
}
func describeElement(_ element: AXUIElement, reference:String? = nil) throws -> [String:Any] {
    let role=stringAttribute(element,kAXRoleAttribute)
    return ["ref":try reference ?? elementRef(element),"role":role.hasPrefix("AX") ? String(role.dropFirst(2)).lowercased() : role.lowercased(),"nativeRole":role,"title":stringAttribute(element,kAXTitleAttribute),"description":stringAttribute(element,kAXDescriptionAttribute),"enabled":attribute(element,kAXEnabledAttribute) as? Bool ?? false,"focused":attribute(element,kAXFocusedAttribute) as? Bool ?? false,"childCount":children(element).count]
}
func focusedElement() throws -> [String:Any] {
    guard AXIsProcessTrusted(), let app=NSWorkspace.shared.frontmostApplication, let value=attribute(AXUIElementCreateApplication(app.processIdentifier),kAXFocusedUIElementAttribute), CFGetTypeID(value)==AXUIElementGetTypeID() else { throw NSError(domain:"scrum.desktop",code:16) }
    return try describeElement(unsafeBitCast(value,to:AXUIElement.self))
}
func elementAt(_ x:Double,_ y:Double) throws -> [String:Any] {
    guard AXIsProcessTrusted(), x.isFinite, y.isFinite, abs(x)<=100000, abs(y)<=100000 else { throw NSError(domain:"scrum.desktop",code:17) }
    var result:AXUIElement?
    guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(),Float(x),Float(y),&result) == .success, let element=result else { throw NSError(domain:"scrum.desktop",code:18) }
    return try describeElement(element)
}
func boundedValue(_ value: CFTypeRef?, depth: Int = 0) -> Any {
    guard let value=value, depth<4 else { return NSNull() }
    if CFGetTypeID(value)==AXUIElementGetTypeID() { return (try? describeElement(unsafeBitCast(value,to:AXUIElement.self))) ?? NSNull() }
    if CFGetTypeID(value)==AXValueGetTypeID() {
        let ax=unsafeBitCast(value,to:AXValue.self)
        switch AXValueGetType(ax) {
        case .cgPoint: var p=CGPoint.zero; if AXValueGetValue(ax,.cgPoint,&p){return ["x":p.x,"y":p.y]}
        case .cgSize: var s=CGSize.zero; if AXValueGetValue(ax,.cgSize,&s){return ["width":s.width,"height":s.height]}
        case .cfRange: var r=CFRange(); if AXValueGetValue(ax,.cfRange,&r){return ["location":r.location,"length":r.length]}
        default: break
        }; return NSNull()
    }
    if let value=value as? String {return String(value.prefix(65536))}
    if let value=value as? NSNumber {return value}
    if let value=value as? URL {return value.absoluteString}
    if let value=value as? [AnyObject] {return value.prefix(500).map{boundedValue($0,depth:depth+1)}}
    return NSNull()
}
func elementBounds(_ element: AXUIElement) throws -> [String:Double] {
    guard let p=attribute(element,kAXPositionAttribute),let s=attribute(element,kAXSizeAttribute),CFGetTypeID(p)==AXValueGetTypeID(),CFGetTypeID(s)==AXValueGetTypeID() else {throw NSError(domain:"scrum.desktop",code:30)}
    var point=CGPoint.zero,size=CGSize.zero
    guard AXValueGetValue(unsafeBitCast(p,to:AXValue.self),.cgPoint,&point),AXValueGetValue(unsafeBitCast(s,to:AXValue.self),.cgSize,&size) else {throw NSError(domain:"scrum.desktop",code:31)}
    return ["x":point.x,"y":point.y,"width":size.width,"height":size.height]
}
func actionNames(_ element: AXUIElement) throws -> [String] {
    var value:CFArray?;guard AXUIElementCopyActionNames(element,&value) == .success,let result=value as? [String],result.count<=1000 else {throw NSError(domain:"scrum.desktop",code:32)};return result
}
func windowElement(_ id: String) throws -> AXUIElement {
    guard AXIsProcessTrusted(),let row=windows().first(where:{$0["id"] as? String==id}),let pid=row["pid"] as? Int else {throw NSError(domain:"scrum.desktop",code:33)}
    let app=AXUIElementCreateApplication(pid_t(pid)),candidates=attribute(app,kAXWindowsAttribute) as? [AXUIElement] ?? []
    let matches=candidates.prefix(1000).filter{candidate in
        guard let rect=try? elementBounds(candidate) else{return false}
        return ["x","y","width","height"].allSatisfy{key in abs((rect[key] ?? .infinity)-Double(row[key] as? CGFloat ?? .infinity))<1}
    }
    guard matches.count==1 else{throw NSError(domain:"scrum.desktop",code:34)};return matches[0]
}
func decodeRequest(_ encoded:String) throws -> [String:Any] {
    guard let data=Data(base64Encoded:encoded),data.count<=65536,let request=try JSONSerialization.jsonObject(with:data) as? [String:Any] else {throw NSError(domain:"scrum.desktop",code:35)};return request
}
func matchingElements(_ root: AXUIElement, query:[String:Any]) throws -> [[String:Any]] {
    let accepted:Set<String>=["role","nativeRole","title","description","text","value","identifier","enabled","focused","limit","maxDepth"]
    guard Set(query.keys).isSubset(of:accepted) else {throw NSError(domain:"scrum.desktop",code:36)}
    let limit=query["limit"] as? Int ?? 100, maxDepth=query["maxDepth"] as? Int ?? 32
    guard limit>=1,limit<=1000,maxDepth>=0,maxDepth<=64 else{throw NSError(domain:"scrum.desktop",code:37)}
    for key in ["role","nativeRole","title","description","text","value","identifier"] {if let value=query[key],!(value is String){throw NSError(domain:"scrum.desktop",code:38)}}
    for key in ["enabled","focused"] {if let value=query[key],!(value is Bool){throw NSError(domain:"scrum.desktop",code:38)}}
    var queue:[(AXUIElement,Int,String)]=[(root,0,try elementRef(root))],head=0,result=[[String:Any]](),visited=Set<String>()
    let deadline=Date().addingTimeInterval(3)
    while head<queue.count && result.count<limit {
        guard head<10000,Date()<deadline else{throw NSError(domain:"scrum.desktop",code:39)}
        let (element,depth,ref)=queue[head];head+=1
        if !visited.insert(ref).inserted{continue}
        let role=stringAttribute(element,kAXRoleAttribute),normalized=role.hasPrefix("AX") ? String(role.dropFirst(2)).lowercased():role.lowercased()
        let strings=["role":normalized,"nativeRole":role,"title":stringAttribute(element,kAXTitleAttribute),"description":stringAttribute(element,kAXDescriptionAttribute),"value":stringAttribute(element,kAXValueAttribute),"identifier":stringAttribute(element,kAXIdentifierAttribute)]
        let text=[strings["title"],strings["description"],strings["value"]].compactMap{$0}.joined(separator:" ")
        var matched=true
        for key in ["role","nativeRole","title","description","value","identifier","text"] {if let desired=query[key] as? String {let actual=key=="text" ? text:strings[key] ?? "";if key=="role" || key=="nativeRole" {matched = matched && actual.caseInsensitiveCompare(desired) == .orderedSame} else {matched = matched && actual.contains(desired)}}}
        for key in ["enabled","focused"] {if let desired=query[key] as? Bool {let actual=attribute(element,key=="enabled" ? kAXEnabledAttribute:kAXFocusedAttribute) as? Bool ?? false;matched = matched && actual==desired}}
        if matched{result.append(try describeElement(element,reference:ref))}
        if depth<maxDepth {let values=children(element);guard values.count<=10000,queue.count+values.count<=10000 else{throw NSError(domain:"scrum.desktop",code:39)};queue.append(contentsOf:try values.enumerated().map{index,child in (child,depth+1,try extendedRef(ref,attribute:kAXChildrenAttribute,index:index,element:child))})}
    };return result
}
func elementRequest(_ request:[String:Any]) throws -> Any {
    guard let ref=request["ref"] as? String,let operation=request["operation"] as? String else{throw NSError(domain:"scrum.desktop",code:40)}
    let element=try resolveRef(ref)
    switch operation {
    case "value":return boundedValue(attribute(element,kAXValueAttribute))
    case "bounds":return try elementBounds(element)
    case "actions":return try actionNames(element)
    case "window":
        var current=element,window:AXUIElement?
        for _ in 0..<64 {if stringAttribute(current,kAXRoleAttribute)==kAXWindowRole{window=current;break};guard let value=attribute(current,kAXParentAttribute),CFGetTypeID(value)==AXUIElementGetTypeID() else{break};current=unsafeBitCast(value,to:AXUIElement.self)}
        guard let target=window else{throw NSError(domain:"scrum.desktop",code:58)}
        let bounds=try elementBounds(target);var pid:pid_t=0;guard AXUIElementGetPid(target,&pid) == .success else{throw NSError(domain:"scrum.desktop",code:58)}
        let matches=windows().filter{row in row["pid"] as? Int==Int(pid) && ["x","y","width","height"].allSatisfy{key in abs((bounds[key] ?? .infinity)-Double(row[key] as? CGFloat ?? .infinity))<1}}
        guard matches.count==1,let id=matches[0]["id"] as? String else{throw NSError(domain:"scrum.desktop",code:58)};return id
    case "attributes":
        var names:CFArray?;guard AXUIElementCopyAttributeNames(element,&names) == .success,let keys=names as? [String],keys.count<=1000 else{throw NSError(domain:"scrum.desktop",code:41)}
        return Dictionary(uniqueKeysWithValues:keys.map{($0,boundedValue(attribute(element,$0)))})
    case "parent":
        guard let value=attribute(element,kAXParentAttribute),CFGetTypeID(value)==AXUIElementGetTypeID() else{return NSNull()};return try describeElement(unsafeBitCast(value,to:AXUIElement.self))
    case "children":let values=children(element);guard values.count<=1000 else{throw NSError(domain:"scrum.desktop",code:42)};return try values.enumerated().map{index,child in try describeElement(child,reference:extendedRef(ref,attribute:kAXChildrenAttribute,index:index,element:child))}
    case "setValue":
        guard let value=request["value"],value is String || value is NSNumber,!(value is NSNull) else{throw NSError(domain:"scrum.desktop",code:43)}
        guard AXUIElementSetAttributeValue(element,kAXValueAttribute as CFString,value as CFTypeRef) == .success else{throw NSError(domain:"scrum.desktop",code:44)};return ["applied":true]
    case "focus":guard AXUIElementSetAttributeValue(element,kAXFocusedAttribute as CFString,kCFBooleanTrue) == .success else{throw NSError(domain:"scrum.desktop",code:45)};return ["applied":true]
    case "perform":
        guard let action=request["action"] as? String,(try actionNames(element)).contains(action) else{throw NSError(domain:"scrum.desktop",code:46)}
        guard AXUIElementPerformAction(element,action as CFString) == .success else{throw NSError(domain:"scrum.desktop",code:47)};return ["applied":true]
    default:throw NSError(domain:"scrum.desktop",code:48)
    }
}
func windowRequest(_ request:[String:Any]) throws -> Any {
    guard let id=request["id"] as? String,let operation=request["operation"] as? String else{throw NSError(domain:"scrum.desktop",code:49)}
    let element=try windowElement(id)
    switch operation {
    case "root":return try describeElement(element)
    case "ref":
        guard let ref=request["ref"] as? String else{throw NSError(domain:"scrum.desktop",code:54)}
        let target=try resolveRef(ref);var cursor=target,inside=false
        for _ in 0..<64 {if CFEqual(cursor,element){inside=true;break};guard let parent=attribute(cursor,kAXParentAttribute),CFGetTypeID(parent)==AXUIElementGetTypeID() else{break};cursor=unsafeBitCast(parent,to:AXUIElement.self)}
        guard inside else{throw NSError(domain:"scrum.desktop",code:55)};return try describeElement(target)
    case "find":return try matchingElements(element,query:request["query"] as? [String:Any] ?? [:])
    case "ax":
        let rows=try matchingElements(element,query:["limit":request["limit"] as? Int ?? 500,"maxDepth":request["maxDepth"] as? Int ?? 8])
        return rows.map{"\($0["role"] ?? "element") \($0["ref"] ?? "") \($0["title"] ?? "")"}.joined(separator:"\n")
    case "raise":guard AXUIElementPerformAction(element,kAXRaiseAction as CFString) == .success else{throw NSError(domain:"scrum.desktop",code:50)};return ["applied":true]
    default:throw NSError(domain:"scrum.desktop",code:51)
    }
}

do {
    guard CommandLine.arguments.count >= 2 else { throw NSError(domain:"scrum.desktop",code:7) }
    switch CommandLine.arguments[1] {
    case "windows":
        let focused = try? focusedWindow()
        try output(windows().map { row in
            var value=row
            value["focused"] = focused?["id"] as? String == row["id"] as? String && focused != nil
            value.removeValue(forKey:"frontmostApp"); value.removeValue(forKey:"layer")
            return value
        })
    case "displays": try output(displays())
    case "focused-window": try output(focusedWindow())
    case "focused-element": try output(focusedElement())
    case "element-at":
        guard CommandLine.arguments.count==4, let x=Double(CommandLine.arguments[2]),let y=Double(CommandLine.arguments[3]) else { throw NSError(domain:"scrum.desktop",code:19) }
        try output(elementAt(x,y))
    case "ref":
        guard CommandLine.arguments.count==3 else { throw NSError(domain:"scrum.desktop",code:20) }
        try output(describeElement(resolveRef(CommandLine.arguments[2])))
    case "element-operation":
        guard CommandLine.arguments.count==3 else{throw NSError(domain:"scrum.desktop",code:52)}
        try output(elementRequest(decodeRequest(CommandLine.arguments[2])))
    case "window-operation":
        guard CommandLine.arguments.count==3 else{throw NSError(domain:"scrum.desktop",code:53)}
        try output(windowRequest(decodeRequest(CommandLine.arguments[2])))
    case "clipboard-read": try output(NSPasteboard.general.string(forType:.string) ?? "")
    case "clipboard-write":
        guard CommandLine.arguments.count==3, let bytes=Data(base64Encoded:CommandLine.arguments[2]),bytes.count<=65536,let text=String(data:bytes,encoding:.utf8) else { throw NSError(domain:"scrum.desktop",code:21) }
        NSPasteboard.general.clearContents()
        guard NSPasteboard.general.setString(text,forType:.string) else { throw NSError(domain:"scrum.desktop",code:22) }
        try output(["written":true])
    case "permissions": try output(["ax":AXIsProcessTrusted(),"capture":CGPreflightScreenCaptureAccess(),"input":CGPreflightPostEventAccess()])
    default: throw NSError(domain:"scrum.desktop",code:8)
    }
} catch {
    // No window titles, clipboard contents or other user data in error output.
    try? output(["error":"Native desktop observation unavailable", "code":(error as NSError).code])
    exit(1)
}
