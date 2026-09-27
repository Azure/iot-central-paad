#!/usr/bin/env node
'use strict';

const {collectLiveDiagnostics, sanitizeDiagnostics} = require('./live-diagnostics');
const MODEL_ID = 'dtmi:azureiot:PhoneAsADevice;2';
const PLATFORMS = ['android', 'ios'];
const fail = () => {
  throw new Error('Invalid live configuration or invocation');
};

function shape(value, required, optional = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).some(
      key =>
        typeof key !== 'string' ||
        ![...required, ...optional].includes(key) ||
        !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), 'value'),
    ) ||
    required.some(key => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    fail();
  }
}

function text(value, pattern, maximum = 128) {
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    /[\s\x00-\x1f\x7f]/.test(value) ||
    !pattern.test(value)
  ) fail();
  return value;
}

/**
 * Accept JSON text or a plain object; return a fresh, validated plain object.
 * Only nonsecret dispatch data belongs here. Throws a fixed, input-free error.
 */
function validateLiveConfig(input, platform = 'all') {
  try {
    if (!['all', ...PLATFORMS].includes(platform)) fail();
    if (typeof input === 'string' && Buffer.byteLength(input) > 8192) fail();
    const config = typeof input === 'string' ? JSON.parse(input) : input;
    shape(config, ['schemaVersion', 'provisioningHost', 'scopeId', 'expectedHub', 'cases']);
    if (config.schemaVersion !== 1) fail();
    const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
    const provisioningHost = text(
      config.provisioningHost,
      new RegExp(`^${label}(?:\\.${label})*\\.azure-devices-provisioning\\.(net|cn|us)$`),
      253,
    );
    const expectedHub = text(
      config.expectedHub,
      new RegExp(`^${label}(?:\\.device)?\\.azure-devices\\.(net|cn|us)$`),
      253,
    );
    const scopeId = text(config.scopeId, /^0ne[A-Za-z0-9]{8}$/);
    shape(config.cases, platform === 'all' ? PLATFORMS : [platform], PLATFORMS);
    const cases = {};
    for (const name of PLATFORMS) {
      if (!Object.prototype.hasOwnProperty.call(config.cases, name)) continue;
      const item = config.cases[name];
      shape(item, ['registrationId', 'expectedDeviceId', 'nonce']);
      cases[name] = {
        registrationId: text(item.registrationId, /^[a-z0-9][a-z0-9._-]{0,127}$/),
        expectedDeviceId: text(item.expectedDeviceId, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
        nonce: text(item.nonce, /^[A-Za-z0-9_-]{16,128}$/),
      };
    }
    if (cases.android && cases.ios) {
      const androidIds = [cases.android.registrationId, cases.android.expectedDeviceId];
      const iosIds = [cases.ios.registrationId, cases.ios.expectedDeviceId];
      if (
        androidIds.some(id => iosIds.includes(id)) ||
        cases.android.nonce === cases.ios.nonce
      ) {
        fail();
      }
    }
    return {schemaVersion: 1, provisioningHost, scopeId, expectedHub, cases};
  } catch {
    fail();
  }
}

const exactPattern = value => `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;

function caseEnvironment(input, platform) {
  if (!PLATFORMS.includes(platform)) fail();
  const config = validateLiveConfig(input, platform);
  const item = config.cases[platform];
  return {
    MAESTRO_APP_ID: platform === 'android' ? 'com.iot_pnp.ci' : 'com.microsoft.iotpnp.ci',
    MAESTRO_PLATFORM: platform,
    MAESTRO_PROVISIONING_HOST: config.provisioningHost,
    MAESTRO_PROVISIONING_HOST_PATTERN: exactPattern(config.provisioningHost),
    MAESTRO_SCOPE_ID: config.scopeId,
    MAESTRO_REGISTRATION_ID: item.registrationId,
    MAESTRO_REGISTRATION_ID_PATTERN: exactPattern(item.registrationId),
    MAESTRO_EXPECTED_DEVICE_ID_PATTERN: exactPattern(item.expectedDeviceId),
    MAESTRO_EXPECTED_HUB_PATTERN: exactPattern(config.expectedHub),
    MAESTRO_NONCE: item.nonce,
    MAESTRO_NONCE_PATTERN: exactPattern(item.nonce),
    MAESTRO_MODEL_ID_PATTERN: exactPattern(MODEL_ID),
  };
}

function createLiveReport(input, platform, options) {
  if (!PLATFORMS.includes(platform)) fail();
  shape(options, ['sourceSha', 'uiResult'], ['diagnostics']);
  const sourceSha = text(options.sourceSha, /^[a-f0-9]{40}$/);
  if (!['passed', 'failed'].includes(options.uiResult)) fail();
  const config = validateLiveConfig(input, platform);
  const item = config.cases[platform];
  return {
    schemaVersion: 1,
    sourceSha,
    platform,
    modelId: MODEL_ID,
    provisioningHost: config.provisioningHost,
    scopeId: config.scopeId,
    registrationId: item.registrationId,
    expectedDeviceId: item.expectedDeviceId,
    expectedHub: config.expectedHub,
    nonce: item.nonce,
    uiResult: options.uiResult,
    independentAzureVerification: 'pending',
    evidenceScope: 'UI assertions only; local QoS 0 submission is not a cloud ACK',
    registryVerification: 'Not checked',
    diagnostics: sanitizeDiagnostics(options.diagnostics),
  };
}

function main() {
  const [command, platform, result, ...extra] = process.argv.slice(2);
  if (command === '--help' && !platform) {
    console.log(`Device-only live proof configuration (no credentials).
CommonJS: {validateLiveConfig, caseEnvironment, createLiveReport, MODEL_ID}.
validateLiveConfig(input, platform='all') accepts JSON text/plain object and returns
{schemaVersion:1, provisioningHost, scopeId, expectedHub, cases:{android?,ios?}}.
Each case contains only {registrationId, expectedDeviceId, nonce}.
DPS/Hub: lowercase Azure DNS only (.net/.cn/.us); Hub permits .device.
Scope: 0ne + 8 alphanumerics. IDs: 1-128 alphanumerics/dot/underscore/hyphen;
registration IDs lowercase. Nonce: 16-128 alphanumerics/underscore/hyphen.
Selected cases are required; cross-platform IDs and nonces must be distinct.
No connection strings, SAS tokens, device keys or other extra fields are accepted.
CLI reads PAAD_LIVE_CONFIG, never command-line JSON:
  node scripts/ci/live-config.js validate [all|android|ios]  (silent)
  node scripts/ci/live-config.js env android|ios  (nonsecret NAME=value lines)
  node scripts/ci/live-config.js report android|ios passed|failed
Report also requires GITHUB_SHA; invoke ONLY after an actual Maestro result.
Private results/debug diagnostics are read before cleanup; missing/invalid data
is unavailable, never a successful UI result. No raw errors/images are emitted.
createLiveReport(input, platform, {sourceSha, uiResult, diagnostics?}) returns only whitelisted
nonsecret fields and explicitly leaves independent Azure verification pending.
Environment output is data: read NAME=value lines; do not eval/source it.
Model is fixed: ${MODEL_ID}. Device keys belong only in MAESTRO_DEVICE_KEY
on the post-build smoke step. --help and validation errors never echo input.`);
    return;
  }
  if (extra.length) fail();
  if (command === 'validate' && !result) {
    validateLiveConfig(process.env.PAAD_LIVE_CONFIG, platform || 'all');
  } else if (command === 'env' && !result) {
    const env = caseEnvironment(process.env.PAAD_LIVE_CONFIG, platform);
    process.stdout.write(Object.entries(env).map(([key, value]) => `${key}=${value}\n`).join(''));
  } else if (command === 'report') {
    const report = createLiveReport(process.env.PAAD_LIVE_CONFIG, platform, {
      sourceSha: process.env.GITHUB_SHA,
      uiResult: result,
      diagnostics: collectLiveDiagnostics(),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    fail();
  }
}

module.exports = {validateLiveConfig, caseEnvironment, createLiveReport, MODEL_ID};
if (require.main === module) {
  try {
    main();
  } catch {
    console.error('Live configuration rejected; consult --help. No input was logged.');
    process.exitCode = 1;
  }
}
