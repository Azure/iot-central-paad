const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  createXCTestCase,
  configureXCTestRun,
} = require('../scripts/ci/ios-xcuitest-config');
const {
  PREFIX,
  MAX_LOG_BYTES,
  sanitizeNativeResult,
  parseNativeLog,
  nativeFlowPassed,
  STAGES, APPLICATION_STATES, FAILURE_CATEGORIES, TARGETS, MAX_OBSERVED_TARGETS,
  INPUT_TARGETS, INPUT_PHASES, INPUT_ELEMENTS, INPUT_VALUES, INPUT_FLAGS,
  INTERACTION_TARGETS, INTERACTION_PHASES, INTERACTION_ELEMENTS, PERMISSION_ALERTS, INTERACTION_FLAGS,
  MATCH_COUNTS, NATIVE_ELEMENT_TYPES, FRAME_VISIBILITIES, RESOLUTION_COUNTS, MAX_RESOLUTION_CANDIDATES,
  RESOLUTION_CAPTURES, RESOLUTION_CHECKPOINTS, NATIVE_ISSUES, NATIVE_OPERATIONS,
  DETAILS_TAP_ATTEMPTS, ELEMENT_PRESENCES, DETAILS_PRESENTATIONS,
  CAPSULE_CONTAINMENTS, TOUCH_TARGET_SIZES, CONTROL_COMPARATORS,
  PERMISSION_SOURCES, MAX_PERMISSION_ACTIONS, PASSWORD_SAVE_PROMPTS,
  APPROVED_CAPTURES,
} = require('../scripts/ci/ios-xcuitest-result');
const {sanitizeDiagnostics} = require('../scripts/ci/live-diagnostics');
const {validateEnvironment} = require('../scripts/ci/run-ios-xcuitest');

const liveConfig = {
  schemaVersion: 1,
  provisioningHost: 'global.azure-devices-provisioning.net',
  scopeId: '0ne00AABBCC',
  expectedHub: 'test-hub.azure-devices.net',
  cases: {
    ios: {
      registrationId: 'native-ios-test',
      expectedDeviceId: 'different-assigned-identity',
      nonce: 'ios_nonce_1234567890',
    },
  },
};
const key = Buffer.alloc(32, 2).toString('base64');
const nativeTarget = () => ({
  IsUITestBundle: true,
  UseUITargetAppProvidedByTests: true,
  TestBundlePath: '__TESTHOST__/PlugIns/PaadLiveUITests.xctest',
  TestHostPath:
    '__TESTROOT__/Release-iphonesimulator/PaadLiveUITests-Runner.app',
  TestingEnvironmentVariables: {
    DYLD_FRAMEWORK_PATH: '__TESTROOT__/Release-iphonesimulator',
  },
});
const manifest = () => ({
  __xctestrun_metadata__: {FormatVersion: 2},
  TestConfigurations: [{TestTargets: [nativeTarget()]}],
});
const nativeResult = (mode = 'live') => ({
  schemaVersion: 1,
  runner: 'xcuitest',
  mode,
  outcome: 'passed',
  stage: 'finished',
  applicationState: 'not-running',
  observedTargets: ['connection-status'],
  connected: mode === 'live',
  nonceSubmitted: mode === 'live',
  coldRestored: mode === 'live',
});
const inputDiagnostic = (phase = 'focused') => ({
  target: 'connection-registrationId',
  phase,
  element: 'text-field',
  value: 'empty',
  hasNewline: false,
  uiFocused: true,
  hittable: true,
  enabled: true,
  keyboardVisible: true,
});
const interactionDiagnostic = () => ({
  target: 'connection-details',
  phase: 'waiting-for-hittability',
  element: 'not-hittable',
  systemAlert: 'denial-hittable',
  applicationAlert: 'none',
  busyOverlay: false,
  keyboardVisible: false,
  permissionDismissed: false,
  permissionLimitReached: false,
});
const geometryDiagnostic = () => ({
  type: 'button', state: 'not-hittable', frame: 'inside-app',
});
const readinessDiagnostic = () => ({
  matches: 'one', capsuleMatches: 'one', capsuleButtonMatches: 'one',
  target: geometryDiagnostic(), containment: 'inside', size: 'meets-minimum',
});
const tapDiagnostic = (attempt = 'initial') => ({
  attempt, targetState: 'not-hittable', completed: true, permissionHandled: true,
  sheet: 'missing', close: 'missing', identity: 'missing',
  presentation: 'unavailable',
  postTapState: 'not-hittable',
  laterTargetState: 'not-hittable',
  readiness: readinessDiagnostic(),
});
const controlComparison = (capture = 'initial') => ({
  capture, details: 'not-hittable', settings: 'hittable',
  home: 'not-hittable', navigation: 'not-hittable',
  applicationState: 'running-foreground', systemApplicationState: 'running-background',
  systemDenial: 'missing',
  polls: capture === 'initial' ? 'zero' : 'one',
});
const foregroundDiagnostic = () => ({
  before: 'running-background', after: 'running-foreground', activationRequested: true,
});
const resolutionDiagnostic = () => ({
  capture: 'initial',
  checkpoint: 'complete',
  queryType: 'button',
  queryMatches: 'one',
  identifierMatches: 'two',
  buttonMatches: 'one',
  capsuleMatches: 'one',
  capsuleButtonMatches: 'one',
  selected: geometryDiagnostic(),
  untypedFirst: {...geometryDiagnostic(), type: 'other'},
  candidates: [
    {...geometryDiagnostic(), type: 'other'},
    geometryDiagnostic(),
  ],
  capsule: {...geometryDiagnostic(), type: 'other'},
  status: {...geometryDiagnostic(), type: 'static-text', state: 'hittable'},
});
const environment = mode => ({
  PAAD_VARIANT: 'ci',
  DEVELOPER_DIR: '/Applications/Xcode_26.6.app/Contents/Developer',
  IOS_SIMULATOR_DEVELOPER_DIR:
    '/Applications/Xcode_26.6.app/Contents/Developer',
  IOS_SIMULATOR_UDID: '12345678-1234-1234-1234-123456789ABC',
  ...(mode === 'live'
    ? {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        PAAD_LIVE_CONFIRM: 'true',
        GITHUB_REF: 'refs/heads/feature/adr-onboarding',
        GITHUB_REPOSITORY_OWNER: 'owner',
        GITHUB_ACTOR: 'owner',
        GITHUB_SHA: 'a'.repeat(40),
        PAAD_LIVE_EXPECTED_SHA: 'a'.repeat(40),
        PAAD_IOS_UI_DRIVER: 'xcuitest',
        PAAD_LIVE_CONFIG: JSON.stringify(liveConfig),
        MAESTRO_DEVICE_KEY: key,
      }
    : {}),
});

test('native smoke uses fixed synthetic input and refuses even empty live inputs', () => {
  const result = createXCTestCase('smoke');
  expect(result.mode).toBe('smoke');
  expect(result.deviceKey).toBe(Buffer.alloc(64, 1).toString('base64'));
  expect(result.registrationId).toBe('paad-native-ui-fixture');
  for (const [input, secret] of [
    [liveConfig, undefined],
    ['', undefined],
    [undefined, ''],
    [undefined, key],
  ]) {
    expect(() => createXCTestCase('smoke', input, secret)).toThrow(
      'Live input rejected',
    );
  }
});

test('native live input preserves returned identity and real phone model without an app launch bypass', () => {
  expect(createXCTestCase('live', JSON.stringify(liveConfig), key)).toEqual({
    schemaVersion: 1,
    mode: 'live',
    modelId: 'dtmi:azureiot:PhoneAsADevice;2',
    provisioningHost: liveConfig.provisioningHost,
    scopeId: liveConfig.scopeId,
    expectedHub: liveConfig.expectedHub,
    ...liveConfig.cases.ios,
    deviceKey: key,
  });
  expect(() => createXCTestCase('other', liveConfig, key)).toThrow();
  expect(() =>
    createXCTestCase('live', {...liveConfig, deviceKey: key}, key),
  ).toThrow();
});

test.each([
  undefined,
  '',
  'KEY_CANARY',
  `${key}\n`,
  Buffer.alloc(15).toString('base64'),
  'A'.repeat(516),
])(
  'native runner rejects malformed key material without echoing it (%#)',
  value =>
    expect(() => createXCTestCase('live', liveConfig, value)).toThrow(
      'Invalid native UI device input',
    ),
);

test('private xctestrun relocates build paths and injects input only into the test runner', () => {
  const input = manifest();
  const products = path.resolve('build/ios-uitest-derived/Build/Products');
  const config = createXCTestCase('live', liveConfig, key);
  const result = configureXCTestRun(input, products, config);
  const target = result.TestConfigurations[0].TestTargets[0];
  expect(target.TestHostPath).toBe(
    `${products}/Release-iphonesimulator/PaadLiveUITests-Runner.app`,
  );
  expect(target.TestBundlePath).toBe(
    '__TESTHOST__/PlugIns/PaadLiveUITests.xctest',
  );
  expect(target.TestingEnvironmentVariables.DYLD_FRAMEWORK_PATH).toBe(
    `${products}/Release-iphonesimulator`,
  );
  expect(JSON.parse(target.EnvironmentVariables.PAAD_XCTEST_CASE)).toEqual(
    config,
  );
  expect(target.UITargetAppEnvironmentVariables).toEqual({});
  expect(target.UseUITargetAppProvidedByTests).toBe(true);
  expect(target.UITargetAppBundleIdentifier).toBeUndefined();
  expect(target.UITargetAppPath).toBeUndefined();
  expect(JSON.stringify(input)).not.toContain(key);
  expect(input).toEqual(manifest());
});

test('native manifest supports a single legacy target but fails closed on unexpected targets', () => {
  const products = '/owned/Products';
  expect(
    configureXCTestRun(
      {PaadLiveUITests: nativeTarget()},
      products,
      createXCTestCase('smoke'),
    ).PaadLiveUITests.EnvironmentVariables.PAAD_XCTEST_CASE,
  ).toBeDefined();
  for (const value of [
    {},
    {TestConfigurations: []},
    {TestConfigurations: [{TestTargets: [nativeTarget(), nativeTarget()]}]},
    {Other: {...nativeTarget(), IsUITestBundle: false}},
    {Other: {...nativeTarget(), TestBundlePath: '/unrelated.xctest'}},
    {Other: {...nativeTarget(), UseUITargetAppProvidedByTests: false}},
    {Other: {...nativeTarget(), UITargetAppPath: '/owned/IoTPnP.app'}},
    {Other: {...nativeTarget(), UITargetAppBundleIdentifier: 'com.microsoft.iotpnp.ci'}},
  ])
    expect(() => configureXCTestRun(value, products, {})).toThrow();
  expect(() => configureXCTestRun(manifest(), 'relative', {})).toThrow();
});

