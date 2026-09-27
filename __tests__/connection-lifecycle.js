import React, {useContext} from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import StorageProvider, {StorageContext} from '../src/contexts/storage';
import IoTCProvider, {IoTCContext} from '../src/contexts/iotc';
import {useConnectIoTCentralClient, useSimulation} from '../src/hooks/iotc';
import {
  createDeviceClient,
  ConnectionError,
  IOTC_EVENTS,
  IIoTCCommandResponse,
  PHONE_MODEL_ID,
} from '../src/connection';
import App from '../src/App';
import {getObservationStore} from '../src/observation';

jest.mock('../src/connection/client', () => ({
  createDeviceClient: jest.fn(),
}));

// Keep App/Navigation and their providers real; the leaf screen exposes controls.
let mockAppCapture;
jest.mock('../src/Registration', () => ({
  Registration: function RegistrationProbe() {
    const React = require('react');
    const {StorageContext} = require('../src/contexts/storage');
    const {useConnectIoTCentralClient} = require('../src/hooks/iotc');
    mockAppCapture({
      connection: useConnectIoTCentralClient(),
      storage: React.useContext(StorageContext),
    });
    return null;
  },
}));

const credentials = {
  scopeId: '0ne12345678',
  deviceId: 'connection-lifecycle',
  deviceKey: Buffer.alloc(32, 2).toString('base64'),
};
const assignedIdentity = Object.freeze({
  assignedHub: 'lifecycle.azure-devices.net',
  deviceId: 'assigned-lifecycle-phone',
  registrationId: credentials.deviceId,
  modelId: PHONE_MODEL_ID,
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
const candidate = gate => {
  let connected = false;
  let identity = null;
  const commands = new Set();
  const properties = new Set();
  const submission = Object.freeze({delivery: 'submitted'});
  const upload = Object.freeze({delivery: 'acknowledged', status: 201});
  const ensureConnected = () => {
    if (!connected) {
      throw new ConnectionError('NOT_CONNECTED');
    }
  };
  const submit = async () => {
    ensureConnected();
    return submission;
  };
  return {
    get id() {
      return identity?.deviceId ?? credentials.deviceId;
    },
    get identity() {
      return identity;
    },
    connect: jest.fn(async ({signal} = {}) => {
      const assigned = gate ? await gate.promise : assignedIdentity;
      if (signal?.aborted) {
        throw new ConnectionError('CANCELLED');
      }
      identity = assigned;
      connected = true;
      return identity;
    }),
    disconnect: jest.fn(async () => {
      connected = false;
    }),
    cancel: jest.fn(() => {
      connected = false;
    }),
    isConnected: jest.fn(() => connected),
    sendTelemetry: jest.fn(submit),
    sendProperty: jest.fn(submit),
    fetchTwin: jest.fn(submit),
    uploadFile: jest.fn(async () => {
      ensureConnected();
      return upload;
    }),
    on: jest.fn((event, callback) => {
      let listeners;
      if (event === IOTC_EVENTS.Commands || event === 'Commands') {
        listeners = commands;
      } else if (event === IOTC_EVENTS.Properties || event === 'Properties') {
        listeners = properties;
      } else {
        throw new ConnectionError('OPERATION_FAILED');
      }
      listeners.add(callback);
      return jest.fn(() => {
        listeners.delete(callback);
      });
    }),
  };
};
const expectObserved = (client, original) => {
  expect(client).not.toBe(original);
  expect(getObservationStore(original)).toBeNull();
  expect(original.identity).toBe(assignedIdentity);
  expect(client.identity).toBe(original.identity);
  expect(client.id).toBe(assignedIdentity.deviceId);
  expect(client.isConnected()).toBe(true);
  expect(getObservationStore(client).getSnapshot()).toMatchObject({
    active: true,
    simulated: false,
    identity: {
      assignedHub: assignedIdentity.assignedHub,
      deviceId: assignedIdentity.deviceId,
      modelId: assignedIdentity.modelId,
    },
  });
};

describe('connection lifecycle through real providers', () => {
  let tree;
  let consumers;
  let appControls;
  const Probe = ({index}) => {
    consumers[index] = {
      connection: useConnectIoTCentralClient(),
      simulation: useSimulation(),
      storage: useContext(StorageContext),
      central: useContext(IoTCContext),
    };
    return null;
  };
  const mount = async () => {
    await act(async () => {
      tree = renderer.create(
        <StorageProvider>
          <IoTCProvider>
            <Probe index={0} />
            <Probe index={1} />
          </IoTCProvider>
        </StorageProvider>,
      );
    });
  };
  const status = (index = 0) => consumers[index].connection[3];
  const start = async (index = 0, input = credentials, options) => {
    let result;
    await act(async () => {
      result = consumers[index].connection[0](input, options);
    });
    return {result};
  };

  beforeEach(() => {
    tree = undefined;
    consumers = [];
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createDeviceClient.mockReset();
    Keychain.getGenericPassword.mockReset().mockResolvedValue(false);
    Keychain.setGenericPassword.mockReset().mockResolvedValue(true);
    Keychain.resetGenericPassword.mockReset().mockResolvedValue(true);
    mockAppCapture = value => {
      appControls = value;
    };
  });

  afterEach(async () => {
    try {
      await act(async () => tree?.unmount());
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      jest.runAllTicks();
      expect(jest.getTimerCount()).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(global.XMLHttpRequest).not.toHaveBeenCalled();
      expect(global.WebSocket).not.toHaveBeenCalled();
      expect(
        JSON.stringify(console.log.mock.calls).includes(credentials.deviceKey),
      ).toBe(false);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  });

  it('serializes requests across TWO consumers and connects before persisting or publishing', async () => {
    const connection = deferred();
    const write = deferred();
    const device = candidate(connection);
    createDeviceClient.mockReturnValue(device);
    Keychain.setGenericPassword.mockImplementationOnce(() => write.promise);
    await mount();
    const first = await start();
    expect(status().loading).toBe(true);
    expect(status(1).loading).toBe(true);
    expect(status().client).toBeNull();
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    const second = await start(1);
    expect((await second.result).error.code).toBe('BUSY');
    expect(createDeviceClient).toHaveBeenCalledTimes(1);
    expect(device.connect).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      cleanSession: true,
      timeoutMs: 90000,
    });
    await act(async () => connection.resolve(assignedIdentity));
    expect(await device.connect.mock.results[0].value).toBe(assignedIdentity);
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
    expect(Keychain.setGenericPassword.mock.calls[0][0]).toBe(
      'IOTC_PAD_CLIENT',
    );
    expect(status().client).toBeNull();
    expect(status().loading).toBe(true);
    await act(async () => {
      write.resolve(true);
      expect(await first.result).toEqual({ok: true});
    });
    expectObserved(status().client, device);
    expect(status(1).client).toBe(status().client);
    expect(status()).toMatchObject({
      loading: false,
      stage: 'connected',
      error: null,
    });
    expect(consumers[0].storage.credentials.deviceId).toBe(
      credentials.deviceId,
    );
  });

  it('publishes the real observation wrapper and delegates all operation and listener boundaries', async () => {
    const device = candidate();
    createDeviceClient.mockReturnValue(device);
    expect(device.identity).toBeNull();
    expect(device.isConnected()).toBe(false);
    await mount();
    const attempt = await start();
    expect(await attempt.result).toEqual({ok: true});
    const client = status().client;
    const store = getObservationStore(client);
    expectObserved(client, device);
    expect(status(1).client).toBe(client);
    expect(device.connect).toHaveBeenCalledTimes(1);
    expect(await device.connect.mock.results[0].value).toBe(assignedIdentity);
    expect(device.on).not.toHaveBeenCalled();
    expect(device.sendTelemetry).not.toHaveBeenCalled();
    expect(device.sendProperty).not.toHaveBeenCalled();
    expect(device.fetchTwin).not.toHaveBeenCalled();

    const telemetry = {battery: 50};
    const attributes = {'$.sub': 'sensors'};
    const reported = {readOnlyProp: 'sample'};
    expect(await client.sendTelemetry(telemetry, attributes)).toBe(
      await device.sendTelemetry.mock.results[0].value,
    );
    expect(await client.sendProperty(reported)).toBe(
      await device.sendProperty.mock.results[0].value,
    );
    expect(await client.fetchTwin()).toBe(
      await device.fetchTwin.mock.results[0].value,
    );
    expect(
      await client.uploadFile('sample.jpg', 'image/jpeg', 'AQID', 'base64'),
    ).toBe(await device.uploadFile.mock.results[0].value);
    expect(device.sendTelemetry).toHaveBeenCalledWith(telemetry, attributes);
    expect(device.sendProperty).toHaveBeenCalledWith(reported);
    expect(device.fetchTwin).toHaveBeenCalledTimes(1);
    expect(device.uploadFile).toHaveBeenCalledWith(
      'sample.jpg',
      'image/jpeg',
      'AQID',
      'base64',
    );

    const commands = jest.fn();
    const properties = jest.fn();
    const offCommand = client.on(IOTC_EVENTS.Commands, commands);
    const offProperty = client.on(IOTC_EVENTS.Properties, properties);
    expect(device.on).toHaveBeenCalledTimes(2);
    expect(offCommand).toBe(device.on.mock.results[0].value);
    expect(offProperty).toBe(device.on.mock.results[1].value);
    const command = {
      name: 'lightOn',
      requestId: 'lifecycle-command-1',
      requestPayload: '{"pulses":1,"duration":1}',
      reply: jest.fn(async () => ({delivery: 'submitted'})),
    };
    const property = {
      name: 'writeableProp',
      value: 'requested sample',
      version: 4,
      source: 'twin',
      ack: jest.fn(async () => ({delivery: 'submitted'})),
    };
    await device.on.mock.calls[0][1](command);
    await device.on.mock.calls[1][1](property);
    const observedCommand = commands.mock.calls[0][0];
    const observedProperty = properties.mock.calls[0][0];
    expect(observedCommand.requestPayload).toBe(command.requestPayload);
    expect(observedProperty.value).toBe(property.value);
    const finish = store.beginExecution(observedCommand);
    finish('completed');
    expect(
      await observedCommand.reply(IIoTCCommandResponse.SUCCESS, '{}'),
    ).toBe(await command.reply.mock.results[0].value);
    expect(await observedProperty.ack('Applied')).toBe(
      await property.ack.mock.results[0].value,
    );
    expect(command.reply).toHaveBeenCalledWith(
      IIoTCCommandResponse.SUCCESS,
      '{}',
    );
    expect(property.ack).toHaveBeenCalledWith('Applied');
    expect(device.sendProperty).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().latest).toMatchObject({
      telemetry: {outcome: 'submitted', names: ['battery']},
      'reported-property': {outcome: 'submitted', names: ['readOnlyProp']},
      'twin-request': {outcome: 'submitted'},
      upload: {outcome: 'acknowledged', status: 201},
      command: {name: 'lightOn', outcome: 'observed'},
      'command-execution': {outcome: 'completed'},
      'command-reply': {outcome: 'submitted', response: 'success'},
      'desired-property': {source: 'twin', version: 4},
      'property-ack': {source: 'twin', outcome: 'submitted'},
    });
    expect(consumers[0].storage.credentials.deviceId).toBe(
      credentials.deviceId,
    );
    expect(store.getSnapshot().identity.deviceId).not.toBe(
      credentials.deviceId,
    );
    offCommand();
    offProperty();
    expect(offCommand).toHaveBeenCalledTimes(1);
    expect(offProperty).toHaveBeenCalledTimes(1);
    await client.disconnect();
    expect(device.disconnect).toHaveBeenCalledTimes(1);
    expect(device.isConnected()).toBe(false);
    expect(store.getSnapshot()).toMatchObject({
      active: false,
      history: [],
      latest: {},
    });
  });

  it('invalidates observations immediately on a transport error stage before publishing that error', async () => {
    const device = candidate();
    createDeviceClient.mockReturnValue(device);
    await mount();
    const attempt = await start();
    expect(await attempt.result).toEqual({ok: true});
    const client = status().client;
    const store = getObservationStore(client);
    const {onStage} = createDeviceClient.mock.calls[0][1];
    await client.sendProperty({readOnlyProp: 'sample'});
    const connectedSnapshot = store.getSnapshot();
    act(() => onStage('connected'));
    expect(store.getSnapshot()).toBe(connectedSnapshot);

    const observedStages = [];
    const unsubscribe = store.subscribe(() => {
      observedStages.push({
        snapshot: store.getSnapshot(),
        stage: status().stage,
        error: status().error,
      });
    });
    device.cancel();
    device.isConnected.mockClear();
    const failure = new ConnectionError('CONNECTION_LOST');
    act(() => onStage('error', failure));
    expect(observedStages).toHaveLength(1);
    expect(observedStages[0]).toMatchObject({
      snapshot: {active: false, history: [], latest: {}, identity: null},
      stage: 'connected',
      error: null,
    });
    expect(store.getSnapshot().generation).not.toBe(
      connectedSnapshot.generation,
    );
    expect(status()).toMatchObject({client, stage: 'error', error: failure});
    expect(device.isConnected).not.toHaveBeenCalled();
    expect(device.on).not.toHaveBeenCalled();
    expect(device.connect).toHaveBeenCalledTimes(1);
    expect(device.sendProperty).toHaveBeenCalledTimes(1);
    expect(device.sendTelemetry).not.toHaveBeenCalled();
    expect(device.fetchTwin).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps intentional disconnection distinct from errors, resets and a fresh reconnect', async () => {
    const device = candidate();
    const retry = candidate();
    createDeviceClient.mockReturnValueOnce(device).mockReturnValueOnce(retry);
    await mount();
    const attempt = await start();
    expect(await attempt.result).toEqual({ok: true});
    const saved = consumers[0].storage.credentials;
    const writes = Keychain.setGenericPassword.mock.calls.length;
    const store = getObservationStore(status().client);

    act(() => consumers[1].connection[2]({disconnected: true}));
    expect(status()).toMatchObject({
      client: null,
      loading: false,
      error: null,
      stage: 'disconnected',
    });
    expect(device.cancel).toHaveBeenCalled();
    expect(store.getSnapshot().active).toBe(false);
    expect(consumers[0].storage.credentials).toBe(saved);
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(writes);
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    expect(createDeviceClient).toHaveBeenCalledTimes(1);

    const next = await start(1, saved);
    expect(await next.result).toEqual({ok: true});
    expectObserved(status().client, retry);
    expect(status()).toMatchObject({stage: 'connected', error: null});
    act(() => consumers[0].connection[2]());
    expect(status()).toMatchObject({stage: 'idle', client: null, error: null});
  });

  it('does not persist or publish a failed candidate and allows a manual retry', async () => {
    const gate = deferred();
    const failed = candidate(gate);
    const retry = candidate();
    createDeviceClient.mockReturnValueOnce(failed).mockReturnValueOnce(retry);
    const onFailure = jest.fn();
    await mount();
    const attempt = await start(0, credentials, {onFailure});
    await act(async () => {
      gate.reject(new ConnectionError('CONNECT_FAILED'));
      expect((await attempt.result).error.code).toBe('CONNECT_FAILED');
    });
    expect(failed.cancel).toHaveBeenCalled();
    expect(status()).toMatchObject({
      client: null,
      loading: false,
      stage: 'error',
    });
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(consumers[0].central.request.current).toBeNull();
    const next = await start(1);
    expect(await next.result).toEqual({ok: true});
    expectObserved(status().client, retry);
    expect(status().error).toBeNull();
  });

  it.each(['resolve', 'reject'])(
    'cancellation aborts and tears down without late %s effects, then permits retry',
    async settlement => {
      const gate = deferred();
      const device = candidate(gate);
      const retry = candidate();
      createDeviceClient.mockReturnValueOnce(device).mockReturnValueOnce(retry);
      const onFailure = jest.fn();
      const onSuccess = jest.fn();
      await mount();
      const attempt = await start(0, credentials, {onFailure, onSuccess});
      const options = createDeviceClient.mock.calls[0][1];
      await act(async () => consumers[1].connection[1]());
      expect(device.connect.mock.calls[0][0].signal.aborted).toBe(true);
      expect(device.cancel).toHaveBeenCalled();
      expect(status()).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      await act(async () => {
        options.onStage('error', new ConnectionError('CONNECT_FAILED'));
        gate[settlement](
          settlement === 'reject'
            ? new Error('Late failure')
            : assignedIdentity,
        );
        expect((await attempt.result).error.code).toBe('CANCELLED');
      });
      expect(status()).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      expect(onFailure).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      const next = await start(1);
      expect(await next.result).toEqual({ok: true});
      expectObserved(status().client, retry);
    },
  );

  it.each(['disconnect', 'forget credentials', 'mode switch'])(
    'aborts a pending connection on explicit %s',
    async action => {
      const gate = deferred();
      const device = candidate(gate);
      createDeviceClient.mockReturnValue(device);
      await mount();
      const attempt = await start();
      await act(async () => {
        if (action === 'disconnect') {
          consumers[1].connection[2]();
        } else if (action === 'forget credentials') {
          await consumers[1].connection[1]({clear: true});
        } else {
          await consumers[1].simulation[1](true);
        }
      });
      expect(device.connect.mock.calls[0][0].signal.aborted).toBe(true);
      expect(device.cancel).toHaveBeenCalled();
      await act(async () => {
        gate.reject(new Error('Late transport failure'));
        expect((await attempt.result).error.code).toBe('CANCELLED');
      });
      expect(status()).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      expect(consumers[0].storage.credentials).toBeNull();
      if (action !== 'disconnect') {
        expect(consumers[0].storage.simulated).toBe(action === 'mode switch');
        expect(
          JSON.parse(Keychain.setGenericPassword.mock.calls[0][1]).credentials,
        ).toBeNull();
      } else {
        expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps the reconnect loader on through old-client disconnect and pending new connection', async () => {
    const disconnect = deferred();
    const connect = deferred();
    const oldDevice = candidate();
    oldDevice.disconnect.mockImplementation(async () => {
      await disconnect.promise;
      oldDevice.cancel();
    });
    const newDevice = candidate(connect);
    createDeviceClient
      .mockReturnValueOnce(oldDevice)
      .mockReturnValueOnce(newDevice);
    await mount();
    const initial = await start();
    expect(await initial.result).toEqual({ok: true});
    const reconnect = await start(1);
    expect(oldDevice.disconnect).toHaveBeenCalledTimes(1);
    expect(status().loading).toBe(true);
    expect(createDeviceClient).toHaveBeenCalledTimes(1);
    await act(async () => disconnect.resolve());
    expect(newDevice.connect).toHaveBeenCalledTimes(1);
    expect(status().client).toBeNull();
    expect(status().loading).toBe(true);
    expect(status(1).loading).toBe(true);
    await act(async () => {
      connect.resolve(assignedIdentity);
      expect(await reconnect.result).toEqual({ok: true});
    });
    expectObserved(status().client, newDevice);
    expect(status().loading).toBe(false);
  });

  it('sanitizes secure-write failure as STORAGE_FAILED and cancels the connected candidate', async () => {
    const device = candidate();
    const retry = candidate();
    createDeviceClient.mockReturnValueOnce(device).mockReturnValueOnce(retry);
    const privateMessage = 'native-detail-not-for-display';
    const onFailure = jest.fn();
    const onSuccess = jest.fn();
    await mount();
    const previousCredentials = {...credentials, deviceId: 'previous-device'};
    await act(async () => {
      await consumers[0].storage.save({credentials: previousCredentials});
    });
    Keychain.setGenericPassword.mockRejectedValueOnce(
      new Error(privateMessage),
    );
    const attempt = await start(0, credentials, {onFailure, onSuccess});
    const result = await attempt.result;
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('STORAGE_FAILED');
    expect(result.error.message.includes(privateMessage)).toBe(false);
    expect(status().error.code).toBe('STORAGE_FAILED');
    expect(status().error.message.includes(privateMessage)).toBe(false);
    expect(status()).toMatchObject({
      client: null,
      loading: false,
      stage: 'error',
    });
    expect(consumers[0].storage.credentials === previousCredentials).toBe(true);
    expect(device.cancel).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(result.error);
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    const next = await start(1);
    expect(await next.result).toEqual({ok: true});
    expectObserved(status().client, retry);
    expect(status().error).toBeNull();
    expect(consumers[0].storage.credentials.deviceId).toBe(
      credentials.deviceId,
    );
  });

  it.each([true, false])(
    'actual App restores once and never reconnects after new credentials or explicit disconnect (stored: %s)',
    async stored => {
      const device = candidate();
      createDeviceClient.mockReturnValue(device);
      if (stored) {
        Keychain.getGenericPassword.mockResolvedValueOnce({
          username: 'IOTC_PAD_CLIENT',
          password: JSON.stringify({credentials}),
        });
      }
      await act(async () => {
        tree = renderer.create(<App />);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
        await jest.runOnlyPendingTimersAsync();
      });
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(createDeviceClient).toHaveBeenCalledTimes(stored ? 1 : 0);
      if (stored) {
        expectObserved(appControls.connection[3].client, device);
      }
      await act(async () => {
        await appControls.storage.save({
          credentials: {...credentials, deviceId: 'updated-lifecycle'},
        });
      });
      expect(createDeviceClient).toHaveBeenCalledTimes(stored ? 1 : 0);
      await act(async () => {
        appControls.connection[2]();
      });
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      expect(appControls.connection[3]).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      expect(appControls.storage.credentials.deviceId).toBe(
        'updated-lifecycle',
      );
      expect(createDeviceClient).toHaveBeenCalledTimes(stored ? 1 : 0);
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    },
  );
});
