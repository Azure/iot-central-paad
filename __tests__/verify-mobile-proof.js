const {
  inspectProof,
  checkBefore,
  validateTargets,
  azureReader,
  registryDevices,
} = require('../scripts/ci/verify-mobile-proof');
const {validateLiveConfig, MODEL_ID} = require('../scripts/ci/live-config');
const {spawnSync} = require('node:child_process');

jest.mock('node:child_process', () => ({spawnSync: jest.fn()}));

const config = validateLiveConfig({
  schemaVersion: 1,
  provisioningHost: 'global.azure-devices-provisioning.net',
  scopeId: '0ne01234567',
  expectedHub: 'fixture.device.azure-devices.net',
  cases: {android: {
    registrationId: 'fixture-registration',
    expectedDeviceId: 'different-assigned-id',
    nonce: 'android-unique-nonce-1234',
  }},
}, 'android');
const targets = validateTargets({
  subscription: '00000000-0000-0000-0000-000000000000',
  resourceGroup: 'fixture-rg',
  namespace: 'fixture-ns',
  dpsServiceHost: 'fixture.azure-devices-provisioning.net',
  hubServiceHost: 'fixture.service.azure-devices.net',
});
const assignment = {
  status: 'assigned',
  registrationId: 'fixture-registration',
  deviceId: 'different-assigned-id',
  assignedHub: config.expectedHub,
};
const twin = {
  deviceId: assignment.deviceId,
  modelId: MODEL_ID,
  proof: {nonce: config.cases.android.nonce, platform: 'android'},
};
const record = {
  id: '/fixture/registryDevices/different-assigned-id',
  name: 'different-assigned-id',
  externalDeviceId: 'different-assigned-id',
};
const reader = (...responses) => jest.fn(() => responses.shift());
const armTargets = {...targets, registryArmEndpoint: 'https://centraluseuap.management.azure.com'};
const registryPath = `/subscriptions/${targets.subscription}/resourceGroups/${targets.resourceGroup}` +
  `/providers/Microsoft.DeviceRegistry/namespaces/${targets.namespace}/registryDevices`;
const inventoryUrl = `${armTargets.registryArmEndpoint}${registryPath}?api-version=2026-11-02-preview`;
const armRecord = {...record, id: `${registryPath}/${record.name}`};

test('explicit ARM registry reads require a known origin and cover all pages without fetching keys', () => {
  const nextLink = `${inventoryUrl}&$skiptoken=second`;
  const read = reader(
    {value: [{...armRecord, externalDeviceId: 'other', arbitrary: 'RAW_CANARY'}], nextLink},
    {value: [armRecord], nextLink: null},
  );
  expect(registryDevices(armTargets, read)).toEqual([
    {...armRecord, externalDeviceId: 'other'}, armRecord,
  ]);
  expect(read.mock.calls.map(([command]) => command)).toEqual([
    ['rest', '--method', 'get', '--url', inventoryUrl, '--resource', 'https://management.azure.com/'],
    ['rest', '--method', 'get', '--url', nextLink, '--resource', 'https://management.azure.com/'],
  ]);
  expect(validateTargets(armTargets)).toEqual(armTargets);
  expect(() => validateTargets({...targets, registryArmEndpoint: 'https://example.com'}))
    .toThrow('INVALID_REGISTRY_ARM_ENDPOINT');
  expect(() => registryDevices({...targets, registryArmEndpoint: 'https://example.com'}, read))
    .toThrow('INVALID_REGISTRY_ARM_ENDPOINT');
  expect(JSON.stringify(read.mock.calls)).not.toMatch(/show-keys|list-keys|primaryKey/);
});

test.each([
  `${inventoryUrl}#fragment`,
  inventoryUrl.replace('https:', 'http:'),
  inventoryUrl.replace('centraluseuap.management.azure.com', 'example.com'),
  inventoryUrl.replace('https://', 'https://user@'),
  inventoryUrl.replace('fixture-ns', 'another-ns'),
  inventoryUrl.replace('2026-11-02-preview', 'other-version'),
  `${inventoryUrl}&api-version=2026-11-02-preview`,
  inventoryUrl,
  '../registryDevices?api-version=2026-11-02-preview',
  'x'.repeat(8193),
  1,
])('rejects unsafe, duplicate or changed-scope ARM continuations before requesting them (%#)', nextLink => {
  const read = reader({value: [], nextLink});
  expect(() => registryDevices(armTargets, read)).toThrow('INVALID_REGISTRY_PAGE');
  expect(read).toHaveBeenCalledTimes(1);
});

test.each([
  null, [], {}, {value: {}}, {value: [null]},
  {value: [{...armRecord, id: '/another/namespace/record'}]},
])('rejects malformed ARM registry inventory instead of claiming absence (%#)', response => {
  expect(() => registryDevices(armTargets, reader(response))).toThrow('INVALID_REGISTRY_RESPONSE');
});

