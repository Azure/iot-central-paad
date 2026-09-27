jest.mock('expo/fetch', () => ({fetch: jest.fn()}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock(
  'react-native-azure-iotcentral-client/node_modules/react-native-paho-mqtt',
  () => {
    const instances = [];
    class Client {
      constructor(options) {
        this.options = options;
        this.listeners = {};
        this.online = false;
        this._client = {
          webSocket: undefined,
          socket: {readyState: 0, close: jest.fn()},
          _disconnected: jest.fn(() => {
            if (this.rejectConnect) {
              this.rejectConnect(new Error('synthetic private token'));
            }
            this.online = false;
            this.listeners.connectionLost?.forEach(fn => fn({errorCode: 0}));
          }),
        };
        this.connect = jest.fn(async () => {
          if (Client.fail) {
            throw new Error('synthetic private token');
          }
          if (Client.hang) {
            return new Promise((_, reject) => {
              this.rejectConnect = reject;
            });
          }
          this.online = true;
        });
        this.subscribe = jest.fn(async () => {});
        this.send = jest.fn();
        instances.push(this);
      }
      on(event, callback) {
        (this.listeners[event] ??= []).push(callback);
      }
    }
    class Message {
      constructor(payload) {
        this.payloadString = payload;
      }
    }
    return {Client, Message, instances};
  },
);

const {
  Client,
  instances,
} = require('react-native-azure-iotcentral-client/node_modules/react-native-paho-mqtt');
const {
  createDeviceClient,
  IOTC_EVENTS,
  IIoTCCommandResponse,
} = require('../src/connection');
const {observeClient, getObservationStore} = require('../src/observation');
const key = Buffer.alloc(32, 7).toString('base64');
const credentials = {
  connectionString: `HostName=synthetic.azure-devices.net;DeviceId=actual-id;SharedAccessKey=${key}`,
};
const secureWebSocket = {
  implementation: class SyntheticSocket {},
  rejectsRedirects: true,
};
beforeEach(() => {
  jest.useFakeTimers();
  global.WebSocket = class UnusedSocket {};
  Client.fail = false;
  Client.hang = false;
  instances.length = 0;
});
afterEach(() => {
  jest.useRealTimers();
});

test('actual vendor adapter sends to assigned identity with model and no retry', async () => {
  const client = createDeviceClient(credentials, {secureWebSocket});
  await client.connect();
  const mqtt = instances[0];
  expect(mqtt.options.uri).toBe(
    'wss://synthetic.azure-devices.net:443/$iothub/websocket',
  );
  expect(mqtt.options.clientId).toBe('actual-id');
  expect(mqtt._client.webSocket).toBe(secureWebSocket.implementation);
  expect(mqtt.connect).toHaveBeenCalledTimes(1);
  expect(mqtt.connect.mock.calls[0][0].userName).toBe(
    'synthetic.azure-devices.net/actual-id/?api-version=2021-04-12&model-id=dtmi%3Aazureiot%3APhoneAsADevice%3B2',
  );
  expect(mqtt.connect.mock.calls[0][0].delay).toBe(0);
  expect(mqtt.subscribe.mock.calls.every(call => call[1].timeout === 0)).toBe(
    true,
  );
  expect(
    await client.sendTelemetry({x: 1}, {'$.sub': 'sensors', second: 'a b'}),
  ).toEqual({delivery: 'submitted'});
  expect(mqtt.send).toHaveBeenLastCalledWith(
    'devices/actual-id/messages/events/%24.sub=sensors&second=a%20b',
    '{"x":1}',
    0,
    false,
  );
  await client.disconnect();
  expect(jest.getTimerCount()).toBe(0);
  expect(mqtt._client._disconnected).toHaveBeenCalledTimes(1);
});

test('stock redirect-following WebSocket is not silently accepted', async () => {
  await expect(createDeviceClient(credentials).connect()).rejects.toMatchObject(
    {code: 'SECURE_TRANSPORT_REQUIRED'},
  );
  expect(instances[0].connect).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('vendor failure does not retry, falsely connect, or leak the raw error', async () => {
  Client.fail = true;
  const client = createDeviceClient(credentials, {secureWebSocket});
  const error = await client.connect().catch(e => e);
  expect(error.code).toBe('CONNECT_FAILED');
  expect(String(error)).not.toContain('private token');
  await jest.advanceTimersByTimeAsync(120000);
  expect(instances[0].connect).toHaveBeenCalledTimes(1);
  expect(client.isConnected()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test('cancellation closes a CONNECTING socket and removes all vendor timers', async () => {
  Client.hang = true;
  const client = createDeviceClient(credentials, {secureWebSocket});
  const result = client.connect().catch(e => e);
  await jest.advanceTimersByTimeAsync(1);
  client.cancel();
  expect(await result).toMatchObject({code: 'CANCELLED'});
  expect(instances[0]._client.socket.close).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('connection loss stays terminal until the owner explicitly reconnects', async () => {
  const stages = jest.fn();
  const client = createDeviceClient(credentials, {
    secureWebSocket,
    onStage: stages,
  });
  await client.connect();
  instances[0].listeners.connectionLost.forEach(fn =>
    fn({errorCode: 1, errorMessage: key}),
  );
  await jest.advanceTimersByTimeAsync(120000);
  expect(client.isConnected()).toBe(false);
  expect(instances[0].connect).toHaveBeenCalledTimes(1);
  expect(stages.mock.calls.at(-1)[0]).toBe('error');
  await expect(client.sendTelemetry({x: 1})).rejects.toMatchObject({
    code: 'NOT_CONNECTED',
  });
  expect(jest.getTimerCount()).toBe(0);
});

test('properties preserve false/zero and command replies truthfully mean submitted', async () => {
  const client = createDeviceClient(credentials, {secureWebSocket});
  const commands = jest.fn();
  const properties = jest.fn();
  client.on(IOTC_EVENTS.Commands, commands);
  client.on(IOTC_EVENTS.Properties, properties);
  await client.connect();
  const message = instances[0].listeners.messageReceived[0];
  message({
    destinationName: '$iothub/twin/PATCH/properties/desired/?$version=3',
    payloadString: JSON.stringify({$version: 3, setting: {value: false}}),
  });

  expect(properties.mock.calls[0][0].value).toBe(false);
  expect(properties.mock.calls[0][0].source).toBe('patch');
  expect(await properties.mock.calls[0][0].ack()).toEqual({
    delivery: 'submitted',
  });
  message({
    destinationName: '$iothub/methods/POST/lightOn/?$rid=123',
    payloadString: '{"pulses":1}',
  });
  expect(commands.mock.calls[0][0]).toMatchObject({
    name: 'lightOn',
    requestPayload: '{"pulses":1}',
    requestId: '123',
  });
  expect(
    await commands.mock.calls[0][0].reply(IIoTCCommandResponse.SUCCESS, '{}'),
  ).toEqual({delivery: 'submitted'});
  expect(instances[0].send).toHaveBeenLastCalledWith(
    '$iothub/methods/res/200/?$rid=123',
    '{}',
    0,
    false,
  );
});

test.each([
  ['$iothub/twin/PATCH/properties/desired/?$version=3', false],
  ['$iothub/twin/res/200/?$rid=1', true],
])(
  'acknowledges writable PnP component properties from %s',
  async (topic, twin) => {
    const client = createDeviceClient(credentials, {secureWebSocket});
    const properties = jest.fn();
    client.on(IOTC_EVENTS.Properties, properties);
    await client.connect();
    const desired = {
      $version: 3,
      sensors: {__t: 'c', telemetryInterval: 10, enabled: false, value: 0},
    };
    instances[0].listeners.messageReceived[0]({
      destinationName: topic,
      payloadString: JSON.stringify(twin ? {desired} : desired),
    });
    const update = properties.mock.calls[0][0];
    expect(update.value).toEqual(desired.sensors);
    expect(update.source).toBe(twin ? 'twin' : 'patch');
    await update.ack();
    const [destination, payload] = instances[0].send.mock.calls.at(-1);
    expect(destination).toMatch(
      /^\$iothub\/twin\/PATCH\/properties\/reported\//,
    );
    const ack = value => ({value, ac: 200, av: 3, ad: 'Property applied'});
    expect(JSON.parse(payload)).toEqual({
      sensors: {
        __t: 'c',
        telemetryInterval: ack(10),
        enabled: ack(false),
        value: ack(0),
      },
    });
    await client.disconnect();
    expect(jest.getTimerCount()).toBe(0);
  },
);

test('observed real adapter preserves startup sends/subscriptions and distinguishes initial twin from patches', async () => {
  const baseline = createDeviceClient(credentials, {secureWebSocket});
  await baseline.connect();
  const startupSendCount = instances[0].send.mock.calls.length;
  const startupSubscriptionCount = instances[0].subscribe.mock.calls.length;
  await baseline.disconnect();

  const client = observeClient(
    createDeviceClient(credentials, {secureWebSocket}),
    false,
  );
  const received = jest.fn();
  client.on(IOTC_EVENTS.Properties, received);
  await client.connect();
  const mqtt = instances[1];
  expect(mqtt.send).toHaveBeenCalledTimes(startupSendCount);
  expect(mqtt.subscribe).toHaveBeenCalledTimes(startupSubscriptionCount);
  expect(mqtt.connect).toHaveBeenCalledTimes(1);
  const store = getObservationStore(client);
  const message = mqtt.listeners.messageReceived[0];
  message({
    destinationName: '$iothub/twin/res/200/?$rid=1',
    payloadString: JSON.stringify({
      desired: {$version: 4, writeableProp: 'private initial value'},
    }),
  });
  expect(store.getSnapshot().latest['desired-property']).toMatchObject({
    source: 'twin',
    version: 4,
    outcome: 'observed',
  });
  await received.mock.calls[0][0].ack();
  expect(store.getSnapshot().latest['property-ack']).toMatchObject({
    source: 'twin',
    outcome: 'submitted',
  });
  message({
    destinationName: '$iothub/twin/PATCH/properties/desired/?$version=4',
    payloadString: JSON.stringify({
      $version: 4,
      writeableProp: 'private patch value',
    }),
  });
  expect(store.getSnapshot().latest['desired-property']).toMatchObject({
    source: 'patch',
    version: 4,
  });
  await client.fetchTwin();
  expect(store.getSnapshot().latest['twin-request'].outcome).toBe('submitted');
  expect(JSON.stringify(store.getSnapshot())).not.toContain('private');
  mqtt.listeners.connectionLost.forEach(callback => callback({errorCode: 1}));
  expect(client.isConnected()).toBe(false);
  expect(store.getSnapshot().history).toEqual([]);
  expect(store.getSnapshot().latest).toEqual({});
  await client.disconnect();
  expect(jest.getTimerCount()).toBe(0);
});
