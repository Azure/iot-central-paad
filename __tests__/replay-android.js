const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflow = yaml.load(fs.readFileSync('.github/workflows/replay-android.yml', 'utf8'));
const script = fs.readFileSync('scripts/ci/replay-android.sh', 'utf8');
const sourceSha = 'e649b78bc8a38d5ca4d0294d4fb15a912d7a0c09';
const sourceRun = '35128464831';
const harnessSha = 'b'.repeat(40);
const repository = 'HangyiWang/iot-central-paad';
const artifactName = `live-build-android-${sourceSha}-1`;
const environment = {
  PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/feature/adr-onboarding',
  GITHUB_REPOSITORY: repository,
  GITHUB_REPOSITORY_OWNER: 'HangyiWang',
  GITHUB_ACTOR: 'HangyiWang',
  GITHUB_TRIGGERING_ACTOR: 'HangyiWang',
  GITHUB_SHA: harnessSha,
  SOURCE_RUN: sourceRun,
  SOURCE_SHA: sourceSha,
  PAAD_VARIANT: 'ci',
};

let fixtureSequence = 0;
function withFixture(testBody, {download = false} = {}) {
  const directory = path.resolve(`.replay-android-fixture-${process.pid}-${fixtureSequence++}`);
  fs.mkdirSync(directory, {mode: 0o700});
  const file = name => path.join(directory, name);
  try {
    for (const child of ['scripts/ci', '.maestro', 'bin', 'source', 'build/ci-tools/maestro/bin']) {
      fs.mkdirSync(file(child), {recursive: true});
    }
    fs.writeFileSync(file('scripts/ci/replay-android.sh'), script);
    fs.copyFileSync('scripts/ci/replay-artifact.js', file('scripts/ci/replay-artifact.js'));
    fs.copyFileSync('.maestro/startup.yaml', file('.maestro/startup.yaml'));
    fs.copyFileSync('.maestro/dismiss-quickstep-anr.yaml', file('.maestro/dismiss-quickstep-anr.yaml'));
    fs.copyFileSync('.maestro/dismiss-ios-password-save.yaml', file('.maestro/dismiss-ios-password-save.yaml'));
    const apk = Buffer.from('credential-free mock APK, not an Android binary');
    const apkSha256 = crypto.createHash('sha256').update(apk).digest('hex');
    const identity = [
      `Built commit: ${sourceSha}`, `Event SHA: ${sourceSha}`,
      `Run: ${sourceRun} attempt 1`, 'Native variant: ci',
      `${apkSha256}  build/ci-artifacts/foundation-ci.apk`, '',
    ].join('\n');
    fs.writeFileSync(file('source/foundation-ci.apk'), apk);
    fs.writeFileSync(file('source/identity.txt'), identity);
    if (!download) {
      fs.mkdirSync(file('build/ci-artifacts'));
      for (const name of ['foundation-ci.apk', 'identity.txt']) {
        fs.copyFileSync(file(`source/${name}`), file(`build/ci-artifacts/${name}`));
      }
    }
    const run = {
      id: Number(sourceRun), repository: {id: 1, full_name: repository},
      head_repository: {id: 1, full_name: repository},
      head_sha: sourceSha, head_branch: 'feature/adr-onboarding', workflow_id: 359345717,
      event: 'workflow_dispatch', actor: {login: 'HangyiWang'},
      triggering_actor: {login: 'HangyiWang'}, run_attempt: 1, status: 'completed',
    };
    const artifact = {
      id: 123, name: artifactName, expired: false,
      workflow_run: {
        id: Number(sourceRun), head_sha: sourceSha, head_branch: 'feature/adr-onboarding',
        repository_id: 1, head_repository_id: 1,
      },
    };
    const metadata = {run, pages: [{artifacts: [artifact]}]};
    const saveMetadata = () => fs.writeFileSync(file('metadata.json'), JSON.stringify(metadata));
    saveMetadata();
    fs.writeFileSync(file('bin/gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('gh-calls.jsonl', JSON.stringify(args) + '\\n');
const data = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
if (args[0] === 'api') {
  console.log(JSON.stringify(args.includes('--paginate') ? data.pages : data.run));
} else if (args[0] === 'run' && args[1] === 'download') {
  for (const name of ['foundation-ci.apk', 'identity.txt']) {
    fs.copyFileSync('source/' + name, 'build/ci-artifacts/' + name);
  }
} else process.exit(99);
`, {mode: 0o700});
    fs.writeFileSync(file('bin/adb'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('adb-calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'devices') {
  process.stdout.write(process.env.TEST_DEVICES || 'List of devices attached\\nemulator-5554\\tdevice\\n');
} else if (args.includes('install') && process.env.TEST_INSTALL_FAILURE === '1') {
  process.exit(8);
} else if (args.includes('screencap')) {
  if (process.env.TEST_CAPTURE_FAILURE === '1') process.exit(9);
  if (process.env.TEST_EMPTY_SCREENSHOT !== '1') process.stdout.write('mock screenshot');
} else {
  console.log('synthetic Android diagnostic');
}
`, {mode: 0o700});
    fs.writeFileSync(file('build/ci-tools/maestro/bin/maestro'), `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const state = path.resolve('build/replay-android-state');
const args = process.argv.slice(2);
fs.writeFileSync('maestro-call.json', JSON.stringify({
  args, binary: process.argv[1], home: process.env.HOME, scratch: process.env.TMPDIR,
  javaOptions: process.env.JAVA_TOOL_OPTIONS,
}));
if (process.env.HOME !== state + '/home' || process.env.TMPDIR !== state + '/scratch' ||
    process.env.JAVA_TOOL_OPTIONS !== '-Duser.home=' + state + '/home -Djava.io.tmpdir=' + state + '/scratch' ||
    'MAESTRO_DEVICE_KEY' in process.env || 'PAAD_LIVE_CONFIG' in process.env ||
    'GH_TOKEN' in process.env || 'GITHUB_TOKEN' in process.env ||
    args.includes('--version')) process.exit(99);
console.log('synthetic Maestro stdout');
console.error('synthetic Maestro stderr');
fs.writeFileSync(state + '/home/cache-fixture', 'not uploaded');
fs.writeFileSync(state + '/scratch/java-fixture', 'not uploaded');
fs.writeFileSync(args[args.indexOf('--output') + 1], '<testsuite/>');
fs.writeFileSync(args[args.indexOf('--debug-output') + 1] + '/commands.json', '[]');
process.exit(Number(process.env.TEST_MAESTRO_RESULT || 0));
`, {mode: 0o700});
    const invoke = (overrides = {}, mode) => spawnSync('/bin/bash', [
      'scripts/ci/replay-android.sh', ...(mode ? [mode] : []),
    ], {
      cwd: directory, encoding: 'utf8', timeout: 20000,
      env: {...environment, PATH: `${file('bin')}:${environment.PATH}`, ...overrides},
    });
    testBody({file, invoke, metadata, saveMetadata, identity, apkSha256});
  } finally {
    fs.rmSync(directory, {recursive: true});
  }
}

test('only the feature workflow path registers metadata; replay is owner-only and manual-only', () => {
  expect(workflow.on.push).toEqual({
    branches: ['feature/adr-onboarding'], paths: ['.github/workflows/replay-android.yml'],
  });
  expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual(['source_run', 'source_sha']);
  for (const input of Object.values(workflow.on.workflow_dispatch.inputs)) {
    expect(input).toMatchObject({type: 'string', required: true});
  }
  const registration = workflow.jobs['register-manual-entrypoint'];
  expect(registration.if).toBe("github.event_name == 'push'");
  expect(registration.steps).toHaveLength(1);
  expect(registration.steps[0].uses).toBeUndefined();
  expect(registration.steps[0].run).toMatch(/^echo /);
  for (const guard of [
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/feature/adr-onboarding'",
    "github.repository == 'HangyiWang/iot-central-paad'",
    'github.actor == github.repository_owner',
    'github.triggering_actor == github.repository_owner',
  ]) expect(workflow.jobs.replay.if).toContain(guard);
  for (const job of Object.values(workflow.jobs)) {
    expect(job['runs-on']).toBe('ubuntu-24.04');
    expect(job['timeout-minutes']).toBeLessThanOrEqual(30);
  }
});

test('tokens are scoped to source download and no secrets, build, installs or broad uploads exist', () => {
  expect(workflow.permissions).toEqual({contents: 'read', actions: 'read'});
  expect(JSON.stringify(workflow)).not.toMatch(/secrets\.|azure\/login|npm (?:ci|install)|prebuild|build-android\.sh/);
  expect(workflow.env.GH_TOKEN).toBeUndefined();
  expect(workflow.jobs.replay.env.GH_TOKEN).toBeUndefined();
  const tokenSteps = workflow.jobs.replay.steps.filter(step => JSON.stringify(step).includes('github.token'));
  expect(tokenSteps).toHaveLength(1);
  expect(tokenSteps[0]).toMatchObject({
    id: 'source', env: {GH_TOKEN: '${{ github.token }}'},
    run: 'bash scripts/ci/replay-android.sh download',
  });
  const emulator = workflow.jobs.replay.steps.find(step => step.uses?.startsWith('reactivecircus/'));
  expect(emulator.env).toBeUndefined();
  const uploads = workflow.jobs.replay.steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'));
  expect(uploads).toHaveLength(1);
  expect(uploads[0].with.path.trim().split('\n')).toEqual([
    'build/ci-artifacts/identity.txt', 'build/ci-artifacts/replay-android/',
  ]);
  expect(uploads[0].with['retention-days']).toBe(3);
  expect(uploads[0].with['if-no-files-found']).toBe('error');
  expect(uploads[0].if).toContain("steps.source.outcome == 'success'");
  expect(uploads[0].if).toContain('!cancelled()');
  expect(uploads[0].if).toContain("hashFiles('build/ci-artifacts/replay-android/replay-identity.json')");
  expect(script).not.toMatch(/rm -rf|fs\.rmSync|printenv|set -x|--version|live-device\.yaml/);
});

test('reuses pinned live actions, Java 21, Maestro installer and identical emulator/KVM settings', () => {
  const live = yaml.load(fs.readFileSync('.github/workflows/live-device.yml', 'utf8'));
  const steps = workflow.jobs.replay.steps;
  const liveSteps = live.jobs.android.steps;
  for (const step of steps.filter(candidate => candidate.uses)) {
    expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    expect(liveSteps.some(candidate => candidate.uses === step.uses)).toBe(true);
  }
  expect(steps.find(step => step.uses?.startsWith('actions/checkout@')).with['persist-credentials']).toBe(false);
  expect(steps.find(step => step.uses?.startsWith('actions/setup-node@')).with).toEqual({'node-version': '24.19.0'});
  expect(steps.find(step => step.uses?.startsWith('actions/setup-java@')).with).toEqual({
    distribution: 'temurin', 'java-version': '21',
  });
  expect(steps.some(step => step.run === 'bash scripts/ci/install-maestro.sh')).toBe(true);
  const emulator = steps.find(step => step.uses?.startsWith('reactivecircus/'));
  const liveEmulator = liveSteps.find(step => step.uses?.startsWith('reactivecircus/'));
  expect(emulator.with).toEqual({...liveEmulator.with, script: 'bash scripts/ci/replay-android.sh'});
  expect(emulator['timeout-minutes']).toBeLessThanOrEqual(15);
  expect(steps.find(step => step.name === 'Enable standard runner KVM').run)
    .toBe(liveSteps.find(step => step.name === 'Enable standard runner KVM').run);
});

test('replays the shared synthetic startup assertions and never submits Connect', () => {
  const flow = yaml.loadAll(fs.readFileSync('.maestro/startup.yaml', 'utf8'));
  const commands = flow[1];
  expect(flow[0].appId).toBe('${APP_ID}');
  expect(commands.filter(command => command.inputText).map(command => command.inputText)).toEqual([
    'ci-input-fixture', '0ne00000000',
    'global-canary.azure-devices-provisioning.net', 'synthetic+not/a-device-key=',
  ]);
  for (const [id, text] of [
    ['connection-registrationId', '^ci-input-fixture$'],
    ['connection-scopeId', '^0ne00000000$'],
    ['connection-provisioningHost', '^global-canary\\.azure-devices-provisioning\\.net$'],
  ]) expect(commands).toContainEqual({assertVisible: {id, text}});
  expect(commands).toContainEqual({assertVisible: {id: 'connection-submit'}});
  expect(commands.filter(command => command.tapOn).map(command => command.tapOn.id))
    .not.toContain('connection-submit');
  expect(commands.filter(command => command.runFlow)).toEqual([
    {runFlow: 'dismiss-quickstep-anr.yaml'},
    {runFlow: 'dismiss-ios-password-save.yaml'},
    {runFlow: 'dismiss-quickstep-anr.yaml'},
  ]);
  expect(commands.some(command => command.runScript)).toBe(false);
  expect(script).toContain("'-e', 'APP_ID=com.iot_pnp.ci', '.maestro/startup.yaml'");
  expect(script).not.toMatch(/-e[^\n]*(?:DEVICE_KEY|PAAD_LIVE_CONFIG)/);
});

test.each([
  ['GITHUB_EVENT_NAME', 'push'], ['GITHUB_REF', 'refs/heads/master'],
  ['GITHUB_REPOSITORY', 'other/iot-central-paad'], ['GITHUB_REPOSITORY_OWNER', 'other'],
  ['GITHUB_ACTOR', 'other'], ['GITHUB_TRIGGERING_ACTOR', 'other'],
  ['GITHUB_SHA', 'invalid'], ['SOURCE_RUN', '1; echo CANARY'],
  ['SOURCE_RUN', ''], ['SOURCE_RUN', '123\n'], ['SOURCE_SHA', 'A'.repeat(40)],
  ['SOURCE_SHA', `${sourceSha}\n`], ['SOURCE_SHA', 'latest'], ['PAAD_VARIANT', 'production'],
])('rejects unauthorized %s before any device or artifact access (%#)', (name, value) => {
  withFixture(({invoke, file}) => {
    const result = invoke({[name]: value});
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Android replay authorization or source binding rejected.\n');
    expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
    expect(fs.existsSync(file('gh-calls.jsonl'))).toBe(false);
    expect(fs.existsSync(file('build/replay-android-state'))).toBe(false);
  });
});

test.each([
  ['MAESTRO_DEVICE_KEY', 'KEY_CANARY'], ['MAESTRO_DEVICE_KEY', ''],
  ['PAAD_LIVE_CONFIG', 'CONFIG_CANARY'], ['PAAD_LIVE_CONFIG', ''],
  ['GH_TOKEN', 'TOKEN_CANARY'], ['GH_TOKEN', ''], ['GITHUB_TOKEN', 'TOKEN_CANARY'],
])('refuses credential/configuration presence before adb: %s (%#)', (name, value) => {
  withFixture(({invoke, file}) => {
    const result = invoke({[name]: value});
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/refuses device credentials|tokens must not enter/);
    expect(result.stdout + result.stderr).not.toContain('CANARY');
    expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
    expect(fs.existsSync(file('gh-calls.jsonl'))).toBe(false);
  });
});

