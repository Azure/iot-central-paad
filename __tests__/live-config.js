const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');
const {
  validateLiveConfig,
  caseEnvironment,
  createLiveReport,
  MODEL_ID,
} = require('../scripts/ci/live-config');

const fixture = () => ({
  schemaVersion: 1,
  provisioningHost: 'global.azure-devices-provisioning.net',
  scopeId: '0ne00AABBCC',
  expectedHub: 'lab-hub.device.azure-devices.net',
  cases: {
    android: {
      registrationId: 'lab-android',
      expectedDeviceId: 'returned.android',
      nonce: 'android_proof_1234567890',
    },
    ios: {
      registrationId: 'lab-ios',
      expectedDeviceId: 'returned-ios',
      nonce: 'ios_proof_1234567890',
    },
  },
});
const sourceSha = 'a'.repeat(40);
const mockEnvironment = {
  PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
};

test('exports a fresh validated plain DTO for the independent operator verifier', () => {
  const input = fixture();
  const result = validateLiveConfig(input);
  expect(result).toEqual(input);
  expect(result).not.toBe(input);
  expect(result.cases.android).not.toBe(input.cases.android);
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(validateLiveConfig(JSON.stringify(input))).toEqual(input);
  expect(MODEL_ID).toBe('dtmi:azureiot:PhoneAsADevice;2');
});

test.each(['net', 'cn', 'us'])(
  'accepts only Azure hostnames in %s cloud',
  suffix => {
    const config = fixture();
    config.provisioningHost = `global.azure-devices-provisioning.${suffix}`;
    for (const name of ['lab-hub', 'lab-hub.device']) {
      config.expectedHub = `${name}.azure-devices.${suffix}`;
      expect(validateLiveConfig(config)).toEqual(config);
    }
  },
);

test.each([
  'https://global.azure-devices-provisioning.net',
  'global.azure-devices-provisioning.net/path',
  'global.azure-devices-provisioning.net:443',
  'user@global.azure-devices-provisioning.net',
  'global.azure-devices-provisioning.net.attacker.example',
  'global.azure-devices-provisioning.net\nINJECT=value',
  '-global.azure-devices-provisioning.net',
  'GLOBAL.azure-devices-provisioning.net',
])('rejects invalid DPS hostname without reflecting it (%#)', host => {
  expect(() =>
    validateLiveConfig({...fixture(), provisioningHost: host}),
  ).toThrow('Invalid live configuration or invocation');
});

test.each([
  'https://lab.azure-devices.net',
  'lab.azure-devices.net:8883',
  'lab.azure-devices.net/',
  'user@lab.azure-devices.net',
  'lab.azure-devices.net.attacker.example',
  'lab.arbitrary.azure-devices.net',
  'localhost',
  '127.0.0.1',
])('rejects non-Azure/URL hub: %s', expectedHub => {
  expect(() => validateLiveConfig({...fixture(), expectedHub})).toThrow();
});

test.each(['deviceKey', 'sas', 'connectionString', '__proto__', 'constructor'])(
  'rejects unexpected/credential keys at every level: %s',
  key => {
    for (const location of ['root', 'cases', 'case']) {
      const config = fixture();
      const target =
        location === 'root'
          ? config
          : location === 'cases'
          ? config.cases
          : config.cases.android;
      Object.defineProperty(target, key, {
        value: 'SECRET_CANARY',
        enumerable: true,
      });
      expect(() => validateLiveConfig(config)).toThrow(
        'Invalid live configuration or invocation',
      );
    }
  },
);

test.each([
  null,
  [],
  1,
  true,
  '{"deviceKey":"SECRET_CANARY"',
  'x'.repeat(8193),
  {...fixture(), schemaVersion: '1'},
  {...fixture(), schemaVersion: 2},
  {...fixture(), extra: true},
  {...fixture(), scopeId: '0ne00AABBCC\nINJECT=x'},
])('rejects malformed schema safely (%#)', value => {
  expect(() => validateLiveConfig(value)).toThrow(
    'Invalid live configuration or invocation',
  );
});

test('requires selected cases and validates even unselected provided cases', () => {
  const config = fixture();
  delete config.cases.ios;
  expect(validateLiveConfig(config, 'android')).toEqual(config);
  expect(() => validateLiveConfig(config, 'all')).toThrow();
  expect(() => validateLiveConfig(config, 'ios')).toThrow();
  expect(() => validateLiveConfig(config, 'web')).toThrow();
  config.cases.ios = {};
  expect(() => validateLiveConfig(config, 'android')).toThrow();
});

test.each(['registrationId', 'expectedDeviceId', 'nonce'])(
  'requires unique %s',
  field => {
    const config = fixture();
    config.cases.ios[field] = config.cases.android[field];
    expect(() => validateLiveConfig(config)).toThrow();
  },
);

