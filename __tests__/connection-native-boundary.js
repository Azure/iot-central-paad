// Keep the vendor, its nested Paho dependency, and the app transport real.
jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {...actual, requireNativeModule: jest.fn(actual.requireNativeModule)};
});
jest.mock('expo/fetch', () => ({
  fetch: jest.fn(() => {
    throw new Error('Unexpected HTTP request');
  }),
}));

const {Buffer} = require('buffer');
const {requireNativeModule} = require('expo-modules-core');
const {fetch: httpFetch} = require('expo/fetch');
const {createDeviceClient, IOTC_EVENTS} = require('../src/connection');
const {secureWebSocket} = require('../src/platform/SecureWebSocket');
const vendor = require('react-native-azure-iotcentral-client');
const paho = require('react-native-azure-iotcentral-client/node_modules/react-native-paho-mqtt');

const identity = {
  assignedHub: 'synthetic.azure-devices.net',
  deviceId: 'native-boundary-device',
  modelId: 'dtmi:azureiot:PhoneAsADevice;2',
};
const credentials = {
  connectionString:
    `HostName=${identity.assignedHub};DeviceId=${identity.deviceId};` +
    `SharedAccessKey=${Buffer.alloc(32, 7).toString('base64')}`,
};

function mqttString(value) {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([
    Buffer.from([bytes.length >> 8, bytes.length & 255]),
    bytes,
  ]);
}

function packet(header, body) {
  let length = body.length;
  const remaining = [];
  do {
    const digit = length % 128;
    length = Math.floor(length / 128);
    remaining.push(digit | (length ? 128 : 0));
  } while (length);
  return Buffer.concat([Buffer.from([header, ...remaining]), body]);
}

// Decode only public CONNECT fields: never retain or print its SAS password.
function decodeFrame(base64) {
  if (typeof base64 !== 'string') {
    throw new Error('Native MQTT frames must be base64-encoded binary');
  }
  const bytes = Buffer.from(base64, 'base64');
  let offset = 1;
  let remaining = 0;
  let multiplier = 1;
  let digit;
  do {
    digit = bytes[offset++];
    remaining += (digit & 127) * multiplier;
    multiplier *= 128;
  } while (digit & 128);
  if (offset + remaining !== bytes.length) {
    throw new Error('Invalid MQTT binary frame length');
  }
  const string = () => {
    const length = bytes.readUInt16BE(offset);
    offset += 2;
    const value = bytes.toString('utf8', offset, offset + length);
    offset += length;
    return value;
  };
  const type = bytes[0] >> 4;
  if (type === 1) {
    const protocol = string();
    const version = bytes[offset++];
    const flags = bytes[offset++];
    offset += 2; // Keepalive.
    return {
      type,
      protocol,
      version,
      flags,
      clientId: string(),
      userName: string(),
    };
  }
  if (type === 8) {
    const id = bytes.readUInt16BE(offset);
    offset += 2;
    const topic = string();
    return {type, id, topic, qos: bytes[offset]};
  }
  if (type === 3) {
    const topic = string();
    return {
      type,
      topic,
      qos: (bytes[0] >> 1) & 3,
      retained: Boolean(bytes[0] & 1),
      payload: bytes.toString('utf8', offset),
    };
  }
  return {type};
}

function createBroker() {
  const listeners = new Set();
  const sockets = new Set();
  const connections = [];
  const frames = [];
  const closes = [];
  const emit = (id, type, fields = {}) => {
    for (const listener of [...listeners]) {
      listener({id, type, ...fields});
    }
  };
  const receive = (id, bytes) => {
    Promise.resolve().then(() => {
      if (sockets.has(id)) {
        emit(id, 'message', {data: bytes.toString('base64')});
      }
    });
  };
  const publish = (topic, payload) => {
    receive(
      connections.at(-1).id,
      packet(0x30, Buffer.concat([mqttString(topic), Buffer.from(payload)])),
    );
  };
  const broker = {
    listeners,
    sockets,
    connections,
    frames,
    closes,
    emit,
    publish,
    acknowledge: true,
    autoOpen: true,
    returnCode: 0,
    native: {
      addListener(name, listener) {
        expect(name).toBe('socketEvent');
        listeners.add(listener);
        return {remove: () => listeners.delete(listener)};
      },
      connect(id, url, protocols) {
        connections.push({id, url, protocols});
        sockets.add(id);
        if (broker.autoOpen) {
          Promise.resolve().then(() => emit(id, 'open', {protocol: 'mqtt'}));
        }
      },
      send(id, base64) {
        const frame = decodeFrame(base64);
        frames.push(frame);
        if (!broker.acknowledge) {
          return;
        }
        if (frame.type === 1) {
          receive(id, Buffer.from([0x20, 2, 0, broker.returnCode]));
        } else if (frame.type === 8) {
          receive(id, Buffer.from([0x90, 3, frame.id >> 8, frame.id & 255, 0]));
        } else if (frame.type === 12) {
          receive(id, Buffer.from([0xd0, 0]));
        }
      },
      close(id, code, reason) {
        closes.push({id, code, reason});
        sockets.delete(id);
        Promise.resolve().then(() => emit(id, 'close', {code, wasClean: true}));
      },
    },
  };
  return broker;
}

