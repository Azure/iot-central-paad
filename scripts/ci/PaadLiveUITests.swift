// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// Native XCUITest harness for the CI iOS simulator lane.
//
// The harness never prints its input, never prints native error text and never
// attaches screenshots or element hierarchies. An explicitly opted-in failure
// capture stays in private runner files for encryption, never in stdout. Public output is a
// single-line record prefixed with `PAAD_XCTEST_RESULT:` whose every field is a
// fixed enumeration, a boolean or an allowlisted test identifier.

import Foundation
import XCTest

// MARK: - Fixed vocabularies

/// Milestones. Emitted with every record so an interrupted run is diagnosable.
private enum Stage: String {
  case starting
  case welcome
  case manualNavigation = "manual-navigation"
  case registrationInput = "registration-input"
  case scopeInput = "scope-input"
  case hostInput = "host-input"
  case keyInput = "key-input"
  case connecting
  case details
  case identity
  case nonce
  case submitting
  case homeTraversal = "home-traversal"
  case exploreTraversal = "explore-traversal"
  case activityTraversal = "activity-traversal"
  case terminating
  case restoring
  case restoredIdentity = "restored-identity"
  case finished
}

/// Mirrors `XCUIApplication.State` without exposing raw integers.
private enum ApplicationState: String {
  case unknown
  case notRunning = "not-running"
  case runningBackgroundSuspended = "running-background-suspended"
  case runningBackground = "running-background"
  case runningForeground = "running-foreground"
}

private enum Outcome: String {
  case inProgress = "in-progress"
  case passed
  case failed
}

/// Every failure reported by this harness. Thrown values carry no free text.
/// `deadline-exceeded` is reserved for the caller and never emitted here.
private enum Failure: String, Error {
  case configuration
  case launchFailed = "launch-failed"
  case missingElement = "missing-element"
  case ambiguousElement = "ambiguous-element"
  case notHittable = "not-hittable"
  case valueMismatch = "value-mismatch"
  case secretNotMasked = "secret-not-masked"
  case keyboardUnavailable = "keyboard-unavailable"
  case connectionTimeout = "connection-timeout"
  case submissionTimeout = "submission-timeout"
  case registryChanged = "registry-changed"
  case terminationFailed = "termination-failed"
  case restoreTimeout = "restore-timeout"
  case unexpectedIssue = "unexpected-issue"
}

/// The complete allowlist of application test identifiers this harness may name.
private enum Target: String, CaseIterable {
  case registrationManual = "registration-manual"
  case registrationBack = "registration-back"
  case formRegistrationId = "connection-registrationId"
  case formScopeId = "connection-scopeId"
  case formProvisioningHost = "connection-provisioningHost"
  case formDeviceKey = "connection-deviceKey"
  case formSubmit = "connection-submit"
  case connectionStatus = "connection-status"
  case connectionDetails = "connection-details"
  case connectionDetailsSheet = "connection-details-sheet"
  case connectionDetailsClose = "connection-details-close"
  case connectionStatusCapsule = "connection-status-capsule"
  case appBusyOverlay = "app-busy-overlay"
  case appSettings = "app-settings"
  case navigationContent = "navigation-content"
  case assignedDeviceId = "assigned-device-id"
  case assignedHub = "assigned-hub"
  case modelId = "model-id"
  case registrationId = "registration-id"
  case registryStatus = "registry-status"
  case proofNonce = "proof-nonce"
  case proofSend = "proof-send"
  case proofStatus = "proof-status"
  case tabHome = "tab-home"
  case tabExplore = "tab-explore"
  case tabActivity = "tab-activity"
  case homeNodePhone = "home-node-phone"
  case homeNodeDps = "home-node-dps"
  case homeNodeHub = "home-node-hub"
  case homeNodeAdr = "home-node-adr"
  case homePanelPhone = "home-panel-phone"
  case homePanelDps = "home-panel-dps"
  case homePanelHub = "home-panel-hub"
  case homePanelAdr = "home-panel-adr"
  case homePanelClose = "home-panel-close"
  case exploreDirectory = "explore-directory"
  case exploreTelemetry = "explore-tool-telemetry"
  case exploreProperties = "explore-tool-properties"
  case exploreImage = "explore-tool-image"
  case exploreBluetooth = "explore-tool-bluetooth"
  case exploreBack = "explore-back"
  case telemetryTool = "telemetry-tool"
  case sensorToggleAccelerometer = "sensor-toggle-accelerometer"
  case propertiesTool = "properties-tool"
  case propertyInput = "property-input-readOnlyProp"
  case propertyTechnical = "property-technical-readOnlyProp"
  case propertyName = "property-name-readOnlyProp"
  case imageUploadCard = "image-upload-card"
  case bluetoothTitle = "bluetooth-tool-title"
  case activityAll = "activity-filter-all"
  case activityIssues = "activity-filter-issues"
  case activityLatest = "activity-latest"
  case activityList = "activity-list"
  case activityDiagnostics = "activity-diagnostics"
  case activityObservations = "activity-observations"
  case logsAll = "logs-filter-all"
  case logsIssues = "logs-filter-issues"
  case logsLatest = "logs-latest"
  case logsList = "logs-list"
}

/// Fixed English application status text the user sees. Only status values that
/// the contract requires verbatim are asserted; incidental screen copy is not,
/// so presentation changes cannot destabilise this lane.
private enum AppLabel {
  static let connected = "Connected"
  static let notChecked = "Not checked"
  static let submittedLocally = "Submitted locally"
}

private enum InputPhase: String {
  case focused
  case cleared
  case typed
  case committed
  case settled
}

private enum InputElement: String {
  case missing
  case textField = "text-field"
  case secureTextField = "secure-text-field"
  case textView = "text-view"
  case other
}

private enum InputValue: String {
  case unavailable
  case nonString = "non-string"
  case empty
  case placeholder
  case exact
  case newlineSuffix = "newline-suffix"
  case whitespaceDifference = "whitespace-difference"
  case mismatch
}

private enum InteractionPhase: String {
  case waitingForHittability = "waiting-for-hittability"
  case waitingForReadiness = "waiting-for-readiness"
  case dismissingPermission = "dismissing-permission"
  case tapping
  case waitingForSheet = "waiting-for-sheet"
  case sheetVisible = "sheet-visible"
}

private enum InteractionElement: String {
  case unavailable
  case missing
  case disabled
  case notHittable = "not-hittable"
  case hittable
}

private enum PermissionAlert: String {
  case none
  case other
  case denialPresent = "denial-present"
  case denialHittable = "denial-hittable"
}

private enum PermissionSource: String {
  case alert
  case systemControl = "system-control"
}

private enum PasswordSavePrompt: String {
  case declining
  case dismissed
}

private enum ApprovedCapture: String {
  case ineligible
  case hierarchyOnly = "hierarchy-only"
  case captured
  case failed
}

private enum MatchCount: String {
  case unavailable
  case zero
  case one
  case two
  case three
  case moreThanThree = "more-than-three"
}

private enum NativeElementType: String {
  case unavailable
  case missing
  case button
  case staticText = "static-text"
  case other
}

private enum FrameVisibility: String {
  case unavailable
  case invalid
  case empty
  case outsideApp = "outside-app"
  case partlyInsideApp = "partly-inside-app"
  case insideApp = "inside-app"
}

private enum NativeIssue: String {
  case harnessFailure = "harness-failure"
  case snapshot
  case multipleMatches = "multiple-matches"
  case noMatches = "no-matches"
  case notHittable = "not-hittable"
  case timeout
  case connectionLost = "connection-lost"
  case other
}

private enum ResolutionCapture: String {
  case initial
  case ready
  case timedOut = "timed-out"
}

private enum NativeOperation: String {
  case activate
  case sheetAbsence = "sheet-absence"
  case permissionCheck = "permission-check"
  case passwordSave = "password-save"
  case matchCount = "match-count"
  case stateCheck = "state-check"
  case resolution
  case resolveElement = "resolve-element"
  case tap
  case presentation
}

private enum DetailsTapAttempt: String {
  case initial
  case permissionRetry = "permission-retry"
}

private enum ElementPresence: String {
  case unavailable
  case missing
  case present
}

private enum DetailsPresentation: String {
  case unavailable
  case closed
  case opening
  case shown
  case unknown
}

private enum CapsuleContainment: String {
  case unavailable
  case invalid
  case empty
  case outside
  case partial
  case inside
}

