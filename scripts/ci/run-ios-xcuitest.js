#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {createXCTestCase, configureXCTestRun} = require('./ios-xcuitest-config');
const {MAX_LOG_BYTES, parseNativeLog, sanitizeNativeResult, nativeFlowPassed} = require('./ios-xcuitest-result');
const {diagnosticRecipient, collectEncryptedDiagnostic} = require('./encrypted-ios-diagnostic');

const DEVELOPER = '/Applications/Xcode_26.6.app/Contents/Developer';
const APP = 'build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app';
const PRODUCTS = 'build/ios-uitest-derived/Build/Products';
const unavailable = reason => ({availability: 'unavailable', reason});

function requireDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe native UI directory');
  return stat;
}

function readBounded(file, maximum = MAX_LOG_BYTES) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maximum) throw new Error('Invalid native UI file');
    return fs.readFileSync(descriptor, 'utf8');
  } finally {
    fs.closeSync(descriptor);
  }
}

function readDiagnostics() {
  try {
    for (const directory of ['build', 'build/live-device-private', 'build/live-device-private/results']) {
      requireDirectory(directory);
    }
    const value = JSON.parse(readBounded('build/live-device-private/results/native-ui.json', 8192));
    const result = sanitizeNativeResult(value);
    return result ? {availability: 'available', nativeUi: result} : unavailable('invalid-metadata');
  } catch {
    return unavailable('read-failed');
  }
}

function preserveSyntheticLog(file) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error('Invalid native smoke log');
    const buffer = Buffer.alloc(Math.min(stat.size, MAX_LOG_BYTES));
    const length = fs.readSync(descriptor, buffer, 0, buffer.length, Math.max(0, stat.size - buffer.length));
    fs.writeFileSync('build/ios-ui-smoke.log', buffer.subarray(0, length), {flag: 'wx', mode: 0o600});
  } finally {
    fs.closeSync(descriptor);
  }
}

function validateEnvironment(mode, env) {
  if (env.PAAD_NATIVE_SMOKE_DIAGNOSTICS !== undefined &&
      (!['true', 'false'].includes(env.PAAD_NATIVE_SMOKE_DIAGNOSTICS) ||
       (mode !== 'smoke' && env.PAAD_NATIVE_SMOKE_DIAGNOSTICS === 'true'))) {
    throw new Error('Synthetic log retention requires credential-free smoke');
  }
  if (!['smoke', 'live'].includes(mode) || env.PAAD_VARIANT !== 'ci' ||
      env.DEVELOPER_DIR !== DEVELOPER || env.IOS_SIMULATOR_DEVELOPER_DIR !== DEVELOPER ||
      !/^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$/.test(env.IOS_SIMULATOR_UDID || '') ||
      ['GH_TOKEN', 'GITHUB_TOKEN', 'PAAD_XCTEST_CASE', 'TEST_RUNNER_PAAD_XCTEST_CASE',
        'PAAD_XCTEST_CAPTURE', 'TEST_RUNNER_PAAD_XCTEST_CAPTURE']
        .some(key => Object.hasOwn(env, key))) {
    throw new Error('Native UI invocation rejected');
  }
  if (mode === 'smoke') {
    if (env.PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY ||
        ['MAESTRO_DEVICE_KEY', 'PAAD_LIVE_CONFIG'].some(key => Object.hasOwn(env, key))) {
      throw new Error('Native smoke rejects live inputs');
    }
  } else if (
    env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.PAAD_LIVE_CONFIRM !== 'true' ||
    env.GITHUB_REF !== 'refs/heads/feature/adr-onboarding' ||
    !env.GITHUB_REPOSITORY_OWNER || env.GITHUB_ACTOR !== env.GITHUB_REPOSITORY_OWNER ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || env.PAAD_LIVE_EXPECTED_SHA !== env.GITHUB_SHA ||
    env.PAAD_IOS_UI_DRIVER !== 'xcuitest'
  ) throw new Error('Native live authorization rejected');
}

