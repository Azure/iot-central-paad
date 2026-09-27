const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');
const liveConfig = require('../scripts/ci/live-config');
const {TARGETS: NATIVE_TARGET_IDS} = require('../scripts/ci/ios-xcuitest-result');
const {
  collectLiveDiagnostics, sanitizeDiagnostics, parseCommands, parseHierarchy,
  COMMAND_KINDS, TARGET_IDS, ERROR_CODES, LIMITS, UNAVAILABLE_REASONS, UI_PRESENCE_IDS, APP_SURFACE_IDS,
} = require('../scripts/ci/live-diagnostics');

const CANARY = 'SECRET_CANARY';
const permissionAbsenceSelector = yaml.loadAll(
  fs.readFileSync('.maestro/dismiss-android-permissions.yaml', 'utf8'),
)[1][0].runFlow.commands[2].assertNotVisible.id;
const rowCategories = new Map([
  ['activity-toggle-[0-9]+', 'activity-row-toggle'],
  ['activity-details-[0-9]+', 'activity-row-details'],
  ['log-toggle-[0-9]+', 'log-row-toggle'],
  ['log-payload-[0-9]+', 'log-row-payload'],
]);
const command = (kind = 'assertConditionCommand') => ({
  command: {
    [kind]: {
      condition: {visible: {idRegex: 'connection-status', textRegex: CANARY}},
      text: CANARY, inputText: CANARY, env: {key: CANARY}, label: CANARY,
      selector: {idRegex: CANARY, textRegex: CANARY, below: {idRegex: CANARY}},
      payload: CANARY, originalDescription: CANARY,
    },
    unknownCommand: CANARY,
  },
  metadata: {
    status: 'FAILED', sequenceNumber: 42, timestamp: CANARY, duration: CANARY, depth: CANARY,
    error: {message: CANARY, debugMessage: CANARY, stack: CANARY},
    evaluatedCommand: {inputTextCommand: {text: CANARY}},
    artifacts: [{type: CANARY, path: CANARY}],
    env: {key: CANARY},
  },
  inputText: CANARY, environment: {key: CANARY}, payload: CANARY,
});
const node = (id, text, children = []) => ({
  attributes: {
    'resource-id': id, text, accessibilityText: CANARY, hintText: CANARY,
    value: CANARY, title: CANARY, bounds: CANARY, payload: CANARY,
  },
  children, error: {message: CANARY, debugMessage: CANARY}, payload: CANARY,
});
const hierarchy = () => node(CANARY, CANARY, [
  node('connection-deviceKey', CANARY),
  node('connection-error-code', 'AUTHENTICATION_FAILED'),
  node('connection-service-code', '401002'),
  node('proof-status', 'Submitted locally'),
]);
const permissionAbsenceCommand = () => ({
  command: {
    assertConditionCommand: {
      condition: {notVisible: {idRegex: permissionAbsenceSelector, optional: false}},
      optional: false, payload: CANARY,
    },
  },
  metadata: {
    status: 'FAILED', sequenceNumber: 168,
    error: {message: `Assertion is false: ${CANARY}`, debugMessage: CANARY},
    artifacts: [{path: CANARY}], payload: CANARY,
  },
});

afterEach(() => jest.restoreAllMocks());

