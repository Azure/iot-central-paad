const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const helper = fs.readFileSync('scripts/ci/replay-native-ios.js', 'utf8');
const developer = '/Applications/Xcode_26.6.app/Contents/Developer';
const device = '12345678-1234-1234-1234-123456789ABC';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
let sequence = 0;

function fixture(testBody) {
  const directory = path.resolve(`.replay-native-ios-fixture-${process.pid}-${sequence++}`);
  const file = name => path.join(directory, name);
  fs.mkdirSync(directory, {mode: 0o700});
  try {
    for (const child of ['scripts/ci', 'build/ci-artifacts', 'bin']) {
      fs.mkdirSync(file(child), {recursive: true});
    }
    fs.writeFileSync(file('scripts/ci/replay-native-ios.js'), helper);
    fs.writeFileSync(file('scripts/ci/PaadLiveUITests.swift'), 'synthetic swift harness');
    fs.writeFileSync(file('scripts/ci/build-ios-uitests.sh'), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' build >> events
[[ "\${TEST_FAIL:-}" != build ]]
test -d build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app
mkdir build/ios-uitest
mkdir build/ios-uitest-derived
`, {mode: 0o700});
    fs.writeFileSync(file('scripts/ci/replay-artifact.js'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync('events', 'verify\\n');
if (process.env.TEST_FAIL === 'verify') process.exit(8);
console.log(JSON.stringify({sourceSha: process.env.SOURCE_SHA, appZipSha256: '${'a'.repeat(64)}'}));
`, {mode: 0o700});
    fs.writeFileSync(file('scripts/ci/run-ios-xcuitest.js'), `const fs = require('node:fs');
exports.executeNative = (mode, env) => {
  fs.appendFileSync('events', 'execute\\n');
  fs.writeFileSync('native-call.json', JSON.stringify({mode, env}));
  fs.writeFileSync('build/ios-ui-smoke-summary.json', '{"uiResult":"passed"}\\n');
  fs.writeFileSync('build/ios-ui-smoke.log', 'synthetic native output\\n');
  if (process.env.TEST_FAIL === 'execute-throw') throw new Error('synthetic');
  return process.env.TEST_FAIL !== 'execute-false';
};
`);
    fs.writeFileSync(file('build/ci-artifacts/foundation-simulator.app.zip'), 'verified archive');
    fs.writeFileSync(file('build/ci-artifacts/identity.txt'), 'verified identity');
    fs.writeFileSync(file('github-env'), '');
    fs.writeFileSync(file('bin/ditto'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync('events', 'extract\\n');
if (process.env.TEST_FAIL === 'extract') process.exit(8);
const destination = process.argv.at(-1);
const app = destination + '/IoTPnP.app';
fs.mkdirSync(app);
fs.writeFileSync(app + '/Info.plist', 'synthetic plist');
fs.writeFileSync(app + '/main.jsbundle', 'synthetic bundle');
`, {mode: 0o700});
    fs.writeFileSync(file('bin/plutil'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync('events', 'plist\\n');
console.log(process.env.TEST_BUNDLE_ID || 'com.microsoft.iotpnp.ci');
`, {mode: 0o700});
    fs.writeFileSync(file('bin/xcrun'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('events', args[1] + '\\n');
fs.appendFileSync('simctl-calls.jsonl', JSON.stringify(args) + '\\n');
if (process.env.TEST_FAIL === args[1]) process.exit(8);
if (args[1] === 'create') console.log(process.env.TEST_UUID || '${device}');
`, {mode: 0o700});
    const environment = {
      PATH: `${file('bin')}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
      PAAD_VARIANT: 'ci',
      DEVELOPER_DIR: developer,
      IOS_SIMULATOR_DEVELOPER_DIR: developer,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/feature/adr-onboarding',
      GITHUB_REPOSITORY: 'HangyiWang/iot-central-paad',
      GITHUB_REPOSITORY_OWNER: 'HangyiWang',
      GITHUB_ACTOR: 'HangyiWang',
      GITHUB_TRIGGERING_ACTOR: 'HangyiWang',
      GITHUB_SHA: 'b'.repeat(40),
      SOURCE_RUN: '35264683214',
      SOURCE_SHA: 'bc0410edb5afc69997e74a8884d0f08bc8a3bce4',
      GITHUB_ENV: file('github-env'),
    };
    const invoke = overrides => spawnSync(process.execPath, ['scripts/ci/replay-native-ios.js'], {
      cwd: directory,
      env: {...environment, ...overrides},
      encoding: 'utf8',
      timeout: 20000,
    });
    const events = () => fs.existsSync(file('events'))
      ? fs.readFileSync(file('events'), 'utf8').trim().split('\n') : [];
    const calls = () => fs.existsSync(file('simctl-calls.jsonl'))
      ? fs.readFileSync(file('simctl-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [];
    testBody({file, invoke, events, calls});
  } finally {
    fs.rmSync(directory, {recursive: true});
  }
}

test.each([
  'GH_TOKEN', 'GITHUB_TOKEN', 'MAESTRO_DEVICE_KEY', 'PAAD_LIVE_CONFIG',
  'PAAD_XCTEST_CASE', 'TEST_RUNNER_PAAD_XCTEST_CASE', 'IOS_SIMULATOR_UDID',
])('native replay rejects supplied credential or target variable before verification: %s', name => {
  fixture(({invoke, events, file}) => {
    const result = invoke({[name]: ''});
    expect(result.status).toBe(1);
    expect(events()).toEqual([]);
    expect(fs.existsSync(file('build/ci-artifacts/replay-ios'))).toBe(false);
  });
});

test('native replay verifies first, binds the current harness, and delegates simulator lifecycle', () => {
  fixture(({invoke, events, calls, file}) => {
    const result = invoke({});
    expect(result).toMatchObject({status: 0, stderr: ''});
    expect(events()).toEqual(['verify', 'extract', 'plist', 'build', 'create', 'execute', 'delete']);
    expect(calls()).toEqual([
      ['simctl', 'create', 'PAAD-Replay-Native-CI',
        'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
        'com.apple.CoreSimulator.SimRuntime.iOS-26-5'],
      ['simctl', 'delete', device],
    ]);
    const identity = JSON.parse(
      fs.readFileSync(file('build/ci-artifacts/replay-ios/replay-identity.json'), 'utf8'),
    );
    expect(identity).toMatchObject({
      sourceSha: 'bc0410edb5afc69997e74a8884d0f08bc8a3bce4',
      appZipSha256: 'a'.repeat(64),
      nativeDriver: 'xcuitest',
      nativeHarnessSwiftSha256: digest('synthetic swift harness'),
      nativeRunControllerSha256: digest(fs.readFileSync(file('scripts/ci/run-ios-xcuitest.js'))),
      nativeBuildHelperSha256: digest(fs.readFileSync(file('scripts/ci/build-ios-uitests.sh'))),
    });
    const native = JSON.parse(fs.readFileSync(file('native-call.json'), 'utf8'));
    expect(native.mode).toBe('smoke');
    expect(native.env).toMatchObject({
      IOS_SIMULATOR_UDID: device,
      PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true',
    });
    for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'MAESTRO_DEVICE_KEY', 'PAAD_LIVE_CONFIG']) {
      expect(native.env).not.toHaveProperty(name);
    }
    expect(fs.readFileSync(file('github-env'), 'utf8')).toBe(
      `IOS_SIMULATOR_UDID=${device}\n` +
      'PAAD_NATIVE_REPLAY_SIMULATOR_DELETED=0\n' +
      'PAAD_NATIVE_REPLAY_SIMULATOR_DELETED=1\n',
    );
    expect(JSON.parse(
      fs.readFileSync(file('build/ci-artifacts/replay-ios/native-result.json'), 'utf8'),
    )).toEqual({
      schemaVersion: 1,
      driver: 'xcuitest',
      executionSucceeded: true,
      simulatorCreated: true,
      simulatorDeleted: true,
    });
  });
});

test.each(['execute-false', 'execute-throw', 'delete'])(
  'native replay preserves execution failure and surfaces owned simulator cleanup: %s',
  failure => {
    fixture(({invoke, calls, file}) => {
      const result = invoke({TEST_FAIL: failure});
      expect(result.status).toBe(1);
      expect(calls().at(-1)).toEqual(['simctl', 'delete', device]);
      const status = JSON.parse(
        fs.readFileSync(file('build/ci-artifacts/replay-ios/native-result.json'), 'utf8'),
      );
      expect(status.executionSucceeded).toBe(failure === 'delete');
      expect(status.simulatorCreated).toBe(true);
      expect(status.simulatorDeleted).toBe(failure !== 'delete');
      expect(fs.readFileSync(file('github-env'), 'utf8')).toContain(
        `IOS_SIMULATOR_UDID=${device}\n`,
      );
      if (failure === 'delete') {
        expect(fs.readFileSync(file('github-env'), 'utf8')).not.toContain(
          'PAAD_NATIVE_REPLAY_SIMULATOR_DELETED=1',
        );
      }
    });
  },
);

test.each([
  [{TEST_BUNDLE_ID: 'com.microsoft.iotpnp'}, ['verify', 'extract', 'plist']],
  [{TEST_UUID: 'not-a-device'}, ['verify', 'extract', 'plist', 'build', 'create']],
  [{TEST_FAIL: 'build'}, ['verify', 'extract', 'plist', 'build']],
])('native replay refuses invalid app, UUID, or runner build before execution (%#)', (overrides, expected) => {
  fixture(({invoke, events, calls, file}) => {
    expect(invoke(overrides).status).toBe(1);
    expect(events()).toEqual(expected);
    expect(fs.existsSync(file('native-call.json'))).toBe(false);
    expect(calls().some(args => args[1] === 'delete')).toBe(false);
  });
});

test.each([
  'build/ci-artifacts/replay-ios',
  'build/ios-derived',
  'build/ios-uitest-derived',
  'build/ios-ui-smoke-private',
])(
  'native replay does not adopt or delete reused output: %s',
  existing => {
    fixture(({invoke, events, file}) => {
      fs.mkdirSync(file(existing));
      fs.writeFileSync(file(`${existing}/keep`), 'untouched');
      expect(invoke({}).status).toBe(1);
      expect(events()).toEqual(['verify']);
      expect(fs.readFileSync(file(`${existing}/keep`), 'utf8')).toBe('untouched');
    });
  },
);
