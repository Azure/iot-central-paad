#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {executeNative} = require('./run-ios-xcuitest');

const DEVELOPER = '/Applications/Xcode_26.6.app/Contents/Developer';
const UUID = /^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$/;
const DIAGNOSTICS = 'build/ci-artifacts/replay-ios';
const PRODUCTS = 'build/ios-derived/Build/Products/Release-iphonesimulator';
const APP = `${PRODUCTS}/IoTPnP.app`;
const MAX_OUTPUT = 16 * 1024 * 1024;
const forbidden = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'MAESTRO_DEVICE_KEY',
  'PAAD_LIVE_CONFIG',
  'PAAD_XCTEST_CASE',
  'TEST_RUNNER_PAAD_XCTEST_CASE',
  'IOS_SIMULATOR_UDID',
];

function requireDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe replay directory');
  return stat;
}

function requireFile(file, nonempty = true) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (nonempty && !stat.size)) {
    throw new Error('Unsafe replay file');
  }
  return stat;
}

function mkdirFresh(directory) {
  if (fs.existsSync(directory)) throw new Error('Replay directory already exists');
  fs.mkdirSync(directory, {mode: 0o700});
  return requireDirectory(directory);
}

function validateEnvironment(env) {
  if (forbidden.some(name => Object.hasOwn(env, name)) ||
      env.PAAD_VARIANT !== 'ci' ||
      env.DEVELOPER_DIR !== DEVELOPER ||
      env.IOS_SIMULATOR_DEVELOPER_DIR !== DEVELOPER) {
    throw new Error('Native replay invocation rejected');
  }
}

function captured(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: options.env,
    encoding: 'utf8',
    timeout: options.timeout,
    killSignal: 'SIGKILL',
    maxBuffer: MAX_OUTPUT,
  });
  if (options.log) {
    fs.writeFileSync(options.log, `${result.stdout || ''}${result.stderr || ''}`, {
      flag: 'wx',
      mode: 0o600,
    });
  }
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`${options.label || command} failed`);
  }
  return result.stdout;
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function appendWorkflowEnvironment(env, lines) {
  if (!path.isAbsolute(env.GITHUB_ENV || '')) throw new Error('Workflow environment unavailable');
  const descriptor = fs.openSync(
    env.GITHUB_ENV,
    fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW,
  );
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error('Unsafe workflow environment');
    fs.writeSync(descriptor, `${lines.join('\n')}\n`);
  } finally {
    fs.closeSync(descriptor);
  }
}

function sameDirectory(directory, owned) {
  const current = requireDirectory(directory);
  if (current.dev !== owned.dev || current.ino !== owned.ino) {
    throw new Error('Owned replay directory changed');
  }
}