test.each(COMMAND_KINDS)('allows only safe command metadata for %s', kind => {
  const result = parseCommands([command(kind)]);
  expect(result).toEqual([{sequenceNumber: 42, commandKind: kind, targetId: 'connection-status'}]);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test.each(['tapOnElement', 'scrollUntilVisible'])('reads pinned selector shape for %s', kind => {
  const input = command(kind);
  input.command[kind].selector.idRegex = 'proof-send';
  expect(parseCommands([input])[0].targetId).toBe('proof-send');
});

test.each([
  ['Assertion is false: ', 'assertion-failed'],
  ['Element not found: ', 'element-not-found'],
  ['Parent element not found: ', 'parent-element-not-found'],
  ['No visible element found: ', 'visible-element-not-found'],
  ["'tap' failed: ", 'tap-operation-failed'],
  ["'viewHierarchy' failed: ", 'hierarchy-operation-failed'],
  ["'isWindowUpdating' failed: ", 'window-check-failed'],
  ["Device server died during '", 'device-server-died'],
  ['Device became unreachable during ', 'device-unreachable'],
  ['iOS driver not ready in time,', 'ios-driver-startup-timeout'],
  ['Failed to get screenshot: Timed out while requesting screenshot.', 'screenshot-timeout'],
])('classifies fixed framework error prefixes without exporting their details (%#)', (prefix, category) => {
  const input = command();
  input.metadata.error.message = prefix + CANARY;
  const commands = parseCommands([input]);
  expect(commands[0].failureCategory).toBe(category);
  const result = sanitizeDiagnostics({availability: 'available', failedCommands: commands});
  expect(result.failedCommands[0].failureCategory).toBe(category);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('rejects arbitrary failure categories and untyped hierarchy availability', () => {
  const result = sanitizeDiagnostics({
    availability: 'available', hierarchyCaptured: CANARY,
    failedCommands: [{sequenceNumber: 1, commandKind: 'assertCommand', failureCategory: CANARY}],
  });
  expect(result).toEqual({
    availability: 'available', failedCommands: [{sequenceNumber: 1, commandKind: 'assertCommand'}], ui: {},
  });
});

test.each([
  'Multiple elements found: ', 'Ambiguous element: ', 'Element is not hittable: ',
  'Timed out waiting for idle: ', 'Element not found without the pinned delimiter ',
])('does not invent Android ambiguity, hittability or idle-timeout errors (%#)', prefix => {
  const input = command('tapOnElement');
  input.metadata.error.message = prefix + CANARY;
  const result = parseCommands([input]);
  expect(result[0].failureCategory).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('ignores unknown kinds, nonfailed commands and invalid sequence numbers', () => {
  for (const value of [CANARY, -1, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const input = command();
    input.metadata.sequenceNumber = value;
    expect(parseCommands([input])).toEqual([]);
  }
  const input = command(CANARY);
  expect(parseCommands([input])).toEqual([]);
  const completed = command();
  completed.metadata.status = 'COMPLETED';
  expect(parseCommands([completed])).toEqual([]);
  expect(() => parseCommands({error: CANARY})).toThrow('Unavailable');
  expect(() => parseCommands(Array(LIMITS.commands + 1).fill(null))).toThrow('Unavailable');
});

test('never exports selector textRegex even for a known UI target', () => {
  const input = command('tapOnElement');
  input.command.tapOnElement.selector = {idRegex: 'connection-deviceKey', textRegex: CANARY};
  expect(parseCommands([input])).toEqual([{
    sequenceNumber: 42, commandKind: 'tapOnElement', targetId: 'connection-deviceKey',
  }]);
});

test('every selector in both real experience flows has fixed target attribution', () => {
  const seenPatterns = new Set();
  const seenLiterals = new Set();
  const shapes = [
    ['tapOn', 'tapOnElement', selector => ({selector})],
    ['assertVisible', 'assertConditionCommand', selector => ({condition: {visible: selector}})],
    ['assertNotVisible', 'assertConditionCommand', selector => ({condition: {notVisible: selector}})],
  ];
  const selectorIds = value => value && typeof value === 'object'
    ? [
      ...(typeof value.id === 'string' ? [value.id] : []),
      ...Object.values(value).flatMap(selectorIds),
    ] : [];
  for (const file of ['experience-home.yaml', 'experience-live.yaml']) {
    const flow = yaml.loadAll(fs.readFileSync(`.maestro/${file}`, 'utf8'))[1];
    for (const step of flow) {
      const shape = shapes.find(([name]) => typeof step[name]?.id === 'string');
      if (!shape) {
        expect(selectorIds(step)).toEqual([]);
        continue;
      }
      const [name, kind, serialize] = shape;
      const selector = step[name];
      // Pinned ElementSelector has optional=false and a nullable String index;
      // Condition serializes visible/notVisible, with null alternatives omitted.
      const raw = command(kind);
      raw.command[kind] = serialize({
        idRegex: selector.id, optional: false, textRegex: CANARY,
        ...(selector.index !== undefined ? {index: String(selector.index)} : {}),
      });
      const category = rowCategories.get(selector.id);
      if (category) seenPatterns.add(selector.id);
      else {
        seenLiterals.add(selector.id);
        expect(NATIVE_TARGET_IDS).toContain(selector.id);
      }
      const expected = {
        sequenceNumber: 42, commandKind: kind,
        ...(category ? {targetCategory: category} : {targetId: selector.id}),
      };
      const parsed = parseCommands([raw]);
      expect(parsed).toEqual([expected]);
      const report = sanitizeDiagnostics({availability: 'available', failedCommands: parsed});
      expect(report.failedCommands).toEqual([expected]);
      expect(JSON.stringify(report)).not.toMatch(/SECRET_CANARY|\[0-9\]|textRegex|idRegex|\.yaml/);
    }
  }
  expect([...seenPatterns].sort()).toEqual([...rowCategories.keys()].sort());
  expect(seenLiterals.has('bluetooth-tool-title')).toBe(true);
  expect(seenLiterals.has('property-input-readOnlyProp')).toBe(true);
  expect(TARGET_IDS).toEqual(expect.arrayContaining(NATIVE_TARGET_IDS));
  expect(UI_PRESENCE_IDS).toHaveLength(17);
  expect(parseHierarchy(node('property-input-readOnlyProp', CANARY))).toEqual({});
});

test.each([...rowCategories])('maps only the exact row pattern %s to its bounded category', (pattern, category) => {
  for (const [kind, fields] of [
    ['tapOnElement', {selector: {idRegex: pattern, optional: false, index: '123456789', textRegex: CANARY}}],
    ['assertConditionCommand', {condition: {visible: {idRegex: pattern, optional: false}}}],
    ['assertConditionCommand', {condition: {notVisible: {idRegex: pattern, optional: false}}}],
  ]) {
    const input = command(kind);
    input.command[kind] = fields;
    input.metadata.evaluatedCommand = {selector: {idRegex: 'activity-toggle-123456789'}};
    const result = parseCommands([input]);
    expect(result).toEqual([{sequenceNumber: 42, commandKind: kind, targetCategory: category}]);
    expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|123456789|\[0-9\]|idRegex|index/);
  }
});

test.each([...rowCategories.keys()])('unknown or poisoned variants of %s remain unknown', pattern => {
  for (const value of [
    `${pattern}|.*`, `^${pattern}$`, `${pattern}\n`, `${pattern}${CANARY}`,
    pattern.replace('[0-9]+', '123456789'), pattern.replace('[0-9]+', '.*'),
    pattern.replace('[0-9]+', '\\d+'), CANARY, {idRegex: pattern},
  ]) {
    const input = command('tapOnElement');
    input.command.tapOnElement = {selector: {idRegex: value, textRegex: pattern}};
    input.metadata.evaluatedCommand = {tapOnElement: {selector: {idRegex: pattern}}};
    input.metadata.error = {message: `Assertion is false: ${pattern} ${CANARY}`};
    const result = parseCommands([input]);
    expect(result).toEqual([{
      sequenceNumber: 42, commandKind: 'tapOnElement', failureCategory: 'assertion-failed',
    }]);
    expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|123456789|\[0-9\]|idRegex/);
  }
});

test('report target categories cannot export patterns, row identities or arbitrary fields', () => {
  const base = {sequenceNumber: 42, commandKind: 'assertConditionCommand'};
  for (const targetCategory of [
    'activity-toggle-[0-9]+', 'activity-toggle-123456789', CANARY, {value: 'activity-row-toggle'},
  ]) {
    const result = sanitizeDiagnostics({
      availability: 'available', failedCommands: [{
        ...base, targetId: 'activity-toggle-123456789', targetCategory, selector: {idRegex: CANARY},
      }],
    });
    expect(result.failedCommands).toEqual([base]);
  }
  const result = sanitizeDiagnostics({
    availability: 'available', failedCommands: [{
      ...base, targetCategory: 'log-row-payload', targetId: 'log-payload-123456789',
      index: '123456789', text: CANARY,
    }],
  });
  expect(result.failedCommands).toEqual([{...base, targetCategory: 'log-row-payload'}]);
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|123456789|\[0-9\]/);
  expect(sanitizeDiagnostics({
    availability: 'available', failedCommands: [{
      ...base, targetId: 'bluetooth-tool-title', targetCategory: 'log-row-payload',
    }],
  }).failedCommands).toEqual([{...base, targetId: 'bluetooth-tool-title'}]);
  expect(sanitizeDiagnostics({
    availability: 'available',
    failedCommands: Array(LIMITS.commands + 1).fill({...base, targetCategory: 'log-row-payload'}),
  })).toEqual({availability: 'unavailable'});
});

test.each([false, undefined])('classifies only the exact published permission-absence assertion (%#)', optional => {
  const input = permissionAbsenceCommand();
  if (optional === undefined) delete input.command.assertConditionCommand.condition.notVisible.optional;
  const result = parseCommands([input]);
  expect(result).toEqual([{
    sequenceNumber: 168, commandKind: 'assertConditionCommand',
    assertionCategory: 'android-permission-absence', failureCategory: 'assertion-failed',
  }]);
  const report = sanitizeDiagnostics({availability: 'available', failedCommands: result});
  expect(report.failedCommands).toEqual(result);
  expect(JSON.stringify(report)).not.toMatch(/SECRET_CANARY|permissioncontroller:id|grant_dialog|\.yaml/);
});

test('unknown, broadened, differently constrained and poisoned assertions remain unknown', () => {
  for (const poison of [
    input => { input.command.assertConditionCommand.condition.notVisible.idRegex += '|.*'; },
    input => { input.command.assertConditionCommand.condition.notVisible.idRegex += '\n'; },
    input => { input.command.assertConditionCommand.condition.notVisible.idRegex = CANARY; },
    input => { input.command.assertConditionCommand.condition.notVisible.textRegex = CANARY; },
    input => { input.command.assertConditionCommand.condition.notVisible.index = '0'; },
    input => { input.command.assertConditionCommand.condition.notVisible.optional = true; },
    input => { input.command.assertConditionCommand.condition.notVisible.payload = CANARY; },
    input => { input.command.assertConditionCommand.condition.visible = {idRegex: 'connection-details'}; },
    input => { input.command.assertConditionCommand.condition.scriptCondition = 'true'; },
    input => { input.command.assertConditionCommand.condition.label = CANARY; },
    input => {
      const condition = input.command.assertConditionCommand.condition;
      condition.visible = condition.notVisible;
      delete condition.notVisible;
    },
    input => {
      input.command.runFlowCommand = input.command.assertConditionCommand;
      delete input.command.assertConditionCommand;
    },
    input => {
      input.metadata.evaluatedCommand = input.command;
      input.command = {assertConditionCommand: {condition: {notVisible: {idRegex: CANARY}}}};
    },
  ]) {
    const input = permissionAbsenceCommand();
    poison(input);
    input.assertionCategory = 'android-permission-absence';
    input.metadata.error.message = `Assertion is false: ${permissionAbsenceSelector} ${CANARY}`;
    const result = parseCommands([input]);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('assertionCategory');
    expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|permissioncontroller:id|grant_dialog/);
  }
  const completed = permissionAbsenceCommand();
  completed.metadata.status = 'COMPLETED';
  expect(parseCommands([completed])).toEqual([]);
});

test('reads only safe status IDs and literals from private hierarchy', () => {
  expect(parseHierarchy(hierarchy())).toEqual({
    connectionErrorCode: 'AUTHENTICATION_FAILED', connectionServiceCode: 401002,
    proofStatus: 'Submitted locally',
  });
  expect(JSON.stringify(parseHierarchy(hierarchy()))).not.toContain(CANARY);
});

test.each(UI_PRESENCE_IDS)('records only fixed target presence, never the value of %s', id => {
  const ui = parseHierarchy(node(id, CANARY));
  expect(ui).toEqual({observedTargets: [id]});
  expect(sanitizeDiagnostics({availability: 'available', ui}).ui).toEqual(ui);
  expect(JSON.stringify(ui)).not.toContain(CANARY);
});

test('classifies only fixed untagged UI labels and exact connection-state values', () => {
  const input = node(undefined, 'IoT PnP', [
    node(undefined, 'Connecting to the assigned IoT Hub...'),
    node('connection-deviceKey', 'Cancel'),
    node('connection-status', 'Connected'),
    node(undefined, CANARY),
  ]);
  const ui = parseHierarchy(input);
  expect(ui).toEqual({
    observedTargets: ['connection-status'],
    observedLabels: ['app-root', 'connecting'],
    connectionState: 'Connected',
  });
  expect(sanitizeDiagnostics({availability: 'available', ui}).ui).toEqual(ui);
  expect(JSON.stringify(ui)).not.toContain(CANARY);
});

test('rejects arbitrary labels and connection-state data at the report boundary', () => {
  const ui = sanitizeDiagnostics({
    availability: 'available',
    failedCommands: [{sequenceNumber: 1, commandKind: 'assertCommand'}],
    ui: {observedLabels: ['app-root', CANARY], connectionState: CANARY, text: CANARY},
  }).ui;
  expect(ui).toEqual({observedLabels: ['app-root']});
  expect(JSON.stringify(ui)).not.toContain(CANARY);
});

test('presence metadata rejects arbitrary values, duplicates and excessive collections', () => {
  expect(sanitizeDiagnostics({availability: 'available', ui: {
    observedTargets: ['model-id', CANARY, 'model-id'],
  }}).ui).toEqual({observedTargets: ['model-id']});
  for (const targets of [CANARY, [CANARY], [true], [{id: 'model-id'}],
    Array(UI_PRESENCE_IDS.length + 1).fill('model-id')]) {
    expect(sanitizeDiagnostics({availability: 'available', ui: {observedTargets: targets}}))
      .toEqual({availability: 'unavailable'});
  }
  expect(parseHierarchy(node(CANARY, 'model-id'))).toEqual({});
});

test.each(ERROR_CODES)('accepts exact connection enum %s on iOS accessibility text', code => {
  const input = node('connection-error-code', CANARY);
  input.attributes.accessibilityText = code;
  expect(parseHierarchy(input)).toEqual({connectionErrorCode: code});
});

test.each([
  ["Quickstep isn't responding", 'quickstep-anr'],
  ["System UI isn't responding", 'system-ui-anr'],
  ["IoT Plug and Play isn't responding", 'paad-anr'],
])('exports only a known system-dialog category (%#)', (text, code) => {
  const ui = parseHierarchy(node('android:id/alertTitle', text));
  expect(ui).toEqual({systemDialog: code});
  expect(sanitizeDiagnostics({availability: 'available', ui}).ui).toEqual({systemDialog: code});
});

test('never exports arbitrary dialog titles or unknown categories', () => {
  expect(parseHierarchy(node('android:id/alertTitle', CANARY))).toEqual({});
  expect(sanitizeDiagnostics({availability: 'available', ui: {systemDialog: CANARY}}))
    .toEqual({availability: 'unavailable'});
});

test.each([100, 200, 400, 401, 429, 503, 599])('exposes only the numeric HTTP status %s', status => {
  const result = parseHierarchy(node('connection-http-status', `HTTP ${status}`));
  expect(result).toEqual({connectionHttpStatus: status});
  expect(sanitizeDiagnostics({availability: 'available', ui: result})).toEqual({
    availability: 'available', failedCommands: [], ui: {connectionHttpStatus: status},
  });
});

test.each([CANARY, 'HTTP 099', 'HTTP 600', 'HTTP 400\n', 'HTTP 400 SECRET', '400', 400])(
  'rejects unexpected HTTP status text (%#)', text => {
    expect(parseHierarchy(node('connection-http-status', text))).toEqual({});
  },
);

test.each([99, 600, Infinity, NaN, 400.5, '400'])(
  'rejects invalid report HTTP status (%#)', status => {
    expect(sanitizeDiagnostics({availability: 'available', ui: {connectionHttpStatus: status}}))
      .toEqual({availability: 'unavailable'});
  },
);

test.each([CANARY, 'AUTHENTICATION_FAILED\n', 'CLOUD_CONFIRMED', 'Connected'])(
  'rejects unapproved error and proof values (%#)', value => {
    expect(parseHierarchy(node('connection-error-code', value))).toEqual({});
    expect(parseHierarchy(node('proof-status', value))).toEqual({});
  },
);

test.each([CANARY, '401\n', '-1', '1.1', 'Infinity', '9007199254740992', 401])(
  'rejects unsafe service codes (%#)', value => {
    expect(parseHierarchy(node('connection-service-code', value))).toEqual({});
  },
);

test('caps hierarchy nodes and depth', () => {
  expect(() => parseHierarchy(node(CANARY, CANARY, Array(LIMITS.nodes).fill({}))))
    .toThrow('Unavailable');
  let tree = {};
  for (let i = 0; i <= LIMITS.hierarchyDepth; i++) tree = {children: [tree]};
  expect(() => parseHierarchy(tree)).toThrow('Unavailable');
});

test('sanitizes final report fields independently of the parser', () => {
  const result = sanitizeDiagnostics({
    availability: 'available',
    failedCommands: [{sequenceNumber: 2, commandKind: 'inputTextCommand', targetId: CANARY,
      inputText: CANARY, error: {message: CANARY}}],
    ui: {connectionErrorCode: CANARY, connectionServiceCode: CANARY, proofStatus: CANARY},
    env: {key: CANARY}, message: CANARY, debugMessage: CANARY, payload: CANARY,
  });
  expect(result).toEqual({
    availability: 'available', failedCommands: [{sequenceNumber: 2, commandKind: 'inputTextCommand'}], ui: {},
  });
  expect(sanitizeDiagnostics({availability: CANARY})).toEqual({availability: 'unavailable'});
});

// Model only task-owned paths, never credentials or real process environment.
function mockArtifacts(contents = {}, links = []) {
  const root = path.resolve('build/live-device-private');
  const entries = new Map([
    [path.dirname(root), {kind: 'directory'}],
    [root, {kind: 'directory'}],
    [path.join(root, 'results'), {kind: 'directory'}],
    [path.join(root, 'debug'), {kind: 'directory'}],
  ]);
  for (const [relative, value] of Object.entries(contents)) {
    const filename = path.join(root, relative);
    let parent = path.dirname(filename);
    while (parent.startsWith(root) && !entries.has(parent)) {
      entries.set(parent, {kind: 'directory'});
      parent = path.dirname(parent);
    }
    entries.set(filename, {kind: 'file', data: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))});
  }
  for (const relative of links) entries.set(path.join(root, relative), {kind: 'link'});
  const lookup = filename => {
    if (!entries.has(filename)) throw Object.assign(new Error(CANARY), {code: 'ENOENT'});
    return entries.get(filename);
  };
  const stat = entry => ({
    isDirectory: () => entry.kind === 'directory', isFile: () => entry.kind === 'file',
    isSymbolicLink: () => entry.kind === 'link', size: entry.data?.length || 0, dev: 1, ino: 2,
  });
  jest.spyOn(fs, 'lstatSync').mockImplementation(filename => stat(lookup(filename)));
  jest.spyOn(fs, 'opendirSync').mockImplementation(directory => {
    const children = [...entries.keys()].filter(filename => filename !== directory && path.dirname(filename) === directory);
    return {readSync: () => children.length ? {name: path.basename(children.shift())} : null, closeSync: jest.fn()};
  });
  const opened = jest.spyOn(fs, 'openSync').mockImplementation((filename, flags) => {
    expect(flags & fs.constants.O_NOFOLLOW).toBe(fs.constants.O_NOFOLLOW);
    lookup(filename);
    return filename;
  });
  jest.spyOn(fs, 'fstatSync').mockImplementation(fd => stat(lookup(fd)));
  jest.spyOn(fs, 'readSync').mockImplementation((fd, buffer) => lookup(fd).data.copy(buffer));
  jest.spyOn(fs, 'closeSync').mockImplementation(() => {});
  return {root, opened};
}

test('unions fixed target presence across failure captures without claiming visibility', () => {
  mockArtifacts({
    'results/session/flow/screen-hierarchy/step-041.json': node('connection-details', CANARY),
    'results/session/flow/screen-hierarchy/step-042.json': node('connection-details-close', CANARY, [
      node('model-id', CANARY),
    ]),
  });
  expect(collectLiveDiagnostics()).toEqual({
    availability: 'available', failedCommands: [], hierarchyCaptured: true,
    ui: {observedTargets: ['connection-details', 'connection-details-close', 'model-id']},
  });
});

test('traverses only fixed private results/debug and never follows links or opens raw output', () => {
  const {root, opened} = mockArtifacts({
    'results/session/flow/commands.json': [command()],
    'results/session/flow/screen-hierarchy/step-042.json': hierarchy(),
    'results/session/flow/screenshots/SECRET_CANARY.png': CANARY,
    'results/session/flow/logs/commands.json': CANARY,
    'debug/maestro.log': CANARY,
    'home/commands.json': CANARY,
    'scratch/commands.json': CANARY,
    'commands.json': CANARY,
  }, ['results/link', 'debug/commands.json']);
  const result = collectLiveDiagnostics();
  expect(result.availability).toBe('available');
  expect(result.failedCommands[0].sequenceNumber).toBe(42);
  expect(result.ui.connectionErrorCode).toBe('AUTHENTICATION_FAILED');
  expect(result.hierarchyCaptured).toBe(true);
  expect(opened.mock.calls.map(call => path.relative(root, call[0]))).toEqual([
    'results/session/flow/commands.json', 'results/session/flow/screen-hierarchy/step-042.json',
  ]);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('distinguishes missing hierarchy from a captured tree without allowlisted targets', () => {
  mockArtifacts({'results/commands.json': [command()]});
  expect(collectLiveDiagnostics().hierarchyCaptured).toBe(false);
  jest.restoreAllMocks();
  mockArtifacts({
    'results/commands.json': [command()],
    'results/screen-hierarchy/step.json': node(CANARY, CANARY),
  });

  expect(collectLiveDiagnostics().hierarchyCaptured).toBe(true);
  expect(collectLiveDiagnostics().ui).toEqual({});
});

test('independently sanitizes the bounded post-failure capture without opening raw logs', () => {
  mockArtifacts({
    'results/commands.json': [command()],
    'results/post-failure-ui.json': {
      source: 'post-failure-ios-hierarchy',
      ui: {observedTargets: ['app-busy-overlay', CANARY], message: CANARY},
      rawHierarchy: CANARY,
    },
  });
  const result = collectLiveDiagnostics();
  expect(result.hierarchyCaptured).toBe(true);
  expect(result.ui).toEqual({observedTargets: ['app-busy-overlay']});
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test.each([
  ['{SECRET_CANARY', 'invalid-metadata'],
  ['{}', 'invalid-metadata'],
  ['[]', 'no-supported-data'],
])('malformed or missing useful commands return unavailable (%#)', (raw, reason) => {
  mockArtifacts({'results/commands.json': raw});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason});
});

test('missing diagnostics and symlinked scan roots are unavailable', () => {
  mockArtifacts();
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'no-supported-data'});
  jest.restoreAllMocks();
  mockArtifacts({}, ['results']);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'unsafe-path'});
});

