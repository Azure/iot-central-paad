jest.mock('expo/fetch', () => ({fetch: jest.fn()}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock(
  'react-native-azure-iotcentral-client/node_modules/react-native-paho-mqtt',
  () => ({Client: class {}, Message: class {}}),
);
jest.mock('../src/connection/legacyHub', () => ({createLegacyHub: jest.fn()}));

const {
  createDeviceClient,
  IOTC_EVENTS,
  PHONE_MODEL_ID,
} = require('../src/connection');
const {createLegacyHub} = require('../src/connection/legacyHub');
const key = Buffer.alloc(32, 7).toString('base64');
const credentials = {
  registrationId: 'registration-id',
  scopeId: '0ne12345',
  deviceKey: key,
};
const response = (status, body, retry = '0') => ({
  status,
  headers: {get: () => retry},
  json: async () => body,
});
const assigned = {
  operationId: 'operation-123',
  status: 'assigned',
  registrationState: {
    deviceId: 'actual-device',
    assignedHub: 'assigned.device.azure-devices.net',
  },
};
let hub;
beforeEach(() => {
  jest.useFakeTimers();
  hub = {
    connect: jest.fn(async () => {
      hub.online = true;
    }),
    close: jest.fn(() => {
      hub.online = false;
    }),
    isConnected: () => !!hub.online,
    sendTelemetry: jest.fn(() => ({delivery: 'submitted'})),
    sendProperty: jest.fn(() => ({delivery: 'submitted'})),
    fetchTwin: jest.fn(() => ({delivery: 'submitted'})),
  };
  createLegacyHub.mockReturnValue(hub);
});
afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

test('device-key DPS carries PnP model, returned Hub and different assigned device ID', async () => {
  const stages = [];
  const http = jest.fn(async () => response(200, assigned));
  const client = createDeviceClient(credentials, {
    http,
    onStage: stage => stages.push(stage),
  });
  expect(client.id).toBe('registration-id');
  expect(client.identity).toBeNull();
  const identity = await client.connect();
  expect(identity).toEqual({
    assignedHub: 'assigned.device.azure-devices.net',
    deviceId: 'actual-device',
    registrationId: 'registration-id',
    operationId: 'operation-123',
    modelId: PHONE_MODEL_ID,
  });
  expect(client.id).toBe('actual-device');
  expect(stages).toEqual([
    'validating',
    'provisioning',
    'connecting',
    'connected',
  ]);
  const [url, request] = http.mock.calls[0];
  expect(url).toBe(
    'https://global.azure-devices-provisioning.net/0ne12345/registrations/registration-id/register?api-version=2019-03-31',
  );
  expect(request.redirect).toBe('error');
  expect(JSON.parse(request.body)).toEqual({
    registrationId: 'registration-id',
    payload: {modelId: PHONE_MODEL_ID, iotcModelId: PHONE_MODEL_ID},
  });
  expect(createLegacyHub.mock.calls[0][1]).toContain(
    'sr=assigned.device.azure-devices.net%2Fdevices%2Factual-device',
  );
  expect(createLegacyHub.mock.calls[0][1]).not.toContain(key);
  expect(await client.sendTelemetry({temperature: 3})).toEqual({
    delivery: 'submitted',
  });
  expect(await client.sendProperty({x: false})).toEqual({
    delivery: 'submitted',
  });
  expect(await client.fetchTwin()).toEqual({delivery: 'submitted'});
  await client.disconnect();
  expect(client.isConnected()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test('direct QR bypasses DPS without truncating padded keys', async () => {
  const http = jest.fn();
  const connectionString = `HostName=direct.azure-devices.net;DeviceId=direct-id;SharedAccessKey=${key}`;
  const client = createDeviceClient(
    Buffer.from(JSON.stringify({connectionString})).toString('base64'),
    {http},
  );
  await client.connect();
  expect(http).not.toHaveBeenCalled();
  expect(client.identity.deviceId).toBe('direct-id');
  expect(createLegacyHub.mock.calls[0][1]).toContain(
    'sr=direct.azure-devices.net%2Fdevices%2Fdirect-id',
  );
});

test('polling honors Retry-After and uses operationId without resubmitting', async () => {
  const http = jest
    .fn()
    .mockResolvedValueOnce(
      response(202, {status: 'assigning', operationId: 'operation-123'}, '2'),
    )
    .mockResolvedValueOnce(response(200, assigned));
  const client = createDeviceClient(
    {
      ...credentials,
      provisioningHost: 'global-canary.azure-devices-provisioning.net',
    },
    {http},
  );
  const pending = client.connect();
  await jest.advanceTimersByTimeAsync(1999);
  expect(http).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await pending;
  expect(http.mock.calls[1][0]).toContain('/operations/operation-123?');
  expect(http.mock.calls[1][1].method).toBe('GET');
  expect(http.mock.calls[1][1].body).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});

test.each([401, 403])(
  'wrong key HTTP %s is safe and never connects',
  async status => {
    const http = jest.fn(async () =>
      response(status, {message: `secret:${key}`}),
    );
    const stages = jest.fn();
    const client = createDeviceClient(credentials, {http, onStage: stages});
    const error = await client.connect().catch(e => e);
    expect(error).toMatchObject({code: 'AUTHENTICATION_FAILED', status});
    expect(JSON.stringify(error)).not.toContain(key);
    expect(String(error)).not.toContain('secret:');
    expect(createLegacyHub).not.toHaveBeenCalled();
    expect(stages.mock.calls.map(c => c[0])).toEqual([
      'validating',
      'provisioning',
      'error',
    ]);
    expect(jest.getTimerCount()).toBe(0);
  },
);

test.each([
  ['errorCode', 400123],
  ['code', 400124],
  ['errorCode', '400123'],
  ['code', '400124'],
  ['errorCode', undefined],
  ['code', undefined],
])(
  'HTTP failures retain only a numeric DPS error code (%#)',
  async (field, serviceCode) => {
    const http = jest.fn(async () =>
      response(400, {[field]: serviceCode, message: key, trackingId: key}),
    );
    const error = await createDeviceClient(credentials, {http})
      .connect()
      .catch(e => e);
    expect(error).toMatchObject({code: 'PROVISIONING_FAILED', status: 400});
    expect(error.serviceCode).toBe(
      typeof serviceCode === 'number' ? serviceCode : undefined,
    );
    expect(JSON.stringify(error)).not.toContain(key);
    expect(createLegacyHub).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  },
);

test.each(['syntax', 'shape', 'read'])(
  'an unusable HTTP error body is still a safe failure (%s)',
  async kind => {
    const result = response(412, key);
    if (kind !== 'shape') {
      result.json = async () => {
        throw kind === 'syntax' ? new SyntaxError(key) : new Error(key);
      };
    }
    const error = await createDeviceClient(credentials, {
      http: jest.fn(async () => result),
    })
      .connect()
      .catch(e => e);
    expect(error.code).toBe(
      kind === 'read' ? 'NETWORK_ERROR' : 'PROVISIONING_FAILED',
    );
    if (kind !== 'read') expect(error.status).toBe(412);
    expect(JSON.stringify(error)).not.toContain(key);
    expect(String(error)).not.toContain(key);
    expect(createLegacyHub).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  },
);

test('failed service operation exposes only numeric code and operationId', async () => {
  const http = jest.fn(async () =>
    response(200, {
      status: 'failed',
      operationId: 'operation-123',
      registrationState: {errorCode: 401002, errorMessage: key},
    }),
  );
  const error = await createDeviceClient(credentials, {http})
    .connect()
    .catch(e => e);
  expect(error).toMatchObject({
    code: 'PROVISIONING_FAILED',
    serviceCode: 401002,
    operationId: 'operation-123',
  });
  expect(JSON.stringify(error)).not.toContain(key);
});

test.each([
  {
    ...assigned,
    registrationState: {deviceId: 'actual-device', assignedHub: 'evil.example'},
  },
  {...assigned, registrationState: {assignedHub: 'assigned.azure-devices.net'}},
  {status: 'assigned'},
  {status: 'something-else'},
])('rejects malformed or unsafe assignment %#', async body => {
  const http = jest.fn(async () => response(200, body));
  await expect(
    createDeviceClient(credentials, {http}).connect(),
  ).rejects.toThrow();
  expect(createLegacyHub).not.toHaveBeenCalled();
});

test.each([301, 302, 307, 308])(
  'never follows HTTP %s redirects',
  async status => {
    const http = jest.fn(async () => response(status, {}));
    await expect(
      createDeviceClient(credentials, {http}).connect(),
    ).rejects.toMatchObject({code: 'UNSAFE_ENDPOINT'});
    expect(http).toHaveBeenCalledTimes(1);
  },
);

test('cancelling pending polling removes all retry/deadline timers', async () => {
  const http = jest.fn(async () =>
    response(202, {status: 'assigning', operationId: 'operation-123'}, '60'),
  );
  const client = createDeviceClient(credentials, {http});
  const result = client.connect().catch(e => e);
  await jest.advanceTimersByTimeAsync(1);
  client.cancel();
  expect(await result).toMatchObject({
    code: 'CANCELLED',
    operationId: 'operation-123',
  });
  await jest.advanceTimersByTimeAsync(120000);
  expect(http).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('deadline aborts an unresponsive request without waiting for transport', async () => {
  const http = jest.fn(() => new Promise(() => {}));
  const result = createDeviceClient(credentials, {http, timeoutMs: 1000})
    .connect()
    .catch(e => e);
  await jest.advanceTimersByTimeAsync(1000);
  expect(await result).toMatchObject({code: 'TIMEOUT'});
  expect(http.mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('external pre-aborted signal sends nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  const http = jest.fn();
  await expect(
    createDeviceClient(credentials, {http}).connect({
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({code: 'CANCELLED'});
  expect(http).not.toHaveBeenCalled();
});

test('transient throttling retry is bounded and honors delay', async () => {
  const http = jest.fn(async () => response(429, {secret: key}, '3'));
  const result = createDeviceClient(credentials, {http, timeoutMs: 5000})
    .connect()
    .catch(e => e);
  await jest.advanceTimersByTimeAsync(2999);
  expect(http).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(2001);
  expect(await result).toMatchObject({code: 'TIMEOUT'});
  expect(http).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

test('typed listeners unsubscribe and raw network errors are redacted', async () => {
  const http = jest.fn(async () => response(200, assigned));
  const client = createDeviceClient(credentials, {http});
  const command = jest.fn();
  const unsubscribe = client.on(IOTC_EVENTS.Commands, command);
  await client.connect();
  createLegacyHub.mock.calls[0][3]({name: 'x', requestPayload: '{}'});
  expect(command).toHaveBeenCalledTimes(1);
  unsubscribe();
  createLegacyHub.mock.calls[0][3]({name: 'x', requestPayload: '{}'});
  expect(command).toHaveBeenCalledTimes(1);
  const broken = createDeviceClient(credentials, {
    http: async () => {
      throw new Error(`token=${key}`);
    },
  });
  const error = await broken.connect().catch(e => e);
  expect(error.code).toBe('NETWORK_ERROR');
  expect(String(error)).not.toContain(key);
});