function executeReplay(env = process.env, nativeExecutor = executeNative) {
  validateEnvironment(env);
  process.umask(0o077);

  const verified = captured(process.execPath, ['scripts/ci/replay-artifact.js', 'ios', 'verify'], {
    env,
    timeout: 30000,
    label: 'Replay artifact verification',
  });
  const identity = JSON.parse(verified);
  if (!identity || Array.isArray(identity) || typeof identity !== 'object') {
    throw new Error('Replay identity unavailable');
  }

  for (const directory of ['build', 'build/ci-artifacts']) requireDirectory(directory);
  for (const existing of [
    DIAGNOSTICS,
    'build/ios-derived',
    'build/ios-uitest',
    'build/ios-uitest-derived',
    'build/ios-ui-smoke-private',
  ]) {
    if (fs.existsSync(existing)) throw new Error('Native replay requires fresh output directories');
  }
  for (const output of ['build/ios-ui-smoke-summary.json', 'build/ios-ui-smoke.log']) {
    if (fs.existsSync(output)) throw new Error('Native replay output already exists');
  }

  Object.assign(identity, {
    nativeDriver: 'xcuitest',
    nativeReplayHelperSha256: digest('scripts/ci/replay-native-ios.js'),
    nativeHarnessSwiftSha256: digest('scripts/ci/PaadLiveUITests.swift'),
    nativeRunControllerSha256: digest('scripts/ci/run-ios-xcuitest.js'),
    nativeBuildHelperSha256: digest('scripts/ci/build-ios-uitests.sh'),
  });
  const diagnostics = mkdirFresh(DIAGNOSTICS);
  mkdirFresh(`${DIAGNOSTICS}/logs`);
  fs.writeFileSync(`${DIAGNOSTICS}/replay-identity.json`, `${JSON.stringify(identity, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });

  const derived = mkdirFresh('build/ios-derived');
  mkdirFresh('build/ios-derived/Build');
  mkdirFresh('build/ios-derived/Build/Products');
  const products = mkdirFresh(PRODUCTS);
  let ownedId = '';
  let executionSucceeded = false;
  let simulatorDeleted = false;
  let primaryFailure;

  try {
    captured('ditto', [
      '-x', '-k', 'build/ci-artifacts/foundation-simulator.app.zip', PRODUCTS,
    ], {
      env,
      timeout: 30000,
      log: `${DIAGNOSTICS}/logs/extract.log`,
      label: 'Native app extraction',
    });
    sameDirectory('build/ios-derived', derived);
    sameDirectory(PRODUCTS, products);
    requireDirectory(APP);
    requireFile(`${APP}/Info.plist`);
    requireFile(`${APP}/main.jsbundle`);
    const bundleId = captured('plutil', [
      '-extract', 'CFBundleIdentifier', 'raw', '-o', '-', `${APP}/Info.plist`,
    ], {
      env,
      timeout: 10000,
      log: `${DIAGNOSTICS}/logs/bundle-identity.log`,
      label: 'Native app identity',
    }).trim();
    if (bundleId !== 'com.microsoft.iotpnp.ci') throw new Error('Native app identity rejected');

    captured('bash', ['scripts/ci/build-ios-uitests.sh'], {
      env,
      timeout: 240000,
      log: `${DIAGNOSTICS}/logs/native-runner-build.log`,
      label: 'Native runner build',
    });
    sameDirectory('build/ios-derived', derived);
    sameDirectory(PRODUCTS, products);
    requireDirectory(APP);
    requireFile(`${APP}/main.jsbundle`);

    const candidate = captured('xcrun', [
      'simctl', 'create', 'PAAD-Replay-Native-CI',
      'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5',
    ], {
      env,
      timeout: 60000,
      log: `${DIAGNOSTICS}/logs/create-simulator.log`,
      label: 'Native simulator creation',
    }).trim();
    if (!UUID.test(candidate)) throw new Error('Native simulator UUID rejected');
    ownedId = candidate;
    fs.writeFileSync(`${DIAGNOSTICS}/simulator-uuid.txt`, `${ownedId}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    appendWorkflowEnvironment(env, [
      `IOS_SIMULATOR_UDID=${ownedId}`,
      'PAAD_NATIVE_REPLAY_SIMULATOR_DELETED=0',
    ]);

    executionSucceeded = nativeExecutor('smoke', {
      ...env,
      IOS_SIMULATOR_UDID: ownedId,
      PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true',
    }) === true;
    if (!executionSucceeded) primaryFailure = new Error('Native replay failed');
  } catch (error) {
    primaryFailure = error;
  } finally {
    if (ownedId) {
      try {
        captured('xcrun', ['simctl', 'delete', ownedId], {
          env,
          timeout: 30000,
          log: `${DIAGNOSTICS}/logs/delete-simulator.log`,
          label: 'Native simulator deletion',
        });
        simulatorDeleted = true;
        appendWorkflowEnvironment(env, ['PAAD_NATIVE_REPLAY_SIMULATOR_DELETED=1']);
      } catch (error) {
        if (!primaryFailure) primaryFailure = error;
      }
    }
    try {
      sameDirectory(DIAGNOSTICS, diagnostics);
      fs.writeFileSync(`${DIAGNOSTICS}/native-result.json`, `${JSON.stringify({
        schemaVersion: 1,
        driver: 'xcuitest',
        executionSucceeded,
        simulatorCreated: Boolean(ownedId),
        simulatorDeleted,
      }, null, 2)}\n`, {flag: 'wx', mode: 0o600});
    } catch (error) {
      if (!primaryFailure) primaryFailure = error;
    }
  }
  if (primaryFailure) throw primaryFailure;
  return true;
}

module.exports = {validateEnvironment, executeReplay};

if (require.main === module) {
  try {
    if (process.argv.length !== 2) throw new Error('Unexpected native replay arguments');
    executeReplay();
  } catch {
    console.error('Credential-free native iOS replay failed; see bounded diagnostics.');
    process.exitCode = 1;
  }
}