test('also rejects cross-platform identity overlap', () => {
  const config = fixture();
  config.cases.ios.expectedDeviceId = config.cases.android.registrationId;
  expect(() => validateLiveConfig(config)).toThrow();
});

test.each(['registrationId', 'expectedDeviceId', 'nonce'])(
  'rejects shell/env/regex/credential injection in %s',
  field => {
    for (const value of [
      'ok\nEVIL=yes',
      '$(echo bad)',
      "x'; bad",
      '.*',
      'SharedAccessSignature sr=secret',
      'x'.repeat(129),
      '',
    ]) {
      const config = fixture();
      config.cases.android[field] = value;
      expect(() => validateLiveConfig(config)).toThrow();
    }
  },
);

test.each(['\n', '\r', '\r\n', '\u2028', '\u2029'])(
  'rejects trailing line terminators rather than accepting JavaScript dollar anchors (%#)',
  terminator => {
    for (const field of ['scopeId', 'provisioningHost', 'expectedHub']) {
      const config = fixture();
      config[field] += terminator;
      expect(() => validateLiveConfig(config)).toThrow();
    }
    for (const field of ['registrationId', 'expectedDeviceId', 'nonce']) {
      const config = fixture();
      config.cases.android[field] += terminator;
      expect(() => validateLiveConfig(config)).toThrow();
    }
  },
);

test('rejects accessors and inherited/unknown fields without invoking them', () => {
  const config = fixture();
  const getter = jest.fn(() => 'SECRET_CANARY');
  Object.defineProperty(config, 'scopeId', {get: getter});
  expect(() => validateLiveConfig(config)).toThrow();
  expect(getter).not.toHaveBeenCalled();
  expect(() => validateLiveConfig(Object.create(fixture()))).toThrow();
});

test('case environment whitelists nonsecret variables and anchors literal expected values', () => {
  const env = caseEnvironment(fixture(), 'android');
  expect(Object.keys(env)).toEqual([
    'MAESTRO_APP_ID',
    'MAESTRO_PLATFORM',
    'MAESTRO_PROVISIONING_HOST',
    'MAESTRO_PROVISIONING_HOST_PATTERN',
    'MAESTRO_SCOPE_ID',
    'MAESTRO_REGISTRATION_ID',
    'MAESTRO_REGISTRATION_ID_PATTERN',
    'MAESTRO_EXPECTED_DEVICE_ID_PATTERN',
    'MAESTRO_EXPECTED_HUB_PATTERN',
    'MAESTRO_NONCE',
    'MAESTRO_NONCE_PATTERN',
    'MAESTRO_MODEL_ID_PATTERN',
  ]);
  expect(env.MAESTRO_DEVICE_KEY).toBeUndefined();
  const pattern = new RegExp(env.MAESTRO_EXPECTED_DEVICE_ID_PATTERN);
  expect(pattern.test('returned.android')).toBe(true);
  expect(pattern.test('returnedXandroid')).toBe(false);
  expect(pattern.test('prefix-returned.android')).toBe(false);
  const hostPattern = new RegExp(env.MAESTRO_PROVISIONING_HOST_PATTERN);
  expect(hostPattern.test(fixture().provisioningHost)).toBe(true);
  expect(hostPattern.test(fixture().provisioningHost + '-leftover')).toBe(
    false,
  );
  expect(hostPattern.test(fixture().provisioningHost.replace('.', 'X'))).toBe(
    false,
  );
  const noncePattern = new RegExp(env.MAESTRO_NONCE_PATTERN);
  expect(noncePattern.test(fixture().cases.android.nonce)).toBe(true);
  expect(noncePattern.test(fixture().cases.android.nonce + '-leftover')).toBe(
    false,
  );
  expect(() => caseEnvironment(fixture(), 'all')).toThrow();
});

test.each(['passed', 'failed'])(
  'whitelisted %s report never claims cloud verification',
  uiResult => {
    const report = createLiveReport(fixture(), 'android', {
      sourceSha,
      uiResult,
    });
    expect(Object.keys(report)).toEqual([
      'schemaVersion',
      'sourceSha',
      'platform',
      'modelId',
      'provisioningHost',
      'scopeId',
      'registrationId',
      'expectedDeviceId',
      'expectedHub',
      'nonce',
      'uiResult',
      'independentAzureVerification',
      'evidenceScope',
      'registryVerification',
      'diagnostics',
    ]);
    expect(report).toMatchObject({
      sourceSha,
      platform: 'android',
      uiResult,
      expectedDeviceId: 'returned.android',
      independentAzureVerification: 'pending',
      registryVerification: 'Not checked',
    });
    expect(report.evidenceScope).toContain('not a cloud ACK');
    expect(() =>
      createLiveReport(fixture(), 'android', {
        sourceSha,
        uiResult,
        deviceKey: 'SECRET_CANARY',
      }),
    ).toThrow();
    expect(() =>
      createLiveReport(fixture(), 'android', {sourceSha: 'bad', uiResult}),
    ).toThrow();
  },
);