test('downloads only the exact named artifact after run and artifact metadata checks', () => {
  withFixture(({invoke, file, identity}) => {
    const result = invoke({GH_TOKEN: 'mock-artifact-only-token'}, 'download');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(fs.readFileSync(file('gh-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)).toEqual([
      ['api', `repos/${repository}/actions/runs/${sourceRun}`],
      ['api', '--paginate', '--slurp', `repos/${repository}/actions/runs/${sourceRun}/artifacts?per_page=100`],
      ['run', 'download', sourceRun, '--repo', repository, '--name', artifactName, '--dir', 'build/ci-artifacts'],
    ]);
    expect(fs.readFileSync(file('build/ci-artifacts/identity.txt'), 'utf8')).toBe(identity);
    expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
  }, {download: true});
});

test.each([
  ['id', 12], ['repository', {id: 2, full_name: 'other/repo'}],
  ['head_repository', {id: 2, full_name: 'other/repo'}], ['head_sha', harnessSha],
  ['head_branch', 'master'], ['workflow_id', 1], ['event', 'push'],
  ['actor', {login: 'other'}], ['triggering_actor', {login: 'other'}],
  ['run_attempt', 2], ['status', 'in_progress'],
])('source run rejects mismatched %s without downloading', (name, value) => {
  withFixture(({invoke, file, metadata, saveMetadata}) => {
    metadata.run[name] = value;
    saveMetadata();
    const result = invoke({}, 'download');
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('Android replay source run or artifact verification failed.\n');
    expect(fs.readFileSync(file('gh-calls.jsonl'), 'utf8')).not.toContain('"download"');
    expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
    expect(fs.existsSync(file('build/ci-artifacts'))).toBe(false);
  }, {download: true});
});

test.each([
  'expired', 'different-name', 'duplicate', 'wrong-run', 'wrong-sha', 'wrong-branch',
  'wrong-head-repository', 'wrong-repository', 'missing-workflow-run',
])('rejects %s artifact metadata without downloading', scenario => {
  withFixture(({invoke, file, metadata, saveMetadata}) => {
    const artifact = metadata.pages[0].artifacts[0];
    if (scenario === 'expired') artifact.expired = true;
    if (scenario === 'different-name') artifact.name = 'live-device-android-raw';
    if (scenario === 'duplicate') metadata.pages.push({artifacts: [artifact]});
    if (scenario === 'wrong-run') artifact.workflow_run.id = 12;
    if (scenario === 'wrong-sha') artifact.workflow_run.head_sha = harnessSha;
    if (scenario === 'wrong-branch') artifact.workflow_run.head_branch = 'master';
    if (scenario === 'wrong-head-repository') artifact.workflow_run.head_repository_id = 2;
    if (scenario === 'wrong-repository') artifact.workflow_run.repository_id = 2;
    if (scenario === 'missing-workflow-run') delete artifact.workflow_run;
    saveMetadata();
    const result = invoke({}, 'download');
    expect(result.status).toBe(1);
    expect(fs.readFileSync(file('gh-calls.jsonl'), 'utf8')).not.toContain('"download"');
    expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
  }, {download: true});
});

test.each(['built', 'event', 'run', 'attempt', 'variant', 'duplicate', 'checksum', 'apk', 'symlink'])(
  'rejects invalid %s binary identity before adb',
  scenario => {
    withFixture(({invoke, file, identity}) => {
      let changed = identity;
      if (scenario === 'built') changed = changed.replace(`Built commit: ${sourceSha}`, `Built commit: ${harnessSha}`);
      if (scenario === 'event') changed = changed.replace(`Event SHA: ${sourceSha}`, `Event SHA: ${harnessSha}`);
      if (scenario === 'run') changed = changed.replace(`Run: ${sourceRun}`, 'Run: 12');
      if (scenario === 'attempt') changed = changed.replace('attempt 1', 'attempt 2');
      if (scenario === 'variant') changed = changed.replace('Native variant: ci', 'Native variant: production');
      if (scenario === 'duplicate') changed += `Built commit: ${sourceSha}\n`;
      if (scenario === 'checksum') changed = changed.replace(/^[a-f0-9]{64}/m, '0'.repeat(64));
      fs.writeFileSync(file('build/ci-artifacts/identity.txt'), changed);
      if (scenario === 'apk') fs.appendFileSync(file('build/ci-artifacts/foundation-ci.apk'), 'corrupt');
      if (scenario === 'symlink') {
        fs.unlinkSync(file('build/ci-artifacts/identity.txt'));
        fs.symlinkSync(file('source/identity.txt'), file('build/ci-artifacts/identity.txt'));
      }
      const result = invoke();
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('Android replay binary identity or checksum rejected.\n');
      expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
    });
  },
);

test.each(['build/replay-android-state', 'build/ci-artifacts/replay-android'])(
  'refuses existing owned-directory candidates without adoption, deletion or adb: %s',
  existing => {
    withFixture(({invoke, file}) => {
      fs.mkdirSync(file(existing));
      fs.writeFileSync(file(`${existing}/keep`), 'untouched');
      expect(invoke().status).toBe(1);
      expect(fs.readFileSync(file(`${existing}/keep`), 'utf8')).toBe('untouched');
      expect(fs.existsSync(file('adb-calls.jsonl'))).toBe(false);
    });
  },
);

test.each([
  'List of devices attached\n',
  'physical-id\tdevice\n',
  'emulator-5554\toffline\n',
  'emulator-5554\tdevice\nemulator-5556\tdevice\n',
  'emulator-5554\tdevice\nphysical-id\tdevice\n',
  'emulator-5554\tdevice\nemulator-5556\toffline\n',
])('rejects physical, offline, missing or ambiguous targets before install (%#)', devices => {
  withFixture(({invoke, file}) => {
    const result = invoke({TEST_DEVICES: devices});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('exactly one online emulator');
    expect(fs.readFileSync(file('adb-calls.jsonl'), 'utf8').trim()).toBe('["devices"]');
    expect(fs.existsSync(file('maestro-call.json'))).toBe(false);
  });
});

test.each([
  {maestro: '0', capture: '0', expected: 0},
  {maestro: '7', capture: '0', expected: 7},
  {maestro: '0', capture: '1', expected: 1},
  {maestro: '7', capture: '1', expected: 7},
])('captures isolated cold startup diagnostics and preserves the original result (%#)', scenario => {
  withFixture(({invoke, file, identity, apkSha256}) => {
    const result = invoke({TEST_MAESTRO_RESULT: scenario.maestro, TEST_CAPTURE_FAILURE: scenario.capture});
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(scenario.expected);
    if (scenario.capture === '1') expect(result.stderr).toContain('diagnostic capture failed');
    const root = 'build/ci-artifacts/replay-android';
    const status = JSON.parse(fs.readFileSync(file(`${root}/status.json`), 'utf8'));
    expect(status).toEqual({
      commandExitCode: Number(scenario.maestro), captureFailed: scenario.capture === '1',
      flowAttempted: true, emulator: 'emulator-5554',
    });
    const record = JSON.parse(fs.readFileSync(file(`${root}/replay-identity.json`), 'utf8'));
    expect(record).toMatchObject({
      sourceRun, sourceSha, sourceArtifact: artifactName, sourceAttempt: 1,
      sourceWorkflowId: 359345717, replayHarnessSha: harnessSha, apkSha256,
    });
    expect(record.replayScriptSha256).toBe(crypto.createHash('sha256').update(script).digest('hex'));
    expect(record.startupFlowSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.readFileSync(file('build/ci-artifacts/identity.txt'), 'utf8')).toBe(identity);
    const invocation = JSON.parse(fs.readFileSync(file('maestro-call.json'), 'utf8'));
    expect(invocation.binary).toBe(file('build/ci-tools/maestro/bin/maestro'));
    expect(invocation.args).toEqual([
      '--device', 'emulator-5554', 'test', '--no-ansi',
      '--format', 'junit', '--output', file(`${root}/results/result.xml`),
      '--debug-output', file(`${root}/debug`), '--test-output-dir', file(`${root}/results`),
      '-e', 'APP_ID=com.iot_pnp.ci', '.maestro/startup.yaml',
    ]);
    expect(invocation.home).toBe(file('build/replay-android-state/home'));
    expect(invocation.scratch).toBe(file('build/replay-android-state/scratch'));
    for (const log of ['android-runtime', 'android-system', 'foreground', 'window']) {
      expect(fs.readFileSync(file(`${root}/logs/${log}.log`), 'utf8')).toContain('synthetic Android diagnostic');
    }
    expect(fs.readFileSync(file(`${root}/logs/maestro-stdout.log`), 'utf8')).toContain('synthetic Maestro stdout');
    expect(fs.readFileSync(file(`${root}/logs/maestro-stderr.log`), 'utf8')).toContain('synthetic Maestro stderr');
    expect(fs.existsSync(file(`${root}/debug/commands.json`))).toBe(true);
    expect(fs.existsSync(file(`${root}/results/result.xml`))).toBe(true);
    expect(fs.existsSync(file(`${root}/home`))).toBe(false);
    expect(fs.existsSync(file(`${root}/scratch`))).toBe(false);
    if (scenario.capture === '0') expect(fs.statSync(file(`${root}/final-screen.png`)).size).toBeGreaterThan(0);
    const adbCalls = fs.readFileSync(file('adb-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(adbCalls[0]).toEqual(['devices']);
    expect(adbCalls[1]).toEqual(['-s', 'emulator-5554', 'install', '-r', 'build/ci-artifacts/foundation-ci.apk']);
    expect(adbCalls[2]).toEqual(['-s', 'emulator-5554', 'logcat', '-c']);
    for (const args of adbCalls.slice(1)) expect(args.slice(0, 2)).toEqual(['-s', 'emulator-5554']);
  });
});

test('captures install failures without running Maestro and treats empty screenshots as failure', () => {
  for (const overrides of [{TEST_INSTALL_FAILURE: '1'}, {TEST_EMPTY_SCREENSHOT: '1'}]) {
    withFixture(({invoke, file}) => {
      const result = invoke(overrides);
      expect(result.status).toBe(overrides.TEST_INSTALL_FAILURE ? 8 : 1);
      const status = JSON.parse(fs.readFileSync(file('build/ci-artifacts/replay-android/status.json'), 'utf8'));
      expect(status.flowAttempted).toBe(!overrides.TEST_INSTALL_FAILURE);
      expect(status.captureFailed).toBe(Boolean(overrides.TEST_EMPTY_SCREENSHOT));
      expect(fs.existsSync(file('build/ci-artifacts/replay-android/logs/window.log'))).toBe(true);
    });
  }
});
