import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  observeClient,
  getObservationStore,
  useObservationSnapshot,
  OBSERVATION_LIMITS,
} from '../src/observation';
import {ConnectionError} from '../src/connection/errors';
import {
  IOTC_EVENTS,
  IIoTCCommandResponse,
  PHONE_MODEL_ID,
} from '../src/connection/types';
import {createSimulatedClient} from '../src/mocks/iotcMock';
import {submitProof} from '../src/onboarding/proof';

const identity = Object.freeze({
  assignedHub: 'observations.azure-devices.net',
  deviceId: 'assigned-phone',
  modelId: PHONE_MODEL_ID,
  registrationId: 'different-registration',
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
};
function fixture(simulated = false, assigned = identity) {
  let online = false;
  let currentIdentity = assigned;
  const submission = {delivery: simulated ? 'simulated' : 'submitted'};
  const upload = {delivery: 'acknowledged', status: 201};
  const listeners = [];
  const raw = {
    get id() {
      return currentIdentity?.deviceId ?? 'registration';
    },
    get identity() {
      return currentIdentity;
    },
    isConnected: jest.fn(() => online),
    connect: jest.fn(async () => {
      online = true;
      return currentIdentity;
    }),
    cancel: jest.fn(() => {
      online = false;
    }),
    disconnect: jest.fn(async () => {
      online = false;
    }),
    sendTelemetry: jest.fn(async () => submission),
    sendProperty: jest.fn(async () => submission),
    fetchTwin: jest.fn(async () => submission),
    uploadFile: jest.fn(async () => upload),
    on: jest.fn((event, callback) => {
      const listener = {event, callback, removed: false};
      listeners.push(listener);
      return jest.fn(() => {
        listener.removed = true;
      });
    }),
  };
  const client = observeClient(raw, simulated);
  const store = getObservationStore(client);
  return {
    client,
    raw,
    store,
    submission,
    upload,
    listeners,
    snapshot: () => store.getSnapshot(),
    online(value) {
      online = value;
    },
    identity(value) {
      currentIdentity = value;
    },
    emit(event, value) {
      return listeners
        .filter(listener => listener.event === event && !listener.removed)
        .map(listener => listener.callback(value));
    },
  };
}
const command = (extra = {}) => ({
  name: 'lightOn',
  requestId: 'request-123',
  requestPayload: '{"private":"do-not-retain-command-body"}',
  reply: jest.fn(async () => ({delivery: 'submitted'})),
  ...extra,
});
const property = (extra = {}) => ({
  name: 'writeableProp',
  value: 'do-not-retain-property-value',
  version: 3,
  ack: jest.fn(async () => ({delivery: 'submitted'})),
  ...extra,
});

test('decorates only the candidate and preserves method arguments, return objects and startup counts', async () => {
  const f = fixture();
  expect(getObservationStore(null)).toBeNull();
  expect(getObservationStore(undefined)).toBeNull();
  expect(getObservationStore(f.raw)).toBeNull();
  expect(f.raw.on).not.toHaveBeenCalled();
  const options = {cleanSession: true, timeoutMs: 90000};
  expect(await f.client.connect(options)).toBe(identity);
  expect(f.raw.connect).toHaveBeenCalledWith(options);
  expect(f.raw.connect).toHaveBeenCalledTimes(1);
  expect(f.raw.fetchTwin).not.toHaveBeenCalled();
  expect(f.raw.sendProperty).not.toHaveBeenCalled();
  expect(f.client.id).toBe(identity.deviceId);
  expect(f.client.identity).toBe(identity);

  const payload = {geolocation: {lat: 1, lon: 2}, private: 'not-retained'};
  const attributes = {'$.sub': 'sensors', authorization: 'do-not-retain'};
  expect(await f.client.sendTelemetry(payload, attributes)).toBe(f.submission);
  expect(f.raw.sendTelemetry).toHaveBeenCalledWith(payload, attributes);
  const reported = {device_info: {__t: 'c', readOnlyProp: 'private-value'}};
  expect(await f.client.sendProperty(reported)).toBe(f.submission);
  expect(f.raw.sendProperty).toHaveBeenCalledWith(reported);
  expect(await f.client.fetchTwin()).toBe(f.submission);
  expect(
    await f.client.uploadFile(
      'private.jpg',
      'image/jpeg',
      'private-base64',
      'base64',
    ),
  ).toBe(f.upload);
  expect(f.raw.uploadFile).toHaveBeenCalledWith(
    'private.jpg',
    'image/jpeg',
    'private-base64',
    'base64',
  );
  expect(f.raw.on).not.toHaveBeenCalled();
  expect(f.snapshot().latest.telemetry).toMatchObject({
    kind: 'telemetry',
    names: ['geolocation'],
    outcome: 'submitted',
    observer: 'device-app',
    simulated: false,
    observedAt: expect.any(Number),
    generation: f.snapshot().generation,
    identity: {
      assignedHub: identity.assignedHub,
      deviceId: identity.deviceId,
      modelId: PHONE_MODEL_ID,
    },
  });
  expect(f.snapshot().latest['reported-property'].names).toEqual([
    'device_info',
    'readOnlyProp',
  ]);
  expect(f.snapshot().latest.upload).toMatchObject({
    outcome: 'acknowledged',
    status: 201,
  });
  expect(f.snapshot().history.map(row => row.kind)).toEqual([
    'reported-property',
    'twin-request',
    'upload',
  ]);
  expect(JSON.stringify(f.snapshot())).not.toMatch(
    /private|authorization|base64|registration|"lat"|"lon"/,
  );
});

test('proof and Bluetooth-shaped calls are observed without adding tool instrumentation', async () => {
  const f = fixture();
  await f.client.connect();
  expect(
    await submitProof(
      f.client,
      'paad_synthetic_nonce_123',
      'test-platform',
      () => true,
    ),
  ).toBe(true);
  expect(f.snapshot().latest.telemetry.names).toEqual([
    'paadProofNonce',
    'paadProofPlatform',
  ]);
  expect(f.snapshot().latest['reported-property'].names).toEqual(['paadProof']);
  await f.client.sendTelemetry({temperature: 0, humidity: 20, rssi: -50});
  await f.client.sendProperty({bleDeviceName: 'private-nearby-device'});
  expect(f.snapshot().latest.telemetry.names).toEqual([
    'temperature',
    'humidity',
    'rssi',
  ]);
  expect(f.snapshot().latest['reported-property'].names).toEqual([
    'bleDeviceName',
  ]);
  expect(JSON.stringify(f.snapshot())).not.toMatch(
    /synthetic_nonce|test-platform|private-nearby/,
  );
});

test('actual offline simulation remains simulated, including safe upload failure', async () => {
  const client = observeClient(
    createSimulatedClient({deviceId: 'simulated-phone'}),
    true,
  );
  const store = getObservationStore(client);
  await client.connect();
  await expect(client.sendTelemetry({battery: 10})).resolves.toEqual({
    delivery: 'simulated',
  });
  await client.sendProperty({readOnlyProp: 'sample'});
  await client.fetchTwin();
  await expect(
    client.uploadFile('a', 'image/jpeg', 'bytes'),
  ).rejects.toMatchObject({
    code: 'OPERATION_FAILED',
  });
  expect(store.getSnapshot().simulated).toBe(true);
  expect(store.getSnapshot().latest.telemetry).toMatchObject({
    simulated: true,
    outcome: 'simulated',
  });
  expect(store.getSnapshot().latest.upload).toMatchObject({
    simulated: true,
    outcome: 'failed',
    errorCode: 'OPERATION_FAILED',
  });
  expect(store.getSnapshot().history.every(row => row.simulated)).toBe(true);
});

test.each([
  ['sendTelemetry', 'telemetry', [{battery: 10}]],
  ['sendProperty', 'reported-property', [{readOnlyProp: 'secret'}]],
  ['fetchTwin', 'twin-request', []],
  ['uploadFile', 'upload', ['secret.jpg', 'image/jpeg', 'secret-bytes']],
])(
  '%s keeps original rejection and records only a safe code',
  async (method, kind, args) => {
    const f = fixture();
    await f.client.connect();
    const rawError = new Error('https://private.blob/?sig=private-token');
    f.raw[method].mockRejectedValueOnce(rawError);
    await expect(f.client[method](...args)).rejects.toBe(rawError);
    expect(f.snapshot().latest[kind]).toMatchObject({
      outcome: 'failed',
      errorCode: 'OPERATION_FAILED',
    });
    const safe = new ConnectionError('TIMEOUT');
    f.raw[method].mockRejectedValueOnce(safe);
    await expect(f.client[method](...args)).rejects.toBe(safe);
    expect(f.snapshot().latest[kind].errorCode).toBe('TIMEOUT');
    expect(JSON.stringify(f.snapshot())).not.toMatch(/secret|private|sig=/);
  },
);

test('concurrent boundaries keep independent outcomes and completion timestamps', async () => {
  const f = fixture();
  await f.client.connect();
  const first = deferred();
  const second = deferred();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(100);
  try {
    f.raw.sendProperty
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const one = f.client.sendProperty({readOnlyProp: 'one'});
    const two = f.client.sendProperty({bleDeviceName: 'two'});
    const rejected = two.catch(error => error);
    second.reject(new ConnectionError('TIMEOUT'));
    expect((await rejected).code).toBe('TIMEOUT');
    clock.mockReturnValue(200);
    first.resolve(f.submission);
    expect(await one).toBe(f.submission);
    expect(
      f.snapshot().history.map(row => [row.outcome, row.observedAt, row.names]),
    ).toEqual([
      ['failed', 100, ['bleDeviceName']],
      ['submitted', 200, ['readOnlyProp']],
    ]);
  } finally {
    clock.mockRestore();
  }
});

test.each([
  [IOTC_EVENTS.Commands, IOTC_EVENTS.Properties],
  ['Commands', 'Properties'],
])(
  'preserves subscriptions, unsubscribe identity and callback contracts (%s)',
  async (commands, properties) => {
    const f = fixture();
    const receivedCommands = jest.fn(async () => {});
    const receivedProperties = jest.fn();
    const offCommand = f.client.on(commands, receivedCommands);
    const offProperty = f.client.on(properties, receivedProperties);
    expect(f.raw.on).toHaveBeenCalledTimes(2);
    expect(offCommand).toBe(f.raw.on.mock.results[0].value);
    expect(offProperty).toBe(f.raw.on.mock.results[1].value);
    await f.client.connect();
    const originalCommand = command();
    const originalProperty = property({source: 'patch'});
    await Promise.all(f.emit(commands, originalCommand));
    f.emit(properties, originalProperty);
    const wrappedCommand = receivedCommands.mock.calls[0][0];
    const wrappedProperty = receivedProperties.mock.calls[0][0];
    expect(wrappedCommand).toMatchObject({
      name: originalCommand.name,
      requestId: originalCommand.requestId,
      requestPayload: originalCommand.requestPayload,
    });
    expect(wrappedProperty.value).toBe(originalProperty.value);
    expect(wrappedProperty.version).toBe(3);
    const finished = f.store.beginExecution(wrappedCommand);
    finished('requested');
    const reply = await wrappedCommand.reply(
      IIoTCCommandResponse.SUCCESS,
      'private response',
    );
    expect(reply).toBe(await originalCommand.reply.mock.results[0].value);
    expect(originalCommand.reply).toHaveBeenCalledWith(
      IIoTCCommandResponse.SUCCESS,
      'private response',
    );
    const ack = await wrappedProperty.ack();
    expect(ack).toBe(await originalProperty.ack.mock.results[0].value);
    expect(originalProperty.ack).toHaveBeenCalledWith();
    expect(f.snapshot().latest['command-execution'].outcome).toBe('requested');
    expect(f.snapshot().latest['command-reply']).toMatchObject({
      response: 'success',
      outcome: 'submitted',
      correlation: {category: 'requestId', value: 'request-123'},
    });
    expect(f.snapshot().latest['property-ack']).toMatchObject({
      source: 'patch',
      version: 3,
      outcome: 'submitted',
    });
    expect(f.raw.sendProperty).not.toHaveBeenCalled();
    expect(JSON.stringify(f.snapshot())).not.toMatch(/private|do-not-retain/);
    offCommand();
    offProperty();
    f.emit(commands, command());
    f.emit(properties, property());
    expect(receivedCommands).toHaveBeenCalledTimes(1);
    expect(receivedProperties).toHaveBeenCalledTimes(1);
  },
);

test('two existing listeners share one receive observation, not two incoming events', async () => {
  const f = fixture();
  await f.client.connect();
  const first = jest.fn();
  const second = jest.fn();
  f.client.on('Commands', first);
  f.client.on('Commands', second);
  const incoming = command();
  f.emit('Commands', incoming);
  expect(first.mock.calls[0][0]).toBe(second.mock.calls[0][0]);
  expect(f.snapshot().history).toHaveLength(1);
  expect(f.raw.on).toHaveBeenCalledTimes(2);
});

test.each(['twin', 'patch', undefined])(
  'desired source %s is explicit and duplicate versions are not inferred away',
  async source => {
    const f = fixture();
    await f.client.connect();
    const listener = jest.fn();
    f.client.on('Properties', listener);
    f.emit('Properties', property({source}));
    f.emit('Properties', property({source}));
    expect(f.snapshot().history).toHaveLength(2);
    expect(f.snapshot().latest['desired-property']).toMatchObject({
      source: source ?? 'unknown',
      version: 3,
      outcome: 'observed',
    });
    await listener.mock.calls[0][0].ack('private ack body');
    expect(f.snapshot().latest['property-ack'].source).toBe(
      source ?? 'unknown',
    );
  },
);

test('unknown names and metadata remain unknown; no arbitrary cloud names or values survive', async () => {
  const f = fixture(false, null);
  await f.client.connect();
  f.client.on('Commands', () => {});
  f.client.on('Properties', () => {});
  f.emit('Commands', command({name: 'secret-command', requestId: undefined}));
  f.emit(
    'Properties',
    property({name: 'secret-property', source: undefined, version: NaN}),
  );
  await f.client.sendTelemetry({'private-payload-key': {coordinates: [1, 2]}});
  await f.client.sendProperty({'private-key': 'private-value'});
  expect(f.snapshot().latest.command).toMatchObject({
    name: null,
    correlation: null,
    identity: null,
  });
  expect(f.snapshot().latest['desired-property']).toMatchObject({
    name: null,
    source: 'unknown',
    version: null,
  });
  expect(f.snapshot().latest.telemetry.names).toEqual([]);
  expect(f.snapshot().latest['reported-property'].names).toEqual([]);
  expect(JSON.stringify(f.snapshot())).not.toMatch(
    /secret|private|coordinates/,
  );
});

test.each([
  ['123', '123'],
  [
    'c688bc6f-1dc8-4168-b48b-01f568860a24',
    'c688bc6f-1dc8-4168-b48b-01f568860a24',
  ],
  ['a'.repeat(64), 'a'.repeat(64)],
  ['a'.repeat(65), null],
  ['', null],
  ['https://blob/?sig=secret', null],
  ['SharedAccessSignature sr=secret', null],
  ['line\nbreak', null],
  [undefined, null],
])(
  'correlation admits only a bounded requestId category: %s',
  async (requestId, expected) => {
    const f = fixture();
    await f.client.connect();
    f.client.on('Commands', () => {});
    f.emit('Commands', command({requestId}));
    expect(f.snapshot().latest.command.correlation).toEqual(
      expected === null ? null : {category: 'requestId', value: expected},
    );
  },
);

test('incoming response and ack failures do not mean execution failed or erase earlier facts', async () => {
  const f = fixture();
  await f.client.connect();
  const cb = jest.fn();
  const pb = jest.fn();
  f.client.on('Commands', cb);
  f.client.on('Properties', pb);
  const failure = new ConnectionError('NETWORK_ERROR');
  const incoming = command({
    reply: jest.fn(async () => {
      throw failure;
    }),
  });
  const desired = property({
    ack: jest.fn(async () => {
      throw failure;
    }),
  });
  f.emit('Commands', incoming);
  f.emit('Properties', desired);
  const wrapped = cb.mock.calls[0][0];
  f.store.recordExecution(wrapped, 'completed');
  await expect(
    wrapped.reply(IIoTCCommandResponse.ERROR, 'private'),
  ).rejects.toBe(failure);
  await expect(pb.mock.calls[0][0].ack('private')).rejects.toBe(failure);
  expect(f.snapshot().latest['command-execution'].outcome).toBe('completed');
  expect(f.snapshot().latest['command-reply']).toMatchObject({
    response: 'error',
    outcome: 'failed',
    errorCode: 'NETWORK_ERROR',
  });
  expect(f.snapshot().latest['property-ack'].outcome).toBe('failed');
});

test.each([
  'cancel',
  'disconnect',
  'poll-loss',
  'completion-loss',
  'identity-change',
  'reconnect',
])(
  '%s discards session facts and all old async completions, callbacks and execution scopes',
  async reason => {
    const f = fixture();
    await f.client.connect();
    const commands = jest.fn();
    const properties = jest.fn();
    f.client.on('Commands', commands);
    f.client.on('Properties', properties);
    const replyGate = deferred();
    const ackGate = deferred();
    f.emit('Commands', command({reply: jest.fn(() => replyGate.promise)}));
    f.emit('Properties', property({ack: jest.fn(() => ackGate.promise)}));
    const wrapped = commands.mock.calls[0][0];
    const finish = f.store.beginExecution(wrapped);
    const reply = wrapped.reply(IIoTCCommandResponse.SUCCESS, '{}');
    const ack = properties.mock.calls[0][0].ack();
    const telemetryGate = deferred();
    const propertyGate = deferred();
    const twinGate = deferred();
    const uploadGate = deferred();
    f.raw.sendTelemetry.mockReturnValueOnce(telemetryGate.promise);
    f.raw.sendProperty.mockReturnValueOnce(propertyGate.promise);
    f.raw.fetchTwin.mockReturnValueOnce(twinGate.promise);
    f.raw.uploadFile.mockReturnValueOnce(uploadGate.promise);
    const telemetry = f.client.sendTelemetry({battery: 1});
    const report = f.client.sendProperty({readOnlyProp: 'private'});
    const twin = f.client.fetchTwin();
    const upload = f.client.uploadFile('private', 'image/jpeg', 'private');
    const generation = f.snapshot().generation;
    if (reason === 'cancel') {
      f.client.cancel();
    } else if (reason === 'disconnect') {
      await f.client.disconnect();
    } else if (reason === 'reconnect') {
      await f.client.connect();
    } else if (reason === 'identity-change') {
      f.identity({...identity, deviceId: 'other-device'});
    } else {
      f.online(false);
      if (reason === 'poll-loss') {
        expect(f.client.isConnected()).toBe(false);
      }
    }
    replyGate.resolve(f.submission);
    ackGate.resolve(f.submission);
    telemetryGate.resolve(f.submission);
    propertyGate.resolve(f.submission);
    twinGate.resolve(f.submission);
    uploadGate.resolve(f.upload);
    await Promise.all([reply, ack, telemetry, report, twin, upload]);
    finish('completed');
    f.store.recordExecution(wrapped, 'rejected');
    f.listeners[0].callback(command());
    f.listeners[1].callback(property());
    expect(commands).toHaveBeenCalledTimes(1);
    expect(properties).toHaveBeenCalledTimes(1);
    expect(f.snapshot().generation).not.toBe(generation);
    expect(f.snapshot().history).toEqual([]);
    expect(f.snapshot().latest).toEqual({});
  },
);

test('late failure after reset is still rejected but cannot mark a replacement session failed', async () => {
  const f = fixture();
  await f.client.connect();
  const gate = deferred();
  f.raw.uploadFile.mockReturnValueOnce(gate.promise);
  const old = f.client.uploadFile('x', 'image/jpeg', 'x').catch(error => error);
  f.client.cancel();
  await f.client.connect();
  await f.client.sendProperty({readOnlyProp: 'new'});
  const current = f.snapshot();
  const error = new ConnectionError('TIMEOUT');
  gate.reject(error);
  expect(await old).toBe(error);
  expect(f.snapshot()).toBe(current);
});

test('same-identity reconnect uses a fresh generation; only newly registered callbacks observe it', async () => {
  const f = fixture();
  await f.client.connect();
  const before = jest.fn();
  f.client.on('Commands', before);
  const incoming = command();
  f.emit('Commands', incoming);
  const oldCommand = before.mock.calls[0][0];
  const generation = f.snapshot().generation;
  await f.client.disconnect();
  await f.client.connect();
  const after = jest.fn();
  f.client.on('Commands', after);
  f.emit('Commands', incoming);
  expect(before).toHaveBeenCalledTimes(1);
  expect(after).toHaveBeenCalledTimes(1);
  expect(after.mock.calls[0][0]).not.toBe(oldCommand);
  expect(f.snapshot().generation).not.toBe(generation);
  expect(f.snapshot().latest.command.identity).toEqual({
    assignedHub: identity.assignedHub,
    deviceId: identity.deviceId,
    modelId: PHONE_MODEL_ID,
  });
  const g = fixture();
  await g.client.connect();
  expect(g.snapshot().generation).not.toBe(f.snapshot().generation);
});

test('cancelled or failed connect never reactivates on a late completion', async () => {
  const f = fixture();
  const gate = deferred();
  f.raw.connect.mockReturnValueOnce(gate.promise);
  const controller = new AbortController();
  const pending = f.client.connect({signal: controller.signal});
  controller.abort();
  f.online(true);
  gate.resolve(identity);
  expect(await pending).toBe(identity);
  await f.client.sendTelemetry({battery: 1});
  expect(f.snapshot().active).toBe(false);
  expect(f.snapshot().latest).toEqual({});
  f.raw.connect.mockRejectedValueOnce(new ConnectionError('CONNECT_FAILED'));
  await expect(f.client.connect()).rejects.toMatchObject({
    code: 'CONNECT_FAILED',
  });
  expect(f.snapshot().active).toBe(false);
  await f.client.connect();
  await f.client.sendTelemetry({battery: 2});
  expect(f.snapshot().latest.telemetry.outcome).toBe('submitted');
});

test('an SDK BUSY rejection does not supersede the original pending connect', async () => {
  const f = fixture();
  const gate = deferred();
  f.raw.connect
    .mockReturnValueOnce(gate.promise)
    .mockRejectedValueOnce(new ConnectionError('BUSY'));
  const connecting = f.client.connect();
  const generation = f.snapshot().generation;
  await expect(f.client.connect()).rejects.toMatchObject({code: 'BUSY'});
  f.online(true);
  gate.resolve(identity);
  await connecting;
  await f.client.fetchTwin();
  expect(f.snapshot().generation).toBe(generation);
  expect(f.snapshot().latest['twin-request'].outcome).toBe('submitted');
});

test('startup callbacks are recorded in the initial generation, before connect resolves', async () => {
  const f = fixture();
  const callback = jest.fn();
  f.client.on('Properties', callback);
  f.raw.connect.mockImplementationOnce(async () => {
    f.online(true);
    f.emit('Properties', property({source: 'twin'}));
    await callback.mock.calls[0][0].ack();
    return identity;
  });
  await f.client.connect();
  expect(f.snapshot().history.map(row => row.kind)).toEqual([
    'desired-property',
    'property-ack',
  ]);
  expect(
    f
      .snapshot()
      .history.every(row => row.generation === f.snapshot().generation),
  ).toBe(true);
});

test('work begun before the first connect never becomes current when that connect succeeds', async () => {
  const f = fixture();
  const gate = deferred();
  f.raw.sendTelemetry.mockReturnValueOnce(gate.promise);
  const previous = f.client.sendTelemetry({battery: 1});
  const finish = f.store.beginExecution(command());
  const active = f.store.capture();
  await f.client.connect();
  gate.resolve(f.submission);
  await previous;
  finish('completed');
  expect(active()).toBe(false);
  expect(f.snapshot().history).toEqual([]);
  expect(f.snapshot().latest).toEqual({});
});

test('cancel before first connect also invalidates pre-connect listener callbacks', async () => {
  const f = fixture();
  const listener = jest.fn();
  f.client.on('Commands', listener);
  f.client.cancel();
  await f.client.connect();
  f.emit('Commands', command());
  expect(listener).not.toHaveBeenCalled();
  expect(f.snapshot().history).toEqual([]);
});

test('telemetry failure remains a historical issue after the next successful sample', async () => {
  const f = fixture();
  await f.client.connect();
  f.raw.sendTelemetry.mockRejectedValueOnce(new ConnectionError('TIMEOUT'));
  await expect(f.client.sendTelemetry({battery: 10})).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  const failure = f.snapshot().latest.telemetry;
  expect(f.snapshot().history).toEqual([failure]);
  await f.client.sendTelemetry({battery: 20});
  expect(f.snapshot().latest.telemetry.outcome).toBe('submitted');
  expect(f.snapshot().history.filter(row => row.outcome === 'failed')).toEqual([
    failure,
  ]);
  expect(f.snapshot().history[0]).toBe(failure);
});

test('consecutive same-code telemetry failures coalesce without losing other channels or changing retained facts', async () => {
  const f = fixture();
  await f.client.connect();
  f.raw.sendTelemetry.mockRejectedValue(new ConnectionError('NETWORK_ERROR'));
  await expect(f.client.sendTelemetry({battery: 10})).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
  });
  const first = f.snapshot().latest.telemetry;
  await f.client.sendProperty({readOnlyProp: 'sample'});
  const reported = f.snapshot().latest['reported-property'];
  for (let index = 0; index < 150; index++) {
    await expect(
      f.client.sendTelemetry({battery: index}),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  }
  expect(f.snapshot().history).toEqual([first, reported]);
  expect(f.snapshot().history[0]).toBe(first);
  expect(f.snapshot().latest.telemetry.id).toBeGreaterThan(reported.id);
  expect(f.snapshot().latest.telemetry).toMatchObject({
    outcome: 'failed',
    errorCode: 'NETWORK_ERROR',
  });
  expect(f.snapshot().latest['reported-property']).toBe(reported);
});