test('CLI rejects invalid JSON without raw parser errors or inherited secret values', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/ci/live-config.js', 'env', 'android'],
    {
      encoding: 'utf8',
      env: {
        ...mockEnvironment,
        PAAD_LIVE_CONFIG: '{"SECRET_CANARY"',
        MAESTRO_DEVICE_KEY: 'KEY_CANARY',
      },
    },
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe(
    'Live configuration rejected; consult --help. No input was logged.\n',
  );
});

test('CLI report serializes only whitelisted configuration after an explicit result', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/ci/live-config.js', 'report', 'ios', 'passed'],
    {
      encoding: 'utf8',
      env: {
        ...mockEnvironment,
        PAAD_LIVE_CONFIG: JSON.stringify(fixture()),
        GITHUB_SHA: sourceSha,
        MAESTRO_DEVICE_KEY: 'KEY_CANARY',
      },
    },
  );
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(
    createLiveReport(fixture(), 'ios', {
      sourceSha,
      uiResult: 'passed',
      diagnostics: {availability: 'unavailable', reason: 'read-failed'},
    }),
  );
  expect(result.stdout).not.toContain('KEY_CANARY');
});

test('live flow does not capture screenshots, simulate cloud, or use key command arguments', () => {
  const flow = fs.readFileSync('.maestro/live-device.yaml', 'utf8');
  const smoke = fs.readFileSync('scripts/ci/smoke-live-device.sh', 'utf8');
  expect(flow).not.toMatch(/takeScreenshot|startRecording/);
  expect(flow).toContain('inputText: ${MAESTRO_DEVICE_KEY}');
  expect(flow).toContain('clearState: false');
  expect(yaml.loadAll(flow)[1]).toContainEqual({
    extendedWaitUntil: {
      visible: {id: 'proof-status', text: '^Submitted locally$'},
      timeout: 30000,
    },
  });
  expect(smoke).not.toMatch(
    /-e\s+(?:MAESTRO_)?DEVICE_KEY|set -x|printenv|logcat -d/,
  );
  expect(smoke).toContain("timeout: 900000, killSignal: 'SIGKILL'");
});

test('iOS key injection uses isolated slow characters without revealing the value', () => {
  const commands = yaml.loadAll(
    fs.readFileSync('.maestro/live-device.yaml', 'utf8'),
  )[1];
  const ios = commands.find(
    command => command.runFlow?.when?.platform === 'iOS',
  ).runFlow;
  expect(ios.commands).toEqual([
    {evalScript: '${output.keyIndex = 0}'},
    {
      repeat: {
        times: '${MAESTRO_DEVICE_KEY.length}',
        commands: [
          {inputText: '${MAESTRO_DEVICE_KEY.charAt(output.keyIndex)}'},
          {evalScript: '${output.keyIndex = output.keyIndex + 1}'},
        ],
      },
    },
  ]);
  const android = commands.find(
    command => command.runFlow?.when?.platform === 'Android',
  ).runFlow;
  expect(android.commands).toEqual([{inputText: '${MAESTRO_DEVICE_KEY}'}]);
});

test('both details presentations wait for readiness and sheet before exact identity', () => {
  const commands = yaml.loadAll(
    fs.readFileSync('.maestro/live-device.yaml', 'utf8'),
  )[1];
  const details = commands.flatMap((command, index) =>
    command.tapOn?.id === 'connection-details' ? [index] : [],
  );
  expect(details).toHaveLength(2);
  for (const index of details) {
    expect(commands[index - 3]).toEqual({runFlow: 'dismiss-android-permissions.yaml'});
    expect(commands[index - 2]).toEqual({
      extendedWaitUntil: {
        notVisible: {id: 'app-busy-overlay'},
        timeout: 15000,
      },
    });
    expect(commands[index - 1]).toEqual({
      extendedWaitUntil: {
        visible: {id: 'connection-details', enabled: true},
        timeout: 15000,
      },
    });
    expect(commands[index]).toEqual({tapOn: {id: 'connection-details'}});
    expect(commands[index + 1]).toEqual({
      runFlow: {
        file: 'dismiss-android-permissions.yaml',
        env: {AFTER_DETAILS_TAP: 'true'},
      },
    });
    expect(commands[index + 2]).toEqual({
      extendedWaitUntil: {
        visible: {id: 'connection-details-sheet'},
        timeout: 15000,
      },
    });
    expect(commands[index + 3]).toEqual({
      extendedWaitUntil: {
        visible: {
          id: 'assigned-device-id',
          text: '${MAESTRO_EXPECTED_DEVICE_ID_PATTERN}',
        },
        timeout: 15000,
      },
    });
    expect(commands[index + 4]).toEqual({
      scrollUntilVisible: {
        element: {id: 'assigned-hub'},
        direction: 'DOWN',
        timeout: 15000,
      },
    });
  }
  expect(commands.some(command => command.retry || command.waitForAnimationToEnd || command.sleep)).toBe(false);
  expect(commands.filter(command => command.launchApp).map(command => command.launchApp)).toEqual([
    {clearState: true, permissions: {all: 'deny'}},
    {clearState: false, permissions: {all: 'deny'}},
  ]);
});