test('never follows a replaced private root or build parent', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.lstatSync.mockReturnValue({isDirectory: () => true, isSymbolicLink: () => true});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'unsafe-path'});
  expect(fs.opendirSync).not.toHaveBeenCalled();
});

test('caps bytes before reading oversized files', () => {
  const {opened} = mockArtifacts({'results/commands.json': CANARY.repeat(LIMITS.fileBytes)});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(opened).not.toHaveBeenCalled();
});

test('caps directory entries and depth without exposing paths', () => {
  const contents = {};
  for (let i = 0; i <= LIMITS.entries; i++) contents[`results/${i}.log`] = CANARY;
  mockArtifacts(contents);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'entry-limit'});
  jest.restoreAllMocks();
  mockArtifacts({[`results/${'nested/'.repeat(LIMITS.directoryDepth + 1)}commands.json`]: [command()]});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'depth-limit'});
});

test('caps JSON file count and cumulative bytes', () => {
  const contents = {};
  for (let i = 0; i <= LIMITS.files; i++) contents[`results/screen-hierarchy/${i}.json`] = {};
  mockArtifacts(contents);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'file-limit'});
  expect(fs.openSync).toHaveBeenCalledTimes(LIMITS.files);
  jest.restoreAllMocks();
  const large = JSON.stringify({ignored: CANARY.repeat(90000)});
  mockArtifacts(Object.fromEntries(Array.from({length: 6}, (_, i) => [
    `debug/screen-hierarchy/${i}.json`, large,
  ])));
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(fs.openSync.mock.calls.length).toBeLessThan(6);
});