test('a different error or successful telemetry result separates failure sequences', async () => {
  const f = fixture();
  await f.client.connect();
  const fail = async code => {
    f.raw.sendTelemetry.mockRejectedValueOnce(new ConnectionError(code));
    await expect(f.client.sendTelemetry({battery: 1})).rejects.toMatchObject({
      code,
    });
  };
  await fail('NETWORK_ERROR');
  await fail('NETWORK_ERROR');
  await fail('TIMEOUT');
  await fail('TIMEOUT');
  await f.client.sendTelemetry({battery: 2});
  await fail('TIMEOUT');
  expect(f.snapshot().history.map(row => row.errorCode)).toEqual([
    'NETWORK_ERROR',
    'TIMEOUT',
    'TIMEOUT',
  ]);
  expect(f.snapshot().history.map(row => row.id)).toEqual(
    [...f.snapshot().history].map(row => row.id).sort((a, b) => a - b),
  );
});

test('a repeated telemetry failure reenters history when its earlier representative was evicted', async () => {
  const f = fixture();
  await f.client.connect();
  f.raw.sendTelemetry.mockRejectedValue(new ConnectionError('TIMEOUT'));
  await expect(f.client.sendTelemetry({battery: 1})).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  const first = f.snapshot().latest.telemetry;
  for (let index = 0; index < OBSERVATION_LIMITS.history; index++) {
    await f.client.fetchTwin();
  }
  expect(f.snapshot().history.some(row => row.id === first.id)).toBe(false);
  await expect(f.client.sendTelemetry({battery: 2})).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  const retained = f.snapshot().latest.telemetry;
  expect(f.snapshot().history.at(-1)).toBe(retained);
  await expect(f.client.sendTelemetry({battery: 3})).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  expect(f.snapshot().history.at(-1)).toBe(retained);
  expect(f.snapshot().history.length).toBeLessThanOrEqual(
    OBSERVATION_LIMITS.history,
  );
  expect(f.snapshot().bytes).toBeLessThanOrEqual(OBSERVATION_LIMITS.bytes);
});

