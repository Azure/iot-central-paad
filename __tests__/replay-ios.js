const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflow = yaml.load(fs.readFileSync('.github/workflows/replay-ios.yml', 'utf8'));
const script = fs.readFileSync('scripts/ci/replay-ios.sh', 'utf8');
const helper = fs.readFileSync('scripts/ci/replay-artifact.js', 'utf8');
const sourceSha = 'a46d3f3d99e9fc00d215ae81ebeae1f823c2b83e';
const sourceRun = '35143779269';
const harnessSha = 'b'.repeat(40);
const repository = 'HangyiWang/iot-central-paad';
const artifactName = `live-build-ios-${sourceSha}-1`;
const binary = 'foundation-simulator.app.zip';
const device = '12345678-1234-1234-1234-123456789ABC';
const developer = '/Applications/Xcode_26.6.app/Contents/Developer';
const environment = {
  PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/feature/adr-onboarding',
  GITHUB_REPOSITORY: repository, GITHUB_REPOSITORY_OWNER: 'HangyiWang',
  GITHUB_ACTOR: 'HangyiWang', GITHUB_TRIGGERING_ACTOR: 'HangyiWang',
  GITHUB_SHA: harnessSha, SOURCE_RUN: sourceRun, SOURCE_SHA: sourceSha, PAAD_VARIANT: 'ci',
  DEVELOPER_DIR: developer, IOS_SIMULATOR_DEVELOPER_DIR: developer,
};
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
let sequence = 0;

test.each(['maestro', 'xcuitest', 'unsupported'])('replay driver guard fails closed for %s', driver => {
  const guard = workflow.jobs.replay.steps.find(step => step.name === 'Reject unsupported replay drivers');
  const result = spawnSync('/bin/bash', ['-c', guard.run], {
    env: {PATH: process.env.PATH, IOS_REPLAY_DRIVER: driver},
  });
  expect(result.status).toBe(driver === 'unsupported' ? 1 : 0);
});

