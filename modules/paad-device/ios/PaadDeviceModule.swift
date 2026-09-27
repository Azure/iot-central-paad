import AVFoundation
import ExpoModulesCore
import Foundation

public final class PaadDeviceModule: Module {
  private let lock = NSRecursiveLock()
  private var sockets: [String: PaadSocket] = [:]
  private var destroyed = false

  public func definition() -> ModuleDefinition {
    Name("PaadDevice")
    Events("socketEvent")

    Function("connect") { (id: String, address: String, protocols: [String]) in
      self.lock.lock()
      defer { self.lock.unlock() }
      guard !self.destroyed, !id.isEmpty, self.sockets[id] == nil,
        let components = URLComponents(string: address),
        components.scheme == "wss", let host = components.host,
        host.lowercased().range(
          of: #"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:device\.)?azure-devices\.(?:net|cn|us)$"#,
          options: .regularExpression
        ) != nil,
        components.user == nil, components.password == nil, components.port == nil,
        components.fragment == nil,
        !address.unicodeScalars.contains(where: { $0.value <= 32 || $0.value == 92 }),
        // Check the original authority too: URLComponents may normalize escaped hosts.
        address.dropFirst(6).prefix(while: { $0 != "/" && $0 != "?" && $0 != "#" })
          .lowercased() == host.lowercased(),
        !protocols.isEmpty, Set(protocols).count == protocols.count,
        protocols.allSatisfy({ $0 == "mqtt" || $0 == "mqttv3.1" }),
        let url = components.url
      else {
        throw PaadSocketError()
      }
      let socket = PaadSocket(url: url, protocols: protocols) { [weak self] fields in
        guard let self else { return }
        self.lock.lock()
        defer { self.lock.unlock() }
        guard !self.destroyed, self.sockets[id] != nil else { return }
        if fields["type"] as? String == "close" {
          self.sockets.removeValue(forKey: id)
        }
        self.sendEvent("socketEvent", fields.merging(["id": id]) { _, new in new })
      }
      self.sockets[id] = socket
      socket.start()
    }

    Function("send") { (id: String, base64: String) in
      self.lock.lock()
      let socket = self.sockets[id]
      self.lock.unlock()
      guard let socket, let data = Data(base64Encoded: base64) else {
        throw PaadSocketError()
      }
      socket.send(data)
    }

    Function("close") { (id: String, code: Int, reason: String) in
      guard (code == 1000 || (3000...4999).contains(code)), reason.utf8.count <= 123 else {
        throw PaadSocketError()
      }
      self.lock.lock()
      let socket = self.sockets[id]
      self.lock.unlock()
      socket?.close(code: code, reason: reason)
    }

    AsyncFunction("hasTorch") { () -> Bool in
      guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
        return false
      }
      return device.hasTorch && device.isTorchAvailable
    }

    OnDestroy {
      self.lock.lock()
      self.destroyed = true
      let active = Array(self.sockets.values)
      self.sockets.removeAll()
      self.lock.unlock()
      active.forEach { $0.destroy() }
    }
  }
}

private struct PaadSocketError: LocalizedError {
  var errorDescription: String? { "Secure MQTT socket operation failed" }
}

private final class PaadSocket: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
  private let queue = DispatchQueue(label: "expo.modules.paaddevice.socket")
  private var session: URLSession!
  private var task: URLSessionWebSocketTask!
  private var timer: DispatchWorkItem?
  private var opened = false
  private var closing = false
  private var finished = false
  private let protocols: [String]
  private let emit: ([String: Any]) -> Void

  init(url: URL, protocols: [String], emit: @escaping ([String: Any]) -> Void) {
    self.protocols = protocols
    self.emit = emit
    super.init()
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 15
    config.httpCookieStorage = nil
    config.httpShouldSetCookies = false
    config.urlCredentialStorage = nil
    // Default system certificate and hostname validation; no challenge override.
    session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    task = session.webSocketTask(with: url, protocols: protocols)
  }

  func start() {
    queue.async {
      guard !self.finished else { return }
      self.armTimeout(seconds: 15)
      self.task.resume()
    }
  }

  func send(_ data: Data) {
    queue.async {
      guard self.opened, !self.closing, !self.finished else { return }
      self.task.send(.data(data)) { [weak self] error in
        guard error != nil, let self else { return }
        self.queue.async { self.fail() }
      }
    }
  }

  func close(code: Int, reason: String) {
    queue.async {
      guard !self.finished, !self.closing else { return }
      self.closing = true
      guard self.opened else {
        self.finish(code: 1006, clean: false)
        return
      }
      self.task.cancel(
        with: URLSessionWebSocketTask.CloseCode(rawValue: code) ?? .normalClosure,
        reason: reason.data(using: .utf8)
      )
      self.armTimeout(seconds: 5)
    }
  }

  func destroy() {
    queue.async { self.finish(code: 1006, clean: false, notify: false) }
  }

  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    // Refuse the proposed request before URLSession can forward any handshake.
    completionHandler(nil)
    queue.async { self.fail() }
  }

  func urlSession(
    _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
    didOpenWithProtocol selectedProtocol: String?
  ) {
    queue.async {
      guard !self.finished, !self.closing else { return }
      guard let selectedProtocol, self.protocols.contains(selectedProtocol) else {
        self.fail()
        return
      }
      self.timer?.cancel()
      self.timer = nil
      self.opened = true
      self.emit(["type": "open", "protocol": selectedProtocol])
      self.receive()
    }
  }

  func urlSession(
    _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?
  ) {
    queue.async {
      self.finish(code: closeCode.rawValue, clean: closeCode != .abnormalClosure)
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    queue.async {
      if error != nil { self.fail() }
      else if !self.finished { self.finish(code: 1006, clean: false) }
    }
  }

  private func receive() {
    task.receive { [weak self] result in
      guard let self else { return }
      self.queue.async {
        guard !self.finished, !self.closing else { return }
        switch result {
        case .success(.data(let data)):
          self.emit(["type": "message", "data": data.base64EncodedString()])
          self.receive()
        default:
          self.fail()
        }
      }
    }
  }

  private func armTimeout(seconds: Double) {
    timer?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard let self else { return }
      if self.closing { self.finish(code: 1006, clean: false) }
      else { self.fail() }
    }
    timer = work
    queue.asyncAfter(deadline: .now() + seconds, execute: work)
  }

  private func fail() {
    guard !finished else { return }
    emit(["type": "error"])
    finish(code: 1006, clean: false)
  }

  private func finish(code: Int, clean: Bool, notify: Bool = true) {
    guard !finished else { return }
    finished = true
    timer?.cancel()
    timer = nil
    task.cancel()
    session.invalidateAndCancel()
    if notify { emit(["type": "close", "code": code, "wasClean": clean]) }
  }
}