private enum TouchTargetSize: String {
  case unavailable
  case belowMinimum = "below-minimum"
  case meetsMinimum = "meets-minimum"
}

// MARK: - Test case configuration

private struct CaseConfig {
  let mode: String
  let provisioningHost: String
  let scopeId: String
  let registrationId: String
  let expectedDeviceId: String
  let expectedHub: String
  let nonce: String
  let modelId: String
  let deviceKey: String
}

// MARK: - Harness

final class PaadLiveUITests: XCTestCase {
  private static let appBundleIdentifier = "com.microsoft.iotpnp.ci"
  private static let springBoardBundleIdentifier = "com.apple.springboard"
  private static let maskCharacter: Character = "\u{2022}"
  /// Only these permission dialog buttons are ever pressed.
  private static let permissionDenyLabels = [
    "Don\u{2019}t Allow",
    "Don't Allow",
    "Deny",
  ]

  private enum Timeout {
    static let interactionPoll: TimeInterval = 1
    static let short: TimeInterval = 15
    static let standard: TimeInterval = 30
    static let launch: TimeInterval = 60
    static let connect: TimeInterval = 180
    static let proof: TimeInterval = 30
    static let terminate: TimeInterval = 30
  }

  private enum Scroll {
    static let forward = 6
    static let backward = 10
  }

  private enum Permission {
    static let maximumAttempts = 4
  }

  private enum Diagnostic {
    static let maximumCandidates = 3
    static let maximumObservedTargets = 16
  }

  private var app: XCUIApplication!
  private var interruption: NSObjectProtocol?

  private var mode: String?
  private var stage: Stage = .starting
  private var failureCategory: Failure?
  private var recordedFailure = false
  /// Recent distinct controls, not a whole-run coverage ledger. Flow completion
  /// depends on the direct assertions and ordered stages, never this diagnostic set.
  private var observed: [String] = []
  private var missingTarget: Target?
  private var ambiguousTarget: String?
  private var ambiguousTypes: [String] = []
  private var connected = false
  private var nonceSubmitted = false
  private var coldRestored = false
  /// Last state observed while the automation session was known healthy. Teardown
  /// reuses it instead of issuing a query that a wedged application could stall.
  private var applicationState: ApplicationState = .unknown
  /// Category applied to an XCTest-reported runtime failure raised by the
  /// interaction currently in flight.
  private var pendingCategory: Failure?
  /// Only the current synthetic, nonsecure field; at most five fixed checkpoints.
  private var inputDiagnostics: [[String: Any]] = []
  /// Cached public UI state only; record/teardown never query a failed interaction.
  private var interactionDiagnostics: [String: Any]?
  private var resolutionDiagnostics: [String: Any]?
  private var resolutionTarget: Target?
  private var nativeIssue: NativeIssue?
  private var nativeOperation: NativeOperation?
  private var detailsTapDiagnostics: [[String: Any]] = []
  private var detailsReadiness: [String: Any]?
  private var detailsControlComparisons: [[String: String]] = []
  private var detailsForeground: [String: Any]?
  private var detailsReadinessPolls = 0
  private var permissionActions: [String] = []
  private var passwordSavePrompt: PasswordSavePrompt?
  private var approvedCapture: ApprovedCapture?
  private var captureRedactionKey: String?
  private var permissionAttempts = 0
  private var permissionDismissals = 0
  private var permissionDismissed = false

  override func setUp() {
    super.setUp()
    continueAfterFailure = false
    app = XCUIApplication(bundleIdentifier: Self.appBundleIdentifier)
    app.launchArguments = []
    app.launchEnvironment = [:]
    interruption = addUIInterruptionMonitor(withDescription: "paad-permission") { [weak self] alert in
      return self?.denyPermissionAlert(alert) ?? false
    }
  }

  override func tearDown() {
    if let monitor = interruption {
      removeUIInterruptionMonitor(monitor)
      interruption = nil
    }
    // The authoritative record was already emitted by the test body; repeating
    // it here costs no automation query and survives an aborted flow.
    emitFinalResult()
    super.tearDown()
  }

  override func record(_ issue: XCTIssue) {
    recordedFailure = true
    if nativeIssue == nil {
      nativeIssue = classifyIssue(issue)
    }
    if failureCategory == nil {
      if let failure = issue.associatedError as? Failure {
        failureCategory = failure
      } else {
        failureCategory = pendingCategory ?? .unexpectedIssue
      }
    }
    emit(outcome: .failed)
    super.record(issue)
  }

  // MARK: Entry point

  func testPaadFlow() throws {
    do {
      let config = try loadConfig()
      advance(to: .starting)
      if config.mode == "live" {
        try runLive(config)
      } else {
        try runSmoke(config)
      }
    } catch let failure as Failure {
      failureCategory = failure
      recordedFailure = true
      emit(outcome: .failed)
      throw failure
    }
  }

  // MARK: Flows

  private func runSmoke(_ config: CaseConfig) throws {
    try launchApp()
    try requireWelcome(timeout: Timeout.launch)

    try openManualForm()
    try requireExists(.formRegistrationId, timeout: Timeout.standard)

    try tap(.registrationBack)
    try requireWelcome(timeout: Timeout.standard)

    try openManualForm()
    try enterCredentials(config)

    // Deliberately invalid fixtures: the submit control is inspected, never pressed.
    try requireExists(.formSubmit, timeout: Timeout.standard)

    try tap(.registrationBack)
    try requireWelcome(timeout: Timeout.standard)

    try terminateApp()
    try relaunchApp()
    try requireWelcome(timeout: Timeout.launch)
    // `coldRestored` is reserved for the live proof; smoke reports stages only.
    advance(to: .restoring)

    try terminateApp()
    advance(to: .finished, queryingState: false)
    emitFinalResult()
  }

  private func runLive(_ config: CaseConfig) throws {
    if ProcessInfo.processInfo.environment["PAAD_XCTEST_CAPTURE"] == "1" {
      captureRedactionKey = config.deviceKey
    }
    try launchApp()
    try requireWelcome(timeout: Timeout.launch)

    try openManualForm()
    try requireExists(.formRegistrationId, timeout: Timeout.standard)
    try tap(.registrationBack)
    try requireWelcome(timeout: Timeout.standard)

    try openManualForm()
    try enterCredentials(config)

    try tap(.formSubmit)
    advance(to: .connecting)

    try waitForConnected(total: Timeout.connect)
    connected = true
    advance(to: .connecting)

    try openDetails()
    try requireIdentity(config)

    try enterExactText(.proofNonce, text: config.nonce)
    advance(to: .nonce)

    try tap(.proofSend)
    try requireExactText(
      .proofStatus, text: AppLabel.submittedLocally,
      timeout: Timeout.proof, failure: .submissionTimeout)
    nonceSubmitted = true
    advance(to: .submitting)

    try requireExactText(
      .registryStatus, text: AppLabel.notChecked,
      timeout: Timeout.short, failure: .registryChanged)
    advance(to: .submitting)

    try tap(.connectionDetailsClose)
    try traverseExperience()

    try terminateApp()
    try relaunchApp()

    try waitForConnected(total: Timeout.connect)
    // Saved credentials must restore without returning to onboarding.
    try waitFor(
      NSPredicate(format: "exists == false"),
      on: element(.registrationManual),
      timeout: Timeout.standard,
      failure: .restoreTimeout)
    coldRestored = true
    advance(to: .restoring)

    try openDetails()
    try requireIdentity(config)
    advance(to: .restoredIdentity)

    try tap(.connectionDetailsClose)
    try traverseHome()

    try terminateApp()
    advance(to: .finished, queryingState: false)
    emitFinalResult()
  }

  // MARK: Flow steps

