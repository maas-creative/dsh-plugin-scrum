import Foundation
import CoreGraphics
import CoreFoundation

// Independent native global emergency-stop listener. No input automation lives here.
let requiredFlags: CGEventFlags = [.maskControl, .maskAlternate, .maskCommand]
let relevantFlags: CGEventFlags = [.maskControl, .maskAlternate, .maskCommand, .maskShift, .maskSecondaryFn]
var listener: CFMachPort?
func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
}
let callback: CGEventTapCallBack = { _, type, event, _ in
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        emit(["globalLive": false, "suspended": true, "reason": "event tap disabled"])
        return Unmanaged.passUnretained(event)
    }
    if type == .keyDown && event.getIntegerValueField(.keyboardEventKeycode) == 53 && event.flags.intersection(relevantFlags) == requiredFlags {
        emit(["globalLive": true, "suspended": true, "reason": "ctrl+alt+cmd+escape"])
    }
    return Unmanaged.passUnretained(event)
}
guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly, eventsOfInterest: CGEventMask(1) << CGEventType.keyDown.rawValue, callback: callback, userInfo: nil), let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else {
    emit(["globalLive": false, "suspended": true, "reason": "native event tap unavailable"])
    exit(2)
}
listener = tap
CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)
guard CGEvent.tapIsEnabled(tap: tap) else { emit(["globalLive": false, "suspended": true]); exit(3) }
emit(["globalLive": true, "suspended": false, "hotkey": "ctrl+alt+cmd+escape"])
if CommandLine.arguments.contains("--self-test") {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: true), let up = CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: false) else { exit(4) }
        down.flags = requiredFlags; up.flags = requiredFlags
        down.post(tap: .cghidEventTap); up.post(tap: .cghidEventTap)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { CFRunLoopStop(CFRunLoopGetMain()) }
}
if !CommandLine.arguments.contains("--self-test") {
    FileHandle.standardInput.readabilityHandler = { handle in
        if handle.availableData.isEmpty {
            handle.readabilityHandler = nil
            CFRunLoopStop(CFRunLoopGetMain())
        }
    }
}
CFRunLoopRun()
CGEvent.tapEnable(tap: tap, enable: false)
CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
CFMachPortInvalidate(tap)