test('native lane is opt-in, precedes device input with synthetic smoke and retains Maestro default', () => {
  const workflow = yaml.load(
    fs.readFileSync('.github/workflows/live-device.yml', 'utf8'),
  );
  expect(workflow.on.workflow_dispatch.inputs.ios_driver).toMatchObject({
    type: 'choice',
    options: ['maestro', 'xcuitest'],
    default: 'maestro',
  });
  const steps = workflow.jobs.ios.steps;
  const build = steps.findIndex(
    step => step.run === 'bash scripts/ci/build-ios-uitests.sh',
  );
  const smoke = steps.findIndex(
    step => step.run === 'node scripts/ci/run-ios-xcuitest.js smoke',
  );
  const live = steps.findIndex(step => step.env?.MAESTRO_DEVICE_KEY);
  expect(build).toBeGreaterThan(0);
  expect(smoke).toBeGreaterThan(build);
  expect(live).toBeGreaterThan(smoke);
  expect(JSON.stringify(steps.slice(0, live))).not.toMatch(
    /secrets\.|MAESTRO_DEVICE_KEY/,
  );
  expect(steps[build].if).toBe("inputs.ios_driver == 'xcuitest'");
  expect(steps[smoke].if).toBe("inputs.ios_driver == 'xcuitest'");
  expect(steps[live].env.PAAD_IOS_UI_DRIVER).toBe('${{ inputs.ios_driver }}');
  expect(steps[live].if).toBe('${{ !inputs.ios_smoke_only }}');
  expect(workflow.on.workflow_dispatch.inputs.ios_smoke_only).toMatchObject({
    type: 'boolean', default: false,
  });
  expect(
    steps.find(step => step.run === 'bash scripts/ci/install-maestro.sh').if,
  ).toBe("inputs.ios_driver != 'xcuitest'");
});

test('approved capture is opt-in and reaches only the test runner, never the app', () => {
  const data = createXCTestCase('live', JSON.stringify(liveConfig), key);
  const configured = configureXCTestRun(manifest(), '/tmp/products', data, true);
  const target = configured.TestConfigurations[0].TestTargets[0];
  expect(target.EnvironmentVariables.PAAD_XCTEST_CAPTURE).toBe('1');
  expect(target.UITargetAppEnvironmentVariables).toEqual({});
  expect(() => configureXCTestRun(manifest(), '/tmp/products', createXCTestCase('smoke'), true)).toThrow();
  const prior = manifest();
  prior.TestConfigurations[0].TestTargets[0].EnvironmentVariables = {PAAD_XCTEST_CAPTURE: '1'};
  expect(configureXCTestRun(prior, '/tmp/products', data).TestConfigurations[0]
    .TestTargets[0].EnvironmentVariables.PAAD_XCTEST_CAPTURE).toBeUndefined();
  for (const name of ['PAAD_XCTEST_CAPTURE', 'TEST_RUNNER_PAAD_XCTEST_CAPTURE']) {
    expect(() => validateEnvironment('live', {...environment('live'), [name]: '1'})).toThrow();
  }
  expect(() => validateEnvironment('smoke', {
    ...environment('smoke'), PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY: 'not-allowed',
  })).toThrow();
});

test.each(APPROVED_CAPTURES)('only a fixed capture state %s can leave private capture processing', approvedCapture => {
  const result = {...nativeResult(), approvedCapture};
  expect(sanitizeNativeResult(result)).toEqual(result);
  expect(sanitizeNativeResult({...nativeResult('smoke'), approvedCapture})).toBeUndefined();
  expect(sanitizeNativeResult({...nativeResult(), approvedCapture: 'RAW_CANARY'})).toBeUndefined();
});

test('native fixed-result parser strips extra fields and reports the last milestone only', () => {
  const value = {
    ...nativeResult(),
    extra: 'RAW_CANARY',
    error: {text: 'RAW_CANARY'},
  };
  const parsed = parseNativeLog(
    `RAW_CANARY\n${PREFIX}${JSON.stringify(value)}\n`,
    'live',
  );
  expect(parsed).toEqual(nativeResult());
  expect(nativeFlowPassed(parsed, 'live')).toBe(true);
  const later = {
    ...nativeResult(),
    outcome: 'failed',
    failureCategory: 'unexpected-issue',
  };
  expect(
    parseNativeLog(
      `${PREFIX}${JSON.stringify(value)}\n${PREFIX}${JSON.stringify(later)}`,
      'live',
    ),
  ).toEqual(later);
  expect(
    JSON.stringify(
      sanitizeDiagnostics({availability: 'available', nativeUi: value}),
    ),
  ).not.toContain('RAW_CANARY');
});

test('synthetic input checkpoints preserve before/after Return evidence without raw values', () => {
  const inputDiagnostics = INPUT_PHASES.map(phase => ({
    ...inputDiagnostic(phase),
    ...(phase === 'typed' ? {value: 'exact'} : {}),
    ...(['committed', 'settled'].includes(phase)
      ? {value: 'newline-suffix', hasNewline: true, keyboardVisible: false} : {}),
  }));
  const result = {
    ...nativeResult('smoke'), outcome: 'failed', stage: 'manual-navigation',
    failureCategory: 'value-mismatch', applicationState: 'running-foreground',
    inputDiagnostics,
  };
  const dirty = {
    ...result,
    inputDiagnostics: inputDiagnostics.map(entry => ({
      ...entry, rawValue: 'RAW_CANARY', placeholder: 'RAW_CANARY', expected: 'RAW_CANARY',
    })),
  };
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, 'smoke')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(result, 'smoke')).toBe(false);
  expect(Buffer.byteLength(`${PREFIX}${JSON.stringify(result)}`)).toBeLessThan(4096);
});

test.each([
  null,
  {},
  [],
  Array(6).fill(inputDiagnostic()),
  [null],
  [{...inputDiagnostic(), target: 'RAW_CANARY'}],
  [{...inputDiagnostic(), target: 'connection-deviceKey'}],
  [{...inputDiagnostic(), phase: 'RAW_CANARY'}],
  [{...inputDiagnostic(), phase: 'typed'}],
  [{...inputDiagnostic(), element: 'RAW_CANARY'}],
  [{...inputDiagnostic(), value: 'RAW_CANARY'}],
  [inputDiagnostic(), {...inputDiagnostic('cleared'), target: 'connection-scopeId'}],
  ...INPUT_FLAGS.map(flag => [{...inputDiagnostic(), [flag]: 'true'}]),
])('native input diagnostics reject invalid, unbounded or mixed-target evidence (%#)', inputDiagnostics => {
  expect(sanitizeNativeResult({...nativeResult('smoke'), inputDiagnostics})).toBeUndefined();
});

test('native input diagnostics are smoke-only and remain optional for existing results', () => {
  expect(sanitizeNativeResult({
    ...nativeResult(), inputDiagnostics: [inputDiagnostic()],
  })).toBeUndefined();
  for (const mode of ['smoke', 'live']) {
    expect(sanitizeNativeResult(nativeResult(mode))).toEqual(nativeResult(mode));
  }
});

test.each(['smoke', 'live'])('Details interaction state is safe to publish in %s without raw UI data', mode => {
  const interactionDiagnostics = interactionDiagnostic();
  const result = {
    ...nativeResult(mode), outcome: 'failed', stage: 'connecting',
    applicationState: 'running-foreground', failureCategory: 'not-hittable',
    nonceSubmitted: false, coldRestored: false, interactionDiagnostics,
  };
  const dirty = {...result, interactionDiagnostics: {
    ...interactionDiagnostics, label: 'RAW_CANARY', value: 'RAW_CANARY',
    alert: {title: 'RAW_CANARY'}, deviceKey: 'RAW_CANARY',
  }};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, mode)).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(result, mode)).toBe(false);
});

test.each([
  null,
  [],
  Array(50).fill(interactionDiagnostic()),
  {},
  {...interactionDiagnostic(), target: 'connection-deviceKey'},
  {...interactionDiagnostic(), target: 'RAW_CANARY'},
  {...interactionDiagnostic(), phase: 'RAW_CANARY'},
  {...interactionDiagnostic(), element: 'RAW_CANARY'},
  {...interactionDiagnostic(), systemAlert: 'RAW_CANARY'},
  {...interactionDiagnostic(), applicationAlert: 'RAW_CANARY'},
  ...INTERACTION_FLAGS.map(flag => ({...interactionDiagnostic(), [flag]: 'true'})),
])('native interaction state rejects non-allowlisted or unbounded evidence (%#)', interactionDiagnostics => {
  expect(sanitizeNativeResult({...nativeResult(), interactionDiagnostics})).toBeUndefined();
});

test.each(INTERACTION_PHASES)('native parser distinguishes the Details interaction phase %s', phase => {
  const result = {...nativeResult(), interactionDiagnostics: {...interactionDiagnostic(), phase}};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(['smoke', 'live'])('resolution evidence preserves native query differences without raw %s UI data', mode => {
  const resolution = resolutionDiagnostic();
  const result = {
    ...nativeResult(mode), outcome: 'failed', stage: 'connecting',
    applicationState: 'running-foreground', failureCategory: 'not-hittable',
    nonceSubmitted: false, coldRestored: false,
    interactionDiagnostics: {...interactionDiagnostic(), resolution},
  };
  const dirtyGeometry = value => ({
    ...value, label: 'RAW_CANARY', value: 'RAW_CANARY', x: 123, y: 456, hierarchy: 'RAW_CANARY',
  });
  const dirty = {...result, interactionDiagnostics: {...result.interactionDiagnostics, resolution: {
    ...resolution,
    selected: dirtyGeometry(resolution.selected),
    untypedFirst: dirtyGeometry(resolution.untypedFirst),
    capsule: dirtyGeometry(resolution.capsule),
    status: dirtyGeometry(resolution.status),
    candidates: resolution.candidates.map(dirtyGeometry),
    count: 123, frame: {x: 123, y: 456}, deviceKey: 'RAW_CANARY',
  }}};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, mode)).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(result, mode)).toBe(false);
});

test.each([
  null,
  [],
  {},
  {...resolutionDiagnostic(), queryType: 'RAW_CANARY'},
  {...resolutionDiagnostic(), capture: 'RAW_CANARY'},
  {...resolutionDiagnostic(), checkpoint: 'RAW_CANARY'},
  ...RESOLUTION_COUNTS.flatMap(key => [
    {...resolutionDiagnostic(), [key]: 'RAW_CANARY'},
    {...resolutionDiagnostic(), [key]: 1},
  ]),
  ...['selected', 'untypedFirst', 'capsule', 'status'].flatMap(key => [
    {...resolutionDiagnostic(), [key]: null},
    {...resolutionDiagnostic(), [key]: {...geometryDiagnostic(), type: 'RAW_CANARY'}},
    {...resolutionDiagnostic(), [key]: {...geometryDiagnostic(), state: 'RAW_CANARY'}},
    {...resolutionDiagnostic(), [key]: {...geometryDiagnostic(), frame: {x: 123}}},
  ]),
  {...resolutionDiagnostic(), candidates: Array(MAX_RESOLUTION_CANDIDATES + 1).fill(geometryDiagnostic())},
  {...resolutionDiagnostic(), candidates: [null]},
  {...resolutionDiagnostic(), candidates: [{...geometryDiagnostic(), type: 'RAW_CANARY'}]},
])('native resolution evidence rejects arbitrary data and oversized candidate lists (%#)', resolution => {
  expect(sanitizeNativeResult({
    ...nativeResult(), interactionDiagnostics: {...interactionDiagnostic(), resolution},
  })).toBeUndefined();
});