  private func traverseExperience() throws {
    try traverseHome()
    advance(to: .exploreTraversal)
    try tapExperience(.tabExplore)
    try requireVisible(.exploreDirectory)
    for tool in [Target.exploreTelemetry, .exploreProperties, .exploreImage, .exploreBluetooth] {
      try requireVisible(tool)
    }

    try tapExperience(.exploreTelemetry)
    try requireVisible(.telemetryTool)
    // Inspect the real enable control without changing the phone's sensor intent.
    try requireVisible(.sensorToggleAccelerometer)
    try tapExperience(.exploreBack)
    try requireVisible(.exploreDirectory)

    try tapExperience(.exploreProperties)
    try requireVisible(.propertiesTool)
    try requireVisible(.propertyInput)
    try tapExperience(.propertyTechnical)
    try requireExactText(.propertyName, text: "readOnlyProp")
    try tapExperience(.propertyTechnical)
    let propertyDraft = "paad-unsent-draft"
    try enterExactText(.propertyInput, text: propertyDraft)
    try tapExperience(.exploreBack)
    try requireVisible(.exploreDirectory)

    try tapExperience(.exploreImage)
    // Do not open personal media or start an upload in the traversal.
    try requireVisible(.imageUploadCard)
    try tapExperience(.exploreBack)
    try requireVisible(.exploreDirectory)

    try tapExperience(.exploreProperties)
    try requireExactText(.propertyInput, text: propertyDraft)
    try tapExperience(.exploreBack)
    try requireVisible(.exploreDirectory)

    try tapExperience(.exploreBluetooth)
    dismissKnownPermissionAlert()
    try requireVisible(.bluetoothTitle)
    try requireExactText(.bluetoothTitle, text: "Nearby devices")
    try tapExperience(.exploreBack)
    try requireVisible(.exploreDirectory)

    advance(to: .activityTraversal)
    try tapExperience(.tabActivity)
    try tapExperience(.activityIssues)
    try tapExperience(.activityAll)
    try requireExactText(.connectionStatus, text: AppLabel.connected)
    try tapExperience(.activityLatest)
    try inspectDetail(in: .activityList, togglePrefix: "activity-toggle-", detailPrefix: "activity-details-")
    try tapExperience(.activityDiagnostics)
    try requireVisible(.logsList)
    try tapExperience(.logsIssues)
    try tapExperience(.logsAll)
    try tapExperience(.logsLatest)
    try inspectDetail(in: .logsList, togglePrefix: "log-toggle-", detailPrefix: "log-payload-")
    try tapExperience(.activityObservations)
    try requireVisible(.activityAll)
    try tapExperience(.tabHome)
    try requireVisible(.homeNodePhone)
    try requireExactText(.connectionStatus, text: AppLabel.connected)
  }

  private func traverseHome() throws {
    advance(to: .homeTraversal)
    try tapExperience(.tabHome)
    let nodes: [(Target, Target)] = [
      (.homeNodePhone, .homePanelPhone), (.homeNodeDps, .homePanelDps),
      (.homeNodeHub, .homePanelHub), (.homeNodeAdr, .homePanelAdr),
    ]
    for (node, panel) in nodes {
      try tapExperience(node)
      try requireVisible(panel)
      try requireVisible(.homePanelClose)
      try tapExperience(.homePanelClose)
      try waitFor(
        NSPredicate(format: "exists == false"), on: element(.homePanelClose),
        timeout: Timeout.short, failure: .unexpectedIssue)
      try requireVisible(node)
    }
  }

  @discardableResult
  private func requireVisible(_ target: Target) throws -> XCUIElement {
    _ = try find(target, timeout: Timeout.standard)
    let query = app.descendants(matching: .any).matching(identifier: target.rawValue)
    try requireUnique(query, target: target)
    return try hittable(query.element)
  }

  private func requireUnique(_ query: XCUIElementQuery, target: Target) throws {
    // Native navigation may briefly retain both outgoing and incoming headers.
    // Wait for uniqueness; never select an arbitrary match from a duplicate set.
    let expectation = XCTNSPredicateExpectation(
      predicate: NSPredicate { _, _ in query.count == 1 }, object: query)
    let settled = XCTWaiter().wait(for: [expectation], timeout: Timeout.short)
    guard settled == .completed, query.count == 1 else {
      ambiguousTarget = target.rawValue
      pendingCategory = .ambiguousElement
      for index in 0..<min(query.count, Diagnostic.maximumCandidates) {
        let type: NativeElementType
        switch query.element(boundBy: index).elementType {
        case .button: type = .button
        case .staticText: type = .staticText
        default: type = .other
        }
        ambiguousTypes.append(type.rawValue)
      }
      throw Failure.ambiguousElement
    }
  }

  private func tapExperience(_ target: Target) throws {
    let control = try requireVisible(target)
    guard control.isEnabled else { throw Failure.notHittable }
    pendingCategory = .notHittable
    control.tap()
    pendingCategory = nil
  }

  private func inspectDetail(in target: Target, togglePrefix: String, detailPrefix: String) throws {
    let list = try requireVisible(target)
    let toggles = list.descendants(matching: .button).matching(NSPredicate(
      format: "identifier MATCHES %@", "^" + togglePrefix + "[0-9]+$"))
    guard toggles.firstMatch.waitForExistence(timeout: Timeout.standard) else { throw Failure.missingElement }
    let count = toggles.count
    guard count > 0 else { throw Failure.missingElement }
    // Latest has moved to the end. Inspect a recent row, not the offscreen
    // telemetry header whose identifier changes with every submission.
    let recent = toggles.element(boundBy: count - 1)
    _ = try hittable(recent, scrolling: list)
    let toggle = list.descendants(matching: .button).matching(identifier: recent.identifier).element
    let suffix = String(toggle.identifier.dropFirst(togglePrefix.count))
    let payload = list.descendants(matching: .any).matching(identifier: detailPrefix + suffix).element
    pendingCategory = .notHittable
    toggle.tap()
    pendingCategory = nil
    guard payload.waitForExistence(timeout: Timeout.short) else { throw Failure.missingElement }
    _ = try hittable(payload, scrolling: list)
    // Only presence is inspected. Never read or export diagnostic text.
    _ = try hittable(toggle, scrolling: list)
    pendingCategory = .notHittable
    toggle.tap()
    pendingCategory = nil
    try waitFor(
      NSPredicate(format: "exists == false"), on: payload,
      timeout: Timeout.short, failure: .unexpectedIssue)
  }

  private func launchApp() throws {
    // The runner's environment is never forwarded to the application: it must
    // reach every screen through ordinary UI, with no launch-time shortcut.
    app.launchArguments = []
    app.launchEnvironment = [:]
    pendingCategory = .launchFailed
    app.activate()
    pendingCategory = nil
    guard app.wait(for: .runningForeground, timeout: Timeout.launch) else {
      throw Failure.launchFailed
    }
    applicationState = .runningForeground
    advance(to: .starting, queryingState: false)
  }

  private func relaunchApp() throws {
    // Same empty launch context as the first launch; the cold restore must rely
    // solely on data the application itself saved.
    app.launchArguments = []
    app.launchEnvironment = [:]
    guard app.state == .notRunning else {
      throw Failure.terminationFailed
    }
    pendingCategory = .launchFailed
    app.activate()
    pendingCategory = nil
    guard app.wait(for: .runningForeground, timeout: Timeout.launch) else {
      throw Failure.launchFailed
    }
    applicationState = .runningForeground
    advance(to: .restoring, queryingState: false)
  }

  private func terminateApp() throws {
    app.terminate()
    guard app.wait(for: .notRunning, timeout: Timeout.terminate) else {
      throw Failure.terminationFailed
    }
    // The state is proven by the wait above, so no further query is needed and
    // the closing records cannot stall on a stopped application.
    applicationState = .notRunning
    advance(to: .terminating, queryingState: false)
  }

  private func requireWelcome(timeout: TimeInterval) throws {
    try requireExists(.registrationManual, timeout: timeout)
    advance(to: .welcome)
  }

  private func openManualForm() throws {
    try tap(.registrationManual)
    try requireExists(.formRegistrationId, timeout: Timeout.standard)
    advance(to: .manualNavigation)
  }

  private func enterCredentials(_ config: CaseConfig) throws {
    // Each field is verified through the element resolved by the entry helper,
    // so a screen costs one element lookup rather than two snapshots.
    try enterExactText(.formRegistrationId, text: config.registrationId)
    advance(to: .registrationInput)

    try enterExactText(.formScopeId, text: config.scopeId)
    advance(to: .scopeInput)

    let host = try enterExactText(.formProvisioningHost, text: config.provisioningHost)
    advance(to: .hostInput)

    try enterSecret(.formDeviceKey, secret: config.deviceKey)

    // The endpoint must survive focusing the secure field.
    try requireExactValue(on: host, text: config.provisioningHost, failure: .valueMismatch)
    advance(to: .keyInput)
  }

