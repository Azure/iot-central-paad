const {
  azurePortalUrl,
  matchesAzureContext,
  parseAzureContext,
} = require('../src/onboarding/azureContext.ts');

const subscriptionId = '11111111-2222-4333-8444-555555555555';
const resourceGroup = 'synthetic-rg';
const namespaceName = 'synthetic-context-ns';
const namespaceId =
  `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
  `/providers/Microsoft.DeviceRegistry/namespaces/${namespaceName}`;

const fixture = () => ({
  schema: 'paad.azure-context',
  version: 1,
  capturedAt: '2026-09-17T18:00:00.123Z',
  binding: {
    deviceId: 'synthetic-device.01',
    assignedHub: 'synthetic-hub.device.azure-devices.net',
    registrationId: 'synthetic-registration',
  },
  subscription: {id: subscriptionId, name: 'Synthetic Subscription'},
  resourceGroup: {name: resourceGroup},
  namespace: {
    resourceId: namespaceId,
    name: namespaceName,
    location: 'testregion',
  },
  hub: {
    resourceId:
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
      '/providers/Microsoft.Devices/IotHubs/synthetic-hub',
    name: 'synthetic-hub',
  },
  dps: {
    resourceId:
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}` +
      '/providers/Microsoft.Devices/provisioningServices/synthetic-dps',
    name: 'synthetic-dps',
  },
  registryDevice: {
    resourceId: `${namespaceId}/registryDevices/synthetic-record`,
    name: 'synthetic-record',
    externalDeviceId: 'synthetic-device.01',
  },
  activities: [
    {
      timestamp: '2026-09-17T17:59:59.1234567Z',
      operation: 'Microsoft.DeviceRegistry/namespaces/registryDevices/write',
      status: 'Succeeded',
      resourceId: `${namespaceId}/registryDevices/synthetic-record`,
    },
  ],
});

const parse = value => parseAzureContext(JSON.stringify(value));

test('normalizes Azure event precision and rejects incomplete UTF-16 pairs', () => {
  expect(parse(fixture()).activities[0].timestamp).toBe(
    '2026-09-17T17:59:59.123Z',
  );
  const bad = fixture();
  bad.subscription.name = 'Broken \ud800';
  expect(() => parse(bad)).toThrow('Invalid Azure context snapshot');
  expect(() => parseAzureContext('\ud800')).toThrow(
    'Invalid Azure context snapshot',
  );
});

