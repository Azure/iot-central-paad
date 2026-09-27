const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const script = path.resolve('scripts/ci/show-ios-simulator.sh');
const developer = '/Applications/Xcode_26.6.app/Contents/Developer';
const device = '12345678-1234-1234-1234-123456789ABC';
let sequence = 0;

function withFixture(body) {
  const directory = path.resolve(`.ios-ui-fixture-${process.pid}-${sequence++}`);
  fs.mkdirSync(directory, {mode: 0o700});
  const call = path.join(directory, 'open-call.json');
  try {
    fs.writeFileSync(path.join(directory, 'open'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync('open-call.json', JSON.stringify(process.argv.slice(2)));
console.error('RAW_CHILD_OUTPUT_CANARY');
process.exit(Number(process.env.TEST_OPEN_RESULT || 0));
`, {mode: 0o700});
    const invoke = (args = [device], overrides = {}) => spawnSync('/bin/bash', [script, ...args], {
      cwd: directory, encoding: 'utf8', timeout: 20000,
      env: {
        PATH: `${directory}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
        DEVELOPER_DIR: developer, IOS_SIMULATOR_DEVELOPER_DIR: developer, ...overrides,
      },
    });
    body({invoke, call});
  } finally {
    fs.rmSync(directory, {recursive: true});
  }
}

test('opens only the explicit simulator with pinned Xcode and bounded, non-detached execution', () => {
  withFixture(({invoke, call}) => {
    const result = invoke();
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('Owned Simulator UI opened.\n');
    expect(result.stderr).toBe('');
    expect(JSON.parse(fs.readFileSync(call, 'utf8'))).toEqual([
      '-a', `${developer}/Applications/Simulator.app`, '--args', '-CurrentDeviceUDID', device,
    ]);
  });
  const source = fs.readFileSync(script, 'utf8');
  expect(source).toContain("timeout: 60000, killSignal: 'SIGKILL'");
  expect(source).not.toMatch(/simctl|osascript|detached|killall|pkill/);
  const smoke = fs.readFileSync('scripts/ci/smoke-ios.sh', 'utf8');
  expect(smoke).toContain('export MAESTRO_DRIVER_STARTUP_TIMEOUT=240000');
  expect(smoke.indexOf('show-ios-simulator.sh')).toBeGreaterThan(smoke.indexOf('simctl install'));
  expect(smoke.indexOf('show-ios-simulator.sh')).toBeLessThan(smoke.indexOf('maestro --version'));
});

test.each([[], ['booted'], ['physical-device'], [`${device}\n`], [device, device]].map(args => [args]))(
  'rejects missing, ambiguous or malformed device arguments (%#)', args => {
    withFixture(({invoke, call}) => {
      const result = invoke(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('explicit UUID and no device inputs');
      expect(fs.existsSync(call)).toBe(false);
    });
  },
);

test.each([
  {DEVELOPER_DIR: undefined}, {DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer'},
  {IOS_SIMULATOR_DEVELOPER_DIR: undefined},
  {MAESTRO_DEVICE_KEY: 'KEY_CANARY'}, {MAESTRO_DEVICE_KEY: ''},
  {PAAD_LIVE_CONFIG: 'CONFIG_CANARY'}, {PAAD_LIVE_CONFIG: ''},
])('refuses mismatched Xcode or device input presence before GUI activity (%#)', overrides => {
  withFixture(({invoke, call}) => {
    const result = invoke([device], overrides);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('CANARY');
    expect(fs.existsSync(call)).toBe(false);
  });
});

test('surfaces GUI failure without printing raw child output', () => {
  withFixture(({invoke, call}) => {
    const result = invoke([device], {TEST_OPEN_RESULT: '8'});
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Owned Simulator UI could not be opened: nonzero-exit.\n');
    expect(fs.existsSync(call)).toBe(true);
  });
});