const permissionHelper = () => yaml.loadAll(
  fs.readFileSync('.maestro/dismiss-android-permissions.yaml', 'utf8'),
);

test('Android denial variants share four guarded taps, then a fail-closed prompt assertion', () => {
  const [config, flow] = permissionHelper();
  expect(config.appId).toBe('${MAESTRO_APP_ID}');
  expect(config.env).toEqual({AFTER_DETAILS_TAP: 'false'});
  expect(flow).toHaveLength(1);
  const scope = flow[0].runFlow;
  expect(scope.when).toEqual({platform: 'Android'});
  expect(scope.commands[0]).toEqual({evalScript: '${output.androidPermissionDenied = false}'});
  const repeated = scope.commands[1].repeat;
  expect(repeated.times).toBe(4);
  expect(Object.keys(repeated).sort()).toEqual(['commands', 'times']);
  expect(repeated.commands).toHaveLength(1);
  const dismissal = repeated.commands[0].runFlow;
  const denyId = '^com\\.(android|google\\.android)\\.permissioncontroller:id/(permission_deny_button|permission_deny_and_dont_ask_again_button)$';
  expect(dismissal.when).toEqual({visible: {id: denyId}});
  expect(dismissal.commands).toEqual([
    {tapOn: {id: denyId, retryTapIfNoChange: false}},
    {evalScript: '${output.androidPermissionDenied = true}'},
  ]);
  const remaining = scope.commands[2].assertNotVisible;
  expect(Object.keys(remaining)).toEqual(['id']);
  const deny = new RegExp(denyId);
  const prompt = new RegExp(remaining.id);
  for (const pkg of ['com.android.permissioncontroller', 'com.google.android.permissioncontroller']) {
    expect(deny.test(`${pkg}:id/permission_deny_button`)).toBe(true);
    expect(deny.test(`${pkg}:id/permission_deny_and_dont_ask_again_button`)).toBe(true);
    for (const resource of ['grant_dialog', 'permission_message', 'permission_deny_button',
      'permission_deny_and_dont_ask_again_button', 'permission_allow_foreground_only_button']) {
      expect(prompt.test(`${pkg}:id/${resource}`)).toBe(true);
    }
    for (const resource of ['permission_allow_button', 'permission_allow_foreground_only_button',
      'permission_allow_one_time_button', 'permission_allow_all_button', 'permission_deny_button_extra']) {
      expect(deny.test(`${pkg}:id/${resource}`)).toBe(false);
    }
  }
  for (const resource of ['android:id/button1', 'android:id/aerr_close',
    'com.android.settings:id/permission_deny_button', 'unrelated:id/permission_deny_button',
    'com.android.settings:id/permission_deny_and_dont_ask_again_button',
    'unrelated:id/permission_deny_and_dont_ask_again_button',
    'com.android.permissioncontroller.evil:id/permission_deny_button']) {
    expect(deny.test(resource)).toBe(false);
    expect(prompt.test(resource)).toBe(false);
  }
  const flatten = steps => steps.flatMap(step => [
    step, ...flatten(step.runFlow?.commands ?? step.repeat?.commands ?? []),
  ]);
  const all = flatten(flow);
  expect(all.filter(step => step.repeat)).toHaveLength(1);
  expect(all.filter(step => step.tapOn).map(step => step.tapOn)).toEqual([
    {id: denyId, retryTapIfNoChange: false},
    {id: 'connection-details', retryTapIfNoChange: false},
  ]);
  expect(JSON.stringify(all)).not.toMatch(
    /takeScreenshot|startRecording|"point"|"text"|"optional"|waitForAnimationToEnd|"sleep"|clearState|setPermissions/,
  );
});

