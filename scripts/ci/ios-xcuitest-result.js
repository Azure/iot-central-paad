'use strict';

const PREFIX = 'PAAD_XCTEST_RESULT:';
const MAX_LOG_BYTES = 1024 * 1024;
// Recent distinct control presence, not an accumulated whole-run coverage ledger.
const MAX_OBSERVED_TARGETS = 16;
const STAGES = Object.freeze([
  'starting', 'welcome', 'manual-navigation', 'registration-input', 'scope-input',
  'host-input', 'key-input', 'connecting', 'details', 'identity', 'nonce',
  'submitting', 'home-traversal', 'explore-traversal', 'activity-traversal',
  'terminating', 'restoring', 'restored-identity', 'finished',
]);
const APPLICATION_STATES = Object.freeze([
  'unknown', 'not-running', 'running-background-suspended', 'running-background', 'running-foreground',
]);
const FAILURE_CATEGORIES = Object.freeze([
  'configuration', 'missing-element', 'ambiguous-element', 'not-hittable', 'value-mismatch',
  'keyboard-unavailable', 'connection-timeout', 'submission-timeout',
  'termination-failed', 'restore-timeout', 'unexpected-issue', 'deadline-exceeded',
  'launch-failed', 'secret-not-masked', 'registry-changed',
]);
const EXECUTIONS = Object.freeze([
  'passed', 'nonzero-exit', 'deadline-exceeded', 'signal', 'spawn-failed', 'invalid-result',
]);
const TARGETS = Object.freeze([
  'registration-manual', 'registration-back', 'connection-registrationId',
  'connection-scopeId', 'connection-provisioningHost', 'connection-deviceKey',
  'connection-submit', 'connection-status', 'connection-details', 'connection-details-sheet',
  'connection-details-close', 'assigned-device-id', 'assigned-hub', 'model-id',
  'registration-id', 'registry-status', 'proof-nonce', 'proof-send', 'proof-status',
  'app-busy-overlay', 'navigation-content', 'connection-error', 'connection-status-capsule', 'app-settings',
  'tab-home', 'tab-explore', 'tab-activity',
  'home-node-phone', 'home-node-dps', 'home-node-hub', 'home-node-adr',
  'home-panel-phone', 'home-panel-dps', 'home-panel-hub', 'home-panel-adr', 'home-panel-close',
  'explore-directory', 'explore-tool-telemetry', 'explore-tool-properties',
  'explore-tool-image', 'explore-tool-bluetooth', 'explore-back',
  'telemetry-tool', 'sensor-toggle-accelerometer',
  'properties-tool', 'property-input-readOnlyProp', 'property-technical-readOnlyProp',
  'property-name-readOnlyProp', 'image-upload-card', 'bluetooth-tool-title',
  'activity-filter-all', 'activity-filter-issues', 'activity-latest', 'activity-list',
  'activity-diagnostics', 'activity-observations',
  'logs-filter-all', 'logs-filter-issues', 'logs-latest', 'logs-list',
]);
const INPUT_TARGETS = Object.freeze([
  'connection-registrationId', 'connection-scopeId', 'connection-provisioningHost',
]);
const INPUT_PHASES = Object.freeze(['focused', 'cleared', 'typed', 'committed', 'settled']);
const INPUT_ELEMENTS = Object.freeze(['missing', 'text-field', 'secure-text-field', 'text-view', 'other']);
const INPUT_VALUES = Object.freeze([
  'unavailable', 'non-string', 'empty', 'placeholder', 'exact',
  'newline-suffix', 'whitespace-difference', 'mismatch',
]);
const INPUT_FLAGS = Object.freeze(['hasNewline', 'uiFocused', 'hittable', 'enabled', 'keyboardVisible']);
const INTERACTION_TARGETS = Object.freeze(['connection-details', 'connection-details-sheet']);
const INTERACTION_PHASES = Object.freeze([
  'waiting-for-hittability', 'waiting-for-readiness', 'dismissing-permission', 'tapping', 'waiting-for-sheet', 'sheet-visible',
]);
const INTERACTION_ELEMENTS = Object.freeze(['unavailable', 'missing', 'disabled', 'not-hittable', 'hittable']);
const PERMISSION_ALERTS = Object.freeze(['none', 'other', 'denial-present', 'denial-hittable']);
const INTERACTION_FLAGS = Object.freeze([
  'busyOverlay', 'keyboardVisible', 'permissionDismissed', 'permissionLimitReached',
]);
const MATCH_COUNTS = Object.freeze(['unavailable', 'zero', 'one', 'two', 'three', 'more-than-three']);
const NATIVE_ELEMENT_TYPES = Object.freeze(['unavailable', 'missing', 'button', 'static-text', 'other']);
const FRAME_VISIBILITIES = Object.freeze([
  'unavailable', 'invalid', 'empty', 'outside-app', 'partly-inside-app', 'inside-app',
]);
const RESOLUTION_COUNTS = Object.freeze([
  'queryMatches', 'identifierMatches', 'buttonMatches', 'capsuleMatches', 'capsuleButtonMatches',
]);
const MAX_RESOLUTION_CANDIDATES = 3;
const RESOLUTION_CAPTURES = Object.freeze(['initial', 'ready', 'timed-out']);
const RESOLUTION_CHECKPOINTS = Object.freeze([
  'viewport', 'query-count', 'identifier-count', 'button-count', 'capsule-count',
  'selected-geometry', 'untyped-geometry', 'candidate-geometry', 'capsule-button-count',
  'capsule-geometry', 'status-geometry', 'complete',
]);
const NATIVE_ISSUES = Object.freeze([
  'harness-failure', 'snapshot', 'multiple-matches', 'no-matches', 'not-hittable',
  'timeout', 'connection-lost', 'other',
]);
const NATIVE_OPERATIONS = Object.freeze([
  'activate', 'sheet-absence', 'permission-check', 'password-save', 'match-count', 'state-check', 'resolution', 'resolve-element', 'tap', 'presentation',
]);
const DETAILS_TAP_ATTEMPTS = Object.freeze(['initial', 'permission-retry']);
const ELEMENT_PRESENCES = Object.freeze(['unavailable', 'missing', 'present']);
const DETAILS_PRESENTATIONS = Object.freeze(['unavailable', 'closed', 'opening', 'shown', 'unknown']);
const CAPSULE_CONTAINMENTS = Object.freeze(['unavailable', 'invalid', 'empty', 'outside', 'partial', 'inside']);
const TOUCH_TARGET_SIZES = Object.freeze(['unavailable', 'below-minimum', 'meets-minimum']);
const CONTROL_COMPARATORS = Object.freeze(['details', 'settings', 'home', 'navigation']);
const PERMISSION_SOURCES = Object.freeze(['alert', 'system-control']);
const MAX_PERMISSION_ACTIONS = 4;
const PASSWORD_SAVE_PROMPTS = Object.freeze(['declining', 'dismissed']);
const APPROVED_CAPTURES = Object.freeze(['ineligible', 'hierarchy-only', 'captured', 'failed']);