test('rejects a file replaced after lstat', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.fstatSync.mockReturnValue({
    isFile: () => true, size: 1, dev: 4, ino: 9,
  });
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'unsafe-path'});
  expect(fs.readSync).not.toHaveBeenCalled();
  expect(fs.closeSync).toHaveBeenCalled();
});

test('fails closed on read races and parser errors without printing raw errors', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.readSync.mockImplementation(() => { throw new Error(CANARY); });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'read-failed'});
  expect(log).not.toHaveBeenCalled();
  expect(fs.closeSync).toHaveBeenCalled();
});

test.each(UNAVAILABLE_REASONS)('retains only a fixed unavailable reason (%s)', reason => {
  expect(sanitizeDiagnostics({availability: 'unavailable', reason, error: CANARY}))
    .toEqual({availability: 'unavailable', reason});
});

test('rejects unknown diagnostic reasons and never exports raw errors', () => {
  expect(sanitizeDiagnostics({availability: 'unavailable', reason: CANARY, error: CANARY}))
    .toEqual({availability: 'unavailable'});
});

test('reports the command limit without inspecting or exposing extra commands', () => {
  mockArtifacts({'results/commands.json': Array(LIMITS.commands + 1).fill(CANARY)});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'command-limit'});
});

const androidOptions = {platform: 'android', expectedDeviceId: 'Synthetic-Assigned.ID'};
const androidTree = (text = androidOptions.expectedDeviceId) => node('connection-details-sheet', CANARY, [
  node('assigned-device-id', text),
]);
const androidCommands = (tapStatus = 'COMPLETED') => {
  const tap = {
    command: {tapOnElement: {selector: {idRegex: 'connection-details', textRegex: CANARY}}},
    metadata: {sequenceNumber: 43, status: tapStatus},
  };
  const failure = command();
  failure.metadata.sequenceNumber = 44;
  failure.command.assertConditionCommand.condition.visible.idRegex = 'assigned-device-id';
  return [tap, failure];
};

test('reads the pinned Android document TreeNode root with omitted empty attributes and children', () => {
  // AndroidDriver.mapHierarchy(document), serialized directly by captureStepHierarchy's
  // NON_EMPTY bundleWriter. Document and XML hierarchy nodes are children, not envelopes.
  const documentTree = {
    children: [{
      attributes: {ignoreBoundsFiltering: 'false'},
      children: [{
        attributes: {
          'resource-id': 'connection-details-sheet', 'class': 'android.view.ViewGroup',
          ignoreBoundsFiltering: 'false',
        },
        children: [{
          attributes: {
            'resource-id': 'assigned-device-id', text: androidOptions.expectedDeviceId,
            'class': 'android.widget.TextView', 'important-for-accessibility': 'true',
            accessibilityText: CANARY,
          },
          enabled: true, clickable: false,
        }],
      }],
    }],
  };
  const parsed = parseHierarchy(documentTree, androidOptions);
  expect(parsed.androidDetails).toMatchObject({
    sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'match',
  });
  mockArtifacts({
    'results/flow/commands.json': androidCommands(),
    'results/flow/screen-hierarchy/step-045-assertCondition.json': documentTree,
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands[0].androidDetails).toEqual({
    detailsTapCompleted: true, ...parsed.androidDetails,
  });
  expect(result.ui.observedTargets).toEqual(['assigned-device-id', 'connection-details-sheet']);
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic|android\.widget/);
});

test('unknown hierarchy envelopes are not guessed or misreported as missing Android IDs', () => {
  for (const envelope of [{root: androidTree()}, {roots: [androidTree()]}, {window: androidTree()}]) {
    expect(parseHierarchy(envelope, androidOptions).androidDetails).toEqual({
      hierarchyShape: 'unsupported-root', visitedNodeCount: 'one',
    });
  }
});

