const {
  collectAzureContext,
  ensureSafeEnvironment,
  writeExclusive,
  run,
} = require('../scripts/ci/export-azure-context');
const {validateLiveConfig} = require('../scripts/ci/live-config');
const {validateTargets} = require('../scripts/ci/verify-mobile-proof');

const subscriptionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const namespaceName = 'operator-context-ns';
const resourceGroup = 'operator-rg';
const namespaceId =
  `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
  `/providers/Microsoft.DeviceRegistry/namespaces/${namespaceName}`;
const config = validateLiveConfig(
  {
    schemaVersion: 1,
    provisioningHost: 'operator-dps.azure-devices-provisioning.net',
    scopeId: '0ne01234567',
    expectedHub: 'operator-hub.device.azure-devices.net',
    cases: {
      android: {
        registrationId: 'operator-registration',
        expectedDeviceId: 'operator-device',
        nonce: 'synthetic_nonce_123456789',
      },
    },
  },
  'android',
);
const targets = validateTargets({
  subscription: subscriptionId,
  resourceGroup,
  namespace: namespaceName,
  dpsServiceHost: 'operator-dps.azure-devices-provisioning.net',
  hubServiceHost: 'operator-hub.service.azure-devices.net',
});
const responses = () => [
  {resourceId: namespaceId, name: namespaceName, location: 'testregion'},
  {id: subscriptionId, name: 'Operator Subscription'},
  [
    {
      resourceId:
        `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
        '/providers/Microsoft.Devices/provisioningServices/operator-dps',
      name: 'dps',
      address: null,
    },
  ],
  [
    {
      resourceId:
        `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
        '/providers/Microsoft.Devices/IotHubs/operator-hub',
      name: 'hub',
      address: targets.hubServiceHost,
    },
  ],
  {
    registrationId: 'operator-registration',
    deviceId: 'operator-device',
    assignedHub: 'operator-hub.device.azure-devices.net',
    status: 'assigned',
  },
  [
    {
      id: `${namespaceId}/registryDevices/operator-record`,
      name: 'operator-record',
      externalDeviceId: 'operator-device',
    },
  ],
  [
    {
      timestamp: '2026-09-17T18:10:00.1234567Z',
      operation: 'Microsoft.DeviceRegistry/namespaces/registryDevices/write',
      status: 'Succeeded',
      resourceId: `${namespaceId}/registryDevices/operator-record`,
    },
  ],
];

const reader = values => jest.fn(() => values.shift());

test('collects only bounded allowlisted Azure reads and validates through the shared schema', () => {
  const read = reader(responses());
  const now = jest.fn(() => new Date('2026-09-17T19:00:00.000Z'));
  const result = collectAzureContext(config, 'android', targets, read, now);
  expect(result).toMatchObject({
    schema: 'paad.azure-context',
    capturedAt: '2026-09-17T19:00:00.000Z',
    binding: {
      deviceId: 'operator-device',
      assignedHub: 'operator-hub.device.azure-devices.net',
    },
    registryDevice: {externalDeviceId: 'operator-device'},
  });
  expect(read).toHaveBeenCalledTimes(7);
  expect(read.mock.calls[2][1]).toBe(
    '[].{resourceId:resourceId,address:address}',
  );
  expect(read.mock.calls[3][1]).toBe(
    '[].{resourceId:resourceId,address:address}',
  );
  expect(read.mock.calls[4][0]).toEqual(
    expect.arrayContaining([
      '--dps-name',
      targets.dpsServiceHost,
      '--auth-type',
      'login',
    ]),
  );
  expect(read.mock.calls[6]).toEqual([
    [
      'monitor',
      'activity-log',
      'list',
      '--resource-id',
      namespaceId,
      '--offset',
      '24h',
      '--max-events',
      '20',
    ],
    '[].{timestamp:eventTimestamp,operation:operationName.value,status:status.value,resourceId:resourceId}',
  ]);
  expect(now).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(read.mock.calls)).not.toMatch(
    /show-keys|list-keys|caller|claims|email|ipAddress/,
  );
});

test('allows a missing registry record but rejects ambiguity and denied activity reads', () => {
  const missing = responses();
  missing[5] = [];
  expect(
    collectAzureContext(
      config,
      'android',
      targets,
      reader(missing),
      () => new Date('2026-09-17T19:00:00.000Z'),
    ).registryDevice,
  ).toBeUndefined();

  const ambiguous = responses();
  ambiguous[5].push({...ambiguous[5][0], name: 'second-record'});
  expect(() =>
    collectAzureContext(config, 'android', targets, reader(ambiguous)),
  ).toThrow('AMBIGUOUS_REGISTRY_EVIDENCE');

  const denied = responses();
  const read = jest.fn(() => {
    const value = denied.shift();
    if (denied.length === 0) throw new Error('AZURE_READ_DENIED');
    return value;
  });
  expect(() => collectAzureContext(config, 'android', targets, read)).toThrow(
    'AZURE_READ_DENIED',
  );
});

test('explicit ARM inventory works through the exporter invocation and shared snapshot validation', () => {
  const values = responses();
  values[5] = {value: values[5], nextLink: null};
  const read = reader(values);
  const fileSystem = {
    readFileSync: jest.fn(() => JSON.stringify(config)),
    writeFileSync: jest.fn(),
    chmodSync: jest.fn(),
  };
  const result = run(
    [
      '--config',
      'nonsecret.json',
      '--platform',
      'android',
      '--subscription',
      subscriptionId,
      '--resource-group',
      resourceGroup,
      '--namespace',
      namespaceName,
      '--dps-service-host',
      targets.dpsServiceHost,
      '--hub-service-host',
      targets.hubServiceHost,
      '--out',
      'new-context.json',
      '--registry-arm-endpoint',
      'https://centraluseuap.management.azure.com',
    ],
    {},
    {read, fs: fileSystem, now: () => new Date('2026-09-17T19:00:00.000Z')},
  );
  expect(result.snapshot.registryDevice).toMatchObject({
    resourceId: `${namespaceId}/registryDevices/operator-record`,
    externalDeviceId: 'operator-device',
  });
  expect(read.mock.calls[5][0]).toEqual(
    expect.arrayContaining([
      'rest',
      '--method',
      'get',
      '--resource',
      'https://management.azure.com/',
    ]),
  );
  expect(fileSystem.writeFileSync).toHaveBeenCalledTimes(1);
});

test('requires exact links and assignment identity', () => {
  const wrongLink = responses();
  wrongLink[2][0].resourceId += '-other';
  expect(() =>
    collectAzureContext(config, 'android', targets, reader(wrongLink)),
  ).toThrow('DPS_LINK_MISMATCH');

  const wrongAssignment = responses();
  wrongAssignment[4].deviceId = 'other-device';
  expect(() =>
    collectAzureContext(config, 'android', targets, reader(wrongAssignment)),
  ).toThrow('ASSIGNMENT_MISMATCH');
});

test('refuses GitHub Actions and device-secret environments', () => {
  expect(() => ensureSafeEnvironment({GITHUB_ACTIONS: 'true'})).toThrow(
    'UNSAFE_EXECUTION_CONTEXT',
  );
  expect(() => ensureSafeEnvironment({MAESTRO_DEVICE_KEY: ''})).toThrow(
    'UNSAFE_EXECUTION_CONTEXT',
  );
  expect(() => ensureSafeEnvironment({PAAD_LIVE_CONFIG: ''})).toThrow(
    'UNSAFE_EXECUTION_CONTEXT',
  );
  expect(() => ensureSafeEnvironment({PATH: '/usr/bin'})).not.toThrow();
});

test('creates output exclusively as mode 0600 and never overwrites', () => {
  const fileSystem = {
    writeFileSync: jest.fn(),
    chmodSync: jest.fn(),
  };
  writeExclusive('context.json', {activities: []}, fileSystem);
  expect(fileSystem.writeFileSync).toHaveBeenCalledWith(
    'context.json',
    expect.any(String),
    {encoding: 'utf8', flag: 'wx', mode: 0o600},
  );
  expect(fileSystem.chmodSync).toHaveBeenCalledWith('context.json', 0o600);

  fileSystem.writeFileSync.mockImplementation(() => {
    const error = new Error('private path detail');
    error.code = 'EEXIST';
    throw error;
  });
  expect(() => writeExclusive('context.json', {}, fileSystem)).toThrow(
    'OUTPUT_ALREADY_EXISTS',
  );
});
