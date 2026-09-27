import Foundation

@main
struct IosWebSocketProbe {
  static func main() async {
    guard CommandLine.arguments.count == 3,
      let port = Int(CommandLine.arguments[1]), (1...65535).contains(port),
      let timeout = Double(CommandLine.arguments[2]), [15.0, 180.0].contains(timeout)
    else { exit(2) }
    FileHandle.standardError.write(Data("PROBE_STARTED\n".utf8))

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = timeout
    configuration.httpCookieStorage = nil
    configuration.urlCredentialStorage = nil
    let session = URLSession(configuration: configuration)
    let socket = session.webSocketTask(with: URL(string: "ws://127.0.0.1:\(port)/")!)
    defer {
      socket.cancel(with: .normalClosure, reason: nil)
      session.invalidateAndCancel()
    }
    var firstReceived = false
    var started = ProcessInfo.processInfo.systemUptime
    var report: [String: Any] = ["requestTimeoutSeconds": timeout]
    #if targetEnvironment(simulator)
      report["platform"] = "ios-simulator"
    #else
      report["platform"] = "not-simulator"
    #endif
    socket.resume()
    do {
      let first = try await socket.receive()
      guard case .data(let data) = first, data == Data([1]) else { exit(3) }
      firstReceived = true
      FileHandle.standardError.write(Data("PROBE_FIRST_FRAME\n".utf8))
      started = ProcessInfo.processInfo.systemUptime
      let second = try await socket.receive()
      guard case .data(let data) = second, data == Data([2]) else { exit(3) }
      report["secondFrameReceived"] = true
    } catch {
      let error = error as NSError
      report["secondFrameReceived"] = false
      report["urlErrorCode"] = error.domain == NSURLErrorDomain ? error.code : 0
    }
    report["firstFrameReceived"] = firstReceived
    report["idleSeconds"] = ProcessInfo.processInfo.systemUptime - started
    guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]),
      let output = String(data: data, encoding: .utf8)
    else { exit(4) }
    print(output)
    fflush(stdout)
    exit(0)
  }
}
