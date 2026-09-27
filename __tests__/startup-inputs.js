const fs = require('node:fs');
const yaml = require('js-yaml');

const steps = yaml.loadAll(fs.readFileSync('.maestro/startup.yaml', 'utf8'))[1];
const hostname = 'global-canary.azure-devices-provisioning.net';
const hostnamePattern = '^global-canary\\.azure-devices-provisioning\\.net$';

test('enters and verifies the endpoint before focusing the secure field, like the real flow', () => {
  const hostInput = steps.findIndex(step => step.inputText === hostname);
  const keyInput = steps.findIndex(step => step.inputText === 'synthetic+not/a-device-key=');
  expect(hostInput).toBeGreaterThan(0);
  expect(keyInput).toBeGreaterThan(hostInput);
  const hostnameAssertion = {
    assertVisible: {id: 'connection-provisioningHost', text: hostnamePattern},
  };
  expect(steps.slice(hostInput + 1, keyInput)).toContainEqual(hostnameAssertion);
  expect(steps.slice(keyInput + 1)).toContainEqual(hostnameAssertion);
});

test('synthetic credentials are never submitted or revealed by the startup flow', () => {
  expect(steps.some(step => step.tapOn?.id === 'connection-submit')).toBe(false);
  expect(JSON.stringify(steps)).not.toMatch(/Show credential|Show credentials/);
  expect(steps).toContainEqual({assertVisible: {id: 'connection-submit'}});
});
