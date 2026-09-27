const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const script = path.resolve('scripts/ci/install-pods.sh');
let sequence = 0;

function withFixture(body, lockLocation = 'ios/Podfile.lock') {
  const directory = path.resolve(`.pod-lock-fixture-${process.pid}-${sequence++}`);
  fs.mkdirSync(directory, {mode: 0o700});
  const calls = path.join(directory, 'bundle-call.json');
  const artifact = path.join(directory, 'build/ci-artifacts/Podfile.lock');
  try {
    fs.mkdirSync(path.join(directory, 'ios'));
    if (lockLocation) {
      const lock = path.join(directory, lockLocation);
      fs.mkdirSync(path.dirname(lock), {recursive: true});
      fs.writeFileSync(lock, 'reviewed-lock\n');
    }
    fs.writeFileSync(path.join(directory, 'bundle'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync('../bundle-call.json', JSON.stringify(args));
const status = Number(process.env.TEST_BUNDLE_STATUS || 0);
if (status) process.exit(status);
if (args[2] === 'update') fs.writeFileSync('Podfile.lock', 'refreshed-lock\\n');
`, {mode: 0o700});
    const invoke = (overrides = {}) => spawnSync('/bin/bash', [script], {
      cwd: directory, encoding: 'utf8', timeout: 20000,
      env: {
        PATH: `${directory}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
        PAAD_VARIANT: 'ci', ...overrides,
      },
    });
    body({invoke, calls, artifact});
  } finally {
    fs.rmSync(directory, {recursive: true});
  }
}

test.each(['ios/Podfile.lock', 'build/ci-artifacts/Podfile.lock'])(
  'normal installation preserves the reviewed lock from %s', location => {
    withFixture(({invoke, calls, artifact}) => {
      const result = invoke();
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(JSON.parse(fs.readFileSync(calls, 'utf8'))).toEqual([
        'exec', 'pod', 'install', '--deployment',
      ]);
      expect(fs.readFileSync(artifact, 'utf8')).toBe('reviewed-lock\n');
      expect(result.stdout).toContain('CocoaPods lock mode: deployment');
    }, location);
  },
);

test.each(['ios/Podfile.lock', undefined])(
  'explicit refresh resolves changed podspecs and exports the new lock (%#)', location => {
    withFixture(({invoke, calls, artifact}) => {
      const result = invoke({PAAD_REFRESH_POD_LOCK: '1'});
      expect(result.status).toBe(0);
      expect(JSON.parse(fs.readFileSync(calls, 'utf8'))).toEqual([
        'exec', 'pod', 'update', '--no-repo-update',
      ]);
      expect(fs.readFileSync(artifact, 'utf8')).toBe('refreshed-lock\n');
      expect(result.stdout).toContain('CocoaPods lock mode: explicit-refresh');
    }, location ?? '');
  },
);

test.each([undefined, '0', 'true'])(
  'missing locks never trigger an implicit update with flag %s', flag => {
    withFixture(({invoke, calls, artifact}) => {
      const result = invoke({PAAD_REFRESH_POD_LOCK: flag});
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Missing reviewed Podfile.lock');
      expect(fs.existsSync(calls)).toBe(false);
      expect(fs.existsSync(artifact)).toBe(false);
    }, '');
  },
);

test.each(['0', '1'])('propagates CocoaPods failure without exporting success (%s)', flag => {
  withFixture(({invoke, artifact}) => {
    const result = invoke({PAAD_REFRESH_POD_LOCK: flag, TEST_BUNDLE_STATUS: '7'});
    expect(result.status).toBe(7);
    expect(fs.existsSync(artifact)).toBe(false);
  });
});

test('refuses non-CI installation before invoking CocoaPods', () => {
  withFixture(({invoke, calls}) => {
    expect(invoke({PAAD_VARIANT: 'production'}).status).toBe(1);
    expect(fs.existsSync(calls)).toBe(false);
  });
});
