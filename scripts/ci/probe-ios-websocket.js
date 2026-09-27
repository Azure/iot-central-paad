'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const {WebSocketServer, WebSocket} = require('ws');

const directory = path.resolve('build/ios-websocket-probe');
const developer = '/Applications/Xcode_26.6.app/Contents/Developer';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
let device;
let booted = false;
let server;

function command(binary, args, timeout) {
  const result = spawnSync(binary, args, {encoding: 'utf8', timeout, maxBuffer: 1048576});
  if (result.error || result.signal || result.status !== 0) {
    fs.appendFileSync(path.join(directory, 'command-errors.log'), result.stderr || 'Command failed\n');
    throw new Error('PROBE_COMMAND_FAILED');
  }
  return result.stdout.trim();
}

async function runCase(port, timeout) {
  const output = await new Promise((resolve, reject) => {
    const child = spawn('xcrun', ['simctl', 'spawn', device,
      path.join(directory, 'probe'), String(port), String(timeout)], {stdio: ['ignore', 'pipe', 'pipe']});
    const chunks = [];
    const errors = [];
    let bytes = 0;
    let errorBytes = 0;
    let failure;
    const deadline = setTimeout(() => {
      failure = 'PROBE_CASE_TIMEOUT';
      child.kill('SIGKILL');
    }, 50000);
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 16384) {
        failure = 'PROBE_OUTPUT_LIMIT';
        child.kill('SIGKILL');
      } else {
        chunks.push(chunk);
      }
    });
    child.stderr.on('data', chunk => {
      errorBytes += chunk.length;
      if (errorBytes <= 32768) errors.push(chunk);
    });
    child.on('error', () => {
      clearTimeout(deadline);
      reject(new Error('PROBE_SPAWN_FAILED'));
    });
    child.on('close', code => {
      clearTimeout(deadline);
      if (failure || code !== 0) {
        fs.appendFileSync(path.join(directory, 'command-errors.log'),
          Buffer.concat(chunks).toString('utf8') +
          Buffer.concat(errors).toString('utf8') +
          (errorBytes > 32768 ? '\nProbe stderr exceeded its capture limit.\n' : ''));
        reject(new Error(failure || 'PROBE_CASE_FAILED'));
      }
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
  const result = JSON.parse(output);
  if (result.platform !== 'ios-simulator' || result.requestTimeoutSeconds !== timeout ||
      result.firstFrameReceived !== true || typeof result.secondFrameReceived !== 'boolean' ||
      !Number.isFinite(result.idleSeconds)) throw new Error('INVALID_PROBE_RESULT');
  return {
    requestTimeoutSeconds: timeout, firstFrameReceived: true,
    secondFrameReceived: result.secondFrameReceived, idleSeconds: result.idleSeconds,
    ...(Number.isSafeInteger(result.urlErrorCode) ? {urlErrorCode: result.urlErrorCode} : {}),
  };
}

async function main() {
  if (process.platform !== 'darwin' || process.env.DEVELOPER_DIR !== developer ||
      'MAESTRO_DEVICE_KEY' in process.env || 'PAAD_LIVE_CONFIG' in process.env) {
    throw new Error('PROBE_ENVIRONMENT_REJECTED');
  }
  fs.mkdirSync('build', {recursive: true});
  fs.mkdirSync(directory);
  const sdk = command('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], 15000);
  command('xcrun', ['--sdk', 'iphonesimulator', 'swiftc', '-parse-as-library',
    '-target', 'arm64-apple-ios16.4-simulator', '-sdk', sdk,
    'scripts/ci/IosWebSocketProbe.swift', '-o', path.join(directory, 'probe')], 60000);
  command('codesign', ['--force', '--sign', '-', path.join(directory, 'probe')], 15000);
  device = command('xcrun', ['simctl', 'create', 'PAAD-WebSocket-Idle-Probe',
    'com.apple.CoreSimulator.SimDeviceType.iPhone-17',
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5'], 60000);
  if (!uuid.test(device)) throw new Error('INVALID_OWNED_SIMULATOR');
  command('xcrun', ['simctl', 'boot', device], 15000);
  booted = true;
  command('xcrun', ['simctl', 'bootstatus', device, '-b'], 180000);
  server = new WebSocketServer({host: '127.0.0.1', port: 0});
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  server.on('connection', socket => {
    socket.send(Buffer.from([1]));
    const timer = setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(Buffer.from([2]));
    }, 30000);
    socket.on('close', () => clearTimeout(timer));
  });
  const port = server.address().port;
  const cases = [];
  for (const timeout of [15, 180]) cases.push(await runCase(port, timeout));
  const report = {
    sourceSha: process.env.GITHUB_SHA,
    platform: 'ios-simulator', configuredSilentSeconds: 30, cases,
    scope: 'Isolated Foundation API over loopback; not PAAD transport or Azure acceptance',
  };
  fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!cases[1].secondFrameReceived || cases[1].idleSeconds < 29) {
    throw new Error('PROBE_CONTROL_FAILED');
  }
}

main().catch(error => {
  console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'PROBE_FAILED');
  process.exitCode = 1;
}).finally(async () => {
  if (server) {
    for (const client of server.clients) client.terminate();
    await new Promise(resolve => server.close(resolve));
  }
  if (device && uuid.test(device)) {
    try {
      if (booted) command('xcrun', ['simctl', 'shutdown', device], 20000);
    } finally {
      command('xcrun', ['simctl', 'delete', device], 20000);
    }
  }
}).catch(() => {
  console.error('OWNED_PROBE_CLEANUP_FAILED');
  process.exitCode = 1;
});