  private func prepareDetailsForeground() throws {
    detailsForeground = [
      "before": ApplicationState.unknown.rawValue,
      "after": ApplicationState.unknown.rawValue,
      "activationRequested": false,
    ]
    pendingCategory = .launchFailed
    nativeOperation = .stateCheck
    refreshApplicationState()
    detailsForeground?["before"] = applicationState.rawValue
    switch applicationState {
    case .runningForeground:
      break
    case .runningBackground, .runningBackgroundSuspended:
      detailsForeground?["activationRequested"] = true
      nativeOperation = .activate
      app.activate()
      guard app.wait(for: .runningForeground, timeout: Timeout.launch) else {
        throw Failure.launchFailed
      }
    default:
      // Never hide a stopped or unqueryable application by relaunching it here.
      throw Failure.launchFailed
    }
    nativeOperation = .stateCheck
    refreshApplicationState()
    detailsForeground?["after"] = applicationState.rawValue
    guard applicationState == .runningForeground else { throw Failure.launchFailed }
    pendingCategory = nil
  }

  private func openDetails() throws {
    detailsTapDiagnostics = []
    detailsReadiness = nil
    detailsControlComparisons = []
    try prepareDetailsForeground()
    nativeOperation = .sheetAbsence
    try waitFor(
      NSPredicate(format: "exists == false"),
      on: element(.connectionDetailsSheet),
      timeout: Timeout.standard,
      failure: .unexpectedIssue)
    let control = try waitForDetailsTarget(
      .connectionDetails, phase: .waitingForReadiness, failure: .notHittable)
    let interrupted = try tapDetails(control, attempt: .initial)
    // A handled permission interruption can consume the original interaction.
    // Retry once only when that happened and the sheet is still absent.
    if interrupted && !element(.connectionDetailsSheet).waitForExistence(timeout: Timeout.short) {
      if !diagnoseDetailsPresentation() {
        let retryControl = try waitForDetailsTarget(
          .connectionDetails, phase: .waitingForReadiness, failure: .notHittable)
        _ = try tapDetails(retryControl, attempt: .permissionRetry)
      }
    }
    _ = try waitForDetailsTarget(
      .connectionDetailsSheet, phase: .waitingForSheet, failure: .missingElement)
    interactionDiagnostics?["phase"] = InteractionPhase.sheetVisible.rawValue
    nativeOperation = nil
    advance(to: .details)
  }

  @discardableResult
  private func tapDetails(_ control: XCUIElement, attempt: DetailsTapAttempt) throws -> Bool {
    let dismissalsBeforeTap = permissionDismissals
    pendingCategory = .notHittable
    nativeOperation = .stateCheck
    let targetState = interactionState(control)
    detailsTapDiagnostics.append([
      "attempt": attempt.rawValue,
      "targetState": targetState.rawValue,
      "completed": false,
      "permissionHandled": false,
      "sheet": ElementPresence.unavailable.rawValue,
      "close": ElementPresence.unavailable.rawValue,
      "identity": ElementPresence.unavailable.rawValue,
      "presentation": DetailsPresentation.unavailable.rawValue,
      "postTapState": InteractionElement.unavailable.rawValue,
      "laterTargetState": InteractionElement.unavailable.rawValue,
    ])
    let index = detailsTapDiagnostics.count - 1
    if let detailsReadiness = detailsReadiness {
      detailsTapDiagnostics[index]["readiness"] = detailsReadiness
    }
    // Diagnostic queries take time; do not tap a target that lost readiness.
    guard targetState == .hittable else { throw Failure.notHittable }
    interactionDiagnostics?["phase"] = InteractionPhase.tapping.rawValue
    nativeOperation = .tap
    emit(outcome: .inProgress)
    control.tap()
    pendingCategory = nil
    let interrupted = permissionDismissals > dismissalsBeforeTap
    detailsTapDiagnostics[index]["completed"] = true
    detailsTapDiagnostics[index]["permissionHandled"] = interrupted
    nativeOperation = .stateCheck
    detailsTapDiagnostics[index]["postTapState"] = interactionState(control).rawValue
    return interrupted
  }

  @discardableResult
  private func diagnoseDetailsPresentation() -> Bool {
    nativeOperation = .presentation
    let index = detailsTapDiagnostics.count - 1
    let sheet = element(.connectionDetailsSheet).exists
    detailsTapDiagnostics[index]["sheet"] =
      (sheet ? ElementPresence.present : .missing).rawValue
    let markers: [(String, Target)] = [
      ("close", .connectionDetailsClose), ("identity", .assignedDeviceId),
    ]
    for (key, target) in markers {
      detailsTapDiagnostics[index][key] =
        (element(target).exists ? ElementPresence.present : .missing).rawValue
    }
    detailsTapDiagnostics[index]["presentation"] = detailsPresentation().rawValue
    let query = app.buttons.matching(identifier: Target.connectionDetails.rawValue)
    if query.count <= 1 {
      detailsTapDiagnostics[index]["laterTargetState"] = interactionState(query.firstMatch).rawValue
    } else {
      detailsTapDiagnostics[index]["laterTargetState"] = InteractionElement.unavailable.rawValue
    }
    return sheet
  }

  private func detailsPresentation() -> DetailsPresentation {
    // RN maps the button's ordinary busy/expanded accessibility states to value.
    // Read only this fixed button; never publish the native value itself.
    let query = app.buttons.matching(identifier: Target.connectionDetails.rawValue)
    guard query.count == 1 else { return .unavailable }
    let value = query.element.value
    if value == nil { return .closed }
    guard let text = value as? String else { return .unknown }
    switch text {
    case "": return .closed
    case "busy": return .opening
    case "expanded": return .shown
    default: return .unknown
    }
  }

  private func waitForDetailsTarget(
    _ target: Target, phase: InteractionPhase, failure: Failure
  ) throws -> XCUIElement {
    if target == .connectionDetails {
      detailsControlComparisons = []
      detailsReadinessPolls = 0
    }
    // Details is a fixed header, not scroll content. Give navigation, the busy
    // overlay and asynchronous sensor permission dialogs time to settle.
    // SummaryAction declares an accessible button. A type-erased first match
    // could instead resolve a wrapper or conceal duplicate navigation elements.
    let query = target == .connectionDetails
      ? app.buttons.matching(identifier: target.rawValue)
      : app.descendants(matching: .any).matching(identifier: target.rawValue)
    let field = query.firstMatch
    pendingCategory = failure
    nativeOperation = .permissionCheck
    dismissKnownPermissionAlert()
    if target == .connectionDetails {
      _ = try dismissPasswordSaveSheet()
    }
    nativeOperation = .stateCheck
    updateInteraction(target, field: field, phase: phase)
    emit(outcome: .inProgress)
    if target == .connectionDetails {
      compareDetailsControls(.initial)
    }
    nativeOperation = .resolution
    diagnoseResolution(target, field: field, query: query, capture: .initial)
    // Diagnostic snapshots can take native waits of their own. They must not
    // exhaust the actionable-readiness window before its first poll.
    var deadline = ProcessInfo.processInfo.systemUptime + Timeout.standard
    var handledPermissions = permissionDismissals
    while ProcessInfo.processInfo.systemUptime < deadline {
      if target == .connectionDetails {
        detailsReadinessPolls += 1
      }
      // Native queries can perform their own waits. Keep them outside an XCTest
      // predicate callback, and explicitly handle only known permission denials.
      nativeOperation = .permissionCheck
      dismissKnownPermissionAlert()
      if target == .connectionDetails, try dismissPasswordSaveSheet() {
        deadline = ProcessInfo.processInfo.systemUptime + Timeout.standard
      }
      nativeOperation = .matchCount
      let unique = query.count == 1
      nativeOperation = .stateCheck
      if updateInteraction(target, field: field, phase: phase) && unique {
        if target == .connectionDetails {
          compareDetailsControls(.ready)
        }
        nativeOperation = .resolution
        diagnoseResolution(target, field: field, query: query, capture: .ready)
        pendingCategory = nil
        observe(target)
        // Unlike firstMatch, element also fails if ambiguity appears at tap time.
        nativeOperation = .resolveElement
        return query.element
      }
      if permissionDismissals > handledPermissions {
        // Only a completed denial action replenishes the settling window;
        // the shared four-attempt budget bounds this across the whole flow.
        handledPermissions = permissionDismissals
        deadline = ProcessInfo.processInfo.systemUptime + Timeout.standard
      }
      let remaining = deadline - ProcessInfo.processInfo.systemUptime
      if remaining > 0 {
        Thread.sleep(forTimeInterval: min(Timeout.interactionPoll, remaining))
      }
    }
    if target == .connectionDetails {
      compareDetailsControls(.timedOut)
    }
    nativeOperation = .resolution
    diagnoseResolution(target, field: field, query: query, capture: .timedOut)
    nativeOperation = .matchCount
    let ambiguous = query.count > 1
    if ambiguous {
      throw Failure.ambiguousElement
    }
    if target == .connectionDetails {
      captureApprovedFailure()
    }
    throw failure
  }