test('bounds ARM pages and records and propagates read failures', () => {
  let page = 0;
  const read = jest.fn(() => ({value: [], nextLink: `${inventoryUrl}&$skiptoken=${++page}`}));
  expect(() => registryDevices(armTargets, read)).toThrow('REGISTRY_INVENTORY_LIMIT');
  expect(read).toHaveBeenCalledTimes(20);
  expect(() => registryDevices(armTargets, reader({value: Array(10001).fill(armRecord)})))
    .toThrow('REGISTRY_INVENTORY_LIMIT');
  expect(() => registryDevices(armTargets, () => { throw new Error('AZURE_READ_DENIED'); }))
    .toThrow('AZURE_READ_DENIED');
});

test('recognizes the actual pre-registration DPS service code without logging its body', () => {
  spawnSync.mockReturnValueOnce({
    status: 3,
    stdout: '',
    stderr: "ERROR: {'code': 404202, 'message': 'Registration not found.'}",
  });
  expect(azureReader(targets, Date.now() + 30000)(['iot', 'dps'], 'status', true)).toBeNull();
});

test.each([401001, 403004])('classifies service authorization code %s without leaking details', code => {
  spawnSync.mockReturnValueOnce({
    status: 3,
    stdout: '',
    stderr: `ERROR: {'code': ${code}, 'message': 'private-fixture'}`,
  });
  expect(() => azureReader(targets, Date.now() + 30000)(['iot', 'dps'], 'status')).toThrow(
    'AZURE_READ_DENIED',
  );
});

test('before traffic checks both registration and assigned identities', () => {
  expect(checkBefore(config, 'android', targets, reader([]))).toMatchObject({
    registryRecordsAbsent: true,
    identifiers: ['fixture-registration', 'different-assigned-id'],
  });
  expect(() => checkBefore(config, 'android', targets, reader([record]))).toThrow(
    'REGISTRY_RECORD_ALREADY_EXISTS',
  );
});

test('requires independent exact assignment, model, nonce and registry identity', () => {
  const read = reader(assignment, twin, [record]);
  expect(inspectProof(config, 'android', targets, read)).toMatchObject({
    complete: true,
    assignedDeviceId: 'different-assigned-id',
    modelId: MODEL_ID,
    reportedProof: {nonce: config.cases.android.nonce},
    registryDevice: {externalDeviceId: 'different-assigned-id'},
    downstreamTelemetryReceipt: 'Not checked',
  });
  expect(read.mock.calls[0][0]).toContain('--auth-type');
  expect(read.mock.calls[1][0]).toContain('different-assigned-id');
  expect(read.mock.calls[1][0]).toContain(targets.hubServiceHost);
  expect(JSON.stringify(read.mock.calls)).not.toMatch(/show-keys|primaryKey|list-keys/);
});

test.each([
  ['deviceId', 'fixture-registration'],
  ['assignedHub', 'other.azure-devices.net'],
  ['registrationId', 'some-other-registration'],
  ['status', 'failed'],
])('does not substitute a guessed assignment (%s)', (field, value) => {
  expect(() => inspectProof(
    config, 'android', targets, reader({...assignment, [field]: value}),
  )).toThrow('ASSIGNMENT_MISMATCH');
});

test('never treats provisioning or local submission alone as confirmation', () => {
  expect(inspectProof(config, 'android', targets, reader(null)).complete).toBe(false);
  expect(inspectProof(config, 'android', targets, reader(assignment, null)).complete).toBe(false);
  expect(inspectProof(config, 'android', targets, reader(
    assignment, {...twin, proof: {nonce: 'old', platform: 'android'}},
  )).complete).toBe(false);
  expect(inspectProof(config, 'android', targets, reader(assignment, twin, [])).complete).toBe(false);
});

test('distinguishes a missing model from a missing nonce without relaxing identity checks', () => {
  expect(inspectProof(config, 'android', targets, reader(assignment, {...twin, modelId: null})))
    .toEqual({complete: false, waitingFor: 'model-bearing Hub twin marker'});
  expect(inspectProof(config, 'android', targets, reader(assignment, {...twin, proof: null})))
    .toEqual({complete: false, waitingFor: 'exact mobile nonce'});
  expect(() => inspectProof(config, 'android', targets, reader(
    assignment, {...twin, modelId: 'dtmi:wrong:model;1', proof: null},
  ))).toThrow('TWIN_IDENTITY_OR_MODEL_MISMATCH');
});

test('rejects wrong models and does not confirm ADR from registration ID', () => {
  expect(() => inspectProof(config, 'android', targets, reader(
    assignment, {...twin, modelId: 'dtmi:wrong:model;1'},
  ))).toThrow('TWIN_IDENTITY_OR_MODEL_MISMATCH');
  expect(inspectProof(config, 'android', targets, reader(
    assignment, twin, [{...record, externalDeviceId: 'fixture-registration'}],
  )).complete).toBe(false);
});

test('outputs only allowlisted proof metadata', () => {
  const proof = inspectProof(config, 'android', targets, reader(
    {...assignment, key: 'private-fixture'},
    {...twin, credentials: 'private-fixture', proof: {...twin.proof, key: 'private-fixture'}},
    [{...record, arbitraryPayload: 'private-fixture'}],
  ));
  expect(JSON.stringify(proof)).not.toContain('private-fixture');
});