function withFixture(testBody, {download = false} = {}) {
  const directory = path.resolve(`.replay-ios-fixture-${process.pid}-${sequence++}`);
  fs.mkdirSync(directory, {mode: 0o700});
  const file = name => path.join(directory, name);
  try {
    for (const child of ['scripts/ci', '.maestro', 'bin', 'source', 'build/ci-tools/maestro/bin']) {
      fs.mkdirSync(file(child), {recursive: true});
    }
    fs.writeFileSync(file('scripts/ci/replay-ios.sh'), script);
    fs.writeFileSync(file('scripts/ci/replay-artifact.js'), helper);
    fs.copyFileSync('scripts/ci/show-ios-simulator.sh', file('scripts/ci/show-ios-simulator.sh'));
    for (const name of ['startup.yaml', 'dismiss-quickstep-anr.yaml', 'dismiss-ios-password-save.yaml']) {
      fs.copyFileSync(`.maestro/${name}`, file(`.maestro/${name}`));
    }
    const archive = 'synthetic ZIP fixture, not a real app or archive';
    const identity = [
      `Built commit: ${sourceSha}`, `Event SHA: ${sourceSha}`, `Run: ${sourceRun} attempt 1`,
      'Native variant: ci', `${digest(archive)}  build/ci-artifacts/${binary}`, '',
    ].join('\n');
    fs.writeFileSync(file(`source/${binary}`), archive);
    fs.writeFileSync(file('source/identity.txt'), identity);
    fs.writeFileSync(file('bin/open'), `#!/usr/bin/env node
const fs = require('node:fs');
if ('MAESTRO_DEVICE_KEY' in process.env || 'PAAD_LIVE_CONFIG' in process.env) process.exit(99);
fs.writeFileSync('simulator-ui-call.json', JSON.stringify(process.argv.slice(2)));
if (process.env.TEST_FAIL === 'open') process.exit(8);
`, {mode: 0o700});
    if (!download) {
      fs.mkdirSync(file('build/ci-artifacts'));
      for (const name of [binary, 'identity.txt']) {
        fs.copyFileSync(file(`source/${name}`), file(`build/ci-artifacts/${name}`));
      }
    }
    const metadata = {
      run: {
        id: Number(sourceRun), repository: {id: 1, full_name: repository},
        head_repository: {id: 1, full_name: repository}, head_sha: sourceSha,
        head_branch: 'feature/adr-onboarding', workflow_id: 359345717, event: 'workflow_dispatch',
        actor: {login: 'HangyiWang'}, triggering_actor: {login: 'HangyiWang'},
        run_attempt: 1, status: 'completed',
      },
      pages: [{artifacts: [{
        id: 123, name: artifactName, expired: false,
        workflow_run: {
          id: Number(sourceRun), head_sha: sourceSha, head_branch: 'feature/adr-onboarding',
          repository_id: 1, head_repository_id: 1,
        },
      }]}],
    };
    const saveMetadata = () => fs.writeFileSync(file('metadata.json'), JSON.stringify(metadata));
    saveMetadata();
    fs.writeFileSync(file('bin/gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('gh-calls.jsonl', JSON.stringify(args) + '\\n');
if (process.env.TEST_GH_FAILURE === '1') { console.error('RAW_TOKEN_CANARY'); process.exit(8); }
const data = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
if (args[0] === 'api') {
  console.log(JSON.stringify(args.includes('--paginate') ? data.pages : data.run));
} else if (args[0] === 'run' && args[1] === 'download') {
  for (const name of ['${binary}', 'identity.txt']) {
    fs.copyFileSync('source/' + name, 'build/ci-artifacts/' + name);
  }
  if (process.env.TEST_EXTRA_ARTIFACT === '1') fs.writeFileSync('build/ci-artifacts/unexpected', 'reject');
} else process.exit(99);
`, {mode: 0o700});
    fs.writeFileSync(file('bin/ditto'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync('ditto-call.json', JSON.stringify(process.argv.slice(2)));
if (process.env.TEST_FAIL === 'ditto') process.exit(8);
const app = process.argv.at(-1) + '/IoTPnP.app';
fs.mkdirSync(app);
fs.writeFileSync(app + '/Info.plist', 'mock plist');
fs.writeFileSync(app + '/main.jsbundle', 'synthetic bundled app');
`, {mode: 0o700});
    fs.writeFileSync(file('bin/plutil'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync('plist-call.json', JSON.stringify(process.argv.slice(2)));
console.log(process.env.TEST_BUNDLE_ID || 'com.microsoft.iotpnp.ci');
`, {mode: 0o700});
    fs.writeFileSync(file('bin/xcrun'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('simctl-calls.jsonl', JSON.stringify(args) + '\\n');
const operation = args[1];
if (args[0] !== 'simctl') process.exit(99);
if (operation === 'create') {
  if (process.env.TEST_FAIL === 'create') process.exit(8);
  console.log(process.env.TEST_UUID || '${device}');
  process.exit(0);
}
if (args[2] !== '${device}') process.exit(99);
if (process.env.TEST_FAIL === operation ||
    (operation === 'io' && process.env.TEST_FAIL === 'screenshot') ||
    (operation === 'spawn' && process.env.TEST_FAIL === 'runtime')) process.exit(8);
if (operation === 'io' && process.env.TEST_EMPTY_SCREENSHOT !== '1') {
  fs.writeFileSync(args.at(-1), 'synthetic screenshot');
}
console.log('synthetic simulator diagnostic');
`, {mode: 0o700});
    fs.writeFileSync(file('build/ci-tools/maestro/bin/maestro'), `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const state = path.resolve('build/replay-ios-state');
const args = process.argv.slice(2);
fs.writeFileSync('maestro-call.json', JSON.stringify({
  args, binary: process.argv[1], home: process.env.HOME, scratch: process.env.TMPDIR,
  javaOptions: process.env.JAVA_TOOL_OPTIONS,
}));
if (process.env.HOME !== state + '/home' || process.env.TMPDIR !== state + '/scratch' ||
    process.env.JAVA_TOOL_OPTIONS !== '-Duser.home=' + state + '/home -Djava.io.tmpdir=' + state + '/scratch' ||
    'MAESTRO_DEVICE_KEY' in process.env || 'PAAD_LIVE_CONFIG' in process.env ||
    'GH_TOKEN' in process.env || 'GITHUB_TOKEN' in process.env || args.includes('--version')) process.exit(99);
fs.writeFileSync(state + '/home/cache-fixture', 'not uploaded');
fs.writeFileSync(state + '/scratch/java-fixture', 'not uploaded');
fs.writeFileSync(args[args.indexOf('--output') + 1], '<testsuite/>');
fs.writeFileSync(args[args.indexOf('--debug-output') + 1] + '/commands.json', '[]');
console.log('synthetic Maestro stdout');
console.error('synthetic Maestro stderr');
process.exit(Number(process.env.TEST_MAESTRO_RESULT || 0));
`, {mode: 0o700});
    const execute = (command, args, overrides) => spawnSync(command, args, {
      cwd: directory, encoding: 'utf8', timeout: 20000,
      env: {...environment, PATH: `${file('bin')}:${environment.PATH}`, ...overrides},
    });
    const invoke = (overrides = {}, mode) => execute('/bin/bash',
      ['scripts/ci/replay-ios.sh', ...(mode ? [mode] : [])], overrides);
    const artifact = (overrides = {}, args = ['ios', 'verify']) =>
      execute(process.execPath, ['scripts/ci/replay-artifact.js', ...args], overrides);
    const calls = () => fs.existsSync(file('simctl-calls.jsonl'))
      ? fs.readFileSync(file('simctl-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [];
    testBody({file, invoke, artifact, calls, metadata, saveMetadata, identity, archive});
  } finally {
    fs.rmSync(directory, {recursive: true});
  }
}

test('iOS replay has owner/manual guards, narrowly scoped registration, pinned tools and bounded macOS jobs', () => {
  const android = yaml.load(fs.readFileSync('.github/workflows/replay-android.yml', 'utf8'));
  expect(workflow.on.push).toEqual({
    branches: ['feature/adr-onboarding'], paths: ['.github/workflows/replay-ios.yml'],
  });
  expect(workflow.on.workflow_dispatch.inputs).toMatchObject(android.on.workflow_dispatch.inputs);
  expect(workflow.on.workflow_dispatch.inputs.ios_driver).toEqual({
    description: 'Credential-free iOS replay driver',
    type: 'choice',
    options: ['maestro', 'xcuitest'],
    default: 'maestro',
    required: true,
  });
  expect(workflow.jobs.replay.if).toBe(android.jobs.replay.if);
  expect(workflow.jobs['register-manual-entrypoint'].if).toBe("github.event_name == 'push'");
  expect(workflow.jobs['register-manual-entrypoint'].steps).toEqual([
    {run: "echo 'Manual entrypoint registered. No binary, device traffic or credentials are used by this job.'"},
  ]);
  for (const job of Object.values(workflow.jobs)) {
    expect(job['runs-on']).toBe('macos-26');
    expect(job['timeout-minutes']).toBeLessThanOrEqual(30);
  }
  expect(workflow.jobs.replay.env).toMatchObject({
    DEVELOPER_DIR: developer, IOS_SIMULATOR_DEVELOPER_DIR: developer,
  });
  const steps = workflow.jobs.replay.steps;
  for (const step of steps.filter(candidate => candidate.uses)) {
    expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
  }
  expect(steps.find(step => step.uses?.startsWith('actions/checkout@')).with['persist-credentials']).toBe(false);
  expect(steps.find(step => step.uses?.startsWith('actions/setup-node@')).with).toEqual({'node-version': '24.19.0'});
  const java = steps.find(step => step.uses?.startsWith('actions/setup-java@'));
  expect(java.with).toEqual({
    distribution: 'temurin', 'java-version': '21',
  });
  expect(java.if).toBe("inputs.ios_driver == 'maestro'");
  const maestroInstall = steps.find(step => step.run === 'bash scripts/ci/install-maestro.sh');
  expect(maestroInstall.if).toBe("inputs.ios_driver == 'maestro'");
  const maestroReplay = steps.find(step => step.run === 'bash scripts/ci/replay-ios.sh');
  expect(maestroReplay.if).toBe("inputs.ios_driver == 'maestro'");
  expect(maestroReplay['timeout-minutes']).toBeLessThanOrEqual(15);
  const ruby = steps.find(step => step.uses?.startsWith('ruby/setup-ruby@'));
  expect(ruby).toMatchObject({
    uses: 'ruby/setup-ruby@984c0c890880bbf811283d6f09c4607c62d210a4',
    if: "inputs.ios_driver == 'xcuitest'",
    with: {'ruby-version': '3.3.8', bundler: '2.5.23', 'bundler-cache': true},
  });
  expect(steps.find(step => step.run === 'node scripts/ci/replay-native-ios.js')).toMatchObject({
    if: "inputs.ios_driver == 'xcuitest'", 'timeout-minutes': 25,
  });
  expect([...script.matchAll(/run_bounded (\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 60000))
    .toBeLessThan(900000);
  expect(script).toContain('run_bounded 400000 "$maestro"');
  expect(script).toContain('export MAESTRO_DRIVER_STARTUP_TIMEOUT=240000');
  expect(script).toContain('run_bounded 60000 xcrun simctl create');
  expect(script).toContain("timeout: Number(milliseconds), killSignal: 'SIGKILL'");
  expect(script).not.toMatch(/\btimeout --|--version|rm -rf|fs\.rmSync|printenv|set -x|live-device\.yaml/);
});

test('only source download receives a token; uploads exclude app, HOME, scratch and caches', () => {
  expect(workflow.permissions).toEqual({contents: 'read', actions: 'read'});
  expect(JSON.stringify(workflow)).not.toMatch(/secrets\.|azure\/login|npm (?:ci|install)|prebuild|build-ios\.sh/);
  expect(workflow.env.GH_TOKEN).toBeUndefined();
  expect(workflow.jobs.replay.env.GH_TOKEN).toBeUndefined();
  const steps = workflow.jobs.replay.steps;
  const tokenSteps = steps.filter(step => JSON.stringify(step).includes('github.token'));
  expect(tokenSteps).toHaveLength(1);
  expect(tokenSteps[0]).toMatchObject({
    id: 'source', env: {GH_TOKEN: '${{ github.token }}'}, run: 'bash scripts/ci/replay-ios.sh download',
  });
  expect(steps.find(step => step.run === 'bash scripts/ci/replay-ios.sh').env).toBeUndefined();
  const uploads = steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'));
  expect(uploads).toHaveLength(2);
  expect(uploads[0].with.path.trim().split('\n')).toEqual([
    'build/ci-artifacts/identity.txt', 'build/ci-artifacts/replay-ios/',
  ]);
  expect(uploads[0].if).toContain("inputs.ios_driver == 'maestro'");
  expect(uploads[1].with.path.trim().split('\n')).toEqual([
    'build/ci-artifacts/identity.txt', 'build/ci-artifacts/replay-ios/',
    'build/ios-ui-smoke-summary.json', 'build/ios-ui-smoke.log',
  ]);
  expect(uploads[1].if).toContain("inputs.ios_driver == 'xcuitest'");
  for (const upload of uploads) {
    expect(upload.with['retention-days']).toBe(3);
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(upload.if).toContain("steps.source.outcome == 'success'");
    expect(upload.if).toContain('!cancelled()');
    expect(upload.if).toContain("hashFiles('build/ci-artifacts/replay-ios/replay-identity.json')");
  }
});

test.each([
  ['GITHUB_EVENT_NAME', 'push'], ['GITHUB_REF', 'refs/heads/master'],
  ['GITHUB_REPOSITORY', 'other/repo'], ['GITHUB_REPOSITORY_OWNER', 'other'],
  ['GITHUB_ACTOR', 'other'], ['GITHUB_TRIGGERING_ACTOR', 'other'],
  ['GITHUB_SHA', `${harnessSha}\n`], ['SOURCE_RUN', '123\n'], ['SOURCE_RUN', '123\r'],
  ['SOURCE_RUN', '123;CANARY'], ['SOURCE_SHA', `${sourceSha}\n`], ['SOURCE_SHA', 'A'.repeat(40)],
  ['PAAD_VARIANT', 'production'],
])('shared helper and iOS shell independently reject unauthorized %s before activity (%#)', (name, value) => {
  withFixture(({invoke, artifact, calls, file}) => {
    for (const result of [invoke({[name]: value}), artifact({[name]: value}),
      artifact({[name]: value}, ['ios', 'download'])]) {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Replay artifact authorization or invocation rejected.\n');
    }
    expect(calls()).toEqual([]);
    expect(fs.existsSync(file('gh-calls.jsonl'))).toBe(false);
    expect(fs.existsSync(file('ditto-call.json'))).toBe(false);
  });
});

test.each([
  ['MAESTRO_DEVICE_KEY', 'KEY_CANARY'], ['MAESTRO_DEVICE_KEY', ''],
  ['PAAD_LIVE_CONFIG', 'CONFIG_CANARY'], ['PAAD_LIVE_CONFIG', ''],
  ['GH_TOKEN', 'TOKEN_CANARY'], ['GH_TOKEN', ''],
  ['GITHUB_TOKEN', 'TOKEN_CANARY'], ['GITHUB_TOKEN', ''],
])('script and direct helper refuse credential presence including empty %s (%#)', (name, value) => {
  withFixture(({invoke, artifact, calls, file}) => {
    for (const result of [invoke({[name]: value}), artifact({[name]: value})]) {
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).not.toContain('CANARY');
    }
    if (['MAESTRO_DEVICE_KEY', 'PAAD_LIVE_CONFIG'].includes(name)) {
      expect(artifact({[name]: value}, ['ios', 'download']).status).toBe(1);
    }
    expect(calls()).toEqual([]);
    expect(fs.existsSync(file('gh-calls.jsonl'))).toBe(false);
    expect(fs.existsSync(file('ditto-call.json'))).toBe(false);
  });
});

test.each([[], ['ios'], ['windows', 'verify'], ['ios', 'latest'], ['ios', 'verify', 'extra']].map(args => [args]))(
  'direct artifact CLI refuses malformed arguments (%#)', args => {
    withFixture(({artifact, file}) => {
      expect(artifact({}, args).status).toBe(1);
      expect(fs.existsSync(file('gh-calls.jsonl'))).toBe(false);
    });
  },
);

test('downloads the exact iOS artifact and verifies its immutable ZIP and replay identities', () => {
  withFixture(({invoke, artifact, file, identity, archive, calls}) => {
    const downloaded = invoke({GH_TOKEN: 'mock-download-only-token'}, 'download');
    expect(downloaded.stderr).toBe('');
    expect(downloaded.status).toBe(0);
    const ghCalls = fs.readFileSync(file('gh-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(ghCalls).toEqual([
      ['api', `repos/${repository}/actions/runs/${sourceRun}`],
      ['api', '--paginate', '--slurp', `repos/${repository}/actions/runs/${sourceRun}/artifacts?per_page=100`],
      ['run', 'download', sourceRun, '--repo', repository, '--name', artifactName, '--dir', 'build/ci-artifacts'],
    ]);
    const verified = artifact();
    expect(verified.status).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({
      sourceRepository: repository, sourceWorkflowId: 359345717, sourceRun, sourceSha,
      sourceAttempt: 1, sourceArtifact: artifactName, appZipSha256: digest(archive),
      replayHarnessSha: harnessSha, replayScriptSha256: digest(script), artifactHelperSha256: digest(helper),
      startupFlowSha256: digest(fs.readFileSync('.maestro/startup.yaml')),
      launcherRecoveryFlowSha256: digest(fs.readFileSync('.maestro/dismiss-quickstep-anr.yaml')),
      simulatorUIHelperSha256: digest(fs.readFileSync('scripts/ci/show-ios-simulator.sh')),
    });
    expect(fs.readFileSync(file('build/ci-artifacts/identity.txt'), 'utf8')).toBe(identity);
    expect(calls()).toEqual([]);
  }, {download: true});
});

test.each(['wrong-platform', 'duplicate', 'expired', 'raw-error', 'extra-file', 'corrupt-zip'])(
  'iOS artifact download rejects %s without device activity or raw errors', scenario => {
    withFixture(({invoke, metadata, saveMetadata, calls, file}) => {
      const entry = metadata.pages[0].artifacts[0];
      if (scenario === 'wrong-platform') entry.name = `live-build-android-${sourceSha}-1`;
      if (scenario === 'duplicate') metadata.pages.push({artifacts: [entry]});
      if (scenario === 'expired') entry.expired = true;
      saveMetadata();
      if (scenario === 'corrupt-zip') fs.appendFileSync(file(`source/${binary}`), 'corrupt');
      const result = invoke({
        TEST_GH_FAILURE: scenario === 'raw-error' ? '1' : '0',
        TEST_EXTRA_ARTIFACT: scenario === 'extra-file' ? '1' : '0',
      }, 'download');
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).not.toContain('RAW_TOKEN_CANARY');
      expect(calls()).toEqual([]);
    }, {download: true});
  },
);

test.each(['zip', 'checksum-path', 'duplicate-identity', 'wrong-attempt', 'symlink'])(
  'iOS rejects invalid %s binary before extraction or simulator access', scenario => {
    withFixture(({invoke, file, identity, calls}) => {
      if (scenario === 'zip') fs.appendFileSync(file(`build/ci-artifacts/${binary}`), 'corrupt');
      if (scenario === 'checksum-path') {
        fs.writeFileSync(file('build/ci-artifacts/identity.txt'), identity.replace(binary, 'foundation-ci.apk'));
      }
      if (scenario === 'duplicate-identity') {
        fs.appendFileSync(file('build/ci-artifacts/identity.txt'), `Built commit: ${sourceSha}\n`);
      }
      if (scenario === 'wrong-attempt') {
        fs.writeFileSync(file('build/ci-artifacts/identity.txt'), identity.replace('attempt 1', 'attempt 2'));
      }
      if (scenario === 'symlink') {
        fs.unlinkSync(file(`build/ci-artifacts/${binary}`));
        fs.symlinkSync(file(`source/${binary}`), file(`build/ci-artifacts/${binary}`));
      }
      expect(invoke().status).toBe(1);
      expect(calls()).toEqual([]);
      expect(fs.existsSync(file('ditto-call.json'))).toBe(false);
    });
  },
);

test.each([
  ['IOS_SIMULATOR_UDID', device], ['IOS_SIMULATOR_UDID', ''],
  ['DEVELOPER_DIR', '/Applications/other'], ['IOS_SIMULATOR_DEVELOPER_DIR', '/Applications/other'],
])('refuses supplied targets or unpinned Xcode before any simctl: %s (%#)', (name, value) => {
  withFixture(({invoke, calls}) => {
    expect(invoke({[name]: value}).status).toBe(1);
    expect(calls()).toEqual([]);
  });
});

test.each(['build/replay-ios-state', 'build/ci-artifacts/replay-ios'])(
  'refuses existing directories without adopting or deleting them: %s', existing => {
    withFixture(({invoke, file, calls}) => {
      fs.mkdirSync(file(existing));
      fs.writeFileSync(file(`${existing}/keep`), 'untouched');
      expect(invoke().status).toBe(1);
      expect(fs.readFileSync(file(`${existing}/keep`), 'utf8')).toBe('untouched');
      expect(calls()).toEqual([]);
    });
  },
);

test.each([
  {TEST_BUNDLE_ID: 'com.microsoft.iotpnp'}, {TEST_UUID: 'physical-device'},
  {TEST_UUID: `${device}\n${device}`}, {TEST_FAIL: 'create'},
])('does not boot or clean an unverified bundle/target (%#)', overrides => {
  withFixture(({invoke, calls, file}) => {
    expect(invoke(overrides).status).not.toBe(0);
    expect(calls().every(args => args[1] === 'create')).toBe(true);
    expect(fs.existsSync(file('maestro-call.json'))).toBe(false);
  });
});

test.each([
  {maestro: '0', fail: '', expected: 0},
  {maestro: '7', fail: '', expected: 7},
  {maestro: '0', fail: 'runtime', expected: 1},
  {maestro: '0', fail: 'screenshot', expected: 1},
  {maestro: '7', fail: 'screenshot', expected: 7},
  {maestro: '0', fail: 'shutdown', expected: 1},
  {maestro: '0', fail: 'delete', expected: 1},
  {maestro: '7', fail: 'delete', expected: 7},
])('isolates startup, captures diagnostics and cleans only its new UUID while preserving result (%#)', scenario => {
  withFixture(({invoke, file, calls, identity}) => {
    const result = invoke({TEST_MAESTRO_RESULT: scenario.maestro, TEST_FAIL: scenario.fail});
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(scenario.expected);
    const root = 'build/ci-artifacts/replay-ios';
    expect(JSON.parse(fs.readFileSync(file(`${root}/status.json`), 'utf8'))).toEqual({
      commandExitCode: Number(scenario.maestro), captureFailed: ['runtime', 'screenshot'].includes(scenario.fail),
      cleanupFailed: ['shutdown', 'delete'].includes(scenario.fail), flowAttempted: true,
      simulator: device, simulatorDeleted: scenario.fail !== 'delete',
    });
    expect(fs.readFileSync(file('build/ci-artifacts/identity.txt'), 'utf8')).toBe(identity);
    const invocation = JSON.parse(fs.readFileSync(file('maestro-call.json'), 'utf8'));
    expect(invocation.binary).toBe(file('build/ci-tools/maestro/bin/maestro'));
    expect(JSON.parse(fs.readFileSync(file('simulator-ui-call.json'), 'utf8'))).toEqual([
      '-a', `${developer}/Applications/Simulator.app`, '--args', '-CurrentDeviceUDID', device,
    ]);
    expect(invocation.args).toEqual([
      '--device', device, 'test', '--no-ansi',
      '--format', 'junit', '--output', file(`${root}/results/result.xml`),
      '--debug-output', file(`${root}/debug`), '--test-output-dir', file(`${root}/results`),
      '-e', 'APP_ID=com.microsoft.iotpnp.ci', '.maestro/startup.yaml',
    ]);
    expect(invocation.home).toBe(file('build/replay-ios-state/home'));
    expect(invocation.scratch).toBe(file('build/replay-ios-state/scratch'));
    expect(fs.readFileSync(file(`${root}/logs/maestro-stdout.log`), 'utf8')).toContain('synthetic Maestro stdout');
    expect(fs.readFileSync(file(`${root}/logs/maestro-stderr.log`), 'utf8')).toContain('synthetic Maestro stderr');
    expect(fs.existsSync(file(`${root}/debug/commands.json`))).toBe(true);
    expect(fs.existsSync(file(`${root}/results/result.xml`))).toBe(true);
    expect(fs.existsSync(file(`${root}/home`))).toBe(false);
    expect(fs.existsSync(file(`${root}/scratch`))).toBe(false);
    expect(fs.existsSync(file(`${root}/app`))).toBe(false);
    expect(JSON.parse(fs.readFileSync(file('ditto-call.json'), 'utf8'))).toEqual([
      '-x', '-k', `build/ci-artifacts/${binary}`, file('build/replay-ios-state/app'),
    ]);
    expect(calls()[0]).toEqual([
      'simctl', 'create', 'PAAD-Replay-CI', 'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5',
    ]);
    for (const args of calls().slice(1)) expect(args[2]).toBe(device);
    expect(calls().slice(-2)).toEqual([['simctl', 'shutdown', device], ['simctl', 'delete', device]]);
    expect(calls().find(args => args[1] === 'spawn')).toEqual([
      'simctl', 'spawn', device, 'log', 'show', '--style', 'compact', '--last', '5m', '--predicate',
      'process == "IoTPnP" OR ((process == "SpringBoard" OR process == "runningboardd" OR process == "CoreSimulatorBridge") AND eventMessage CONTAINS "com.microsoft.iotpnp.ci")',
    ]);
  });
});

test.each(['boot', 'bootstatus', 'install'])('tracks ownership and deletes the new UUID even after %s failure', fail => {
  withFixture(({invoke, calls, file}) => {
    expect(invoke({TEST_FAIL: fail}).status).toBe(8);
    expect(calls().slice(-2)).toEqual([['simctl', 'shutdown', device], ['simctl', 'delete', device]]);
    const status = JSON.parse(fs.readFileSync(file('build/ci-artifacts/replay-ios/status.json'), 'utf8'));
    expect(status).toMatchObject({commandExitCode: 8, flowAttempted: false, simulator: device, simulatorDeleted: true});
    expect(fs.readFileSync(file('build/ci-artifacts/replay-ios/simulator-uuid.txt'), 'utf8')).toBe(`${device}\n`);
    expect(fs.existsSync(file('maestro-call.json'))).toBe(false);
  });
});

test('Simulator UI launch failure fails replay before Maestro and still cleans its owned device', () => {
  withFixture(({invoke, calls, file}) => {
    expect(invoke({TEST_FAIL: 'open'}).status).toBe(1);
    expect(calls().slice(-2)).toEqual([['simctl', 'shutdown', device], ['simctl', 'delete', device]]);
    expect(fs.existsSync(file('maestro-call.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(file('build/ci-artifacts/replay-ios/status.json'), 'utf8')))
      .toMatchObject({commandExitCode: 1, flowAttempted: false, simulatorDeleted: true});
  });
});

test('empty screenshot fails successful replay but still deletes its simulator', () => {
  withFixture(({invoke, calls, file}) => {
    expect(invoke({TEST_EMPTY_SCREENSHOT: '1'}).status).toBe(1);
    expect(calls().at(-1)).toEqual(['simctl', 'delete', device]);
    const status = JSON.parse(fs.readFileSync(file('build/ci-artifacts/replay-ios/status.json'), 'utf8'));
    expect(status).toMatchObject({commandExitCode: 0, captureFailed: true, simulatorDeleted: true});
  });
});