  private func requireIdentity(_ config: CaseConfig) throws {
    try requireExactText(.assignedDeviceId, text: config.expectedDeviceId)
    try requireExactText(.assignedHub, text: config.expectedHub)
    try requireExactText(.modelId, text: config.modelId)
    try requireExactText(.registrationId, text: config.registrationId)
    try requireExactText(
      .registryStatus, text: AppLabel.notChecked,
      timeout: Timeout.short, failure: .registryChanged)
    advance(to: .identity)
  }

  private func waitForConnected(total: TimeInterval) throws {
    // The status row only mounts once the cloud session is established, so the
    // wait covers appearance and the exact label together.
    let status = element(.connectionStatus)
    let predicate = NSPredicate(
      format: "exists == true AND (label == %@ OR value == %@)",
      AppLabel.connected, AppLabel.connected)
    let firstSlice = total / 2
    let first = XCTNSPredicateExpectation(predicate: predicate, object: status)
    if XCTWaiter().wait(for: [first], timeout: firstSlice) != .completed {
      // A permission dialog may be blocking the transition. A readable status
      // alone does not prove that the Details control is ready for interaction.
      dismissKnownPermissionAlert()
      let second = XCTNSPredicateExpectation(predicate: predicate, object: status)
      guard XCTWaiter().wait(for: [second], timeout: total - firstSlice) == .completed else {
        throw Failure.connectionTimeout
      }
    }
    observe(.connectionStatus)
  }

  // MARK: Element helpers

  private func element(_ target: Target) -> XCUIElement {
    // Application test identifiers land on several native classes, so match any.
    return app.descendants(matching: .any).matching(identifier: target.rawValue).firstMatch
  }

  private func observe(_ target: Target) {
    // Earlier milestones are already emitted. Keep the current record bounded
    // as traversal grows, without dropping proof or restoration assertions.
    if let index = observed.firstIndex(of: target.rawValue) {
      observed.remove(at: index)
    }
    observed.append(target.rawValue)
    if observed.count > Diagnostic.maximumObservedTargets {
      observed.removeFirst()
    }
  }