test.each([
  ['Synthetic-Assigned.ID', 'match'],
  ['synthetic-assigned.id', 'mismatch'],
  ['Synthetic-AssignedXID', 'mismatch'],
  [CANARY, 'mismatch'],
  ['', 'unavailable'],
  [undefined, 'unavailable'],
  [{payload: CANARY}, 'unavailable'],
  [CANARY.repeat(129), 'unavailable'],
])('Android compares only bounded tagged text without exporting values (%#)', (text, expected) => {
  const tree = androidTree();
  tree.children[0].attributes.text = text;
  tree.children[0].attributes.accessibilityText = androidOptions.expectedDeviceId;
  tree.children[0].attributes.hintText = androidOptions.expectedDeviceId;
  const result = parseHierarchy(tree, androidOptions).androidDetails;
  expect(result).toMatchObject({
    sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: expected,
  });
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic/);
});

test.each([undefined, '', '.*', '^Synthetic-Assigned.ID$', 'Synthetic-Assigned.ID\n',
  CANARY.repeat(129), true, {text: CANARY}])(
  'Android does not compare against untrusted or missing expected identity (%#)', expectedDeviceId => {
    expect(parseHierarchy(androidTree(), {platform: 'android', expectedDeviceId}).androidDetails)
      .toMatchObject({sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'unavailable'});
  },
);