function sanitizeControlComparisons(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2 ||
      value.some((entry, index) => !entry || typeof entry !== 'object' || Array.isArray(entry) ||
        (index === 0 ? entry.capture !== 'initial' : !['ready', 'timed-out'].includes(entry.capture)) ||
        ['applicationState', 'systemApplicationState'].some(key =>
          entry[key] !== undefined && !APPLICATION_STATES.includes(entry[key])) ||
        (entry.systemDenial !== undefined && !INTERACTION_ELEMENTS.includes(entry.systemDenial)) ||
        (entry.polls !== undefined && !MATCH_COUNTS.includes(entry.polls)) ||
        CONTROL_COMPARATORS.some(key => !INTERACTION_ELEMENTS.includes(entry[key])))) return undefined;
  return value.map(entry => ({
    capture: entry.capture,
    ...Object.fromEntries(CONTROL_COMPARATORS.map(key => [key, entry[key]])),
    ...(entry.applicationState ? {applicationState: entry.applicationState} : {}),
    ...(entry.systemApplicationState ? {systemApplicationState: entry.systemApplicationState} : {}),
    ...(entry.systemDenial ? {systemDenial: entry.systemDenial} : {}),
    ...(entry.polls ? {polls: entry.polls} : {}),
  }));
}

function sanitizeDetailsForeground(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !APPLICATION_STATES.includes(value.before) || !APPLICATION_STATES.includes(value.after) ||
      typeof value.activationRequested !== 'boolean' ||
      (value.activationRequested &&
        !['running-background', 'running-background-suspended'].includes(value.before))) return undefined;
  return {before: value.before, after: value.after, activationRequested: value.activationRequested};
}