test.each(NATIVE_ISSUES)('a recorded native %s issue cannot become a success', nativeIssue => {
  for (const mode of ['smoke', 'live']) {
    const result = {...nativeResult(mode), nativeIssue};
    expect(sanitizeNativeResult(result)).toEqual(result);
    expect(nativeFlowPassed(result, mode)).toBe(false);
  }
});

test.each(['RAW_CANARY', {description: 'RAW_CANARY'}, null])(
  'native issue classification rejects free-form data (%#)', nativeIssue => {
    expect(sanitizeNativeResult({...nativeResult(), nativeIssue})).toBeUndefined();
  },
);

test.each(NATIVE_OPERATIONS)('retains only the fixed native operation %s', nativeOperation => {
  const result = {...nativeResult(), nativeOperation};
  expect(sanitizeNativeResult(result)).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: result}).nativeUi).toEqual(result);
  expect(sanitizeNativeResult({...result, nativeOperation: 'RAW_CANARY'})).toBeUndefined();
});

test('Details tap evidence records handled interruptions and marker presence without UI text', () => {
  const detailsTapDiagnostics = DETAILS_TAP_ATTEMPTS.map(tapDiagnostic);
  const result = {...nativeResult(), detailsTapDiagnostics};
  const dirty = {...result, detailsTapDiagnostics: detailsTapDiagnostics.map(entry => ({
    ...entry, label: 'RAW_CANARY', value: 'RAW_CANARY', alert: 'RAW_CANARY',
  }))};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, 'live')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
});

test.each([
  null, [], {}, [null], Array(3).fill(tapDiagnostic()),
  [tapDiagnostic('permission-retry')],
  [{...tapDiagnostic(), attempt: 'RAW_CANARY'}],
  [{...tapDiagnostic(), targetState: 'RAW_CANARY'}],
  [{...tapDiagnostic(), completed: 'true'}],
  [{...tapDiagnostic(), permissionHandled: 'true'}],
  ...['sheet', 'close', 'identity'].map(key => [{...tapDiagnostic(), [key]: 'RAW_CANARY'}]),
  [{...tapDiagnostic(), permissionHandled: false}, tapDiagnostic('permission-retry')],
  [{...tapDiagnostic(), completed: false}, tapDiagnostic('permission-retry')],
])('Details tap evidence rejects unbounded or unobserved interruption recovery (%#)', detailsTapDiagnostics => {
  expect(sanitizeNativeResult({...nativeResult(), detailsTapDiagnostics})).toBeUndefined();
});

test.each(ELEMENT_PRESENCES)('Details marker evidence accepts fixed presence %s', presence => {
  const result = {...nativeResult(), detailsTapDiagnostics: [
    {...tapDiagnostic(), sheet: presence, close: presence, identity: presence},
  ]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(DETAILS_PRESENTATIONS)('publishes only the fixed Details presentation state %s', presentation => {
  const result = {...nativeResult(), detailsTapDiagnostics: [{...tapDiagnostic(), presentation}]};
  expect(sanitizeNativeResult(result)).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: result}).nativeUi).toEqual(result);
  expect(sanitizeNativeResult({
    ...result, detailsTapDiagnostics: [{...tapDiagnostic(), presentation: 'RAW_CANARY'}],
  })).toBeUndefined();
});

test('retains pre-tap readiness and later native states without exporting geometry or text', () => {
  const result = {...nativeResult(), detailsTapDiagnostics: [tapDiagnostic()]};
  const dirty = {...result, detailsTapDiagnostics: [{
    ...tapDiagnostic(), readiness: {
      ...readinessDiagnostic(), raw: 'RAW_CANARY', x: 123,
      target: {...geometryDiagnostic(), label: 'RAW_CANARY', frameOrigin: {x: 123}},
    },
  }]};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, 'live')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
});

test.each([
  ...['postTapState', 'laterTargetState'].flatMap(key => [
    {[key]: 'RAW_CANARY'}, {[key]: null}, {[key]: true},
  ]),
  {readiness: null}, {readiness: []}, {readiness: {}},
  ...['matches', 'capsuleMatches', 'capsuleButtonMatches'].flatMap(key => [
    {readiness: {...readinessDiagnostic(), [key]: 'RAW_CANARY'}},
    {readiness: {...readinessDiagnostic(), [key]: 1}},
  ]),
  {readiness: {...readinessDiagnostic(), target: {x: 123}}},
  {readiness: {...readinessDiagnostic(), containment: 'RAW_CANARY'}},
  {readiness: {...readinessDiagnostic(), size: 44}},
])('rejects unbounded Details readiness or later-state data (%#)', change => {
  expect(sanitizeNativeResult({
    ...nativeResult(), detailsTapDiagnostics: [{...tapDiagnostic(), ...change}],
  })).toBeUndefined();
});