let broker;
let client;
// The real native-module loader caches its binding between connections.
const nativeBoundary = {
  addListener: (...args) => broker.native.addListener(...args),
  connect: (...args) => broker.native.connect(...args),
  send: (...args) => broker.native.send(...args),
  close: (...args) => broker.native.close(...args),
};
const stages = jest.fn();
const flush = () => jest.advanceTimersByTimeAsync(1);
const publications = () => broker.frames.filter(frame => frame.type === 3);
const expectTerminal = () => {
  expect(client.isConnected()).toBe(false);
  expect(broker.listeners.size).toBe(0);
  expect(broker.sockets.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
};
const connect = async () => {
  const result = client.connect();
  await flush();
  return result;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  broker = createBroker();
  requireNativeModule.mockImplementation(name => {
    if (name !== 'PaadDevice') {
      throw new Error('Unexpected native module');
    }
    return nativeBoundary;
  });
  client = createDeviceClient(credentials, {secureWebSocket, onStage: stages});
});

afterEach(async () => {
  await client.disconnect();
  await flush();
  expect(broker.listeners.size).toBe(0);
  expect(broker.sockets.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  expect(httpFetch).not.toHaveBeenCalled();
  for (const transport of ['fetch', 'XMLHttpRequest', 'WebSocket']) {
    expect(global[transport]).not.toHaveBeenCalled();
  }
  jest.useRealTimers();
});

test('real vendor and bundled Paho cross the canonical native binary boundary', async () => {
  expect(
    require('react-native-azure-iotcentral-client/package.json').version,
  ).toBe('1.1.10');
  expect(jest.isMockFunction(vendor.IoTCClient)).toBe(false);
  expect(jest.isMockFunction(paho.Client)).toBe(false);
  expect(await connect()).toEqual(identity);
  expect(client.identity).toEqual(identity);
  expect(client.id).toBe(identity.deviceId);
  expect(client.isConnected()).toBe(true);
  expect(broker.connections).toEqual([
    {
      id: expect.any(String),
      url: `wss://${identity.assignedHub}/$iothub/websocket`,
      protocols: ['mqtt'],
    },
  ]);
  expect(broker.frames.filter(frame => frame.type === 1)).toEqual([
    {
      type: 1,
      protocol: 'MQTT',
      version: 4,
      flags: 0xc2,
      clientId: identity.deviceId,
      userName: `${identity.assignedHub}/${
        identity.deviceId
      }/?api-version=2021-04-12&model-id=${encodeURIComponent(
        identity.modelId,
      )}`,
    },
  ]);
  expect(broker.frames.filter(frame => frame.type === 8)).toEqual([
    {type: 8, id: expect.any(Number), topic: '$iothub/twin/res/#', qos: 0},
    {
      type: 8,
      id: expect.any(Number),
      topic: '$iothub/twin/PATCH/properties/desired/#',
      qos: 0,
    },
    {type: 8, id: expect.any(Number), topic: '$iothub/methods/POST/#', qos: 0},
  ]);
  expect(publications()).toEqual([
    {
      type: 3,
      topic: '$iothub/twin/GET/?$rid=1',
      payload: '',
      qos: 0,
      retained: false,
    },
  ]);
  expect(
    await client.sendTelemetry(
      {temperature: 0, enabled: false},
      {'$.sub': 'sensors', label: 'a b'},
    ),
  ).toEqual({delivery: 'submitted'});
  expect(publications().at(-1)).toEqual({
    type: 3,
    topic: `devices/${identity.deviceId}/messages/events/%24.sub=sensors&label=a%20b`,
    payload: '{"temperature":0,"enabled":false}',
    qos: 0,
    retained: false,
  });
  expect(
    await client.sendProperty({sensors: {__t: 'c', label: 'synthetic'}}),
  ).toEqual({delivery: 'submitted'});
  expect(publications().at(-1)).toMatchObject({
    topic: '$iothub/twin/PATCH/properties/reported/?$rid=2',
    payload: '{"sensors":{"__t":"c","label":"synthetic"}}',
    qos: 0,
    retained: false,
  });
  await client.disconnect();
  await flush();
  expect(broker.closes).toHaveLength(1);
  expectTerminal();
});

test.each([
  ['$iothub/twin/res/200/?$rid=1', true],
  ['$iothub/twin/PATCH/properties/desired/?$version=3', false],
])(
  'component acknowledgements survive real Paho decoding: %s',
  async (topic, twin) => {
    const properties = jest.fn();
    client.on(IOTC_EVENTS.Properties, properties);
    await connect();
    const desired = {
      $version: 3,
      sensors: {__t: 'c', telemetryInterval: 10, enabled: false, value: 0},
    };
    broker.publish(topic, JSON.stringify(twin ? {desired} : desired));
    await flush();
    expect(properties).toHaveBeenCalledTimes(1);
    const update = properties.mock.calls[0][0];
    expect(update).toMatchObject({
      name: 'sensors',
      version: 3,
      value: desired.sensors,
    });
    expect(await update.ack()).toEqual({delivery: 'submitted'});
    const published = publications().at(-1);
    expect(published.topic).toBe(
      '$iothub/twin/PATCH/properties/reported/?$rid=2',
    );
    const ack = value => ({value, ac: 200, av: 3, ad: 'Property applied'});
    expect(JSON.parse(published.payload)).toEqual({
      sensors: {
        __t: 'c',
        telemetryInterval: ack(10),
        enabled: ack(false),
        value: ack(0),
      },
    });
  },
);

test('CONNACK refusal fails once without retry or outstanding timers', async () => {
  broker.returnCode = 5;
  const result = client.connect().catch(error => error);
  await flush();
  expect(await result).toMatchObject({code: 'CONNECT_FAILED'});
  expect(client.isConnected()).toBe(false);
  await jest.advanceTimersByTimeAsync(120000);
  expect(broker.connections).toHaveLength(1);
  expect(broker.frames.filter(frame => frame.type === 1)).toHaveLength(1);
  expectTerminal();
});

test('missing CONNACK respects the owner deadline and clears Paho timers', async () => {
  broker.acknowledge = false;
  const result = client.connect({timeoutMs: 50}).catch(error => error);
  await jest.advanceTimersByTimeAsync(51);
  expect(await result).toMatchObject({code: 'TIMEOUT'});
  expect(broker.connections).toHaveLength(1);
  expect(broker.closes).toHaveLength(1);
  expectTerminal();
});

test.each([false, true])(
  'cancellation closes native socket (opened=%s)',
  async opened => {
    broker.autoOpen = opened;
    broker.acknowledge = false;
    const result = client.connect().catch(error => error);
    await flush();
    expect(broker.connections).toHaveLength(1);
    client.cancel();
    expect(await result).toMatchObject({code: 'CANCELLED'});
    await flush();
    expect(broker.closes).toHaveLength(1);
    expectTerminal();
  },
);

test('native transport error after connection is terminal and redacted', async () => {
  await connect();
  broker.emit(broker.connections[0].id, 'error', {
    message: 'synthetic private token',
  });
  await flush();
  expect(client.isConnected()).toBe(false);
  expect(stages.mock.calls.at(-1)[0]).toBe('error');
  expect(stages.mock.calls.at(-1)[1]).toMatchObject({code: 'CONNECTION_LOST'});
  expect(stages.mock.calls.at(-1)[1].message).toBe(
    'The cloud connection was interrupted.',
  );
  expect(String(stages.mock.calls.at(-1)[1])).not.toContain('private token');
  await expect(client.sendTelemetry({x: 1})).rejects.toMatchObject({
    code: 'NOT_CONNECTED',
  });
  await jest.advanceTimersByTimeAsync(120000);
  expect(broker.connections).toHaveLength(1);
  expectTerminal();
});

test('native transport failure before CONNACK is not mislabelled as a lost established session', async () => {
  broker.acknowledge = false;
  const pending = client.connect().catch(error => error);
  await flush();
  broker.emit(broker.connections[0].id, 'error', {
    message: 'synthetic private token',
  });
  await flush();
  expect(await pending).toMatchObject({code: 'CONNECT_FAILED'});
  expect(stages.mock.calls.some(([, error]) => error?.code === 'CONNECTION_LOST')).toBe(false);
  expect(client.isConnected()).toBe(false);
  expectTerminal();
});
