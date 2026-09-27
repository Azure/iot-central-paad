'use strict';

const path = require('node:path');
const {validateLiveConfig, MODEL_ID} = require('./live-config');

function createXCTestCase(mode, input, key) {
  if (!['smoke', 'live'].includes(mode)) throw new Error('Invalid native UI mode');
  if (mode === 'smoke') {
    if (input !== undefined || key !== undefined) throw new Error('Live input rejected by native smoke');
    return {
      schemaVersion: 1, mode, modelId: MODEL_ID,
      provisioningHost: 'global.azure-devices-provisioning.net',
      scopeId: '0ne00AABBCC', registrationId: 'paad-native-ui-fixture',
      expectedDeviceId: 'paad-native-ui-returned',
      expectedHub: 'paad-native-ui-fixture.azure-devices.net',
      nonce: 'ios_native_fixture_1234567890',
      deviceKey: Buffer.alloc(64, 1).toString('base64'),
    };
  }
  const config = validateLiveConfig(input, 'ios');
  if (typeof key !== 'string' || key.length > 512 ||
      Buffer.from(key, 'base64').length < 16 || Buffer.from(key, 'base64').toString('base64') !== key) {
    throw new Error('Invalid native UI device input');
  }
  return {
    schemaVersion: 1, mode, modelId: MODEL_ID,
    provisioningHost: config.provisioningHost, scopeId: config.scopeId,
    expectedHub: config.expectedHub, ...config.cases.ios, deviceKey: key,
  };
}

function configureXCTestRun(manifest, products, caseData, captureDiagnostic = false) {
  if (typeof captureDiagnostic !== 'boolean' || (captureDiagnostic && caseData.mode !== 'live')) {
    throw new Error('Diagnostic capture requires an authorized live case');
  }
  if (!path.isAbsolute(products)) {
    throw new Error('Native UI paths must be absolute');
  }
  const root = JSON.parse(JSON.stringify(manifest));
  const targets = root.TestConfigurations?.flatMap(config => config.TestTargets || []) ||
    Object.entries(root).filter(([key]) => key !== '__xctestrun_metadata__').map(([, value]) => value);
  if (targets.length !== 1 || targets[0].IsUITestBundle !== true ||
      typeof targets[0].TestBundlePath !== 'string' ||
      !targets[0].TestBundlePath.endsWith('/PaadLiveUITests.xctest') ||
      typeof targets[0].TestHostPath !== 'string' || !targets[0].TestHostPath.endsWith('-Runner.app') ||
      targets[0].UseUITargetAppProvidedByTests !== true ||
      targets[0].UITargetAppPath !== undefined || targets[0].UITargetAppBundleIdentifier !== undefined) {
    throw new Error('Unexpected native UI test target');
  }
  // The private copy moves away from Products; retain the original build-path base.
  function relocate(value) {
    if (typeof value === 'string') return value.replaceAll('__TESTROOT__', products);
    if (Array.isArray(value)) return value.map(relocate);
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) value[key] = relocate(value[key]);
    }
    return value;
  }
  relocate(root);
  const target = targets[0];
  target.UITargetAppEnvironmentVariables = {};
  target.EnvironmentVariables = {...target.EnvironmentVariables, PAAD_XCTEST_CASE: JSON.stringify(caseData)};
  delete target.EnvironmentVariables.PAAD_XCTEST_CAPTURE;
  if (captureDiagnostic) target.EnvironmentVariables.PAAD_XCTEST_CAPTURE = '1';
  return root;
}

module.exports = {createXCTestCase, configureXCTestRun};
