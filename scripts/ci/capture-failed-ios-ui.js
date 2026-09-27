'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {parseHierarchy, LIMITS} = require('./live-diagnostics');

function captureFailedIosUi({platform, startedAt, privateDirectory, maestro, device},
  {run = spawnSync, now = Date.now, write = fs.writeFileSync} = {}) {
  if (platform !== 'ios') return 'not-ios';
  const remaining = 900000 - (now() - startedAt);
  if (remaining < 30000) return 'budget-exhausted';
  const timeout = Math.min(270000, remaining);
  const result = run(maestro, ['--device', device, 'hierarchy', '--no-ansi'], {
    encoding: 'utf8', maxBuffer: LIMITS.fileBytes,
    timeout, killSignal: 'SIGKILL',
    env: {...process.env, MAESTRO_DRIVER_STARTUP_TIMEOUT: String(Math.min(240000, timeout - 10000))},
  });
  if (result.error || result.signal || result.status !== 0) return 'driver-unavailable';
  if (typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > LIMITS.fileBytes) {
    return 'invalid-hierarchy';
  }
  let ui;
  try {
    ui = parseHierarchy(JSON.parse(result.stdout));
  } catch {
    return 'invalid-hierarchy';
  }
  // Only fixed fields leave memory. Raw hierarchy, stderr and driver messages are never copied.
  write(path.join(privateDirectory, 'results', 'post-failure-ui.json'),
    JSON.stringify({source: 'post-failure-ios-hierarchy', ui}),
    {flag: 'wx', mode: 0o600});
  return 'captured';
}

module.exports = {captureFailedIosUi};