test('one Details retry requires a fresh post-tap denial and an asynchronous sheet lookup plus absence recheck', () => {
  const scope = permissionHelper()[1][0].runFlow;
  const recovery = scope.commands[3].runFlow;
  expect(scope.commands).toHaveLength(4);
  expect(recovery.when).toEqual({
    true: "${AFTER_DETAILS_TAP === 'true' && output.androidPermissionDenied === true}",
  });
  const evaluate = (expression, context) => vm.runInNewContext(expression.slice(2, -1), context);
  for (const [after, denied, expected] of [
    ['true', true, true], ['false', true, false], ['true', false, false],
    ['true', undefined, false], ['true', 'true', false], ['unrelated', true, false],
  ]) {
    expect(evaluate(recovery.when.true, {AFTER_DETAILS_TAP: after, output: {androidPermissionDenied: denied}}))
      .toBe(expected);
  }
  expect(recovery.commands[0]).toEqual({evalScript: '${output.androidDetailsSheetSeen = false}'});
  expect(recovery.commands[1]).toEqual({
    runFlow: {
      when: {visible: {id: 'connection-details-sheet'}},
      commands: [{evalScript: '${output.androidDetailsSheetSeen = true}'}],
    },
  });
  const retry = recovery.commands[2].runFlow;
  expect(recovery.commands).toHaveLength(3);
  expect(retry.when).toEqual({
    true: '${output.androidDetailsSheetSeen === false}',
    notVisible: {id: 'connection-details-sheet'},
  });
  expect(evaluate(retry.when.true, {output: {androidDetailsSheetSeen: true}})).toBe(false);
  expect(evaluate(retry.when.true, {output: {androidDetailsSheetSeen: false}})).toBe(true);
  expect(retry.commands).toEqual([
    {extendedWaitUntil: {visible: {id: 'connection-details', enabled: true}, timeout: 15000}},
    {runFlow: {
      when: {notVisible: {id: 'connection-details-sheet'}},
      commands: [{tapOn: {id: 'connection-details', retryTapIfNoChange: false}}],
    }},
  ]);
});

test('identity waits retain exact selectors with bounded sheet presentation', () => {
  const commands = yaml.loadAll(
    fs.readFileSync('.maestro/live-device.yaml', 'utf8'),
  )[1];
  expect(commands).toContainEqual({
    extendedWaitUntil: {
      notVisible: {id: 'registration-manual'},
      timeout: 180000,
    },
  });
  for (const [id, text] of [
    ['assigned-device-id', '${MAESTRO_EXPECTED_DEVICE_ID_PATTERN}'],
    ['assigned-hub', '${MAESTRO_EXPECTED_HUB_PATTERN}'],
  ]) {
    const waits = commands.filter(
      command => command.extendedWaitUntil?.visible?.id === id,
    );
    expect(waits).toEqual(
      Array(2).fill({
        extendedWaitUntil: {
          visible: {id, text},
          timeout: 15000,
        },
      }),
    );
    expect(commands.some(command => command.assertVisible?.id === id)).toBe(
      false,
    );
  }
});