function sanitizeDetailsReadiness(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ['matches', 'capsuleMatches', 'capsuleButtonMatches'].some(key => !MATCH_COUNTS.includes(value[key])) ||
      !CAPSULE_CONTAINMENTS.includes(value.containment) ||
      !TOUCH_TARGET_SIZES.includes(value.size)) return undefined;
  const target = sanitizeGeometry(value.target);
  if (!target) return undefined;
  return {
    matches: value.matches, capsuleMatches: value.capsuleMatches,
    capsuleButtonMatches: value.capsuleButtonMatches, target,
    containment: value.containment, size: value.size,
  };
}

function sanitizeDetailsTaps(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > DETAILS_TAP_ATTEMPTS.length ||
      value.some((entry, index) => !entry || typeof entry !== 'object' || Array.isArray(entry) ||
        entry.attempt !== DETAILS_TAP_ATTEMPTS[index] ||
        !INTERACTION_ELEMENTS.includes(entry.targetState) ||
        (entry.presentation !== undefined && !DETAILS_PRESENTATIONS.includes(entry.presentation)) ||
        ['postTapState', 'laterTargetState'].some(key =>
          entry[key] !== undefined && !INTERACTION_ELEMENTS.includes(entry[key])) ||
        (entry.readiness !== undefined && !sanitizeDetailsReadiness(entry.readiness)) ||
        typeof entry.completed !== 'boolean' || typeof entry.permissionHandled !== 'boolean' ||
        ['sheet', 'close', 'identity'].some(key => !ELEMENT_PRESENCES.includes(entry[key]))) ||
      (value.length === 2 && (!value[0].completed || !value[0].permissionHandled))) return undefined;
  return value.map(entry => ({
    attempt: entry.attempt, targetState: entry.targetState,
    completed: entry.completed, permissionHandled: entry.permissionHandled,
    sheet: entry.sheet, close: entry.close, identity: entry.identity,
    ...(entry.presentation ? {presentation: entry.presentation} : {}),
    ...(entry.postTapState ? {postTapState: entry.postTapState} : {}),
    ...(entry.laterTargetState ? {laterTargetState: entry.laterTargetState} : {}),
    ...(entry.readiness ? {readiness: sanitizeDetailsReadiness(entry.readiness)} : {}),
  }));
}

function sanitizeInputDiagnostics(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > INPUT_PHASES.length ||
      value.some((entry, index) => !entry || typeof entry !== 'object' || Array.isArray(entry) ||
        !INPUT_TARGETS.includes(entry.target) || entry.target !== value[0].target ||
        entry.phase !== INPUT_PHASES[index] || !INPUT_ELEMENTS.includes(entry.element) ||
        !INPUT_VALUES.includes(entry.value) ||
        INPUT_FLAGS.some(flag => typeof entry[flag] !== 'boolean'))) return undefined;
  return value.map(entry => ({
    target: entry.target, phase: entry.phase, element: entry.element, value: entry.value,
    ...Object.fromEntries(INPUT_FLAGS.map(flag => [flag, entry[flag]])),
  }));
}

function sanitizeInteractionDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !INTERACTION_TARGETS.includes(value.target) || !INTERACTION_PHASES.includes(value.phase) ||
      !INTERACTION_ELEMENTS.includes(value.element) || !PERMISSION_ALERTS.includes(value.systemAlert) ||
      !PERMISSION_ALERTS.includes(value.applicationAlert) ||
      INTERACTION_FLAGS.some(flag => typeof value[flag] !== 'boolean')) return undefined;
  const resolution = value.resolution === undefined ? undefined : sanitizeResolution(value.resolution);
  if (value.resolution !== undefined && !resolution) return undefined;
  return {
    target: value.target, phase: value.phase, element: value.element,
    systemAlert: value.systemAlert, applicationAlert: value.applicationAlert,
    ...Object.fromEntries(INTERACTION_FLAGS.map(flag => [flag, value[flag]])),
    ...(resolution ? {resolution} : {}),
  };
}

function sanitizeGeometry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !NATIVE_ELEMENT_TYPES.includes(value.type) || !INTERACTION_ELEMENTS.includes(value.state) ||
      !FRAME_VISIBILITIES.includes(value.frame)) return undefined;
  return {type: value.type, state: value.state, frame: value.frame};
}