test('different telemetry failures obey history limits and reset between generations', async () => {
  const f = fixture();
  await f.client.connect();
  for (let index = 0; index < 150; index++) {
    const code = index % 2 ? 'TIMEOUT' : 'NETWORK_ERROR';
    f.raw.sendTelemetry.mockRejectedValueOnce(new ConnectionError(code));
    await expect(
      f.client.sendTelemetry({battery: index}),
    ).rejects.toMatchObject({code});
  }
  expect(f.snapshot().history.length).toBeLessThanOrEqual(
    OBSERVATION_LIMITS.history,
  );
  expect(f.snapshot().bytes).toBeLessThanOrEqual(OBSERVATION_LIMITS.bytes);
  f.client.cancel();
  expect(f.snapshot().history).toEqual([]);
  await f.client.connect();
  f.raw.sendTelemetry.mockRejectedValueOnce(new ConnectionError('TIMEOUT'));
  await expect(f.client.sendTelemetry({battery: 1})).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  expect(f.snapshot().history).toEqual([f.snapshot().latest.telemetry]);
});

test('history and total serialized store obey count/byte/entry limits; successful telemetry never floods history', async () => {
  const f = fixture();
  await f.client.connect();
  for (let index = 0; index < 130; index++) {
    await f.client.fetchTwin();
  }
  expect(f.snapshot().history).toHaveLength(OBSERVATION_LIMITS.history);
  const count = f.snapshot().history.length;
  for (let index = 0; index < 250; index++) {
    await f.client.sendTelemetry({battery: index, private: 'x'.repeat(8000)});
  }
  expect(f.snapshot().history).toHaveLength(count);
  expect(f.snapshot().history.some(row => row.kind === 'telemetry')).toBe(
    false,
  );

  const large = fixture(false, {
    assignedHub: 'a'.repeat(253),
    deviceId: 'd'.repeat(128),
    modelId: `dtmi:${'m'.repeat(249)};1`,
  });
  await large.client.connect();
  large.client.on('Commands', () => {});
  for (let index = 0; index < 150; index++) {
    large.emit('Commands', command({requestId: 'a'.repeat(64)}));
  }
  const snapshot = large.snapshot();
  expect(snapshot.history.length).toBeLessThan(OBSERVATION_LIMITS.history);
  expect(snapshot.bytes).toBeLessThanOrEqual(OBSERVATION_LIMITS.bytes);
  expect(
    Buffer.byteLength(JSON.stringify(snapshot), 'utf8'),
  ).toBeLessThanOrEqual(snapshot.bytes);
  for (const row of [...snapshot.history, ...Object.values(snapshot.latest)]) {
    expect(Buffer.byteLength(JSON.stringify(row), 'utf8')).toBeLessThanOrEqual(
      OBSERVATION_LIMITS.entryBytes,
    );
  }
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.latest)).toBe(true);
  expect(Object.isFrozen(snapshot.history)).toBe(true);
  expect(Object.isFrozen(snapshot.latest.command.identity)).toBe(true);
});