test('Android missing includes omitted/hidden targets, not a claim they are unmounted', () => {
  // The Android driver omits invisible children; unrelated labels are not target evidence.
  const tree = node('connection-details', 'assigned-device-id', [
    node(undefined, androidOptions.expectedDeviceId),
  ]);
  expect(parseHierarchy(tree, androidOptions).androidDetails).toMatchObject({
    sheetPresent: false, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
  tree.children.push(node('connection-details-sheet', CANARY));
  expect(parseHierarchy(tree, androidOptions).androidDetails).toMatchObject({
    sheetPresent: true, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
});

test('Android presence never substitutes for visibility and duplicate IDs remain ambiguous', () => {
  const tree = androidTree();
  tree.children[0].enabled = false;
  tree.children[0].attributes['important-for-accessibility'] = 'false';
  expect(parseHierarchy(tree, androidOptions).androidDetails.assignedDeviceIdPresent).toBe(true);
  tree.children.push(node('assigned-device-id', CANARY));
  expect(parseHierarchy(tree, androidOptions).androidDetails.assignedDeviceIdTextMatch).toBe('ambiguous');
  expect(parseHierarchy({payload: tree}, androidOptions).androidDetails).toEqual({
    hierarchyShape: 'unsupported-root', visitedNodeCount: 'one',
  });
  expect(parseHierarchy(androidTree(), {platform: 'ios'}).androidDetails).toBeUndefined();
});

test('Android rejects malformed hierarchy children and preserves existing parser limits', () => {
  for (const tree of [{children: CANARY}, {attributes: CANARY}, {children: [null]}]) {
    expect(() => parseHierarchy(tree, androidOptions)).toThrow('Unavailable');
  }
  expect(() => parseHierarchy(node(CANARY, CANARY, Array(LIMITS.nodes).fill({})), androidOptions))
    .toThrow('Unavailable');
  let tree = androidTree();
  for (let i = 0; i <= LIMITS.hierarchyDepth; i++) tree = {children: [tree]};
  expect(() => parseHierarchy(tree, androidOptions)).toThrow('Unavailable');
});

test('binds Android booleans and text comparison to the same failure, not accumulated targets', () => {
  mockArtifacts({
    'results/session/flow/commands.json': androidCommands(),
    'results/session/flow/screen-hierarchy/step-043-assertCondition.json': androidTree(),
    'results/session/flow/screen-hierarchy/step-045-assertCondition.json': node('connection-details', CANARY),
    'results/other/screen-hierarchy/step-045-assertCondition.json': androidTree(),
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands[0].androidDetails).toMatchObject({
    detailsTapCompleted: true, sheetPresent: false,
    assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
  expect(result.ui.observedTargets).toContain('assigned-device-id');
  expect(result.ui.androidDetails).toBeUndefined();
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic|step-045|session/);
  expect(sanitizeDiagnostics(result)).toEqual(result);
});

test.each(['COMPLETED', 'FAILED', 'SKIPPED'])(
  'reports the exact preceding Details tap outcome without claiming app state (%s)', status => {
    mockArtifacts({
      'results/commands.json': androidCommands(status),
      'results/screen-hierarchy/step-045.json': androidTree(CANARY),
    });
    expect(collectLiveDiagnostics(androidOptions).failedCommands.find(item => item.targetId === 'assigned-device-id').androidDetails).toMatchObject({
      detailsTapCompleted: status === 'COMPLETED', sheetPresent: true,
      assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'mismatch',
    });
  },
);

test('does not manufacture a request from stale, missing, ambiguous or unrelated commands', () => {
  for (const update of [
    commands => { commands[0].metadata.sequenceNumber = 3; },
    commands => { commands.shift(); },
    commands => { commands.unshift(commands[0]); },
    commands => { commands[0].command.tapOnElement.selector.idRegex = CANARY; },
    commands => { commands[0].command.inputTextCommand = {text: CANARY}; },
    commands => { commands[0].metadata.status = CANARY; },
  ]) {
    const commands = androidCommands();
    update(commands);
    mockArtifacts({
      'results/commands.json': commands,
      'results/screen-hierarchy/step-045.json': androidTree(),
    });
    const details = collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails;
    expect(details.detailsTapCompleted).toBeUndefined();
    expect(details.assignedDeviceIdTextMatch).toBe('match');
    jest.restoreAllMocks();
  }
});

test('missing and duplicate failure snapshots are not replaced with another observed tree', () => {
  mockArtifacts({'results/commands.json': androidCommands()});
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails)
    .toEqual({detailsTapCompleted: true});
  jest.restoreAllMocks();
  mockArtifacts({
    'results/commands.json': androidCommands(),
    'results/screen-hierarchy/step-045-first.json': androidTree(),
    'results/screen-hierarchy/step-045-second.json': androidTree(CANARY),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails)
    .toEqual({detailsTapCompleted: true});
  jest.restoreAllMocks();
  const commands = androidCommands();
  commands.push(commands[1]);
  mockArtifacts({
    'results/commands.json': commands,
    'results/screen-hierarchy/step-045.json': androidTree(),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands.every(item => !item.androidDetails)).toBe(true);
});

test('Android keeps oversize files unavailable before opening or comparing any text', () => {
  const {opened} = mockArtifacts({
    'results/screen-hierarchy/step-045.json': CANARY.repeat(LIMITS.fileBytes),
  });
  expect(collectLiveDiagnostics(androidOptions)).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(opened).not.toHaveBeenCalled();
});

test('Android failure report independently strips arbitrary names, payloads and malformed metadata', () => {
  const failure = {
    sequenceNumber: 44, commandKind: 'assertConditionCommand', targetId: 'assigned-device-id',
    androidDetails: {
      detailsTapCompleted: true, sheetPresent: false, assignedDeviceIdPresent: false,
      assignedDeviceIdTextMatch: 'missing', actual: CANARY, expected: CANARY,
      attributes: {payload: CANARY}, arbitraryName: CANARY,
    },
  };
  const result = sanitizeDiagnostics({availability: 'available', failedCommands: [failure]});
  expect(result.failedCommands[0].androidDetails).toEqual({
    detailsTapCompleted: true, sheetPresent: false, assignedDeviceIdPresent: false,
    assignedDeviceIdTextMatch: 'missing',
  });
  expect(JSON.stringify(result)).not.toContain(CANARY);
  for (const bad of [
    {detailsTapCompleted: CANARY},
    {sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: CANARY},
    {sheetPresent: true, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'match'},
    {sheetPresent: CANARY, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing'},
    Array(LIMITS.nodes).fill(CANARY),
  ]) {
    failure.androidDetails = bad;
    expect(sanitizeDiagnostics({availability: 'available', failedCommands: [failure]}).failedCommands[0])
      .not.toHaveProperty('androidDetails');
  }
});

test('attributes a failed Details tap snapshot even if no allowlisted UI text is captured', () => {
  const [tap] = androidCommands('FAILED');
  tap.metadata.error = {message: `Element not found: ${CANARY}`};
  mockArtifacts({
    'results/flow/commands.json': [tap],
    'results/flow/screen-hierarchy/step-044-tapOnElement.json': {children: [{attributes: {text: CANARY}}]},
    'results/other/screen-hierarchy/step-044-tapOnElement.json': androidTree(),
    'results/flow/screen-hierarchy/step-045-assertCondition.json': androidTree(),
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands).toEqual([{
    sequenceNumber: 43, commandKind: 'tapOnElement', targetId: 'connection-details',
    failureCategory: 'element-not-found',
    androidDetails: {
      detailsTapCompleted: false, hierarchyShape: 'tree-node', visitedNodeCount: '2-16',
      appTargetsPresent: false, appSurfaces: [], resourceNamespaces: [], systemSurfaces: [],
      permissionDenyControls: [],
      detailsButtonPresent: false, detailsButtonCount: 'zero',
      sheetPresent: false, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
    },
  }]);
  expect(sanitizeDiagnostics(result)).toEqual(result);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('reports duplicate Details IDs as observed multiplicity, never a guessed failure category', () => {
  const [tap] = androidCommands('FAILED');
  const tree = {children: [node('connection-details', CANARY), node('connection-details', CANARY), androidTree()]};
  mockArtifacts({
    'results/commands.json': [tap],
    'results/screen-hierarchy/step-044.json': tree,
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands[0]).toEqual({
    sequenceNumber: 43, commandKind: 'tapOnElement', targetId: 'connection-details',
    androidDetails: {
      detailsTapCompleted: false, hierarchyShape: 'tree-node', visitedNodeCount: '2-16',
      appTargetsPresent: true, appSurfaces: [], resourceNamespaces: [], systemSurfaces: [],
      permissionDenyControls: [],
      detailsButtonPresent: true, detailsButtonCount: 'multiple',
      sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'match',
    },
  });
});

test.each(['app-busy-overlay', 'connection-details', 'connection-details-sheet'])(
  'attributes the existing failure hierarchy to the bounded %s readiness assertion', targetId => {
    const failure = command();
    failure.command.assertConditionCommand.condition = targetId === 'app-busy-overlay'
      ? {notVisible: {idRegex: targetId}} : {visible: {idRegex: targetId}};
    mockArtifacts({
      'results/commands.json': [failure],
      'results/screen-hierarchy/step-043.json': node('connection-details', CANARY),
    });
    const result = collectLiveDiagnostics(androidOptions);
    expect(result.failedCommands[0]).toEqual({
      sequenceNumber: 42, commandKind: 'assertConditionCommand', targetId,
      androidDetails: {
        hierarchyShape: 'tree-node', visitedNodeCount: 'one',
        appTargetsPresent: true, appSurfaces: [], resourceNamespaces: [], systemSurfaces: [],
        permissionDenyControls: [],
        detailsButtonPresent: true, detailsButtonCount: 'one',
        sheetPresent: false, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
      },
    });
  },
);

test.each([
  [{}, 'empty-object'],
  [{root: {children: [androidTree()]}, payload: CANARY}, 'unsupported-root'],
])('attributes root shape without assuming missing controls in an unrecognized root (%#)', (tree, shape) => {
  const [tap] = androidCommands('FAILED');
  mockArtifacts({
    'results/commands.json': [tap],
    'results/screen-hierarchy/step-044.json': tree,
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.ui).toEqual({});
  expect(result.hierarchyCaptured).toBe(true);
  expect(result.failedCommands[0].androidDetails).toEqual({
    detailsTapCompleted: false, hierarchyShape: shape, visitedNodeCount: 'one',
  });
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic/);
});

test.each([
  [1, 'one'], [2, '2-16'], [16, '2-16'], [17, '17-128'],
  [128, '17-128'], [129, '129-4096'], [4096, '129-4096'],
])('reports only the visited-node bucket for %s nodes', (count, bucket) => {
  const tree = {children: Array(count - 1).fill({})};
  const details = parseHierarchy(tree, androidOptions).androidDetails;
  expect(details.visitedNodeCount).toBe(bucket);
  expect(details.hierarchyShape).toBe('tree-node');
});

test('recognizes completed tap across exactly the new completed sheet readiness assertion', () => {
  const [tap, failure] = androidCommands();
  const sheet = {
    command: {assertConditionCommand: {condition: {visible: {idRegex: 'connection-details-sheet'}}}},
    metadata: {sequenceNumber: 44, status: 'COMPLETED'},
  };
  failure.metadata.sequenceNumber = 45;
  mockArtifacts({
    'results/commands.json': [tap, sheet, failure],
    'results/screen-hierarchy/step-046.json': androidTree(),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails.detailsTapCompleted).toBe(true);
  jest.restoreAllMocks();
  sheet.metadata.status = 'FAILED';
  mockArtifacts({
    'results/commands.json': [tap, sheet],
    'results/screen-hierarchy/step-045.json': node('connection-details', CANARY),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0]).toMatchObject({
    targetId: 'connection-details-sheet',
    androidDetails: {detailsTapCompleted: true, detailsButtonPresent: true, sheetPresent: false},
  });
  jest.restoreAllMocks();
  sheet.metadata.status = 'SKIPPED';
  mockArtifacts({
    'results/commands.json': [tap, sheet, failure],
    'results/screen-hierarchy/step-046.json': androidTree(),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails.detailsTapCompleted).toBeUndefined();
});

test('sanitizes root shape and Details-button metadata as fixed consistent categories only', () => {
  const failure = {sequenceNumber: 43, commandKind: 'tapOnElement', targetId: 'connection-details'};
  for (const unsafe of [
    {hierarchyShape: CANARY, visitedNodeCount: 'one'},
    {hierarchyShape: 'tree-node', visitedNodeCount: 4096},
    {hierarchyShape: 'tree-node', visitedNodeCount: CANARY},
    {detailsButtonPresent: true, detailsButtonCount: 'zero'},
    {detailsButtonPresent: false, detailsButtonCount: 'multiple'},
    {detailsButtonPresent: CANARY, detailsButtonCount: 'one'},
    {detailsButtonPresent: true, detailsButtonCount: [CANARY]},
  ]) {
    const result = sanitizeDiagnostics({
      availability: 'available', failedCommands: [{...failure, androidDetails: unsafe}],
    });
    expect(result.failedCommands[0]).toEqual(failure);
  }
  const result = sanitizeDiagnostics({
    availability: 'available', failedCommands: [{...failure, androidDetails: {
      hierarchyShape: 'unsupported-root', visitedNodeCount: 'one', classNames: [CANARY],
      detailsButtonPresent: false, detailsButtonCount: 'zero', sheetPresent: false,
      assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
    }}],
  });
  expect(result.failedCommands[0].androidDetails).toEqual({
    hierarchyShape: 'unsupported-root', visitedNodeCount: 'one',
  });
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test.each(APP_SURFACE_IDS)('records the fixed new app surface %s without its values', id => {
  const details = parseHierarchy(node(id, CANARY), androidOptions).androidDetails;
  expect(details).toMatchObject({
    appTargetsPresent: true, appSurfaces: [id], resourceNamespaces: [], systemSurfaces: [],
    detailsButtonPresent: false, sheetPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
  const report = sanitizeDiagnostics({availability: 'available', failedCommands: [{
    sequenceNumber: 44, commandKind: 'assertConditionCommand', targetId: 'connection-details',
    androidDetails: details,
  }]});
  expect(report.failedCommands[0].androidDetails).toEqual(details);
  expect(JSON.stringify(report)).not.toContain(CANARY);
  expect(parseHierarchy(node(id, CANARY), {platform: 'ios'})).toEqual({});
});

test('new app surface vocabulary is bound to the real Home, tab, directory and tool controls', () => {
  const home = fs.readFileSync('src/experience/WorkflowHome.tsx', 'utf8');
  expect(home).toContain('testID={panel ? `home-panel-${panel}` : undefined}');
  expect(home).toContain('testID={`home-node-${key}`}');
  expect(home).toContain('testID="home-panel-close"');
  expect(home).toContain('testID="workflow-home-content"');
  for (const name of ['phone', 'dps', 'hub', 'adr']) {
    expect(APP_SURFACE_IDS).toContain(`home-panel-${name}`);
    expect(APP_SURFACE_IDS).toContain(`home-node-${name}`);
  }
  for (const [file, ids] of [
    ['src/Home.tsx', ['tab-home', 'tab-explore', 'tab-activity', 'explore-back']],
    ['src/experience/Explore.tsx', ['explore-directory']],
    ['src/experience/Activity.tsx', ['activity-list']],
    ['src/CardView.tsx', ['telemetry-tool', 'properties-tool']],
    ['src/FileUpload.tsx', ['image-upload-card']],
    ['src/bluetooth/Bluetooth.tsx', ['bluetooth-tool-title']],
    ['src/Logs.tsx', ['logs-list']],
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    for (const id of ids) {
      expect(source).toContain(id);
      expect(APP_SURFACE_IDS).toContain(id);
    }
  }
  expect(UI_PRESENCE_IDS).toHaveLength(17);
  expect(APP_SURFACE_IDS).toHaveLength(21);
});

test.each([
  ['com.iot_pnp.ci:id/content', 'app'],
  ['com.android.permissioncontroller:id/permission_allow_button', 'permissioncontroller'],
  ['com.google.android.permissioncontroller:id/permission_allow_one_time_button', 'permissioncontroller'],
  ['com.android.inputmethod.latin:id/keyboard_view', 'inputmethod'],
  ['com.google.android.inputmethod.latin:id/keyboard_view', 'inputmethod'],
  ['com.android.systemui:id/content', 'systemui'],
  ['com.android.launcher3:id/workspace', 'launcher'],
  ['com.google.android.apps.nexuslauncher:id/workspace', 'launcher'],
  ['com.google.android.gms:id/content', 'googleservices'],
  ['com.android.settings:id/content', 'settings'],
  ['synthetic.unknown:id/content', 'other'],
])('exports only the fixed resource-namespace category (%#)', (id, category) => {
  const details = parseHierarchy(node(id, CANARY), androidOptions).androidDetails;
  expect(details.resourceNamespaces).toEqual([category]);
  expect(details.appTargetsPresent).toBe(false);
  expect(details.appSurfaces).toEqual([]);
  expect(JSON.stringify(details)).not.toMatch(/SECRET_CANARY|:id\/|com\.|synthetic\.unknown/);
  expect(details).not.toHaveProperty('windowOwner');
});

test.each([
  ['com.android.permissioncontroller:id/grant_dialog', 'permission-dialog'],
  ['com.google.android.permissioncontroller:id/permission_message', 'permission-dialog'],
  ['com.android.permissioncontroller:id/permission_allow_foreground_only_button', 'permission-dialog'],
  ['com.google.android.permissioncontroller:id/permission_deny_button', 'permission-dialog'],
  ['android:id/autofill_save', 'autofill-save'],
  ['android:id/autofill_save_yes', 'autofill-save'],
  ['android:id/autofill_save_no', 'autofill-save'],
  ['android:id/autofill_dataset_picker', 'autofill-picker'],
  ['android:id/autofill_dataset_list', 'autofill-picker'],
  ['android:id/aerr_wait', 'anr-dialog'],
])('recognizes an exact public permission/autofill/ANR resource signature (%#)', (id, category) => {
  const details = parseHierarchy(node(id, CANARY), androidOptions).androidDetails;
  expect(details.systemSurfaces).toEqual([category]);
  expect(JSON.stringify(details)).not.toContain(id);
  expect(JSON.stringify(details)).not.toContain(CANARY);
});

test('does not infer system surfaces from shared IDs, freeform labels, classes or dropped package attributes', () => {
  const tree = {children: [
    node('android:id/aerr_close', CANARY), node('android:id/aerr_report', CANARY),
    node('android:id/button1', CANARY),
    node('com.android.permissioncontroller.evil:id/grant_dialog', CANARY),
    node('com.google.android.gms:id/autofill_save', CANARY),
    node(CANARY, 'com.android.permissioncontroller:id/grant_dialog'),
    {attributes: {
      package: 'com.android.permissioncontroller', class: 'com.android.permissioncontroller.GrantPermissionsActivity',
      text: 'android:id/autofill_save', accessibilityText: 'android:id/aerr_wait',
    }},
  ]};
  const details = parseHierarchy(tree, androidOptions).androidDetails;
  expect(details.systemSurfaces).toEqual([]);
  expect(details.resourceNamespaces).toEqual(['googleservices', 'other']);
  expect(details.appSurfaces).toEqual([]);
  expect(details.appTargetsPresent).toBe(false);
  expect(JSON.stringify(details)).not.toMatch(/SECRET_CANARY|:id\/|com\./);
  expect(parseHierarchy(node(`com.google.android.gms:id/${CANARY.repeat(30)}`, CANARY), androidOptions)
    .androidDetails.resourceNamespaces).toEqual([]);
  const malformed = parseHierarchy(node('com.android.permissioncontroller:id/grant_dialog\n', CANARY), androidOptions)
    .androidDetails;
  expect(malformed.resourceNamespaces).toEqual([]);
  expect(malformed.systemSurfaces).toEqual([]);
});

test('distinguishes a Home modal from an unrelated system snapshot despite empty legacy ui', () => {
  const [tap] = androidCommands('FAILED');
  mockArtifacts({
    'results/flow/commands.json': [tap],
    'results/flow/screen-hierarchy/step-044.json': node('home-panel-adr', CANARY, [node('home-panel-close', CANARY)]),
    'results/flow/screen-hierarchy/step-045.json': node('android:id/autofill_save', CANARY),
    'results/other/screen-hierarchy/step-044.json': node('com.android.permissioncontroller:id/grant_dialog', CANARY),
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.ui).toEqual({});
  expect(result.failedCommands[0].androidDetails).toMatchObject({
    appTargetsPresent: true, appSurfaces: ['home-panel-adr', 'home-panel-close'],
    resourceNamespaces: [], systemSurfaces: [],
    sheetPresent: false, detailsButtonPresent: false,
  });
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('mixed-window app and system evidence is retained without assigning foreground ownership', () => {
  const details = parseHierarchy({children: [
    node('tab-home', CANARY), node('activity-list', CANARY),
    node('com.android.permissioncontroller:id/grant_dialog', CANARY),
    node('android:id/autofill_save', CANARY),
  ]}, androidOptions).androidDetails;
  expect(details).toMatchObject({
    appTargetsPresent: true, appSurfaces: ['activity-list', 'tab-home'],
    resourceNamespaces: ['other', 'permissioncontroller'], systemSurfaces: ['autofill-save', 'permission-dialog'],
  });
  expect(details).not.toHaveProperty('windowOwner');
  expect(details).not.toHaveProperty('foreground');
});

test('new collections reject oversized, sparse and arbitrary data at the report boundary', () => {
  const sanitize = androidDetails => sanitizeDiagnostics({
    availability: 'available',
    failedCommands: [{sequenceNumber: 44, commandKind: 'assertConditionCommand',
      targetId: 'connection-details', androidDetails}],
  }).failedCommands[0].androidDetails;
  const shape = {hierarchyShape: 'tree-node', visitedNodeCount: 'one'};
  for (const [key, valid, cap] of [
    ['appSurfaces', 'tab-home', 21],
    ['resourceNamespaces', 'permissioncontroller', 8],
    ['systemSurfaces', 'permission-dialog', 4],
    ['permissionDenyControls', 'deny', 2],
  ]) {
    for (const invalid of [CANARY, [CANARY], [true], [{payload: CANARY}], Array(1), Array(cap + 1).fill(valid)]) {
      expect(sanitize({...shape, [key]: invalid, appTargetsPresent: CANARY})).toEqual(shape);
    }
    expect(sanitize({...shape, [key]: [valid, valid], raw: CANARY})[key]).toEqual([valid]);
  }
  expect(sanitize({...shape, appSurfaces: ['home-panel-phone'], appTargetsPresent: false}))
    .not.toHaveProperty('appTargetsPresent');
  for (const hierarchyShape of ['empty-object', 'unsupported-root']) {
    expect(sanitize({
      ...shape, hierarchyShape, appTargetsPresent: false, appSurfaces: [], resourceNamespaces: [], systemSurfaces: [],
    })).toEqual({hierarchyShape, visitedNodeCount: 'one'});
  }
});

test('binds deny-control evidence only to the exact assertion command and its bundle snapshot', () => {
  mockArtifacts({
    'results/flow/commands.json': [
      {command: {runFlowCommand: {path: CANARY}}, metadata: {status: 'FAILED', sequenceNumber: 159}},
      permissionAbsenceCommand(),
    ],
    'results/flow/screen-hierarchy/step-168.json': node('com.android.permissioncontroller:id/permission_deny_button', CANARY),
    'results/flow/screen-hierarchy/step-169-assertCondition.json':
      node('com.google.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button', CANARY),
    'results/other/screen-hierarchy/step-169.json': node('com.android.permissioncontroller:id/permission_deny_button', CANARY),
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands[0]).toEqual({sequenceNumber: 159, commandKind: 'runFlowCommand'});
  expect(result.failedCommands[1]).toMatchObject({
    sequenceNumber: 168, commandKind: 'assertConditionCommand',
    assertionCategory: 'android-permission-absence', failureCategory: 'assertion-failed',
    androidDetails: {
      hierarchyShape: 'tree-node', visitedNodeCount: 'one',
      resourceNamespaces: ['permissioncontroller'], systemSurfaces: ['permission-dialog'],
      permissionDenyControls: ['deny-and-dont-ask-again'],
    },
  });
  expect(result.failedCommands[1]).not.toHaveProperty('targetId');
  expect(sanitizeDiagnostics(result)).toEqual(result);
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|permissioncontroller:id|permission_deny_|\.json|\.yaml/);
});

test('permission classification cannot authorize a snapshot for unknown assertions or duplicate bindings', () => {
  const failure = permissionAbsenceCommand();
  for (const contents of [
    {
      'results/flow/commands.json': [failure],
      'results/other/screen-hierarchy/step-169.json': node('com.android.permissioncontroller:id/permission_deny_button', CANARY),
    },
    {
      'results/flow/commands.json': [failure],
      'results/flow/screen-hierarchy/step-169-first.json': node('com.android.permissioncontroller:id/permission_deny_button', CANARY),
      'results/flow/screen-hierarchy/step-169-second.json': node('com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button', CANARY),
    },
    {
      'results/flow/commands.json': [failure, failure],
      'results/flow/screen-hierarchy/step-169.json': node('com.android.permissioncontroller:id/permission_deny_button', CANARY),
    },
  ]) {
    mockArtifacts(contents);
    expect(collectLiveDiagnostics(androidOptions).failedCommands.every(item => !item.androidDetails)).toBe(true);
    jest.restoreAllMocks();
  }
  failure.command.assertConditionCommand.condition.notVisible.idRegex = CANARY;
  mockArtifacts({
    'results/commands.json': [failure],
    'results/screen-hierarchy/step-169.json': node('com.android.permissioncontroller:id/permission_deny_button', CANARY),
  });
  const result = collectLiveDiagnostics(androidOptions).failedCommands[0];
  expect(result).not.toHaveProperty('assertionCategory');
  expect(result).not.toHaveProperty('androidDetails');
});

test('deny-control categories use exact fixed resource IDs, never arbitrary text or IDs', () => {
  for (const namespace of ['com.android.permissioncontroller', 'com.google.android.permissioncontroller']) {
    const details = parseHierarchy({children: [
      node(`${namespace}:id/permission_deny_button`, CANARY),
      node(`${namespace}:id/permission_deny_and_dont_ask_again_button`, CANARY),
      node(`${namespace}:id/permission_deny_button`, CANARY),
    ]}, androidOptions).androidDetails;
    expect(details.permissionDenyControls).toEqual(['deny', 'deny-and-dont-ask-again']);
    expect(details.systemSurfaces).toEqual(['permission-dialog']);
    expect(JSON.stringify(details)).not.toMatch(/SECRET_CANARY|permission_deny_|com\./);
  }
  const details = parseHierarchy({children: [
    node('unrelated:id/permission_deny_and_dont_ask_again_button', CANARY),
    node('com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button\n', CANARY),
    node('com.android.permissioncontroller:id/permission_allow_button', CANARY),
    node(CANARY, 'com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button'),
  ]}, androidOptions).androidDetails;
  expect(details.permissionDenyControls).toEqual([]);
});

test('permission evidence remains unavailable for unsupported roots and unchanged byte limits', () => {
  mockArtifacts({
    'results/commands.json': [permissionAbsenceCommand()],
    'results/screen-hierarchy/step-169.json': {root: node('com.android.permissioncontroller:id/permission_deny_button', CANARY)},
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails).toEqual({
    hierarchyShape: 'unsupported-root', visitedNodeCount: 'one',
  });
  jest.restoreAllMocks();
  const {opened} = mockArtifacts({
    'results/screen-hierarchy/step-169.json': CANARY.repeat(LIMITS.fileBytes),
  });
  expect(collectLiveDiagnostics(androidOptions)).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(opened).not.toHaveBeenCalled();
});

test('report boundary accepts only the fixed assertion category on an assertion command', () => {
  for (const [commandKind, assertionCategory] of [
    ['assertConditionCommand', CANARY], ['runFlowCommand', 'android-permission-absence'],
    ['tapOnElement', 'android-permission-absence'],
  ]) {
    const result = sanitizeDiagnostics({
      availability: 'available', failedCommands: [{
        sequenceNumber: 168, commandKind, assertionCategory,
        androidDetails: {hierarchyShape: 'tree-node', visitedNodeCount: 'one', permissionDenyControls: ['deny']},
      }],
    });
    expect(result.failedCommands).toEqual([{sequenceNumber: 168, commandKind}]);
  }
  const result = sanitizeDiagnostics({
    availability: 'available', failedCommands: [{
      sequenceNumber: 168, commandKind: 'assertConditionCommand', assertionCategory: 'android-permission-absence',
      selector: {idRegex: permissionAbsenceSelector}, path: CANARY, payload: CANARY,
      androidDetails: {
        hierarchyShape: 'tree-node', visitedNodeCount: 'one',
        permissionDenyControls: [CANARY], actual: CANARY,
      },
    }],
  });
  expect(result.failedCommands[0]).toEqual({
    sequenceNumber: 168, commandKind: 'assertConditionCommand', assertionCategory: 'android-permission-absence',
    androidDetails: {hierarchyShape: 'tree-node', visitedNodeCount: 'one'},
  });
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|permissioncontroller:id|grant_dialog/);
});

test('smoke passes platform only; trusted expected identity stays inside existing sanitize boundary', () => {
  const smoke = fs.readFileSync('scripts/ci/smoke-live-device.sh', 'utf8');
  expect(smoke).toContain('diagnostics=$(node scripts/ci/live-diagnostics.js "$platform")');
  expect(smoke).not.toMatch(/live-diagnostics\.js.*(?:DEVICE_KEY|EXPECTED_DEVICE_ID)/);
});

test.each(['valid', 'invalid', 'ios'])('CLI sanitizes existing synthetic artifacts with %s configuration', mode => {
  const source = fs.readFileSync('scripts/ci/live-diagnostics.js', 'utf8');
  const config = {
    schemaVersion: 1, provisioningHost: 'global.azure-devices-provisioning.net',
    scopeId: '0neAABBCCDD', expectedHub: 'synthetic.azure-devices.net',
    cases: {android: {
      registrationId: 'synthetic-registration', expectedDeviceId: androidOptions.expectedDeviceId,
      nonce: 'synthetic_nonce_1234',
    }},
  };
  mockArtifacts({
    'results/commands.json': androidCommands(),
    'results/screen-hierarchy/step-045.json': androidTree(),
  });
  const entryModule = {exports: {}};
  const entryRequire = name => name === './live-config' ? liveConfig
    : require(name.startsWith('./') ? `../scripts/ci/${name.slice(2)}` : name);
  entryRequire.main = entryModule;
  const write = jest.fn();
  const invoke = () => vm.runInNewContext(source, {
    module: entryModule, require: entryRequire, Buffer,
    process: {
      argv: ['node', 'live-diagnostics.js', mode === 'ios' ? 'ios' : 'android'],
      env: {PAAD_LIVE_CONFIG: mode === 'invalid' ? CANARY : JSON.stringify(config), MAESTRO_DEVICE_KEY: CANARY},
      stdout: {write},
    },
  });
  if (mode === 'invalid') {
    expect(invoke).toThrow('Invalid live configuration or invocation');
    expect(write).not.toHaveBeenCalled();
    return;
  }
  invoke();
  expect(write).toHaveBeenCalledTimes(1);
  const output = write.mock.calls[0][0];
  const details = JSON.parse(output).failedCommands[0].androidDetails;
  if (mode === 'ios') expect(details).toBeUndefined();
  else expect(details.assignedDeviceIdTextMatch).toBe('match');
  expect(output).not.toMatch(/SECRET_CANARY|Synthetic|synthetic-registration/);
});