test('workflow gates every live job, scopes secrets after binary publication and whitelists uploads', () => {
  const workflow = yaml.load(
    fs.readFileSync('.github/workflows/live-device.yml', 'utf8'),
  );
  expect(Object.keys(workflow.on)).toEqual(['push', 'workflow_dispatch']);
  expect(workflow.on.push).toEqual({
    branches: ['feature/adr-onboarding'],
    paths: ['.github/workflows/live-device.yml'],
  });
  expect(workflow.jobs.authorization.if).toBe(
    "github.event_name == 'workflow_dispatch'",
  );
  expect(workflow.jobs['register-manual-entrypoint'].if).toBe(
    "github.event_name == 'push'",
  );
  expect(
    JSON.stringify(workflow.jobs['register-manual-entrypoint']),
  ).not.toContain('secrets.');
  expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual([
    'platform',
    'ios_driver',
    'ios_smoke_only',
    'confirm_live',
    'expected_sha',
    'config',
    'diagnostic_public_key',
  ]);
  expect(workflow.env.MAESTRO_DEVICE_KEY).toBeUndefined();
  for (const platform of ['android', 'ios']) {
    const job = workflow.jobs[platform];
    expect(job.needs).toBe('authorization');
    expect(job['timeout-minutes']).toBeLessThanOrEqual(45);
    const secretSteps = job.steps.filter(step =>
      JSON.stringify(step).includes('secrets.'),
    );
    expect(secretSteps).toHaveLength(1);
    const secretStep = secretSteps[0];
    expect(secretStep['timeout-minutes']).toBe(20);
    expect(secretStep.env.MAESTRO_DEVICE_KEY).toBe(
      '${{ secrets.PAAD_LIVE_' + platform.toUpperCase() + '_DEVICE_KEY }}',
    );
    const buildIndex = job.steps.findIndex(
      step => step.run === `bash scripts/ci/build-${platform}.sh`,
    );
    expect(buildIndex).toBeGreaterThan(-1);
    const identityIndex = job.steps.findIndex(
      step => step.run === 'bash scripts/ci/identity.sh',
    );
    expect(identityIndex).toBeGreaterThan(-1);
    expect(identityIndex).toBeLessThan(buildIndex);
    expect(job.steps.indexOf(secretStep)).toBeGreaterThan(buildIndex);
    const nativeUploads = job.steps.filter(step =>
      step.uses?.startsWith('actions/upload-artifact@') &&
      ['build/ios-ui-smoke-summary.json', 'build/ios-ui-smoke.log'].includes(step.with.path),
    );
    expect(nativeUploads).toHaveLength(platform === 'ios' ? 2 : 0);
    if (platform === 'ios') {
      for (const upload of nativeUploads) {
        expect(upload.with['retention-days']).toBe(3);
        expect(job.steps.indexOf(upload)).toBeLessThan(job.steps.indexOf(secretStep));
      }
      expect(nativeUploads[1].if).toContain('inputs.ios_smoke_only');
      expect(secretStep.if).toContain('!inputs.ios_smoke_only');
      const synthetic = job.steps.find(step => step.run === 'node scripts/ci/run-ios-xcuitest.js smoke');
      expect(synthetic.env.PAAD_NATIVE_SMOKE_DIAGNOSTICS).toBe('${{ inputs.ios_smoke_only }}');
      expect(JSON.stringify(synthetic)).not.toContain('secrets.');
    }
    const encrypted = job.steps.filter(step =>
      step.uses?.startsWith('actions/upload-artifact@') &&
      step.with.path === 'build/ios-encrypted-diagnostic.json',
    );
    expect(encrypted).toHaveLength(platform === 'ios' ? 1 : 0);
    for (const upload of encrypted) {
      expect(upload.if).toContain("inputs.diagnostic_public_key != ''");
      expect(upload.with['retention-days']).toBe(1);
      expect(job.steps.indexOf(upload)).toBeGreaterThan(job.steps.indexOf(secretStep));
    }
    const uploads = job.steps.filter(step =>
      step.uses?.startsWith('actions/upload-artifact@') &&
      !nativeUploads.includes(step) && !encrypted.includes(step),
    );
    expect(uploads).toHaveLength(2);
    expect(job.steps.indexOf(uploads[0])).toBeGreaterThan(buildIndex);
    expect(job.steps.indexOf(uploads[0])).toBeLessThan(
      job.steps.indexOf(secretStep),
    );
    expect(uploads[0].with.path.trim().split('\n')).toEqual([
      `build/ci-artifacts/${
        platform === 'android'
          ? 'foundation-ci.apk'
          : 'foundation-simulator.app.zip'
      }`,
      'build/ci-artifacts/identity.txt',
    ]);
    expect(uploads[1].with.path).toBe(
      `build/live-device-summary-${platform}.json`,
    );
    for (const upload of uploads) expect(upload.with['retention-days']).toBe(3);
  }
});