test('identity metadata is bounded without retaining secret-shaped or malformed strings', async () => {
  const f = fixture(false, {
    assignedHub: 'https://private.blob/?sig=secret',
    deviceId: 'a'.repeat(10000),
    modelId: 'SharedAccessSignature sr=secret',
  });
  await f.client.connect();
  await f.client.fetchTwin();
  expect(f.snapshot().identity).toEqual({
    assignedHub: null,
    deviceId: null,
    modelId: null,
  });
  expect(JSON.stringify(f.snapshot())).not.toMatch(/private|sig=|SharedAccess/);
});

test('safe name projection never executes payload getters', async () => {
  const f = fixture();
  await f.client.connect();
  const getter = jest.fn(() => {
    throw new Error('private getter');
  });
  const payload = Object.defineProperty({}, 'battery', {get: getter});
  await f.client.sendTelemetry(payload);
  expect(getter).not.toHaveBeenCalled();
  expect(f.snapshot().latest.telemetry.names).toEqual([]);
});

test('useSyncExternalStore supplies stable null snapshots, switches clients and releases listeners', async () => {
  const first = fixture();
  const second = fixture(true);
  await first.client.connect();
  await second.client.connect();
  let snapshot;
  let renders = 0;
  let tree;
  function Probe({client}) {
    snapshot = useObservationSnapshot(client);
    renders++;
    return null;
  }
  try {
    act(() => {
      tree = renderer.create(<Probe client={null} />);
    });
    const empty = snapshot;
    act(() => {
      tree.update(<Probe client={null} />);
    });
    expect(snapshot).toBe(empty);
    act(() => {
      tree.update(<Probe client={first.client} />);
    });
    expect(snapshot).toBe(first.snapshot());
    await act(async () => {
      await first.client.sendProperty({readOnlyProp: 'x'});
    });
    expect(snapshot.latest['reported-property'].outcome).toBe('submitted');
    act(() => {
      tree.update(<Probe client={second.client} />);
    });
    expect(snapshot).toBe(second.snapshot());
    const before = renders;
    await act(async () => {
      await first.client.fetchTwin();
    });
    expect(renders).toBe(before);
    await act(async () => {
      await second.client.fetchTwin();
    });
    expect(snapshot.latest['twin-request']).toMatchObject({
      simulated: true,
      outcome: 'simulated',
    });
    act(() => {
      second.client.cancel();
    });
    expect(snapshot.history).toEqual([]);
  } finally {
    act(() => {
      tree?.unmount();
    });
  }
});