function sanitizeResolution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !['button', 'any'].includes(value.queryType) ||
      (value.capture !== undefined && !RESOLUTION_CAPTURES.includes(value.capture)) ||
      (value.checkpoint !== undefined && !RESOLUTION_CHECKPOINTS.includes(value.checkpoint)) ||
      RESOLUTION_COUNTS.some(key => !MATCH_COUNTS.includes(value[key])) ||
      !Array.isArray(value.candidates) || value.candidates.length > MAX_RESOLUTION_CANDIDATES) return undefined;
  const selected = sanitizeGeometry(value.selected);
  const untypedFirst = sanitizeGeometry(value.untypedFirst);
  const capsule = sanitizeGeometry(value.capsule);
  const status = sanitizeGeometry(value.status);
  const candidates = value.candidates.map(sanitizeGeometry);
  if (!selected || !untypedFirst || !capsule || !status ||
      candidates.some(candidate => !candidate)) return undefined;
  return {
    queryType: value.queryType,
    ...(value.capture ? {capture: value.capture} : {}),
    ...(value.checkpoint ? {checkpoint: value.checkpoint} : {}),
    ...Object.fromEntries(RESOLUTION_COUNTS.map(key => [key, value[key]])),
    selected, untypedFirst, candidates, capsule, status,
  };
}

function sanitizeNativeResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schemaVersion !== 1 || value.runner !== 'xcuitest' ||
      !['smoke', 'live'].includes(value.mode) ||
      !['in-progress', 'passed', 'failed'].includes(value.outcome) ||
      !STAGES.includes(value.stage) || !APPLICATION_STATES.includes(value.applicationState) ||
      !['connected', 'nonceSubmitted', 'coldRestored'].every(key => typeof value[key] === 'boolean') ||
      !Array.isArray(value.observedTargets) || value.observedTargets.length > MAX_OBSERVED_TARGETS ||
      value.observedTargets.some(id => !TARGETS.includes(id)) ||
      (value.failureCategory !== undefined && !FAILURE_CATEGORIES.includes(value.failureCategory)) ||
      (value.nativeIssue !== undefined && !NATIVE_ISSUES.includes(value.nativeIssue)) ||
      (value.nativeOperation !== undefined && !NATIVE_OPERATIONS.includes(value.nativeOperation)) ||
      (value.execution !== undefined && !EXECUTIONS.includes(value.execution))) return undefined;
  if (value.missingTarget !== undefined &&
      (value.outcome !== 'failed' || value.failureCategory !== 'missing-element' ||
        !TARGETS.includes(value.missingTarget))) return undefined;
  if (value.ambiguousTarget !== undefined || value.ambiguousTypes !== undefined) {
    if (value.failureCategory !== 'ambiguous-element' ||
        (!TARGETS.includes(value.ambiguousTarget) && value.ambiguousTarget !== 'bluetooth-heading') ||
        !Array.isArray(value.ambiguousTypes) || value.ambiguousTypes.length > MAX_RESOLUTION_CANDIDATES ||
        value.ambiguousTypes.some(type => !['button', 'static-text', 'other'].includes(type))) return undefined;
  }
  const inputDiagnostics = value.inputDiagnostics === undefined ? undefined
    : sanitizeInputDiagnostics(value.inputDiagnostics);
  if (value.inputDiagnostics !== undefined && (value.mode !== 'smoke' || !inputDiagnostics)) return undefined;
  const interactionDiagnostics = value.interactionDiagnostics === undefined ? undefined
    : sanitizeInteractionDiagnostics(value.interactionDiagnostics);
  if (value.interactionDiagnostics !== undefined && !interactionDiagnostics) return undefined;
  const detailsTapDiagnostics = value.detailsTapDiagnostics === undefined ? undefined
    : sanitizeDetailsTaps(value.detailsTapDiagnostics);
  if (value.detailsTapDiagnostics !== undefined && !detailsTapDiagnostics) return undefined;
  const detailsControlComparisons = value.detailsControlComparisons === undefined ? undefined
    : sanitizeControlComparisons(value.detailsControlComparisons);
  if (value.detailsControlComparisons !== undefined && !detailsControlComparisons) return undefined;
  const detailsForeground = value.detailsForeground === undefined ? undefined
    : sanitizeDetailsForeground(value.detailsForeground);
  if (value.detailsForeground !== undefined && !detailsForeground) return undefined;
  if (value.permissionActions !== undefined &&
      (!Array.isArray(value.permissionActions) || value.permissionActions.length === 0 ||
        value.permissionActions.length > MAX_PERMISSION_ACTIONS ||
        value.permissionActions.some(source => !PERMISSION_SOURCES.includes(source)))) return undefined;
  if (value.passwordSavePrompt !== undefined &&
      (value.mode !== 'live' || !value.connected ||
        !PASSWORD_SAVE_PROMPTS.includes(value.passwordSavePrompt))) return undefined;
  if (value.approvedCapture !== undefined &&
        (value.mode !== 'live' || !APPROVED_CAPTURES.includes(value.approvedCapture))) return undefined;
  if (value.approvedCaptureExport !== undefined &&
        (value.mode !== 'live' || !['encrypted', 'failed'].includes(value.approvedCaptureExport))) return undefined;
  return {
    schemaVersion: 1, runner: 'xcuitest', mode: value.mode, outcome: value.outcome,
    stage: value.stage, applicationState: value.applicationState,
    ...(value.failureCategory ? {failureCategory: value.failureCategory} : {}),
    ...(value.nativeIssue ? {nativeIssue: value.nativeIssue} : {}),
    ...(value.nativeOperation ? {nativeOperation: value.nativeOperation} : {}),
    ...(value.missingTarget ? {missingTarget: value.missingTarget} : {}),
    ...(value.ambiguousTarget ? {
      ambiguousTarget: value.ambiguousTarget, ambiguousTypes: [...value.ambiguousTypes],
    } : {}),
    observedTargets: [...new Set(value.observedTargets)].sort(),
    connected: value.connected, nonceSubmitted: value.nonceSubmitted, coldRestored: value.coldRestored,
    ...(value.execution ? {execution: value.execution} : {}),
    ...(inputDiagnostics ? {inputDiagnostics} : {}),
    ...(interactionDiagnostics ? {interactionDiagnostics} : {}),
    ...(detailsTapDiagnostics ? {detailsTapDiagnostics} : {}),
    ...(detailsControlComparisons ? {detailsControlComparisons} : {}),
    ...(detailsForeground ? {detailsForeground} : {}),
    ...(value.permissionActions ? {permissionActions: [...value.permissionActions]} : {}),
    ...(value.passwordSavePrompt ? {passwordSavePrompt: value.passwordSavePrompt} : {}),
    ...(value.approvedCapture ? {approvedCapture: value.approvedCapture} : {}),
    ...(value.approvedCaptureExport ? {approvedCaptureExport: value.approvedCaptureExport} : {}),
  };
}