test.each([
  ['GITHUB_EVENT_NAME', 'push'],
  ['PAAD_LIVE_CONFIRM', 'false'],
  ['GITHUB_REF', 'refs/heads/master'],
  ['GITHUB_ACTOR', 'not-owner'],
  ['PAAD_LIVE_EXPECTED_SHA', 'b'.repeat(40)],
  ['GITHUB_SHA', 'invalid'],
])(
  'shell gate fails closed before any device access when %s is unauthorized',
  (name, value) => {
    const result = spawnSync(
      'bash',
      ['scripts/ci/smoke-live-device.sh', 'android'],
      {
        encoding: 'utf8',
        env: {
          ...mockEnvironment,
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          PAAD_LIVE_CONFIRM: 'true',
          GITHUB_REF: 'refs/heads/feature/adr-onboarding',
          GITHUB_REPOSITORY_OWNER: 'owner',
          GITHUB_ACTOR: 'owner',
          GITHUB_SHA: sourceSha,
          PAAD_LIVE_EXPECTED_SHA: sourceSha,
          PAAD_VARIANT: 'ci',
          PAAD_LIVE_CONFIG: 'INVALID_INPUT_CANARY',
          MAESTRO_DEVICE_KEY: 'KEY_CANARY',
          [name]: value,
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Live smoke authorization rejected.\n');
  },
);

test.each([
  'KEY_CANARY',
  Buffer.alloc(15).toString('base64'),
  Buffer.alloc(32).toString('base64') + '\n',
])(
  'invalid dedicated input is rejected before accessing a device (%#)',
  key => {
    const result = spawnSync(
      'bash',
      ['scripts/ci/smoke-live-device.sh', 'ios'],
      {
        encoding: 'utf8',
        env: {
          ...mockEnvironment,
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          PAAD_LIVE_CONFIRM: 'true',
          GITHUB_REF: 'refs/heads/feature/adr-onboarding',
          GITHUB_REPOSITORY_OWNER: 'owner',
          GITHUB_ACTOR: 'owner',
          GITHUB_SHA: sourceSha,
          PAAD_LIVE_EXPECTED_SHA: sourceSha,
          PAAD_VARIANT: 'ci',
          PAAD_LIVE_CONFIG: JSON.stringify(fixture()),
          MAESTRO_DEVICE_KEY: key,
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Dedicated device input is not canonical Base64 key material.\n',
    );
    expect(result.stderr).not.toContain(key);
  },
);

test('report sanitizes nested diagnostics and never upgrades a failed UI result', () => {
  const diagnostics = {
    availability: 'available',
    failedCommands: [
      {
        sequenceNumber: 42,
        commandKind: 'assertConditionCommand',
        targetId: 'connection-status',
        inputText: 'SECRET_CANARY',
        error: {message: 'SECRET_CANARY'},
      },
    ],
    ui: {
      connectionErrorCode: 'AUTHENTICATION_FAILED',
      connectionServiceCode: 401002,
      proofStatus: 'SECRET_CANARY',
      message: 'SECRET_CANARY',
    },
    env: {MAESTRO_DEVICE_KEY: 'SECRET_CANARY'},
  };
  const report = createLiveReport(fixture(), 'ios', {
    sourceSha,
    uiResult: 'failed',
    diagnostics,
  });
  expect(JSON.stringify(report)).not.toContain('SECRET_CANARY');
  expect(report.uiResult).toBe('failed');
  expect(report.independentAzureVerification).toBe('pending');
  expect(report.diagnostics.ui).toEqual({
    connectionErrorCode: 'AUTHENTICATION_FAILED',
    connectionServiceCode: 401002,
  });
  expect(
    createLiveReport(fixture(), 'ios', {sourceSha, uiResult: 'failed'})
      .diagnostics,
  ).toEqual({availability: 'unavailable'});
});

test('cleanup and launcher stay private, owned and do not silence simulator cleanup failure', () => {
  const smoke = fs.readFileSync('scripts/ci/smoke-live-device.sh', 'utf8');
  const workflow = yaml.load(
    fs.readFileSync('.github/workflows/live-device.yml', 'utf8'),
  );
  const cleanup = workflow.jobs.ios.steps.find(
    step => step.name === "Remove only this job's dedicated simulator",
  );
  expect(cleanup.run).not.toContain('|| true');
  expect(cleanup.run).toContain('::warning::');
  expect(smoke).toContain('maestro="$PWD/build/ci-tools/maestro/bin/maestro"');
  expect(smoke).toContain('HOME="$private/home" TMPDIR="$private/scratch"');
  expect(smoke).toContain('export MAESTRO_DRIVER_STARTUP_TIMEOUT=240000');
  expect(smoke).toContain(
    'env -u MAESTRO_DEVICE_KEY -u PAAD_LIVE_CONFIG \\\n    bash scripts/ci/show-ios-simulator.sh "$device" > "$private/simulator-ui.log" 2>&1',
  );
  expect(smoke).toContain('stat.dev}:${stat.ino}');
  expect(smoke.indexOf('node scripts/ci/live-diagnostics.js')).toBeLessThan(
    smoke.indexOf('shell am force-stop'),
  );
  expect(smoke.indexOf('node scripts/ci/live-diagnostics.js')).toBeLessThan(
    smoke.indexOf('fs.rmSync(root'),
  );
  expect(smoke).not.toContain('rm -rf');
  const iosSelection = smoke.slice(
    smoke.indexOf('candidate="${IOS_SIMULATOR_UDID'),
  );
  expect(iosSelection.indexOf('[[ "$candidate" =~')).toBeLessThan(
    iosSelection.indexOf('device="$candidate"'),
  );
});

test.each([
  {
    maestroResult: '0',
    diagnostics: 'yes',
    cleanupFailure: 'no',
    expected: 'passed',
  },
  {
    maestroResult: '7',
    diagnostics: 'yes',
    cleanupFailure: 'no',
    expected: 'failed',
  },
  {
    maestroResult: '7',
    diagnostics: 'no',
    cleanupFailure: 'no',
    expected: 'failed',
  },
  {
    maestroResult: '0',
    diagnostics: 'yes',
    cleanupFailure: 'yes',
    expected: 'failed',
  },
])(
  'mock-only smoke preserves outcome and removes all private state (%#)',
  scenario => {
    const key = Buffer.from('SECRET_CANARY'.repeat(3)).toString('base64');
    const directory = `.live-smoke-fixture-${process.pid}-${scenario.maestroResult}-${scenario.diagnostics}-${scenario.cleanupFailure}`;
    fs.mkdirSync(directory, {mode: 0o700});
    try {
      for (const child of ['scripts/ci', 'bin', 'build/ci-tools/maestro/bin']) {
        fs.mkdirSync(path.join(directory, child), {recursive: true});
      }
      for (const file of [
        'smoke-live-device.sh',
        'live-config.js',
        'live-diagnostics.js',
        'ios-xcuitest-result.js',
        'capture-failed-ios-ui.js',
      ]) {
        fs.copyFileSync(
          `scripts/ci/${file}`,
          path.join(directory, 'scripts/ci', file),
        );
      }
      fs.writeFileSync(
        path.join(directory, 'bin/adb'),
        `#!/bin/bash
if [[ "$1" = devices ]]; then printf 'emulator-5554\\tdevice\\n'; exit 0; fi
if [[ "$TEST_CLEANUP_FAILURE" = yes && "$*" = *"pm clear"* ]]; then exit 1; fi
echo SECRET_CANARY
`,
        {mode: 0o700},
      );
      fs.writeFileSync(
        path.join(directory, 'build/ci-tools/maestro/bin/maestro'),
        `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const root = process.env.PAAD_LIVE_PRIVATE;
if (process.env.HOME !== root + '/home' || process.env.TMPDIR !== root + '/scratch' ||
    !process.env.JAVA_TOOL_OPTIONS.includes('-Duser.home=' + root + '/home') ||
    !process.argv[1].startsWith(path.resolve('build/ci-tools/maestro/bin'))) process.exit(99);
console.log('SECRET_CANARY', process.env.MAESTRO_DEVICE_KEY);
fs.writeFileSync(root + '/home/private-key', 'SECRET_CANARY');
fs.writeFileSync(root + '/scratch/private-java', 'SECRET_CANARY');
fs.writeFileSync(root + '/results/failure.png', 'SECRET_CANARY');
if (process.env.TEST_DIAGNOSTICS === 'yes') {
  fs.writeFileSync(root + '/results/commands.json', JSON.stringify([{
    command: {assertConditionCommand: {condition: {visible: {idRegex: 'connection-status', textRegex: 'SECRET_CANARY'}}}},
    metadata: {status: 'FAILED', sequenceNumber: 42, error: {message: 'SECRET_CANARY', debugMessage: 'SECRET_CANARY'}}
  }]));
}
process.exit(Number(process.env.TEST_MAESTRO_RESULT));
`,
        {mode: 0o700},
      );
      const result = spawnSync(
        '/bin/bash',
        ['scripts/ci/smoke-live-device.sh', 'android'],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 20000,
          env: {
            ...mockEnvironment,
            PATH: `${path.resolve(directory, 'bin')}:${mockEnvironment.PATH}`,
            GITHUB_EVENT_NAME: 'workflow_dispatch',
            PAAD_LIVE_CONFIRM: 'true',
            GITHUB_REF: 'refs/heads/feature/adr-onboarding',
            GITHUB_REPOSITORY_OWNER: 'owner',
            GITHUB_ACTOR: 'owner',
            GITHUB_SHA: sourceSha,
            PAAD_LIVE_EXPECTED_SHA: sourceSha,
            PAAD_VARIANT: 'ci',
            PAAD_LIVE_CONFIG: JSON.stringify(fixture()),
            MAESTRO_DEVICE_KEY: key,
            TEST_MAESTRO_RESULT: scenario.maestroResult,
            TEST_DIAGNOSTICS: scenario.diagnostics,
            TEST_CLEANUP_FAILURE: scenario.cleanupFailure,
          },
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status === 0).toBe(scenario.expected === 'passed');
      expect(result.stdout + result.stderr).not.toContain('SECRET_CANARY');
      expect(result.stdout + result.stderr).not.toContain(key);
      expect(
        fs.existsSync(path.join(directory, 'build/live-device-private')),
      ).toBe(false);
      const raw = fs.readFileSync(
        path.join(directory, 'build/live-device-summary-android.json'),
        'utf8',
      );
      const report = JSON.parse(raw);
      expect(raw).not.toContain('SECRET_CANARY');
      expect(raw).not.toContain(key);
      expect(report.uiResult).toBe(scenario.expected);
      expect(report.independentAzureVerification).toBe('pending');
      expect(report.diagnostics.availability).toBe(
        scenario.diagnostics === 'yes' ? 'available' : 'unavailable',
      );
    } finally {
      fs.rmSync(directory, {recursive: true});
    }
  },
);