function executeNative(mode, env = process.env) {
  validateEnvironment(mode, env);
  const recipient = diagnosticRecipient(env.PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY);
  const data = createXCTestCase(mode, env.PAAD_LIVE_CONFIG, env.MAESTRO_DEVICE_KEY);
  process.umask(0o077);
  requireDirectory('build');
  const root = path.resolve(mode === 'live' ? 'build/live-device-private' : 'build/ios-ui-smoke-private');
  if (mode === 'smoke') fs.mkdirSync(root);
  const owned = requireDirectory(root);
  const log = path.join(root, 'xcuitest.log');
  let descriptor;
  let success = false;
  let smokeBootAttempted = false;
  let diagnostics = unavailable('no-supported-data');
  let bootstrapStage = 'manifest-read';
  const cleanEnv = {...env};
  delete cleanEnv.MAESTRO_DEVICE_KEY;
  delete cleanEnv.PAAD_LIVE_CONFIG;
  delete cleanEnv.PAAD_IOS_DIAGNOSTIC_PUBLIC_KEY;
  const command = (binary, args, timeout, input) => {
    const result = spawnSync(binary, args, {
      env: cleanEnv, timeout, killSignal: 'SIGKILL', input,
      stdio: [input === undefined ? 'ignore' : 'pipe', descriptor, descriptor],
    });
    if (result.error || result.signal || result.status !== 0) {
      const reason = result.error?.code === 'ETIMEDOUT' ? 'deadline-exceeded'
        : result.error ? 'spawn-failed' : result.signal ? 'signal' : 'nonzero-exit';
      diagnostics = {...unavailable('native-bootstrap-failed'), bootstrapStage, execution: reason};
      fs.writeSync(descriptor, `Native bootstrap failure: ${reason}\n`);
      throw new Error('Native UI subprocess failed');
    }
  };
  try {
    descriptor = fs.openSync(log, 'wx', 0o600);
    const products = path.resolve(PRODUCTS);
    for (const directory of ['build/ios-uitest-derived', 'build/ios-uitest-derived/Build', PRODUCTS, APP]) {
      requireDirectory(directory);
    }
    const manifests = fs.readdirSync(products).filter(name => name.endsWith('.xctestrun'));
    if (manifests.length !== 1) throw new Error('Native UI manifest unavailable');
    const source = path.join(products, manifests[0]);
    const sourceStat = fs.lstatSync(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > MAX_LOG_BYTES) {
      throw new Error('Invalid native UI manifest');
    }
    const decoded = spawnSync('plutil', ['-convert', 'json', '-o', '-', source], {
      env: cleanEnv, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: MAX_LOG_BYTES,
    });
    if (decoded.error || decoded.signal || decoded.status !== 0) throw new Error('Native UI manifest unreadable');
    const configured = configureXCTestRun(JSON.parse(decoded.stdout), products, data, !!recipient);
    const privateManifest = path.join(root, 'case.xctestrun');
    if (fs.existsSync(privateManifest)) throw new Error('Native UI manifest already exists');
    bootstrapStage = 'manifest-write';
    command('plutil', ['-convert', 'binary1', '-o', privateManifest, '-'], 10000, JSON.stringify(configured));
    if (mode === 'smoke') {
      // This simulator was created by build-ios.sh, not discovered from other running devices.
      fs.writeSync(descriptor, 'Native bootstrap: simulator boot and readiness\n');
      smokeBootAttempted = true;
      // -b initiates boot if needed and waits for migration, not just Booted state.
      bootstrapStage = 'simulator-ready';
      command('xcrun', ['simctl', 'bootstatus', env.IOS_SIMULATOR_UDID, '-b'], 600000);
      fs.writeSync(descriptor, 'Native bootstrap: app install\n');
      bootstrapStage = 'app-install';
      command('xcrun', ['simctl', 'install', env.IOS_SIMULATOR_UDID, path.resolve(APP)], 180000);
      fs.writeSync(descriptor, 'Native bootstrap: simulator presentation\n');
      bootstrapStage = 'simulator-presentation';
      command('bash', ['scripts/ci/show-ios-simulator.sh', env.IOS_SIMULATOR_UDID], 65000);
    }
    fs.writeSync(descriptor, 'Native bootstrap: XCTest execution\n');
    bootstrapStage = 'xctest';
    const result = spawnSync('xcodebuild', [
      'test-without-building', '-xctestrun', privateManifest,
      '-destination', `platform=iOS Simulator,id=${env.IOS_SIMULATOR_UDID}`,
      '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-simulator-destinations', '1',
      '-resultBundlePath', path.join(root, 'result.xcresult'),
      '-test-timeouts-enabled', 'YES',
      '-default-test-execution-time-allowance', mode === 'live' ? '720' : '300',
      '-maximum-test-execution-time-allowance', mode === 'live' ? '780' : '360',
      '-disableAutomaticPackageResolution',
    ], {
      env: cleanEnv, stdio: ['ignore', descriptor, descriptor],
      timeout: mode === 'live' ? 900000 : 420000, killSignal: 'SIGKILL',
    });
    fs.closeSync(descriptor);
    descriptor = undefined;
    const parsed = parseNativeLog(readBounded(log), mode);
    const execution = result.error?.code === 'ETIMEDOUT' ? 'deadline-exceeded'
      : result.error ? 'spawn-failed' : result.signal ? 'signal'
      : result.status !== 0 ? 'nonzero-exit'
      : nativeFlowPassed(parsed, mode) ? 'passed' : 'invalid-result';
    success = execution === 'passed';
    if (parsed) diagnostics = {availability: 'available', nativeUi: {...parsed, execution}};
    if (mode === 'live' && parsed) {
      try {
        if (recipient && !success) {
          diagnostics.nativeUi.approvedCaptureExport = 'failed';
          collectEncryptedDiagnostic(recipient, parsed.approvedCapture, root, cleanEnv);
          diagnostics.nativeUi.approvedCaptureExport = 'encrypted';
        }
      } finally {
        requireDirectory(path.join(root, 'results'));
        fs.writeFileSync(path.join(root, 'results/native-ui.json'), JSON.stringify(diagnostics.nativeUi),
          {flag: 'wx', mode: 0o600});
      }
    }
  } catch {
    success = false;
    if (diagnostics.reason === 'no-supported-data') {
      diagnostics = {...unavailable('native-bootstrap-failed'), bootstrapStage};
    }
    console.error('Native UI execution failed; raw diagnostics remain private.');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (mode === 'smoke') {
      if (smokeBootAttempted) {
        if (env.PAAD_NATIVE_SMOKE_DIAGNOSTICS === 'true') {
          try {
            const runtime = spawnSync('xcrun', [
              'simctl', 'spawn', env.IOS_SIMULATOR_UDID, 'log', 'show',
              '--style', 'compact', '--last', '5m', '--predicate',
              'process == "IoTPnP" OR ((process == "SpringBoard" OR process == "runningboardd") AND eventMessage CONTAINS "com.microsoft.iotpnp.ci")',
            ], {
              env: cleanEnv, encoding: 'utf8', timeout: 20000,
              killSignal: 'SIGKILL', maxBuffer: 256 * 1024,
            });
            const incomplete = runtime.error || runtime.signal || runtime.status !== 0;
            if (incomplete) console.error('Credential-free runtime diagnostics are incomplete.');
            const output = fs.openSync(log,
              fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
            try {
              fs.writeSync(output, `\nNative synthetic runtime diagnostics (${incomplete ? 'incomplete' : 'complete'}):\n`);
              fs.writeSync(output, runtime.stdout || '');
              fs.writeSync(output, runtime.stderr || '');
            } finally {
              fs.closeSync(output);
            }
          } catch {
            console.error('Credential-free runtime diagnostics could not be recorded.');
          }
        }
        const shutdown = spawnSync('xcrun', ['simctl', 'shutdown', env.IOS_SIMULATOR_UDID], {
          env: cleanEnv, stdio: 'ignore', timeout: 60000, killSignal: 'SIGKILL',
        });
        if (shutdown.error || shutdown.signal || shutdown.status !== 0) {
          success = false;
          console.error('Native smoke simulator shutdown failed; workflow cleanup must delete the owned simulator.');
        }
      }
      if (env.PAAD_NATIVE_SMOKE_DIAGNOSTICS === 'true' && fs.existsSync(log)) {
        try {
          preserveSyntheticLog(log);
        } catch {
          success = false;
          console.error('Credential-free native smoke log could not be retained.');
        }
      }
      try {
        requireDirectory('build');
        const stat = requireDirectory(root);
        if (stat.dev !== owned.dev || stat.ino !== owned.ino) throw new Error('Native smoke directory changed');
        fs.rmSync(root, {recursive: true});
      } catch {
        success = false;
        console.error('Native smoke private-state cleanup failed.');
      }
      fs.writeFileSync('build/ios-ui-smoke-summary.json',
        `${JSON.stringify({uiResult: success ? 'passed' : 'failed', diagnostics}, null, 2)}\n`,
        {flag: 'wx', mode: 0o600});
    }
  }
  return success;
}

module.exports = {validateEnvironment, readDiagnostics, executeNative};
if (require.main === module) {
  try {
    const [mode, ...extra] = process.argv.slice(2);
    if (extra.length) throw new Error('Invalid native UI command');
    if (mode === 'diagnostics') console.log(JSON.stringify(readDiagnostics()));
    else if (!executeNative(mode)) process.exitCode = 1;
  } catch {
    console.error('Native UI command rejected or failed; no input was logged.');
    process.exitCode = 1;
  }
}