test.each(CAPSULE_CONTAINMENTS)('retains categorical capsule containment %s', containment => {
  const result = {...nativeResult(), detailsTapDiagnostics: [{
    ...tapDiagnostic(), readiness: {...readinessDiagnostic(), containment},
  }]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(TOUCH_TARGET_SIZES)('retains categorical touch target size %s', size => {
  const result = {...nativeResult(), detailsTapDiagnostics: [{
    ...tapDiagnostic(), readiness: {...readinessDiagnostic(), size},
  }]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test('accepts prior tap reports without the optional readiness and later-state evidence', () => {
  const {readiness, postTapState, laterTargetState, ...legacy} = tapDiagnostic();
  const result = {...nativeResult(), detailsTapDiagnostics: [legacy]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(['ready', 'timed-out'])('retains initial and %s control comparisons without exporting text', capture => {
  const detailsControlComparisons = [controlComparison(), controlComparison(capture)];
  const result = {...nativeResult(), detailsControlComparisons};
  const dirty = {...result, detailsControlComparisons: detailsControlComparisons.map(entry => ({
    ...entry, label: 'RAW_CANARY', value: 'RAW_CANARY', frame: {x: 123},
    arbitraryControl: 'RAW_CANARY',
  }))};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, 'live')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
});

test.each([
  null, [], {}, [null], [controlComparison('ready')],
  Array(3).fill(controlComparison()), [controlComparison(), controlComparison()],
  [controlComparison(), controlComparison('RAW_CANARY')],
  ...CONTROL_COMPARATORS.flatMap(key => [
    [{...controlComparison(), [key]: undefined}],
    [{...controlComparison(), [key]: 'RAW_CANARY'}],
    [{...controlComparison(), [key]: true}],
    [{...controlComparison(), [key]: {label: 'RAW_CANARY'}}],
  ]),
  ...['applicationState', 'systemApplicationState', 'systemDenial', 'polls'].flatMap(key => [
    [{...controlComparison(), [key]: 'RAW_CANARY'}],
    [{...controlComparison(), [key]: null}],
  ]),
])('rejects unbounded, unordered or arbitrary control comparisons (%#)', detailsControlComparisons => {
  expect(sanitizeNativeResult({...nativeResult(), detailsControlComparisons})).toBeUndefined();
});

test.each(INTERACTION_ELEMENTS)('preserves fixed comparator state %s, including interrupted reads', state => {
  const detailsControlComparisons = [{
    capture: 'initial', ...Object.fromEntries(CONTROL_COMPARATORS.map(key => [key, state])),
  }];
  const result = {...nativeResult(), detailsControlComparisons};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test('a control comparison cannot upgrade a failed actual flow', () => {
  const result = {
    ...nativeResult(), outcome: 'failed', stage: 'connecting', failureCategory: 'not-hittable',
    nonceSubmitted: false, coldRestored: false,
    detailsControlComparisons: [controlComparison(), controlComparison('timed-out')],
  };
  expect(sanitizeNativeResult(result)).toEqual(result);
  expect(nativeFlowPassed(result, 'live')).toBe(false);
  expect(sanitizeNativeResult(nativeResult())).toEqual(nativeResult());
});

test('accepts previous control comparisons without fresh application or system state', () => {
  const {applicationState, systemApplicationState, systemDenial, polls, ...legacy} = controlComparison();
  const result = {...nativeResult(), detailsControlComparisons: [legacy]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(APPLICATION_STATES)('fresh control samples preserve fixed app state %s', state => {
  const result = {...nativeResult(), detailsControlComparisons: [{
    ...controlComparison(), applicationState: state, systemApplicationState: state,
  }]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(INTERACTION_ELEMENTS)('global denial-button observations preserve fixed state %s without action', systemDenial => {
  const result = {...nativeResult(), detailsControlComparisons: [{...controlComparison(), systemDenial}]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(MATCH_COUNTS)('readiness poll observations preserve only fixed count category %s', polls => {
  const result = {...nativeResult(), detailsControlComparisons: [{...controlComparison(), polls}]};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test('permission action evidence names only bounded alert or system-control attempts', () => {
  const result = {...nativeResult(), permissionActions: [...PERMISSION_SOURCES]};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(result)}`, 'live')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: result}).nativeUi).toEqual(result);
  expect(sanitizeNativeResult({
    ...nativeResult(), permissionActions: Array(MAX_PERMISSION_ACTIONS).fill('system-control'),
  })).toBeDefined();
});

test.each(PASSWORD_SAVE_PROMPTS)('password-save handling emits only fixed state %s', passwordSavePrompt => {
  const result = {...nativeResult(), passwordSavePrompt};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(result)}`, 'live')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: result}).nativeUi).toEqual(result);
  expect(sanitizeNativeResult({...nativeResult('smoke'), passwordSavePrompt})).toBeUndefined();
  expect(sanitizeNativeResult({...result, connected: false})).toBeUndefined();
  expect(nativeFlowPassed(result, 'live')).toBe(passwordSavePrompt === 'dismissed');
  expect(nativeFlowPassed({...result, nonceSubmitted: false}, 'live')).toBe(false);
});

test.each([null, {}, [], true, 'Not Now', 'Save Password?', 'RAW_CANARY'])(
  'rejects arbitrary password-save observations (%#)', passwordSavePrompt => {
    expect(sanitizeNativeResult({...nativeResult(), passwordSavePrompt})).toBeUndefined();
  },
);

test.each([
  null, [], {}, ['RAW_CANARY'], [{label: 'RAW_CANARY'}],
  Array(MAX_PERMISSION_ACTIONS + 1).fill('alert'),
])('rejects arbitrary or unbounded permission-action evidence (%#)', permissionActions => {
  expect(sanitizeNativeResult({...nativeResult(), permissionActions})).toBeUndefined();
});

test('foreground preparation publishes only lifecycle categories and an activation flag', () => {
  const result = {...nativeResult(), detailsForeground: foregroundDiagnostic()};
  const dirty = {...result, detailsForeground: {
    ...foregroundDiagnostic(), label: 'RAW_CANARY', value: 'RAW_CANARY', processId: 123,
  }};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, 'live')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
});

test.each([
  null, [], {}, {...foregroundDiagnostic(), before: 'RAW_CANARY'},
  {...foregroundDiagnostic(), after: 'RAW_CANARY'},
  {...foregroundDiagnostic(), activationRequested: 'true'},
  ...['unknown', 'not-running', 'running-foreground'].map(before => ({
    ...foregroundDiagnostic(), before,
  })),
])('rejects malformed foreground evidence or activation of a stopped/foreground app (%#)', detailsForeground => {
  expect(sanitizeNativeResult({...nativeResult(), detailsForeground})).toBeUndefined();
});

test.each(APPLICATION_STATES)('retains partial or unchanged foreground observation %s', before => {
  const result = {...nativeResult(), detailsForeground: {
    before, after: 'unknown', activationRequested: false,
  }};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test.each(RESOLUTION_CHECKPOINTS)('preserves interrupted resolution at %s through the final summary', checkpoint => {
  const unavailable = {type: 'unavailable', state: 'unavailable', frame: 'unavailable'};
  const resolution = {
    ...resolutionDiagnostic(),
    checkpoint,
    ...Object.fromEntries(RESOLUTION_COUNTS.map(key => [key, 'unavailable'])),
    selected: unavailable, untypedFirst: unavailable,
    capsule: unavailable, status: unavailable, candidates: [],
  };
  const result = {
    ...nativeResult(), outcome: 'failed', stage: 'connecting',
    applicationState: 'running-foreground', failureCategory: 'not-hittable',
    nativeIssue: 'snapshot', nonceSubmitted: false, coldRestored: false,
    interactionDiagnostics: {...interactionDiagnostic(), resolution},
  };
  const parsed = parseNativeLog(`${PREFIX}${JSON.stringify(result)}`, 'live');
  expect(parsed).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: parsed}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(parsed, 'live')).toBe(false);
});

test.each(FRAME_VISIBILITIES)('native geometry accepts only the fixed frame category %s', frame => {
  const result = {
    ...nativeResult(), interactionDiagnostics: {
      ...interactionDiagnostic(), resolution: {
        ...resolutionDiagnostic(), selected: {...geometryDiagnostic(), frame},
      },
    },
  };
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test('duplicate target evidence cannot substitute for a unique real Details action', () => {
  const result = {
    ...nativeResult(), outcome: 'failed', failureCategory: 'ambiguous-element',
    stage: 'connecting', applicationState: 'running-foreground',
    nonceSubmitted: false, coldRestored: false,
    interactionDiagnostics: {
      ...interactionDiagnostic(), resolution: {...resolutionDiagnostic(), queryMatches: 'two'},
    },
  };
  expect(sanitizeNativeResult(result)).toEqual(result);
  expect(nativeFlowPassed(result, 'live')).toBe(false);
});

test.each(['smoke', 'live'])('maximum mode-specific %s diagnostics fit the unchanged record limit', mode => {
  const longest = values => values.reduce((a, b) => a.length >= b.length ? a : b);
  const geometry = {
    type: longest(NATIVE_ELEMENT_TYPES), state: longest(INTERACTION_ELEMENTS),
    frame: longest(FRAME_VISIBILITIES),
  };
  const readiness = {
    ...Object.fromEntries(['matches', 'capsuleMatches', 'capsuleButtonMatches']
      .map(key => [key, longest(MATCH_COUNTS)])),
    target: geometry, containment: longest(CAPSULE_CONTAINMENTS), size: longest(TOUCH_TARGET_SIZES),
  };
  const result = {
    ...nativeResult(mode), observedTargets: [...TARGETS].sort((a, b) => b.length - a.length).slice(0, MAX_OBSERVED_TARGETS), outcome: 'failed',
    stage: longest(STAGES), applicationState: longest(APPLICATION_STATES),
    failureCategory: 'ambiguous-element', nativeIssue: longest(NATIVE_ISSUES),
    ambiguousTarget: longest(TARGETS), ambiguousTypes: Array(3).fill('static-text'),
    nativeOperation: longest(NATIVE_OPERATIONS),
    permissionActions: Array(MAX_PERMISSION_ACTIONS).fill(longest(PERMISSION_SOURCES)),
    ...(mode === 'smoke' ? {
      inputDiagnostics: INPUT_PHASES.map(phase => ({
        ...inputDiagnostic(phase), target: longest(INPUT_TARGETS),
        element: longest(INPUT_ELEMENTS), value: longest(INPUT_VALUES),
        ...Object.fromEntries(INPUT_FLAGS.map(key => [key, false])),
      })),
    } : {
      passwordSavePrompt: longest(PASSWORD_SAVE_PROMPTS),
      approvedCapture: longest(APPROVED_CAPTURES),
      detailsTapDiagnostics: DETAILS_TAP_ATTEMPTS.map((attempt, index) => ({
        ...tapDiagnostic(attempt), targetState: longest(INTERACTION_ELEMENTS),
        postTapState: longest(INTERACTION_ELEMENTS), laterTargetState: longest(INTERACTION_ELEMENTS),
        completed: index === 0, permissionHandled: index === 0,
        presentation: longest(DETAILS_PRESENTATIONS), readiness,
        ...Object.fromEntries(['sheet', 'close', 'identity'].map(key => [key, longest(ELEMENT_PRESENCES)])),
      })),
      detailsControlComparisons: ['initial', 'timed-out'].map(capture => ({
        ...controlComparison(capture),
        ...Object.fromEntries(CONTROL_COMPARATORS.map(key => [key, longest(INTERACTION_ELEMENTS)])),
        applicationState: longest(APPLICATION_STATES),
        systemApplicationState: longest(APPLICATION_STATES), systemDenial: longest(INTERACTION_ELEMENTS),
        polls: longest(MATCH_COUNTS),
      })),
      detailsForeground: {
        before: 'running-background-suspended', after: longest(APPLICATION_STATES), activationRequested: true,
      },
    }),
    interactionDiagnostics: {
      ...interactionDiagnostic(), target: longest(INTERACTION_TARGETS),
      phase: longest(INTERACTION_PHASES), element: longest(INTERACTION_ELEMENTS),
      applicationAlert: longest(PERMISSION_ALERTS), systemAlert: longest(PERMISSION_ALERTS),
      resolution: {
      ...resolutionDiagnostic(), capture: longest(RESOLUTION_CAPTURES), checkpoint: longest(RESOLUTION_CHECKPOINTS),
      ...Object.fromEntries(RESOLUTION_COUNTS.map(key => [key, longest(MATCH_COUNTS)])),
      selected: geometry, untypedFirst: geometry, capsule: geometry, status: geometry,
      candidates: Array(MAX_RESOLUTION_CANDIDATES).fill(geometry),
      },
    },
  };
  const line = `${PREFIX}${JSON.stringify(result)}`;
  expect(Buffer.byteLength(line)).toBeLessThan(4096);
  expect(parseNativeLog(line, mode)).toEqual(sanitizeNativeResult(result));
  const withoutAmbiguity = {
    ...result, failureCategory: longest(FAILURE_CATEGORIES),
  };
  delete withoutAmbiguity.ambiguousTarget;
  delete withoutAmbiguity.ambiguousTypes;
  const otherLine = `${PREFIX}${JSON.stringify(withoutAmbiguity)}`;
  expect(Buffer.byteLength(otherLine)).toBeLessThan(4096);
  expect(parseNativeLog(otherLine, mode)).toEqual(sanitizeNativeResult(withoutAmbiguity));
  const missing = {
    ...withoutAmbiguity, failureCategory: 'missing-element', missingTarget: longest(TARGETS),
  };
  const missingLine = `${PREFIX}${JSON.stringify(missing)}`;
  expect(Buffer.byteLength(missingLine)).toBeLessThan(4096);
  expect(parseNativeLog(missingLine, mode)).toEqual(sanitizeNativeResult(missing));
});

test.each(['smoke', 'live'])('missing %s control evidence is failure-bound and allowlisted', mode => {
  const result = {
    ...nativeResult(mode), outcome: 'failed', stage: 'welcome',
    failureCategory: 'missing-element', missingTarget: 'connection-registrationId',
    connected: false, nonceSubmitted: false, coldRestored: false,
  };
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(result)}`, mode)).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: result}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(result, mode)).toBe(false);
  for (const target of TARGETS) {
    expect(sanitizeNativeResult({...result, missingTarget: target})?.missingTarget).toBe(target);
  }
  for (const change of [
    {missingTarget: 'RAW_CANARY'}, {missingTarget: 'bluetooth-heading'}, {missingTarget: null},
    {missingTarget: ['registration-manual']}, {missingTarget: {label: 'RAW_CANARY'}},
    {failureCategory: 'not-hittable'}, {failureCategory: undefined},
    {outcome: 'passed'}, {outcome: 'in-progress'},
  ]) {
    expect(sanitizeNativeResult({...result, ...change})).toBeUndefined();
  }
  const {missingTarget, ...legacy} = result;
  expect(sanitizeNativeResult(legacy)).toEqual(legacy);
});

test('missing native target is captured only after the bounded search exhausts', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const find = swift.split('private func find(')[1].split('private func requireExists(')[0];
  expect(find.indexOf('missingTarget = target')).toBeGreaterThan(find.indexOf('0..<Scroll.backward'));
  expect(find).toMatch(/missingTarget = target\s+throw Failure\.missingElement/);
  const emitter = swift.split('private func emit(outcome:')[1];
  expect(emitter).toContain('outcome == .failed, failureCategory == .missingElement');
  expect(emitter).toContain('record["missingTarget"] = missingTarget.rawValue');
  expect(emitter).not.toMatch(/app\.|\.label\b|\.value\b|debugDescription|screenshot/);
});

test('ambiguous native selectors disclose only a fixed target and three bounded native kinds', () => {
  const result = {
    ...nativeResult(), outcome: 'failed', stage: 'explore-traversal',
    failureCategory: 'ambiguous-element', ambiguousTarget: 'explore-back',
    ambiguousTypes: ['button', 'other'],
  };
  expect(sanitizeNativeResult(result)).toEqual(result);
  for (const change of [
    {ambiguousTarget: 'RAW_CANARY'},
    {ambiguousTypes: ['RAW_CANARY']},
    {ambiguousTypes: Array(4).fill('button')},
    {ambiguousTypes: undefined},
    {ambiguousTarget: undefined},
    {failureCategory: 'not-hittable'},
  ]) {
    expect(sanitizeNativeResult({...result, ...change})).toBeUndefined();
  }
  expect(sanitizeNativeResult({...result, ambiguousTarget: 'bluetooth-heading'})).toBeDefined();
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const unique = swift.split('private func requireUnique(')[1].split('private func tapExperience(')[0];
  expect(unique).toContain('NSPredicate { _, _ in query.count == 1 }');
  expect(unique).toContain('timeout: Timeout.short');
  expect(unique).toContain('guard settled == .completed, query.count == 1 else');
  expect(unique).toContain('0..<min(query.count, Diagnostic.maximumCandidates)');
  expect(unique).toContain('throw Failure.ambiguousElement');
  expect(unique).not.toMatch(/\.label\b|\.value\b|debugDescription|screenshot/);
});

test('native producer keeps synthetic input tracing separate from live Details observations', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const smoke = swift.split('private func runSmoke(')[1].split('private func runLive(')[0];
  const input = swift.split('private func diagnoseInput(')[1].split('private func advance(')[0];
  expect(smoke).not.toMatch(/openDetails|compareDetailsControls|prepareDetailsForeground/);
  expect(input).toContain('guard mode == "smoke"');
});

test('native traversal retains only a bounded recent set of fixed controls without changing proof requirements', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  expect(MAX_OBSERVED_TARGETS).toBe(16);
  expect(swift).toContain(`static let maximumObservedTargets = ${MAX_OBSERVED_TARGETS}`);
  const observe = swift.split('private func observe(')[1].split('private func waitFor(')[0];
  expect(observe).toContain('observed.firstIndex(of: target.rawValue)');
  expect(observe).toContain('observed.count > Diagnostic.maximumObservedTargets');
  expect(observe).toContain('observed.removeFirst()');
  expect(sanitizeNativeResult({...nativeResult(), observedTargets: TARGETS.slice(0, MAX_OBSERVED_TARGETS + 1)})).toBeUndefined();
  expect(nativeFlowPassed({...nativeResult(), nonceSubmitted: false}, 'live')).toBe(false);
  expect(nativeFlowPassed({...nativeResult(), coldRestored: false}, 'live')).toBe(false);
});

test.each(['home-traversal', 'explore-traversal', 'activity-traversal'])(
  'accepts fixed traversal stage %s without treating navigation as completed proof',
  stage => {
    const record = {...nativeResult(), outcome: 'in-progress', stage};
    expect(parseNativeLog(`${PREFIX}${JSON.stringify(record)}`, 'live')).toEqual(record);
    expect(nativeFlowPassed(record, 'live')).toBe(false);
  },
);

test('expanded native selector vocabulary stays fixed and bounded rather than exporting dynamic row identifiers', () => {
  const observedTargets = TARGETS.slice(0, MAX_OBSERVED_TARGETS);
  const record = {...nativeResult(), observedTargets};
  expect(sanitizeNativeResult(record)?.observedTargets).toEqual([...observedTargets].sort());
  for (const id of TARGETS) {
    expect(sanitizeNativeResult({...nativeResult(), observedTargets: [id]})?.observedTargets).toEqual([id]);
  }
  for (const id of ['activity-toggle-123', 'log-payload-123', 'RAW_CANARY', 'home-node-secret']) {
    expect(sanitizeNativeResult({...nativeResult(), observedTargets: [id]})).toBeUndefined();
  }
  expect(sanitizeNativeResult({
    ...nativeResult(), observedTargets: Array(MAX_OBSERVED_TARGETS + 1).fill('tab-home'),
  })).toBeUndefined();
  expect(CONTROL_COMPARATORS).toEqual(['details', 'settings', 'home', 'navigation']);
});

test.each([
  {stage: 'RAW_CANARY'},
  {applicationState: 'RAW_CANARY'},
  {observedTargets: ['RAW_CANARY']},
  {failureCategory: 'RAW_CANARY'},
  {execution: 'RAW_CANARY'},
  {nonceSubmitted: 'true'},
  {observedTargets: Array(100).fill('connection-status')},
])(
  'native diagnostics reject arbitrary source strings or wrong schema (%#)',
  fields => {
    expect(
      sanitizeNativeResult({...nativeResult(), ...fields}),
    ).toBeUndefined();
  },
);

test('native diagnostics bound log bytes, record size/count and malformed/mixed-mode output', () => {
  const line = `${PREFIX}${JSON.stringify(nativeResult())}`;
  expect(parseNativeLog('x'.repeat(MAX_LOG_BYTES + 1), 'live')).toBeUndefined();
  expect(
    parseNativeLog(`${PREFIX}${'x'.repeat(4096)}`, 'live'),
  ).toBeUndefined();
  expect(
    parseNativeLog(Array(65).fill(line).join('\n'), 'live'),
  ).toBeUndefined();
  expect(parseNativeLog(`${line}\n${PREFIX}{bad}`, 'live')).toBeUndefined();
  expect(parseNativeLog(line, 'smoke')).toBeUndefined();
  expect(parseNativeLog('no native completion record', 'live')).toBeUndefined();
});

test.each([
  {outcome: 'in-progress'},
  {stage: 'restoring'},
  {applicationState: 'running-foreground'},
  {nonceSubmitted: false},
  {coldRestored: false},
  {connected: false},
  {failureCategory: 'missing-element'},
])('a partial or contradictory native flow is not accepted (%#)', fields => {
  expect(nativeFlowPassed({...nativeResult(), ...fields}, 'live')).toBe(false);
});

test('smoke proof flags cannot stand in for live proof and vice versa', () => {
  expect(nativeFlowPassed(nativeResult('smoke'), 'smoke')).toBe(true);
  expect(nativeFlowPassed(nativeResult('smoke'), 'live')).toBe(false);
  expect(nativeFlowPassed(nativeResult(), 'smoke')).toBe(false);
});

test('native environment guards reject credentials in smoke and unauthorized live invocation', () => {
  expect(() =>
    validateEnvironment('smoke', environment('smoke')),
  ).not.toThrow();
  expect(() => validateEnvironment('live', environment('live'))).not.toThrow();
  for (const name of [
    'MAESTRO_DEVICE_KEY',
    'PAAD_LIVE_CONFIG',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'PAAD_XCTEST_CASE',
    'TEST_RUNNER_PAAD_XCTEST_CASE',
  ]) {
    expect(() =>
      validateEnvironment('smoke', {...environment('smoke'), [name]: ''}),
    ).toThrow();
  }
  for (const [name, value] of [
    ['PAAD_LIVE_CONFIRM', 'false'],
    ['GITHUB_EVENT_NAME', 'push'],
    ['GITHUB_REF', 'refs/heads/master'],
    ['GITHUB_ACTOR', 'not-owner'],
    ['PAAD_LIVE_EXPECTED_SHA', 'b'.repeat(40)],
    ['PAAD_IOS_UI_DRIVER', 'maestro'],
    ['IOS_SIMULATOR_UDID', 'booted'],
    ['PAAD_VARIANT', 'production'],
    ['PAAD_NATIVE_SMOKE_DIAGNOSTICS', 'true'],
  ])
    expect(() =>
      validateEnvironment('live', {...environment('live'), [name]: value}),
    ).toThrow();
  expect(() => validateEnvironment('smoke', {
    ...environment('smoke'), PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'unexpected',
  })).toThrow();
});

function withRunner(mode, body, overrides = {}) {
  const original = process.cwd();
  const directory = fs.mkdtempSync(
    path.join(original, '.native-ui-unit-'),
  );
  const spawn = jest.spyOn(require('node:child_process'), 'spawnSync');
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    process.chdir(directory);
    for (const child of [
      'build/ios-uitest-derived/Build/Products',
      'build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app',
      ...(mode === 'live' ? ['build/live-device-private/results'] : []),
    ])
      fs.mkdirSync(child, {recursive: true});
    fs.writeFileSync(
      'build/ios-uitest-derived/Build/Products/PaadLiveUITests.xctestrun',
      'fixture',
    );
    spawn.mockImplementation((binary, args, options) => {
      if (binary === overrides.bootstrap?.binary && args.includes(overrides.bootstrap.argument)) {
        fs.writeSync(options.stdio[1], 'RAW_CANARY bootstrap output\n');
        return overrides.bootstrap.result;
      }
      if (binary === 'plutil' && args.includes('json'))
        return {status: 0, stdout: JSON.stringify(manifest())};
      if (binary === 'plutil') {
        expect(args).not.toContain(key);
        fs.writeFileSync(args[args.indexOf('-o') + 1], options.input);
        return {status: 0};
      }
      if (binary === 'xcodebuild') {
        expect(options.env.MAESTRO_DEVICE_KEY).toBeUndefined();
        expect(options.env.PAAD_LIVE_CONFIG).toBeUndefined();
        expect(args.join(' ')).not.toContain(key);
        expect(options.timeout).toBe(mode === 'live' ? 900000 : 420000);
        expect(args).toContain('test-without-building');
        expect(args).toContain('NO');
        const privateInput = JSON.parse(
          fs.readFileSync(args[args.indexOf('-xctestrun') + 1], 'utf8'),
        );
        const target = privateInput.TestConfigurations[0].TestTargets[0];
        expect(target.UITargetAppEnvironmentVariables).toEqual({});
        expect(target.UITargetAppPath).toBeUndefined();
        expect(target.UITargetAppBundleIdentifier).toBeUndefined();
        expect(
          JSON.parse(target.EnvironmentVariables.PAAD_XCTEST_CASE).mode,
        ).toBe(mode);
        expect(target.EnvironmentVariables.PAAD_XCTEST_CAPTURE)
          .toBe(overrides.env?.PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY ? '1' : undefined);
        expect(options.env.PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY).toBeUndefined();
        fs.writeSync(
          options.stdio[1],
          `${overrides.logPrefix || 'RAW_CANARY'}\n${PREFIX}${JSON.stringify(
            overrides.result || nativeResult(mode),
          )}\n`,
        );
        return overrides.process || {status: 0};
      }
      if (binary === 'xcrun' && args[1] === 'spawn') {
        expect(mode).toBe('smoke');
        return overrides.runtime || {status: 0};
      }
      if (binary === 'xcrun' && args[1] === 'bootstatus') {
        expect(mode).toBe('smoke');
        expect(options.timeout).toBe(600000);
        expect(options.killSignal).toBe('SIGKILL');
        expect(args).toEqual(['simctl', 'bootstatus', environment(mode).IOS_SIMULATOR_UDID, '-b']);
        return {status: 0};
      }
      if (binary === 'xcrun' && args[1] === 'install') {
        expect(mode).toBe('smoke');
        expect(options.timeout).toBe(180000);
        expect(options.killSignal).toBe('SIGKILL');
        expect(args[2]).toBe(environment(mode).IOS_SIMULATOR_UDID);
        return {status: 0};
      }
      if (binary === 'xcrun' || binary === 'bash') return {status: 0};
      throw new Error('Unexpected fixture command');
    });
    jest.isolateModules(() => {
      const runner = require('../scripts/ci/run-ios-xcuitest');
      body(runner.executeNative(mode, {...environment(mode), ...overrides.env}), runner);
    });
    expect(spawn.mock.calls.some(([binary, args]) =>
      binary === 'xcrun' && args[1] === 'boot')).toBe(false);
    expect(error.mock.calls.flat().join(' ')).not.toContain('RAW_CANARY');
  } finally {
    process.chdir(original);
    spawn.mockRestore();
    error.mockRestore();
    fs.rmSync(directory, {recursive: true});
  }
}

test('native live orchestration keeps the key and raw logs private, publishing only fixed results', () => {
  withRunner('live', (passed, runner) => {
    expect(passed).toBe(true);
    expect(runner.readDiagnostics()).toEqual({
      availability: 'available',
      nativeUi: {...nativeResult(), execution: 'passed'},
    });
    expect(
      fs.readFileSync(
        'build/live-device-private/results/native-ui.json',
        'utf8',
      ),
    ).not.toMatch(/RAW_CANARY|deviceKey/);
  });
});

test('a successful opted-in live flow does not collect a failure capture', () => {
  const {publicKey} = require('node:crypto').generateKeyPairSync('rsa', {
    modulusLength: 3072, publicKeyEncoding: {type: 'spki', format: 'pem'},
  });
  withRunner('live', passed => {
    expect(passed).toBe(true);
    expect(fs.existsSync('build/ios-encrypted-diagnostic.json')).toBe(false);
  }, {env: {PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY: publicKey}});
});

test('an ineligible approved capture fails visibly without publishing any raw file', () => {
  const {publicKey} = require('node:crypto').generateKeyPairSync('rsa', {
    modulusLength: 3072, publicKeyEncoding: {type: 'spki', format: 'pem'},
  });
  withRunner('live', (passed, runner) => {
    expect(passed).toBe(false);
    expect(runner.readDiagnostics().nativeUi.approvedCaptureExport).toBe('failed');
    expect(fs.existsSync('build/ios-encrypted-diagnostic.json')).toBe(false);
  }, {
    env: {PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY: publicKey},
    result: {...nativeResult(), outcome: 'failed', approvedCapture: 'ineligible'},
  });
  expect(sanitizeNativeResult({...nativeResult(), approvedCaptureExport: 'RAW_CANARY'})).toBeUndefined();
});

test.each(['waiting-for-hittability', 'waiting-for-readiness', 'dismissing-permission', 'tapping', 'waiting-for-sheet'])(
  'native live failure publishes only fixed %s state without changing proof or log retention',
  phase => {
    const interactionDiagnostics = {
      ...interactionDiagnostic(), phase, resolution: resolutionDiagnostic(),
    };
    withRunner('live', (passed, runner) => {
      expect(passed).toBe(false);
      expect(runner.readDiagnostics()).toMatchObject({
        availability: 'available',
        nativeUi: {
          connected: true, nonceSubmitted: false, coldRestored: false,
          failureCategory: 'not-hittable', interactionDiagnostics,
        },
      });
      const text = fs.readFileSync('build/live-device-private/results/native-ui.json', 'utf8');
      expect(text).not.toMatch(/RAW_CANARY|deviceKey|alertTitle/);
      expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
    }, {
      process: {status: 1},
      result: {
        ...nativeResult(), outcome: 'failed', stage: 'connecting',
        applicationState: 'running-foreground', failureCategory: 'not-hittable',
        nonceSubmitted: false, coldRestored: false,
        interactionDiagnostics: {
          ...interactionDiagnostics, alertTitle: 'RAW_CANARY', deviceKey: 'RAW_CANARY',
        },
      },
    });
  },
);

test.each([
  {status: 1},
  {status: 0, signal: 'SIGTERM'},
  {status: null, error: {code: 'ETIMEDOUT'}},
])(
  'a printed native pass never overrides a failed or timed-out process (%#)',
  processResult => {
    withRunner('live', passed => expect(passed).toBe(false), {
      process: processResult,
    });
  },
);

test('native zero exit without complete app proof remains a failure', () => {
  withRunner('live', passed => expect(passed).toBe(false), {
    result: {...nativeResult(), nonceSubmitted: false},
  });
});

test.each([
  ['simulator-ready', 'xcrun', 'bootstatus'],
  ['app-install', 'xcrun', 'install'],
  ['simulator-presentation', 'bash', 'scripts/ci/show-ios-simulator.sh'],
])('pre-secret bootstrap failure reports only its fixed %s checkpoint', (bootstrapStage, binary, argument) => {
  withRunner('smoke', passed => {
    expect(passed).toBe(false);
    const report = fs.readFileSync('build/ios-ui-smoke-summary.json', 'utf8');
    expect(JSON.parse(report)).toEqual({
      uiResult: 'failed',
      diagnostics: {
        availability: 'unavailable', reason: 'native-bootstrap-failed',
        bootstrapStage, execution: 'deadline-exceeded',
      },
    });
    expect(report).not.toContain('RAW_CANARY');
    expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {bootstrap: {binary, argument, result: {error: {code: 'ETIMEDOUT', message: 'RAW_CANARY'}}}});
});

test('native smoke deletes owned private state and writes only the fixed synthetic result', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(true);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
    const text = fs.readFileSync('build/ios-ui-smoke-summary.json', 'utf8');
    expect(text).not.toMatch(/RAW_CANARY|deviceKey/);
    expect(JSON.parse(text)).toMatchObject({uiResult: 'passed'});
    expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
  });
});

test('native smoke summary carries bounded input diagnosis without upgrading failed exact proof', () => {
  const inputDiagnostics = INPUT_PHASES.map(phase => ({
    ...inputDiagnostic(phase), value: 'mismatch', rawValue: 'RAW_CANARY',
  }));
  withRunner('smoke', passed => {
    expect(passed).toBe(false);
    const text = fs.readFileSync('build/ios-ui-smoke-summary.json', 'utf8');
    expect(text).not.toContain('RAW_CANARY');
    expect(JSON.parse(text)).toMatchObject({
      uiResult: 'failed',
      diagnostics: {nativeUi: {
        stage: 'manual-navigation', failureCategory: 'value-mismatch',
        inputDiagnostics: INPUT_PHASES.map(phase => ({
          ...inputDiagnostic(phase), value: 'mismatch',
        })),
      }},
    });
    expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {
    process: {status: 1},
    result: {
      ...nativeResult('smoke'), outcome: 'failed', stage: 'manual-navigation',
      applicationState: 'running-foreground', failureCategory: 'value-mismatch',
      inputDiagnostics,
    },
  });
});

test('explicit credential-free smoke retains a bounded log but still removes private test state', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(true);
    expect(fs.readFileSync('build/ios-ui-smoke.log', 'utf8')).toContain('RAW_CANARY');
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {env: {PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true'}});
});

test('an unavailable optional no-secret runtime log does not replace UI proof or prevent cleanup', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(true);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
    expect(fs.readFileSync('build/ios-ui-smoke.log', 'utf8')).toContain('runtime diagnostics (incomplete)');
  }, {
    env: {PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true'},
    runtime: {status: 1, stderr: 'SYNTHETIC_RUNTIME_ONLY'},
  });
});

test('oversized native output fails proof while credential-free diagnostics retain at most one MiB', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(false);
    expect(fs.statSync('build/ios-ui-smoke.log').size).toBe(MAX_LOG_BYTES);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {
    env: {PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true'},
    logPrefix: 'x'.repeat(MAX_LOG_BYTES + 1),
  });
});

test('Swift diagnostics use only the parser vocabularies and stable public controls', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const values = name => {
    const body = swift.match(new RegExp(`private enum ${name}[^\\{]*\\{([\\s\\S]*?)\\n\\}`))[1];
    return [...body.matchAll(/^  case (\w+)(?: = "([^"]+)")?$/gm)].map(match => match[2] || match[1]);
  };
  expect(values('Stage').sort()).toEqual([...STAGES].sort());
  expect(values('ApplicationState').sort()).toEqual([...APPLICATION_STATES].sort());
  expect(values('InputPhase').sort()).toEqual([...INPUT_PHASES].sort());
  expect(values('InputElement').sort()).toEqual([...INPUT_ELEMENTS].sort());
  expect(values('InputValue').sort()).toEqual([...INPUT_VALUES].sort());
  expect(values('InteractionPhase').sort()).toEqual([...INTERACTION_PHASES].sort());
  expect(values('InteractionElement').sort()).toEqual([...INTERACTION_ELEMENTS].sort());
  expect(values('PermissionAlert').sort()).toEqual([...PERMISSION_ALERTS].sort());
  expect(values('MatchCount').sort()).toEqual([...MATCH_COUNTS].sort());
  expect(values('NativeElementType').sort()).toEqual([...NATIVE_ELEMENT_TYPES].sort());
  expect(values('FrameVisibility').sort()).toEqual([...FRAME_VISIBILITIES].sort());
  expect(values('NativeIssue').sort()).toEqual([...NATIVE_ISSUES].sort());
  expect(values('NativeOperation').sort()).toEqual([...NATIVE_OPERATIONS].sort());
  expect(values('DetailsTapAttempt').sort()).toEqual([...DETAILS_TAP_ATTEMPTS].sort());
  expect(values('ElementPresence').sort()).toEqual([...ELEMENT_PRESENCES].sort());
  expect(values('DetailsPresentation').sort()).toEqual([...DETAILS_PRESENTATIONS].sort());
  expect(values('CapsuleContainment').sort()).toEqual([...CAPSULE_CONTAINMENTS].sort());
  expect(values('TouchTargetSize').sort()).toEqual([...TOUCH_TARGET_SIZES].sort());
  expect(values('ResolutionCapture').sort()).toEqual([...RESOLUTION_CAPTURES].sort());
  expect(values('ApprovedCapture').sort()).toEqual([...APPROVED_CAPTURES].sort());
  expect(values('PermissionSource').sort()).toEqual([...PERMISSION_SOURCES].sort());
  for (const value of values('Failure')) expect(FAILURE_CATEGORIES).toContain(value);
  for (const value of values('Target')) expect(TARGETS).toContain(value);
  expect(swift).toContain('FileHandle.standardOutput.write(Data("PAAD_XCTEST_RESULT:');
  const ordinary = swift.replace(
    /\/\/ MARK: Approved encrypted failure capture[\s\S]*?\/\/ MARK: Diagnostics/,
    '// MARK: Diagnostics',
  );
  expect(ordinary).not.toMatch(/screenshot\(\)|debugDescription|XCTAttachment\(/);
  expect(swift).not.toContain('XCTAttachment(');
  expect(swift).not.toContain('"IoT Plug and Play"');
});

test('Details requires unique hittable in-frame readiness and a real tap-to-sheet transition', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const open = swift.split('private func openDetails()')[1].split('private func tapDetails(')[0];
  const events = [
    'try prepareDetailsForeground()',
    'NSPredicate(format: "exists == false")',
    'on: element(.connectionDetailsSheet)',
    '.connectionDetails, phase: .waitingForReadiness, failure: .notHittable',
    'tapDetails(control, attempt: .initial)',
    '.connectionDetailsSheet, phase: .waitingForSheet, failure: .missingElement',
    'InteractionPhase.sheetVisible.rawValue',
    'advance(to: .details)',
  ].map(text => open.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  const wait = swift.split('private func waitForDetailsTarget(')[1].split('private func requireIdentity(')[0];
  expect(wait).not.toMatch(/NSPredicate|XCTWaiter|XCTNSPredicateExpectation/);
  expect(wait).toContain('? app.buttons.matching(identifier: target.rawValue)');
  expect(wait).toContain('let unique = query.count == 1');
  expect(wait).toContain('updateInteraction(target, field: field, phase: phase) && unique');
  expect(wait).toContain('return query.element');
  expect(wait).toContain('throw Failure.ambiguousElement');
  expect(wait).toContain('dismissKnownPermissionAlert()');
  expect(wait).toContain('ProcessInfo.processInfo.systemUptime + Timeout.standard');
  expect(wait.indexOf('var deadline =')).toBeGreaterThan(wait.indexOf('capture: .initial'));
  expect(wait.indexOf('dismissKnownPermissionAlert()')).toBeLessThan(wait.indexOf('updateInteraction('));
  expect(wait).toContain('if permissionDismissals > handledPermissions');
  expect(wait).toContain('handledPermissions = permissionDismissals');
  expect(wait).toContain('detailsReadinessPolls += 1');
  expect(wait).toContain('while ProcessInfo.processInfo.systemUptime < deadline');
  expect(wait).toContain('Thread.sleep(forTimeInterval: min(Timeout.interactionPoll, remaining))');
  expect(wait).toContain('throw failure');
  expect(wait.indexOf('if updateInteraction(')).toBeLessThan(wait.indexOf('observe(target)'));
  expect(open + wait).not.toMatch(/swipe|coordinate|tap\(\.connectionDetails\)|try find\(|try hittable\(/i);
  const state = swift.split('private func updateInteraction(')[1].split('private func diagnoseInput(')[0];
  expect(state).toContain('target == .connectionDetailsSheet ? exists');
  expect(state).toContain(': exists && state == .hittable');
  expect(state).toContain('frameVisibility(field.frame, in: app.frame) == .insideApp');
  expect(state).toContain('targetReady && !busyOverlay && systemAlert == .none && applicationAlert == .none');
  expect(state).not.toMatch(/\.label\b|\.value\b|placeholderValue|debugDescription|screenshot/);
  expect(state).toContain('element(.appBusyOverlay).exists');
  expect(INTERACTION_TARGETS).toEqual(['connection-details', 'connection-details-sheet']);
  const record = swift.split('override func record(')[1].split('// MARK: Entry point')[0];
  expect(record).not.toMatch(/updateInteraction|app\.|permissionAlertState/);
});

test('Details retries only a handled in-tap interruption with a still-absent sheet and ready button', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const open = swift.split('private func openDetails()')[1].split('private func tapDetails(')[0];
  expect(open).toContain('detailsTapDiagnostics = []');
  expect(open).toContain('if interrupted && !element(.connectionDetailsSheet).waitForExistence(timeout: Timeout.short)');
  expect(open).toContain('if !diagnoseDetailsPresentation()');
  expect(open.match(/\.connectionDetails, phase: \.waitingForReadiness, failure: \.notHittable/g)).toHaveLength(2);
  expect(open.match(/attempt: \.permissionRetry/g)).toHaveLength(1);
  expect(open).not.toMatch(/\bfor\b|\bwhile\b|\bcatch\b/);
  const tap = swift.split('private func tapDetails(')[1].split('private func diagnoseDetailsPresentation(')[0];
  const events = [
    'let dismissalsBeforeTap = permissionDismissals',
    'detailsTapDiagnostics.append(', '"completed": false',
    'InteractionPhase.tapping.rawValue', 'emit(outcome: .inProgress)', 'control.tap()',
    'permissionDismissals > dismissalsBeforeTap', '["completed"] = true',
    '["permissionHandled"] = interrupted', 'return interrupted',
  ].map(text => tap.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  const presentation = swift.split('private func diagnoseDetailsPresentation(')[1].split('private func detailsPresentation(')[0];
  expect(presentation).toContain('element(.connectionDetailsSheet).exists');
  expect(presentation).toContain('("close", .connectionDetailsClose)');
  expect(presentation).toContain('("identity", .assignedDeviceId)');
  expect(tap + presentation).not.toMatch(/\.label\b|\.value\b|debugDescription|screenshot|coordinate|swipe/);
  const wait = swift.split('private func waitForDetailsTarget(')[1].split('private func requireIdentity(')[0];
  expect(wait).not.toContain('requireHittable');
  const emitter = swift.split('private func emit(outcome:')[1];
  expect(emitter).toContain('record["detailsTapDiagnostics"] = detailsTapDiagnostics');
});

test('retains readiness before the real tap and samples later state without changing actions', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const tap = swift.split('private func tapDetails(')[1].split('private func diagnoseDetailsPresentation(')[0];
  expect(tap).toContain('detailsTapDiagnostics[index]["readiness"] = detailsReadiness');
  expect(tap.indexOf('["readiness"]')).toBeLessThan(tap.indexOf('control.tap()'));
  expect(tap.indexOf('["postTapState"] = interactionState(control)')).toBeGreaterThan(tap.indexOf('control.tap()'));
  expect(tap.match(/control\.tap\(\)/g)).toHaveLength(1);
  expect(tap).toContain('throws -> Bool');
  expect(tap).toContain('let targetState = interactionState(control)');
  expect(tap).toContain('"targetState": targetState.rawValue');
  expect(tap).toContain('guard targetState == .hittable else { throw Failure.notHittable }');
  expect(tap.indexOf('guard targetState == .hittable')).toBeLessThan(tap.indexOf('control.tap()'));
  expect(tap).not.toMatch(/\bwhile\b|\bfor\b/);
  const presentation = swift.split('private func diagnoseDetailsPresentation(')[1].split('private func detailsPresentation(')[0];
  expect(presentation).toContain('["laterTargetState"] = interactionState(query.firstMatch)');
  const readiness = swift.split('private func retainDetailsReadiness(')[1].split('private func diagnoseResolution(')[0];
  expect(readiness).toContain('frame.width >= 44 && frame.height >= 44');
  expect(readiness).toContain('frameVisibility(frame, in: capsule.frame)');
  expect(readiness).not.toMatch(/\.label\b|\.value\b|print\(|\.tap\(|coordinate|screenshot/);
  const diagnosis = swift.split('private func diagnoseResolution(')[1].split('private func permissionAlertState(')[0];
  expect(diagnosis).toContain('if target == .connectionDetails && capture == .ready');
  expect(diagnosis).toContain('retainDetailsReadiness(field, capsule: capsule)');
});

test('presentation classification reads only the fixed Details button and never exports its native value', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const state = swift.split('private func detailsPresentation()')[1].split('private func waitForDetailsTarget(')[0];
  expect(state).toContain('app.buttons.matching(identifier: Target.connectionDetails.rawValue)');
  expect(state).toContain('guard query.count == 1');
  expect(state).toContain('let value = query.element.value');
  expect(state).toContain('case "busy": return .opening');
  expect(state).toContain('case "expanded": return .shown');
  expect(state).toContain('default: return .unknown');
  expect(state).not.toMatch(/print\(|emit\(|standardOutput|record\[|detailsTapDiagnostics|\.tap\(/);
});

test('control comparisons are bounded read-only observations, not readiness or navigation fallbacks', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const comparison = swift.split('private func compareDetailsControls(')[1]
    .split('private func retainDetailsReadiness(')[0];
  const wait = swift.split('private func waitForDetailsTarget(')[1]
    .split('private func requireIdentity(')[0];
  for (const capture of ['initial', 'ready', 'timedOut']) {
    expect(wait).toContain(`if target == .connectionDetails {\n      ${capture === 'ready' ? '    ' : ''}compareDetailsControls(.${capture})`);
  }
  expect(wait).toContain('if target == .connectionDetails {\n      detailsControlComparisons = []');
  expect(wait.indexOf('detailsControlComparisons = []')).toBeLessThan(wait.indexOf('updateInteraction('));
  expect(comparison).toContain('count == 1 ? interactionState(query.element) : .unavailable');
  expect(comparison).toContain('Target.appSettings.rawValue');
  expect(comparison).toContain('Target.navigationContent.rawValue');
  expect(comparison).toContain('Target.tabHome.rawValue');
  expect(comparison).not.toContain('Telemetry, tab, 1 of 5');
  expect(comparison).toContain('refreshApplicationState()');
  expect(comparison).toContain('observedApplicationState(springBoard).rawValue');
  expect(comparison).toContain('NSPredicate(format: "label IN %@", argumentArray: [Self.permissionDenyLabels])');
  expect(comparison).toContain('"polls": matchCount(detailsReadinessPolls).rawValue');
  for (const key of CONTROL_COMPARATORS) {
    expect(comparison).toContain(`"${key}"`);
  }
  expect(comparison).not.toMatch(/\.label\b|\.value\b|debugDescription|screenshot|coordinate|\.tap\(|swipe|activate\(|emit\(|waitFor/);
  expect(swift.split('private func emit(outcome:')[1])
    .toContain('record["detailsControlComparisons"] = detailsControlComparisons');
});

test('foreground preparation activates only an observed background process, never a stopped app', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const preparation = swift.split('private func prepareDetailsForeground()')[1]
    .split('private func openDetails()')[0];
  const events = [
    'refreshApplicationState()', 'detailsForeground?["before"]',
    'switch applicationState', 'case .runningForeground:', 'break',
    'case .runningBackground, .runningBackgroundSuspended:',
    'detailsForeground?["activationRequested"] = true', 'app.activate()',
    'app.wait(for: .runningForeground, timeout: Timeout.launch)',
    'default:',
    'detailsForeground?["after"]',
    'guard applicationState == .runningForeground',
  ].map(text => preparation.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  expect(preparation.match(/app\.activate\(\)/g)).toHaveLength(1);
  const stopped = preparation.split('default:')[1].split('nativeOperation = .stateCheck')[0];
  expect(stopped).toContain('throw Failure.launchFailed');
  expect(stopped).not.toContain('app.activate()');
  expect(preparation).not.toMatch(/\.tap\(|swipe|coordinate|\.launch\(|\bwhile\b|\bfor\s+|\bcatch\b/);
  const emitter = swift.split('private func emit(outcome:')[1];
  expect(emitter).toContain('record["detailsForeground"] = detailsForeground');
});

test('resolution evidence survives polling and query aborts without text or coordinate taps', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const wait = swift.split('private func waitForDetailsTarget(')[1].split('private func requireIdentity(')[0];
  expect(wait.match(/diagnoseResolution\(/g)).toHaveLength(3);
  expect(wait.indexOf('capture: .initial')).toBeLessThan(wait.indexOf('while ProcessInfo'));
  const diagnosis = swift.split('private func diagnoseResolution(')[1].split('private func permissionAlertState(')[0];
  expect(diagnosis).toContain('0..<min(count, Diagnostic.maximumCandidates)');
  expect(diagnosis).toContain('matches.element(boundBy: index)');
  expect(diagnosis).toContain('elementGeometry(matches.firstMatch, viewport: viewport)');
  expect(diagnosis).toContain('Target.connectionStatusCapsule.rawValue');
  expect(diagnosis).toContain('capsuleCount == 1');
  expect(diagnosis).toContain('elementGeometry(element(.connectionStatus), viewport: viewport)');
  expect(diagnosis).not.toMatch(/\.label\b|\.value\b|debugDescription|screenshot|\.tap\(/);
  expect(diagnosis.indexOf('resolutionDiagnostics =')).toBeLessThan(diagnosis.indexOf('let viewport = app.frame'));
  expect(diagnosis).not.toContain('interactionDiagnostics?["resolution"]');
  for (const checkpoint of RESOLUTION_CHECKPOINTS) {
    expect(diagnosis).toContain(`"${checkpoint}"`);
  }
  const update = swift.split('private func updateInteraction(')[1].split('private func diagnoseInput(')[0];
  expect(update).not.toContain('resolutionDiagnostics');
  const emitter = swift.split('private func emit(outcome:')[1];
  expect(emitter).toContain('interaction["resolution"] = resolutionDiagnostics');
  expect(emitter).toContain('resolutionTarget?.rawValue == (interaction["target"] as? String)');
  const classifier = swift.split('private func classifyIssue(')[1].split('private func matchCount(')[0];
  expect(classifier).toContain('issue.compactDescription.lowercased()');
  expect(classifier).not.toMatch(/print\(|standardOutput|emit\(/);
  const geometry = swift.split('private func frameVisibility(')[1].split('private func diagnoseResolution(')[0];
  expect(geometry).toContain('frame.origin.x.isFinite');
  expect(geometry).toContain('viewport.contains(frame)');
  expect(geometry).toContain('frameVisibility(field.frame, in: viewport).rawValue');
  expect(geometry).not.toMatch(/\.label\b|\.value\b|print\(|\.tap\(|coordinate/);
  expect(swift).toContain(`static let maximumCandidates = ${MAX_RESOLUTION_CANDIDATES}`);
});

test('password saving is declined only inside the observed native sheet, once and within the shared budget', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const dismissal = swift.split('private func dismissPasswordSaveSheet()')[1]
    .split('private func dismissKnownPermissionAlert()')[0];
  expect(dismissal).toContain('mode == "live", connected, passwordSavePrompt == nil');
  expect(dismissal).toContain('permissionAttempts < Permission.maximumAttempts');
  expect(dismissal).toContain('app.state == .runningForeground, !element(.formDeviceKey).exists');
  expect(dismissal).toContain('app.sheets.matching(NSPredicate(format: "label == %@", "Save Password?"))');
  expect(dismissal).toContain('guard sheets.count <= 1 else { throw Failure.ambiguousElement }');
  expect(dismissal).toContain('guard sheets.count == 1 else { return false }');
  expect(dismissal).toContain('sheet.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))');
  expect(dismissal).toContain('sheet.buttons.matching(NSPredicate(format: "label == %@", "Save"))');
  expect(dismissal).toContain('guard declines.count == 1, saves.count == 1');
  expect(dismissal).toContain('guard decline.isEnabled, decline.isHittable');
  const events = [
    'permissionAttempts += 1', 'passwordSavePrompt = .declining',
    'emit(outcome: .inProgress)', 'decline.tap()', 'try waitFor(',
    'NSPredicate(format: "exists == false"), on: sheet', 'passwordSavePrompt = .dismissed',
  ].map(text => dismissal.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  expect(dismissal.match(/\.tap\(\)/g)).toHaveLength(1);
  expect(dismissal).not.toMatch(/springBoard|app\.buttons|permissionDismissals \+=|coordinate|while |\.label\b|\.value\b/);
  const labels = swift.split('private static let permissionDenyLabels = [')[1].split(']')[0];
  expect(labels).not.toMatch(/Not Now|Save/);
  const wait = swift.split('private func waitForDetailsTarget(')[1].split('private func requireIdentity(')[0];
  expect(wait.match(/try dismissPasswordSaveSheet\(\)/g)).toHaveLength(2);
  expect(wait).toContain('if target == .connectionDetails, try dismissPasswordSaveSheet()');
});

test('explicit and interruption permission handling share a bounded allowlisted denial action', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const setup = swift.split('override func setUp()')[1].split('override func tearDown()')[0];
  expect(setup).toContain('self?.denyPermissionAlert(alert) ?? false');
  const dismissal = swift.split('private func dismissKnownPermissionAlert()')[1]
    .split('// MARK: Configuration')[0];
  expect(dismissal).toContain('[springBoard.alerts.firstMatch, app.alerts.firstMatch]');
  expect(dismissal).toContain('permissionAttempts < Permission.maximumAttempts, alert.exists');
  expect(dismissal).toContain('for label in Self.permissionDenyLabels');
  expect(dismissal).toContain('button.exists && button.isHittable');
  expect(dismissal).toContain('app.state == .runningForeground');
  expect(dismissal).toContain('let denials = springBoard.buttons.matching(');
  expect(dismissal).toContain('NSPredicate(format: "label IN %@", argumentArray: [Self.permissionDenyLabels])');
  expect(dismissal).toContain('guard denials.count == 1 else { return }');
  expect(dismissal).toContain('performPermissionDenial(denials.element, source: .systemControl)');
  expect(dismissal).toContain('return performPermissionDenial(button, source: .alert)');
  expect(dismissal).toContain('button.exists && button.isEnabled && button.isHittable');
  const events = [
    'permissionAttempts += 1',
    'permissionActions.append(source.rawValue)',
    'InteractionPhase.dismissingPermission.rawValue', 'emit(outcome: .inProgress)',
    'button.tap()', 'permissionDismissals += 1', 'permissionDismissed = true',
    'pendingCategory = previousCategory',
  ].map(text => dismissal.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  expect(swift).toContain(`static let maximumAttempts = ${MAX_PERMISSION_ACTIONS}`);
  expect(dismissal).not.toMatch(/buttons\.firstMatch|coordinate|\.label\b|\.value\b|while /);
  const classify = swift.split('private func permissionAlertState(')[1]
    .split('private func updateInteraction(')[0];
  expect(classify).toContain('var state: PermissionAlert = .other');
  expect(classify).toContain('return .denialHittable');
  expect(classify).not.toMatch(/\.tap\(|\.label\b|\.value\b/);
});

test('input diagnosis brackets real keystrokes, leaves exact proof strict, and excludes live/secure input', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const entry = swift.split('private func enterExactText(')[1].split('private func enterSecret(')[0];
  const events = [
    'inputDiagnostics = []', 'focusField(target)', 'phase: .focused',
    'clearField(field)', 'phase: .cleared', 'typeCharacters(text, into: field)', 'phase: .typed',
    'commitField(field)', 'phase: .committed', 'requireExactValue(on: field',
    'phase: .settled', 'throw failure',
  ].map(text => entry.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  const exact = swift.split('private func requireExactValue(')[1].split('private func requireExactText(')[0];
  expect(exact).toContain('(field.value as? String) == text');
  expect(exact).toContain('on: NSNull(), timeout: Timeout.short, failure: failure');
  expect(exact).not.toMatch(/trimmingCharacters|placeholderValue|NSPredicate\(format:/);
  const commit = swift.split('private func commitField(')[1].split('private func enterExactText(')[0];
  expect(commit).toContain('field.typeText("\\n")');
  expect(commit).toContain('NSPredicate(format: "exists == false")');
  expect(commit).toContain('on: app.keyboards.firstMatch, timeout: Timeout.short, failure: .keyboardUnavailable');
  expect(commit.indexOf('field.typeText("\\n")')).toBeLessThan(commit.indexOf('try waitFor('));
  expect(entry).toContain('try commitField(field)');
  const diagnostic = swift.split('private func diagnoseInput(')[1].split('private func advance(')[0];
  expect(diagnostic).toContain('guard mode == "smoke"');
  expect(diagnostic).toContain('[.formRegistrationId, .formScopeId, .formProvisioningHost].contains(target)');
  expect(INPUT_TARGETS).toEqual([
    'connection-registrationId', 'connection-scopeId', 'connection-provisioningHost',
  ]);
  expect(diagnostic).toContain('kind != .secureTextField ? field.value : nil');
  expect(diagnostic).toContain('"value": value.rawValue');
  expect(diagnostic).not.toMatch(/print\(|debugDescription|value\(forKey:|String\(describing:/);
  const secret = swift.split('private func enterSecret(')[1].split('private func requireMaskedEntry(')[0];
  expect(secret).toContain('inputDiagnostics = []');
  expect(secret).not.toContain('diagnoseInput(');
  expect(secret).toContain('typeCharacters(secret, into: field)');
  expect(secret).toContain('try commitField(field)');
  expect(secret).toContain('requireMaskedEntry(field, expectedLength: secret.count)');
  const typing = swift.split('private func typeCharacters(')[1].split('@discardableResult')[0];
  expect(typing).toContain('for character in text');
  expect(typing).toContain('field.typeText(String(character))');
  expect(typing).not.toMatch(/setValue|paste|UIPasteboard|sleep|usleep/);
});

test('native smoke never submits credentials and live cold restoration uses an actual process stop', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const smoke = swift.split('private func runSmoke(')[1].split('private func runLive(')[0];
  expect(smoke).not.toMatch(/tap\(\.formSubmit\)|tap\(\.proofSend\)/);
  expect(smoke).toContain('requireExists(.formSubmit');
  expect(swift).toContain('app.terminate()');
  expect(swift).toContain('app.wait(for: .notRunning');
  expect(swift).toContain('guard app.state == .notRunning else');
  expect(swift.match(/app\.activate\(\)/g)).toHaveLength(3);
  expect(swift).not.toContain('app.launch()');
  expect(swift.match(/app.launchEnvironment = \[:\]/g)).toHaveLength(3);
  expect(swift).not.toMatch(/app\.launchEnvironment\s*=\s*(?:ProcessInfo|config)/);
  expect(swift).not.toContain('func finalize(');
  const finalized = swift.split('private func emitFinalResult()')[1].split('private func refreshApplicationState')[0];
  expect(finalized).not.toContain('app.state');
  expect(finalized).toContain('failureCount');
  expect(finalized).toContain('stage == .finished && applicationState == .notRunning');
});

test('approved visual capture is gated after Connected with the credential form absent and no attachments', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const capture = swift.split('// MARK: Approved encrypted failure capture')[1]
    .split('// MARK: Diagnostics')[0];
  expect(capture).toContain('guard connected, app.state == .runningForeground');
  expect(capture).toContain('!element(.formDeviceKey).exists');
  expect(capture).toContain('!element(.formRegistrationId).exists');
  expect(capture).toContain('app.secureTextFields.count == 0');
  expect(capture).toContain('status.label == AppLabel.connected');
  expect(capture).toContain('guard let key = captureRedactionKey, approvedCapture == nil');
  expect(capture).toContain('guard mode == "live", captureEligible()');
  expect(capture).toContain('.replacingOccurrences(of: key, with: "[REDACTED]")');
  expect(capture).toContain('paad-approved-diagnostic');
  expect(capture).toContain('options: .withoutOverwriting');
  expect(capture).not.toMatch(/XCTAttachment|print\(|standardOutput|\.tap\(|\.activate\(/);
  const timeout = swift.split('private func waitForDetailsTarget(')[1].split('private func requireIdentity(')[0];
  expect(timeout.indexOf('captureApprovedFailure()')).toBeGreaterThan(timeout.indexOf('capture: .timedOut'));
  expect(swift.split('override func record(')[1].split('// MARK: Entry point')[0])
    .not.toContain('captureApprovedFailure');
});
test('native project and build preserve existing app signing and reject reused or arbitrary deletion roots', () => {
  const ruby = fs.readFileSync('scripts/ci/create-ios-uitest-project.rb', 'utf8');
  const build = fs.readFileSync('scripts/ci/build-ios-uitests.sh', 'utf8');
  expect(ruby).not.toMatch(/rm_rf|rm_r\b/);
  expect(ruby).toContain("project_dir == File.join(build, 'ios-uitest')");
  expect(ruby).toContain('!File.exist?(project_dir)');
  expect(ruby).toContain("new_target(:ui_test_bundle, NAME");
  expect(build).not.toMatch(/rm -rf|\|\| :/);
  expect(build).toContain('MAESTRO_DEVICE_KEY+x');
  expect(build).toContain('TEST_RUNNER_PAAD_XCTEST_CASE+x');
  expect(build).toContain('test ! -e build/ios-uitest-derived');
  expect(build).toContain('UseUITargetAppProvidedByTests');
  expect(build).toContain('codesign --verify --strict --deep "$app"');
  expect(build).toContain('= "$app_identity"');
});