test('supports only validated subscription and resource-group portal scopes', () => {
  expect(azurePortalUrl(`/subscriptions/${subscriptionId}`)).toBe(
    `https://portal.azure.com/#resource/subscriptions/${subscriptionId}/overview`,
  );
  expect(
    azurePortalUrl(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`,
    ),
  ).toContain(`/resourceGroups/${resourceGroup}/overview`);
  for (const suffix of ['?token=secret', '/../other', '/providers/evil']) {
    expect(() =>
      azurePortalUrl(`/subscriptions/${subscriptionId}${suffix}`),
    ).toThrow();
  }
});

test('portal links use fixed cloud hosts rather than imported URLs', () => {
  expect(azurePortalUrl(namespaceId, 'synthetic-hub.azure-devices.cn')).toMatch(
    /^https:\/\/portal\.azure\.cn\/#resource\//,
  );
  expect(azurePortalUrl(namespaceId, 'synthetic-hub.azure-devices.us')).toMatch(
    /^https:\/\/portal\.azure\.us\/#resource\//,
  );
  expect(() => azurePortalUrl(namespaceId, 'evil.example')).toThrow();
});

test('parses a strict fresh Azure context snapshot and builds portal links', () => {
  const source = fixture();
  const result = parse(source);
  expect(result).toEqual({
    ...source,
    activities: source.activities.map(activity => ({
      ...activity,
      timestamp: new Date(activity.timestamp).toISOString(),
    })),
  });
  expect(result).not.toBe(source);
  expect(result.binding).not.toBe(source.binding);
  expect(result.activities[0]).not.toBe(source.activities[0]);
  source.binding.deviceId = 'mutated';
  source.activities[0].operation = 'mutated';
  expect(result.binding.deviceId).toBe('synthetic-device.01');
  expect(result.activities[0].operation).toContain('/write');
  expect(azurePortalUrl(result.namespace.resourceId)).toBe(
    `https://portal.azure.com/#resource${namespaceId}/overview`,
  );
});

test('matches exact device identity, canonical hostname and available registration ID', () => {
  const snapshot = parse(fixture());
  expect(
    matchesAzureContext(snapshot, {
      deviceId: 'synthetic-device.01',
      assignedHub: 'SYNTHETIC-HUB.DEVICE.AZURE-DEVICES.NET',
      registrationId: 'synthetic-registration',
    }),
  ).toBe(true);
  expect(
    matchesAzureContext(snapshot, {
      deviceId: 'synthetic-device.01',
      assignedHub: 'synthetic-hub.device.azure-devices.net',
    }),
  ).toBe(true);
  expect(
    matchesAzureContext(snapshot, {
      deviceId: 'Synthetic-device.01',
      assignedHub: 'synthetic-hub.device.azure-devices.net',
    }),
  ).toBe(false);
  expect(
    matchesAzureContext(snapshot, {
      deviceId: 'synthetic-device.01',
      assignedHub: 'synthetic-hub.device.azure-devices.net',
      registrationId: 'wrong-registration',
    }),
  ).toBe(false);
});

test.each([
  'deviceKey',
  'sasToken',
  'credentials',
  'connectionString',
  'primaryKey',
])(
  'rejects credential or unknown fields without reflecting source data: %s',
  key => {
    const value = fixture();
    value.binding[key] = 'SECRET_CANARY';
    expect(() => parse(value)).toThrow('Invalid Azure context snapshot');
    expect(() => parse(value)).not.toThrow('SECRET_CANARY');
  },
);

test('rejects unknown fields at every object level', () => {
  for (const target of [
    value => value,
    value => value.subscription,
    value => value.activities[0],
  ]) {
    const value = fixture();
    target(value).unexpected = true;
    expect(() => parse(value)).toThrow('Invalid Azure context snapshot');
  }
});

test.each([
  'https://portal.azure.com/#resource/subscriptions/x',
  '/subscriptions/11111111-2222-4333-8444-555555555555/resourceGroups/rg/providers/Microsoft.Web/sites/site',
  '/subscriptions/11111111-2222-4333-8444-555555555555/resourceGroups/rg/providers/Microsoft.Devices/IotHubs/hub?x=1',
  '/subscriptions/11111111-2222-4333-8444-555555555555/resourceGroups/rg/providers/Microsoft.Devices/IotHubs/../evil',
])('rejects malicious or unsupported portal resource IDs: %s', resourceId => {
  expect(() => azurePortalUrl(resourceId)).toThrow(
    'Invalid Azure context snapshot',
  );
});

test('rejects cross-subscription, resource-group and resource-name binding', () => {
  for (const mutate of [
    value => {
      value.hub.resourceId = value.hub.resourceId.replace(
        subscriptionId,
        'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      );
    },
    value => {
      value.dps.resourceId = value.dps.resourceId.replace(
        resourceGroup,
        'other-rg',
      );
    },
    value => {
      value.namespace.resourceId = value.namespace.resourceId.replace(
        namespaceName,
        'other-context-ns',
      );
    },
  ]) {
    const value = fixture();
    mutate(value);
    expect(() => parse(value)).toThrow('Invalid Azure context snapshot');
  }
});

test('rejects wrong device, Hub and unrelated activity bindings', () => {
  for (const mutate of [
    value => {
      value.registryDevice.externalDeviceId = 'wrong-device';
    },
    value => {
      value.binding.assignedHub = 'wrong-hub.device.azure-devices.net';
    },
    value => {
      value.activities[0].resourceId = value.hub.resourceId;
    },
  ]) {
    const value = fixture();
    mutate(value);
    expect(() => parse(value)).toThrow('Invalid Azure context snapshot');
  }
});

test.each([
  value => {
    value.capturedAt = '2026-09-17T18:00:00+00:00';
  },
  value => {
    value.activities[0].timestamp = '2026-02-30T00:00:00Z';
  },
  value => {
    value.activities[0].status = 'Complete';
  },
  value => {
    value.activities[0].operation = 'write operation with spaces';
  },
])('rejects malformed timestamps, statuses and operations', mutate => {
  const value = fixture();
  mutate(value);
  expect(() => parse(value)).toThrow('Invalid Azure context snapshot');
});

test('enforces input, event count and string bounds', () => {
  const tooMany = fixture();
  tooMany.activities = Array.from({length: 21}, () => fixture().activities[0]);
  expect(() => parse(tooMany)).toThrow('Invalid Azure context snapshot');

  const longOperation = fixture();
  longOperation.activities[0].operation = `Microsoft.DeviceRegistry/${'x'.repeat(
    240,
  )}/write`;
  expect(() => parse(longOperation)).toThrow('Invalid Azure context snapshot');
  expect(() => parseAzureContext(' '.repeat(65537))).toThrow(
    'Invalid Azure context snapshot',
  );
});

test('accepts an intentionally absent optional registry record', () => {
  const value = fixture();
  delete value.registryDevice;
  expect(parse(value).registryDevice).toBeUndefined();
});