  private func waitFor(
    _ predicate: NSPredicate, on object: Any, timeout: TimeInterval, failure: Failure
  ) throws {
    // A bare waiter reports the timeout to this harness instead of recording a
    // test failure that would echo the predicate.
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: object)
    guard XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed else {
      throw failure
    }
  }

  @discardableResult
  private func find(_ target: Target, timeout: TimeInterval) throws -> XCUIElement {
    let candidate = element(target)
    if candidate.waitForExistence(timeout: timeout) {
      observe(target)
      return candidate
    }
    // Bounded scroll search; long screens place controls outside the viewport.
    for _ in 0..<Scroll.forward {
      app.swipeUp()
      if candidate.exists {
        observe(target)
        return candidate
      }
    }
    for _ in 0..<Scroll.backward {
      app.swipeDown()
      if candidate.exists {
        observe(target)
        return candidate
      }
    }
    missingTarget = target
    throw Failure.missingElement
  }

  @discardableResult
  private func requireExists(_ target: Target, timeout: TimeInterval) throws -> XCUIElement {
    return try find(target, timeout: timeout)
  }

  private func hittable(
    _ candidate: XCUIElement, scrolling container: XCUIElement? = nil
  ) throws -> XCUIElement {
    let scroll: XCUIElement = container ?? app
    if candidate.isHittable {
      return candidate
    }
    for _ in 0..<Scroll.forward {
      scroll.swipeUp()
      if candidate.isHittable {
        return candidate
      }
    }
    for _ in 0..<Scroll.backward {
      scroll.swipeDown()
      if candidate.isHittable {
        return candidate
      }
    }
    throw Failure.notHittable
  }

  private func tap(_ target: Target) throws {
    let found = try find(target, timeout: Timeout.standard)
    let control = try hittable(found)
    pendingCategory = .notHittable
    control.tap()
    pendingCategory = nil
  }

  /// Verifies an already-resolved element so callers avoid a second lookup.
  private func requireExactValue(
    on field: XCUIElement, text: String, failure: Failure
  ) throws {
    // A format predicate echoes its expected value in XCTest's progress log.
    // Keep exact equality, but do not give the waiter a printable input value.
    try waitFor(
      NSPredicate { _, _ in (field.value as? String) == text },
      on: NSNull(), timeout: Timeout.short, failure: failure)
  }

  private func requireExactText(
    _ target: Target, text: String, timeout: TimeInterval = Timeout.short,
    failure: Failure = .valueMismatch
  ) throws {
    let found = try hittable(find(target, timeout: timeout))
    try waitFor(
      NSPredicate(format: "label == %@ OR value == %@", text, text),
      on: found, timeout: timeout, failure: failure)
  }

  // MARK: Text entry

  private func focusField(_ target: Target) throws -> XCUIElement {
    let found = try find(target, timeout: Timeout.standard)
    let field = try hittable(found)
    pendingCategory = .notHittable
    field.tap()
    pendingCategory = nil
    // Focus is proven by a live keyboard plus, after typing, by the field's own
    // value. Both are public attributes and neither echoes the typed text.
    try waitFor(
      NSPredicate(format: "exists == true"),
      on: app.keyboards.firstMatch, timeout: Timeout.short, failure: .keyboardUnavailable)
    return field
  }

  private func clearField(_ field: XCUIElement) {
    guard let current = field.value as? String, !current.isEmpty else {
      return
    }
    // An empty native field reports its placeholder, which must not be deleted.
    if let placeholder = field.placeholderValue, placeholder == current {
      return
    }
    pendingCategory = .notHittable
    field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
    pendingCategory = nil
  }

  private func commitField(_ field: XCUIElement) throws {
    pendingCategory = .notHittable
    field.typeText("\n")
    pendingCategory = nil
    // blurAndSubmit/Keyboard.dismiss can finish after the Return keystroke.
    // Do not let that dismissal race the next field's focus.
    try waitFor(
      NSPredicate(format: "exists == false"),
      on: app.keyboards.firstMatch, timeout: Timeout.short, failure: .keyboardUnavailable)
  }

  private func typeCharacters(_ text: String, into field: XCUIElement) {
    // Each public XCTest typing action waits for UI idleness. Avoid one burst
    // racing the controlled input's native/JavaScript updates.
    pendingCategory = .notHittable
    for character in text {
      field.typeText(String(character))
    }
    pendingCategory = nil
  }

  @discardableResult
  private func enterExactText(_ target: Target, text: String) throws -> XCUIElement {
    inputDiagnostics = []
    let field = try focusField(target)
    diagnoseInput(field, target: target, phase: .focused, expected: text)
    clearField(field)
    diagnoseInput(field, target: target, phase: .cleared, expected: text)
    typeCharacters(text, into: field)
    diagnoseInput(field, target: target, phase: .typed, expected: text)
    try commitField(field)
    diagnoseInput(field, target: target, phase: .committed, expected: text)
    do {
      try requireExactValue(on: field, text: text, failure: .valueMismatch)
    } catch let failure as Failure {
      diagnoseInput(field, target: target, phase: .settled, expected: text)
      throw failure
    }
    diagnoseInput(field, target: target, phase: .settled, expected: text)
    return field
  }

  private func enterSecret(_ target: Target, secret: String) throws {
    inputDiagnostics = []
    let field = try focusField(target)
    clearField(field)
    typeCharacters(secret, into: field)
    try commitField(field)
    try requireMaskedEntry(field, expectedLength: secret.count)
  }

  /// Confirms the secret is masked and that every keystroke reached this field.
  private func requireMaskedEntry(_ field: XCUIElement, expectedLength: Int) throws {
    guard let masked = field.value as? String else {
      throw Failure.keyboardUnavailable
    }
    if let placeholder = field.placeholderValue, placeholder == masked {
      throw Failure.keyboardUnavailable
    }
    guard !masked.isEmpty else {
      throw Failure.keyboardUnavailable
    }
    guard masked.allSatisfy({ $0 == Self.maskCharacter }) else {
      throw Failure.secretNotMasked
    }
    guard masked.count == expectedLength else {
      throw Failure.valueMismatch
    }
  }

  // MARK: Permission dialogs

  /// iOS exposes its password-saving suggestion as an app-owned sheet, not an alert.
  private func dismissPasswordSaveSheet() throws -> Bool {
    guard mode == "live", connected, passwordSavePrompt == nil,
      permissionAttempts < Permission.maximumAttempts,
      app.state == .runningForeground, !element(.formDeviceKey).exists else { return false }
    let sheets = app.sheets.matching(NSPredicate(format: "label == %@", "Save Password?"))
    guard sheets.count <= 1 else { throw Failure.ambiguousElement }
    guard sheets.count == 1 else { return false }
    let sheet = sheets.element
    let declines = sheet.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
    let saves = sheet.buttons.matching(NSPredicate(format: "label == %@", "Save"))
    guard declines.count == 1, saves.count == 1 else { return false }
    let decline = declines.element
    guard decline.isEnabled, decline.isHittable else { return false }
    let previousCategory = pendingCategory
    let previousOperation = nativeOperation
    pendingCategory = .notHittable
    nativeOperation = .passwordSave
    // Share the four-action budget, but do not enable a permission-only Details retry.
    permissionAttempts += 1
    passwordSavePrompt = .declining
    interactionDiagnostics?["permissionLimitReached"] =
      permissionAttempts == Permission.maximumAttempts
    emit(outcome: .inProgress)
    decline.tap()
    try waitFor(
      NSPredicate(format: "exists == false"), on: sheet,
      timeout: Timeout.short, failure: .notHittable)
    passwordSavePrompt = .dismissed
    emit(outcome: .inProgress)
    pendingCategory = previousCategory
    nativeOperation = previousOperation
    return true
  }

  /// Presses a known permission denial button when one is on screen. Never
  /// dismisses unrelated dialogs.
  private func dismissKnownPermissionAlert() {
    let springBoard = XCUIApplication(bundleIdentifier: Self.springBoardBundleIdentifier)
    // System permission dialogs can be exposed by either application's query.
    for alert in [springBoard.alerts.firstMatch, app.alerts.firstMatch] {
      if denyPermissionAlert(alert) {
        return
      }
    }
    // Recheck exact denial controls on SpringBoard if no alert was handled.
    guard permissionAttempts < Permission.maximumAttempts,
      app.state == .runningForeground else { return }
    let denials = springBoard.buttons.matching(
      NSPredicate(format: "label IN %@", argumentArray: [Self.permissionDenyLabels]))
    guard denials.count == 1 else { return }
    _ = performPermissionDenial(denials.element, source: .systemControl)
  }

  private func denyPermissionAlert(_ alert: XCUIElement) -> Bool {
    guard permissionAttempts < Permission.maximumAttempts, alert.exists else {
      return false
    }
    for label in Self.permissionDenyLabels {
      let button = alert.buttons[label]
      if button.exists && button.isHittable {
        return performPermissionDenial(button, source: .alert)
      }
    }
    return false
  }

  private func performPermissionDenial(_ button: XCUIElement, source: PermissionSource) -> Bool {
    guard permissionAttempts < Permission.maximumAttempts,
      button.exists && button.isEnabled && button.isHittable else { return false }
    let previousPhase = interactionDiagnostics?["phase"]
    let previousCategory = pendingCategory
    pendingCategory = .notHittable
    // Consume the shared budget before the action, including monitor re-entry.
    permissionAttempts += 1
    permissionActions.append(source.rawValue)
    if interactionDiagnostics != nil {
      interactionDiagnostics?["phase"] = InteractionPhase.dismissingPermission.rawValue
      interactionDiagnostics?["permissionLimitReached"] =
        permissionAttempts == Permission.maximumAttempts
      emit(outcome: .inProgress)
    }
    button.tap()
    permissionDismissals += 1
    permissionDismissed = true
    pendingCategory = previousCategory
    interactionDiagnostics?["phase"] = previousPhase
    interactionDiagnostics?["permissionDismissed"] = true
    interactionDiagnostics?["permissionLimitReached"] =
      permissionAttempts == Permission.maximumAttempts
    return true
  }

  // MARK: Configuration

  private func loadConfig() throws -> CaseConfig {
    guard let raw = ProcessInfo.processInfo.environment["PAAD_XCTEST_CASE"] else {
      throw Failure.configuration
    }
    guard
      let parsed = try? JSONSerialization.jsonObject(with: Data(raw.utf8)),
      let fields = parsed as? [String: Any]
    else {
      throw Failure.configuration
    }
    // Resolve the mode first so even a rejected configuration produces a record.
    if let candidate = fields["mode"] as? String, candidate == "smoke" || candidate == "live" {
      mode = candidate
    }
    guard let resolvedMode = mode else {
      throw Failure.configuration
    }
    guard let version = fields["schemaVersion"] as? Int, version == 1 else {
      throw Failure.configuration
    }
    func text(_ key: String) throws -> String {
      guard let value = fields[key] as? String, !value.isEmpty else {
        throw Failure.configuration
      }
      return value
    }
    return CaseConfig(
      mode: resolvedMode,
      provisioningHost: try text("provisioningHost"),
      scopeId: try text("scopeId"),
      registrationId: try text("registrationId"),
      expectedDeviceId: try text("expectedDeviceId"),
      expectedHub: try text("expectedHub"),
      nonce: try text("nonce"),
      modelId: try text("modelId"),
      deviceKey: try text("deviceKey"))
  }

  // MARK: Approved encrypted failure capture

  private func captureEligible() -> Bool {
    guard connected, app.state == .runningForeground,
      !element(.formDeviceKey).exists, !element(.formRegistrationId).exists,
      app.secureTextFields.count == 0, app.textFields.count == 0 else { return false }
    let status = element(.connectionStatus)
    return status.exists &&
      (status.label == AppLabel.connected || (status.value as? String) == AppLabel.connected)
  }

  private func captureApprovedFailure() {
    guard let key = captureRedactionKey, approvedCapture == nil else { return }
    defer { captureRedactionKey = nil }
    guard mode == "live", captureEligible() else {
      approvedCapture = .ineligible
      return
    }
    do {
      guard let documents = FileManager.default.urls(
        for: .documentDirectory, in: .userDomainMask).first else {
        approvedCapture = .failed
        return
      }
      let directory = documents.appendingPathComponent("paad-approved-diagnostic", isDirectory: true)
      guard !FileManager.default.fileExists(atPath: directory.path) else {
        approvedCapture = .failed
        return
      }
      let springBoard = XCUIApplication(bundleIdentifier: Self.springBoardBundleIdentifier)
      let hierarchy = ("APP\n" + app.debugDescription + "\nSYSTEM\n" + springBoard.debugDescription)
        .replacingOccurrences(of: key, with: "[REDACTED]")
      let data = Data(hierarchy.utf8)
      guard data.count <= 512 * 1024, captureEligible() else {
        approvedCapture = .ineligible
        return
      }
      try FileManager.default.createDirectory(
        at: directory, withIntermediateDirectories: false,
        attributes: [.posixPermissions: 0o700])
      try data.write(to: directory.appendingPathComponent("hierarchy.txt"), options: .withoutOverwriting)
      approvedCapture = .hierarchyOnly
      emit(outcome: .inProgress)
      let image = XCUIScreen.main.screenshot().pngRepresentation
      guard image.count <= 8 * 1024 * 1024, captureEligible() else { return }
      try image.write(to: directory.appendingPathComponent("screen.png"), options: .withoutOverwriting)
      approvedCapture = .captured
    } catch {
      if approvedCapture != .hierarchyOnly {
        approvedCapture = .failed
      }
    }
  }

  // MARK: Diagnostics

  private func classifyIssue(_ issue: XCTIssue) -> NativeIssue {
    if issue.associatedError is Failure {
      return .harnessFailure
    }
    let description = issue.compactDescription.lowercased()
    if description.contains("matching snapshot") || description.contains("snapshot request") {
      return .snapshot
    }
    if description.contains("multiple matching elements") {
      return .multipleMatches
    }
    if description.contains("no matches found") {
      return .noMatches
    }
    if description.contains("not hittable") || description.contains("hittable point") {
      return .notHittable
    }
    if description.contains("timed out") || description.contains("timeout") {
      return .timeout
    }
    if description.contains("lost connection") || description.contains("connection was interrupted") {
      return .connectionLost
    }
    return .other
  }

  private func matchCount(_ count: Int) -> MatchCount {
    switch count {
    case 0: return .zero
    case 1: return .one
    case 2: return .two
    case 3: return .three
    default: return .moreThanThree
    }
  }

  private func frameVisibility(_ frame: CGRect, in viewport: CGRect) -> FrameVisibility {
    guard frame.origin.x.isFinite, frame.origin.y.isFinite,
      frame.width.isFinite, frame.height.isFinite,
      viewport.origin.x.isFinite, viewport.origin.y.isFinite,
      viewport.width.isFinite, viewport.height.isFinite, !viewport.isEmpty
    else {
      return .invalid
    }
    if frame.isEmpty {
      return .empty
    }
    if !viewport.intersects(frame) {
      return .outsideApp
    }
    return viewport.contains(frame) ? .insideApp : .partlyInsideApp
  }

  private func elementGeometry(_ field: XCUIElement, viewport: CGRect) -> [String: String] {
    guard field.exists else {
      return [
        "type": NativeElementType.missing.rawValue,
        "state": InteractionElement.missing.rawValue,
        "frame": FrameVisibility.unavailable.rawValue,
      ]
    }
    let type: NativeElementType
    switch field.elementType {
    case .button: type = .button
    case .staticText: type = .staticText
    default: type = .other
    }
    let state = interactionState(field)
    return [
      "type": type.rawValue,
      "state": state.rawValue,
      "frame": frameVisibility(field.frame, in: viewport).rawValue,
    ]
  }

  private func interactionState(_ field: XCUIElement) -> InteractionElement {
    guard field.exists else { return .missing }
    guard field.isEnabled else { return .disabled }
    return field.isHittable ? .hittable : .notHittable
  }

  private func compareDetailsControls(_ capture: ResolutionCapture) {
    detailsControlComparisons.append([
      "capture": capture.rawValue,
      "details": InteractionElement.unavailable.rawValue,
      "settings": InteractionElement.unavailable.rawValue,
      "home": InteractionElement.unavailable.rawValue,
      "navigation": InteractionElement.unavailable.rawValue,
      "applicationState": ApplicationState.unknown.rawValue,
      "systemApplicationState": ApplicationState.unknown.rawValue,
      "systemDenial": InteractionElement.unavailable.rawValue,
      "polls": matchCount(detailsReadinessPolls).rawValue,
    ])
    let index = detailsControlComparisons.count - 1
    nativeOperation = .stateCheck
    refreshApplicationState()
    detailsControlComparisons[index]["applicationState"] = applicationState.rawValue
    let springBoard = XCUIApplication(bundleIdentifier: Self.springBoardBundleIdentifier)
    detailsControlComparisons[index]["systemApplicationState"] =
      observedApplicationState(springBoard).rawValue
    // Header Settings sits outside the stack screen; Home sits inside it.
    let queries: [(String, XCUIElementQuery)] = [
      ("details", app.buttons.matching(identifier: Target.connectionDetails.rawValue)),
      ("settings", app.buttons.matching(identifier: Target.appSettings.rawValue)),
      ("home", app.buttons.matching(identifier: Target.tabHome.rawValue)),
      ("navigation", app.otherElements.matching(identifier: Target.navigationContent.rawValue)),
      ("systemDenial", springBoard.buttons.matching(
        NSPredicate(format: "label IN %@", argumentArray: [Self.permissionDenyLabels]))),
    ]
    for (name, query) in queries {
      nativeOperation = .matchCount
      let count = query.count
      nativeOperation = .stateCheck
      let state: InteractionElement = count == 0 ? .missing
        : count == 1 ? interactionState(query.element) : .unavailable
      detailsControlComparisons[index][name] = state.rawValue
    }
  }

  private func retainDetailsReadiness(_ field: XCUIElement, capsule: XCUIElement) {
    guard let resolutionDiagnostics = resolutionDiagnostics else { return }
    var containment = CapsuleContainment.unavailable
    var size = TouchTargetSize.unavailable
    if field.exists {
      let frame = field.frame
      if frame.width.isFinite && frame.height.isFinite && !frame.isNull {
        size = frame.width >= 44 && frame.height >= 44 ? .meetsMinimum : .belowMinimum
      }
      if capsule.exists {
        switch frameVisibility(frame, in: capsule.frame) {
        case .insideApp: containment = .inside
        case .partlyInsideApp: containment = .partial
        case .outsideApp: containment = .outside
        case .empty: containment = .empty
        case .invalid: containment = .invalid
        case .unavailable: containment = .unavailable
        }
      }
    }
    detailsReadiness = [
      "matches": resolutionDiagnostics["queryMatches"] ?? MatchCount.unavailable.rawValue,
      "capsuleMatches": resolutionDiagnostics["capsuleMatches"] ?? MatchCount.unavailable.rawValue,
      "capsuleButtonMatches": resolutionDiagnostics["capsuleButtonMatches"] ?? MatchCount.unavailable.rawValue,
      "target": resolutionDiagnostics["selected"] ?? [
        "type": NativeElementType.unavailable.rawValue,
        "state": InteractionElement.unavailable.rawValue,
        "frame": FrameVisibility.unavailable.rawValue,
      ],
      "containment": containment.rawValue,
      "size": size.rawValue,
    ]
  }

  private func diagnoseResolution(
    _ target: Target, field: XCUIElement, query: XCUIElementQuery, capture: ResolutionCapture
  ) {
    // Cache each completed read separately from polling, including the checkpoint
    // an XCTest query aborts at. No raw frames or accessibility tree leave here.
    let unavailable = ["type": NativeElementType.unavailable.rawValue,
      "state": InteractionElement.unavailable.rawValue,
      "frame": FrameVisibility.unavailable.rawValue]
    resolutionTarget = target
    resolutionDiagnostics = [
      "capture": capture.rawValue,
      "checkpoint": "viewport",
      "queryType": target == .connectionDetails ? "button" : "any",
      "queryMatches": MatchCount.unavailable.rawValue,
      "identifierMatches": MatchCount.unavailable.rawValue,
      "buttonMatches": MatchCount.unavailable.rawValue,
      "capsuleMatches": MatchCount.unavailable.rawValue,
      "capsuleButtonMatches": MatchCount.unavailable.rawValue,
      "selected": unavailable,
      "untypedFirst": unavailable,
      "candidates": [[String: String]](),
      "capsule": unavailable,
      "status": unavailable,
    ]
    emit(outcome: .inProgress)
    let viewport = app.frame
    resolutionDiagnostics?["checkpoint"] = "query-count"
    resolutionDiagnostics?["queryMatches"] = matchCount(query.count).rawValue
    let matches = app.descendants(matching: .any).matching(identifier: target.rawValue)
    resolutionDiagnostics?["checkpoint"] = "identifier-count"
    let count = matches.count
    resolutionDiagnostics?["identifierMatches"] = matchCount(count).rawValue
    resolutionDiagnostics?["checkpoint"] = "button-count"
    resolutionDiagnostics?["buttonMatches"] =
      matchCount(app.buttons.matching(identifier: target.rawValue).count).rawValue
    let capsuleQuery = app.descendants(matching: .any)
      .matching(identifier: Target.connectionStatusCapsule.rawValue)
    resolutionDiagnostics?["checkpoint"] = "capsule-count"
    let capsuleCount = capsuleQuery.count
    resolutionDiagnostics?["capsuleMatches"] = matchCount(capsuleCount).rawValue
    let capsule = capsuleQuery.firstMatch
    resolutionDiagnostics?["checkpoint"] = "selected-geometry"
    resolutionDiagnostics?["selected"] = elementGeometry(field, viewport: viewport)
    resolutionDiagnostics?["checkpoint"] = "untyped-geometry"
    resolutionDiagnostics?["untypedFirst"] = elementGeometry(matches.firstMatch, viewport: viewport)
    resolutionDiagnostics?["checkpoint"] = "candidate-geometry"
    var candidates: [[String: String]] = []
    for index in 0..<min(count, Diagnostic.maximumCandidates) {
      candidates.append(elementGeometry(matches.element(boundBy: index), viewport: viewport))
      resolutionDiagnostics?["candidates"] = candidates
    }
    resolutionDiagnostics?["checkpoint"] = "capsule-button-count"
    let scopedButtons: MatchCount = capsuleCount == 1
      ? matchCount(capsule.buttons.matching(identifier: target.rawValue).count) : .unavailable
    resolutionDiagnostics?["capsuleButtonMatches"] = scopedButtons.rawValue
    resolutionDiagnostics?["checkpoint"] = "capsule-geometry"
    resolutionDiagnostics?["capsule"] = elementGeometry(capsule, viewport: viewport)
    resolutionDiagnostics?["checkpoint"] = "status-geometry"
    resolutionDiagnostics?["status"] = elementGeometry(element(.connectionStatus), viewport: viewport)
    resolutionDiagnostics?["checkpoint"] = "complete"
    if target == .connectionDetails && capture == .ready {
      retainDetailsReadiness(field, capsule: capsule)
    }
    if target == .connectionDetailsSheet && !detailsTapDiagnostics.isEmpty {
      diagnoseDetailsPresentation()
      nativeOperation = .resolution
    }
    emit(outcome: .inProgress)
  }

  private func permissionAlertState(_ alert: XCUIElement) -> PermissionAlert {
    guard alert.exists else {
      return .none
    }
    var state: PermissionAlert = .other
    for label in Self.permissionDenyLabels {
      let button = alert.buttons[label]
      if button.exists {
        state = .denialPresent
        if button.isHittable {
          return .denialHittable
        }
      }
    }
    return state
  }

  @discardableResult
  private func updateInteraction(
    _ target: Target, field: XCUIElement, phase: InteractionPhase
  ) -> Bool {
    let state = interactionState(field)
    let exists = state != .missing
    let springBoard = XCUIApplication(bundleIdentifier: Self.springBoardBundleIdentifier)
    let systemAlert = permissionAlertState(springBoard.alerts.firstMatch)
    let applicationAlert = permissionAlertState(app.alerts.firstMatch)
    let busyOverlay = element(.appBusyOverlay).exists
    interactionDiagnostics = [
      "target": target.rawValue,
      "phase": phase.rawValue,
      "element": state.rawValue,
      "systemAlert": systemAlert.rawValue,
      "applicationAlert": applicationAlert.rawValue,
      "busyOverlay": busyOverlay,
      "keyboardVisible": app.keyboards.firstMatch.exists,
      "permissionDismissed": permissionDismissed,
      "permissionLimitReached": permissionAttempts == Permission.maximumAttempts,
    ]
    // A visible frame alone did not make the first gesture actionable. Wait for
    // a hittable header; the real tap must still open the previously absent sheet.
    let targetReady = target == .connectionDetailsSheet ? exists
      : exists && state == .hittable
        && frameVisibility(field.frame, in: app.frame) == .insideApp
    return targetReady && !busyOverlay && systemAlert == .none && applicationAlert == .none
  }

  private func diagnoseInput(
    _ field: XCUIElement, target: Target, phase: InputPhase, expected: String
  ) {
    // Never inspect live input or secure fields for diagnostic publication.
    guard mode == "smoke",
      [.formRegistrationId, .formScopeId, .formProvisioningHost].contains(target)
    else {
      return
    }
    let exists = field.exists
    let kind: InputElement
    if exists {
      switch field.elementType {
      case .textField: kind = .textField
      case .secureTextField: kind = .secureTextField
      case .textView: kind = .textView
      default: kind = .other
      }
    } else {
      kind = .missing
    }
    let raw = exists && kind != .secureTextField ? field.value : nil
    let value: InputValue
    if let text = raw as? String {
      if text.isEmpty {
        value = .empty
      } else if text == field.placeholderValue {
        value = .placeholder
      } else if text == expected {
        value = .exact
      } else if text == expected + "\n" || text == expected + "\r\n" {
        value = .newlineSuffix
      } else if text.trimmingCharacters(in: .whitespacesAndNewlines) == expected {
        value = .whitespaceDifference
      } else {
        value = .mismatch
      }
    } else {
      value = raw == nil ? .unavailable : .nonString
    }
    inputDiagnostics.append([
      "target": target.rawValue,
      "phase": phase.rawValue,
      "element": kind.rawValue,
      "value": value.rawValue,
      "hasNewline": (raw as? String)?.rangeOfCharacter(from: .newlines) != nil,
      // UI focus is diagnostic only; it is not a keyboard-focus assertion.
      "uiFocused": exists && field.hasFocus,
      "hittable": exists && field.isHittable,
      "enabled": exists && field.isEnabled,
      "keyboardVisible": app.keyboards.firstMatch.exists,
    ])
    emit(outcome: .inProgress)
  }

  private func advance(to stage: Stage, queryingState: Bool = true) {
    self.stage = stage
    if queryingState {
      refreshApplicationState()
    }
    emit(outcome: .inProgress)
  }

  /// Emits the authoritative record. Never upgrades a recorded failure to a pass
  /// and never queries the application, so teardown cannot stall.
  private func emitFinalResult() {
    let failed = recordedFailure || (testRun?.failureCount ?? 0) > 0
      || (testRun?.unexpectedExceptionCount ?? 0) > 0
    let complete = stage == .finished && applicationState == .notRunning
    emit(outcome: (failed || !complete) ? .failed : .passed)
  }

  private func refreshApplicationState() {
    guard let app = app else {
      applicationState = .unknown
      return
    }
    applicationState = observedApplicationState(app)
  }

  private func observedApplicationState(_ application: XCUIApplication) -> ApplicationState {
    switch application.state {
    case .notRunning:
      return .notRunning
    case .runningBackgroundSuspended:
      return .runningBackgroundSuspended
    case .runningBackground:
      return .runningBackground
    case .runningForeground:
      return .runningForeground
    case .unknown:
      return .unknown
    @unknown default:
      return .unknown
    }
  }

  private func emit(outcome: Outcome) {
    guard let mode = mode else {
      // The mode is part of the fixed schema; an unreadable configuration
      // simply fails the process without an ambiguous record.
      return
    }
    var record: [String: Any] = [
      "schemaVersion": 1,
      "runner": "xcuitest",
      "mode": mode,
      "outcome": outcome.rawValue,
      "stage": stage.rawValue,
      "applicationState": applicationState.rawValue,
      "observedTargets": observed,
      "connected": connected,
      "nonceSubmitted": nonceSubmitted,
      "coldRestored": coldRestored,
    ]
    if let category = failureCategory {
      record["failureCategory"] = category.rawValue
    }
    if outcome == .failed, failureCategory == .missingElement, let missingTarget = missingTarget {
      record["missingTarget"] = missingTarget.rawValue
    }
    if let ambiguousTarget = ambiguousTarget {
      record["ambiguousTarget"] = ambiguousTarget
      record["ambiguousTypes"] = ambiguousTypes
    }
    if let nativeIssue = nativeIssue {
      record["nativeIssue"] = nativeIssue.rawValue
    }
    if let nativeOperation = nativeOperation {
      record["nativeOperation"] = nativeOperation.rawValue
    }
    if !detailsTapDiagnostics.isEmpty {
      record["detailsTapDiagnostics"] = detailsTapDiagnostics
    }
    if !detailsControlComparisons.isEmpty {
      record["detailsControlComparisons"] = detailsControlComparisons
    }
    if let detailsForeground = detailsForeground {
      record["detailsForeground"] = detailsForeground
    }
    if !permissionActions.isEmpty {
      record["permissionActions"] = permissionActions
    }
    if let passwordSavePrompt = passwordSavePrompt {
      record["passwordSavePrompt"] = passwordSavePrompt.rawValue
    }
    if let approvedCapture = approvedCapture {
      record["approvedCapture"] = approvedCapture.rawValue
    }
    if !inputDiagnostics.isEmpty {
      record["inputDiagnostics"] = inputDiagnostics
    }
    if var interaction = interactionDiagnostics {
      if resolutionTarget?.rawValue == (interaction["target"] as? String),
        let resolutionDiagnostics = resolutionDiagnostics {
        interaction["resolution"] = resolutionDiagnostics
      }
      record["interactionDiagnostics"] = interaction
    }
    guard
      let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]),
      let json = String(data: data, encoding: .utf8)
    else {
      return
    }
    FileHandle.standardOutput.write(Data("PAAD_XCTEST_RESULT:\(json)\n".utf8))
  }
}