function parseNativeLog(text, mode) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_LOG_BYTES) return undefined;
  let result;
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf(PREFIX);
    if (index === -1) continue;
    if (++count > 64 || Buffer.byteLength(line) > 4096) return undefined;
    try {
      const candidate = sanitizeNativeResult(JSON.parse(line.slice(index + PREFIX.length)));
      if (!candidate || candidate.mode !== mode) return undefined;
      result = candidate;
    } catch {
      return undefined;
    }
  }
  return result;
}

function nativeFlowPassed(result, mode) {
  return result?.mode === mode && result.outcome === 'passed' && result.stage === 'finished' &&
    result.applicationState === 'not-running' && !result.failureCategory && !result.nativeIssue &&
    (!result.passwordSavePrompt || result.passwordSavePrompt === 'dismissed') &&
    ['connected', 'nonceSubmitted', 'coldRestored'].every(key => result[key] === (mode === 'live'));
}

module.exports = {
  PREFIX, MAX_LOG_BYTES, MAX_OBSERVED_TARGETS, STAGES, APPLICATION_STATES, FAILURE_CATEGORIES, EXECUTIONS, TARGETS,
  INPUT_TARGETS, INPUT_PHASES, INPUT_ELEMENTS, INPUT_VALUES, INPUT_FLAGS,
  INTERACTION_TARGETS, INTERACTION_PHASES, INTERACTION_ELEMENTS, PERMISSION_ALERTS, INTERACTION_FLAGS,
  MATCH_COUNTS, NATIVE_ELEMENT_TYPES, FRAME_VISIBILITIES, RESOLUTION_COUNTS, MAX_RESOLUTION_CANDIDATES,
  RESOLUTION_CAPTURES, RESOLUTION_CHECKPOINTS, NATIVE_ISSUES, NATIVE_OPERATIONS,
  DETAILS_TAP_ATTEMPTS, ELEMENT_PRESENCES, DETAILS_PRESENTATIONS,
  CAPSULE_CONTAINMENTS, TOUCH_TARGET_SIZES, CONTROL_COMPARATORS,
  PERMISSION_SOURCES, MAX_PERMISSION_ACTIONS, PASSWORD_SAVE_PROMPTS,
  APPROVED_CAPTURES,
  sanitizeNativeResult, parseNativeLog, nativeFlowPassed,
};
