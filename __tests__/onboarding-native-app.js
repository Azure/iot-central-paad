// The entire App, hooks, providers, core client and bundled MQTT implementation
// run here. Only native sockets, HTTP, keychain and device services are simulated.
jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {...actual, requireNativeModule: jest.fn(actual.requireNativeModule)};
});
jest.mock('expo/fetch', () => ({fetch: jest.fn()}));
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  Camera: {
    getCameraPermissionsAsync: jest.fn(async () => ({
      granted: true,
      canAskAgain: true,
    })),
    requestCameraPermissionsAsync: jest.fn(async () => ({granted: true})),
  },
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, AppState, Modal, TextInput} from 'react-native';
import {requireNativeModule} from 'expo-modules-core';
import {fetch as httpFetch} from 'expo/fetch';
import * as Keychain from 'react-native-keychain';
import App from '../src/App';
import {PHONE_MODEL_ID} from '../src/connection';

const key = Buffer.alloc(32, 7).toString('base64');
const direct = `HostName=assigned.azure-devices.net;DeviceId=Assigned-Phone;SharedAccessKey=${key}`;
let app;
let listeners;
let sockets;
let publications;
let destinations;
let previousAppState;
const emit = (id, type, fields = {}) => {
  Promise.resolve().then(() => {
    for (const listener of listeners) {
      listener({id, type, ...fields});
    }
  });
};
const native = {
  addListener: (_name, listener) => {
    listeners.add(listener);
    return {remove: () => listeners.delete(listener)};
  },
  connect: (id, url) => {
    sockets.add(id);
    destinations.push(url);
    emit(id, 'open', {protocol: 'mqtt'});
  },
  send: (id, frame) => {
    const bytes = Buffer.from(frame, 'base64');
    const type = bytes[0] >> 4;
    let offset = 1;
    while (bytes[offset++] & 128) {}
    const receive = data =>
      emit(id, 'message', {data: Buffer.from(data).toString('base64')});
    if (type === 1) {
      receive([0x20, 2, 0, 0]);
    }
    if (type === 8) {
      receive([0x90, 3, bytes[offset], bytes[offset + 1], 0]);
    }
    if (type === 12) {
      receive([0xd0, 0]);
    }
    if (type === 3) {
      const length = bytes.readUInt16BE(offset);
      const topic = bytes.toString('utf8', offset + 2, offset + 2 + length);
      const payload = bytes.toString('utf8', offset + 2 + length);
      publications.push({topic, payload});
    }
  },
  close: id => {
    sockets.delete(id);
    emit(id, 'close', {code: 1000, wasClean: true});
  },
};
const press = id =>
  app.root
    .findAllByProps({testID: id})
    .find(node => node.props.onPress)
    .props.onPress();
const value = id => app.root.findAllByProps({testID: id})[0]?.props.children;
const boot = async () => {
  await act(async () => {
    app = renderer.create(<App />);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2100);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  previousAppState = AppState.currentState;
  AppState.currentState = 'active';
  listeners = new Set();
  sockets = new Set();
  publications = [];
  destinations = [];
  requireNativeModule.mockImplementation(name => {
    if (name === 'PaadDevice') {
      return native;
    }
    throw new Error('Native service unavailable in test');
  });
  httpFetch.mockImplementation(async () => ({
    status: 200,
    headers: {get: () => null},
    json: async () => ({
      status: 'assigned',
      operationId: 'operation-123',
      registrationState: {
        assignedHub: 'assigned.azure-devices.net',
        deviceId: 'Assigned-Phone',
      },
    }),
  }));
  Keychain.getGenericPassword.mockResolvedValue(false);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => {
    app?.unmount();
  });
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
  jest.runAllTicks();
  expect(sockets.size).toBe(0);
  expect(listeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(global.WebSocket).not.toHaveBeenCalled();
  expect(global.XMLHttpRequest).not.toHaveBeenCalled();
  jest.useRealTimers();
  jest.restoreAllMocks();
  AppState.currentState = previousAppState;
});

test('manual individual DPS connects to returned identity and submits genuine core proof payloads', async () => {
  await boot();
  await act(async () => {
    press('registration-manual');
    await jest.advanceTimersByTimeAsync(500);
  });
  const input = id =>
    app.root.findAllByType(TextInput).find(node => node.props.testID === id);
  await act(async () => {
    input('connection-registrationId').props.onChangeText('registration-phone');
    input('connection-scopeId').props.onChangeText('0ne123456');
    input('connection-deviceKey').props.onChangeText(key);
    input('connection-provisioningHost').props.onChangeText(
      'global-canary.azure-devices-provisioning.net',
    );
  });
  httpFetch.mockRejectedValueOnce(new Error('synthetic-service-secret'));
  await act(async () => {
    press('connection-submit');
    await jest.advanceTimersByTimeAsync(500);
  });
  expect(value('connection-error-code')).toBe('NETWORK_ERROR');
  expect(input('connection-deviceKey').props.value).toBe(key);
  expect(input('connection-registrationId').props.value).toBe(
    'registration-phone',
  );
  expect(JSON.stringify(app.toJSON())).not.toContain(
    'synthetic-service-secret',
  );
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  httpFetch.mockResolvedValueOnce({
    status: 400,
    headers: {get: () => null},
    json: async () => ({
      errorCode: 400123,
      message: 'synthetic-service-secret',
    }),
  });
  await act(async () => {
    press('connection-submit');
    await jest.advanceTimersByTimeAsync(500);
  });
  expect(value('connection-error-code')).toBe('PROVISIONING_FAILED');
  expect(value('connection-http-status')).toBe('HTTP 400');
  expect(value('connection-service-code')).toBe(400123);
  // Exactly one notice, next to the form that can recover — never a second
  // copy stranded under the navigator and tab bar.
  const hosts = id =>
    app.root
      .findAllByProps({testID: id})
      .filter(node => typeof node.type === 'string');
  expect(hosts('connection-error')).toHaveLength(1);
  expect(hosts('connection-error-code')).toHaveLength(1);
  expect(hosts('connection-http-status')).toHaveLength(1);
  expect(hosts('connection-service-code')).toHaveLength(1);
  expect(hosts('connection-error')[0].props.accessibilityRole).toBe('alert');
  expect(JSON.stringify(app.toJSON())).toContain(
    'Provisioning did not complete',
  );
  expect(JSON.stringify(app.toJSON())).not.toContain(
    'synthetic-service-secret',
  );
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  const presented = () =>
    app.root.findAllByType(Modal).filter(node => node.props.visible);
  await act(async () => {
    press('connection-submit');
  });
  // The blocking busy state must not hold a native modal: iOS drops a sheet
  // presented while a previous one is still dismissing.
  expect(
    app.root.findAllByProps({testID: 'app-busy-overlay'}).length,
  ).toBeGreaterThan(0);
  expect(presented()).toHaveLength(0);
  expect(
    app.root.findAllByProps({testID: 'navigation-content'})[0].props,
  ).toMatchObject({
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
  expect(value('connection-status')).toBe('Connected');
  expect(
    app.root.findAllByProps({testID: 'navigation-content'})[0].props,
  ).toMatchObject({
    accessibilityElementsHidden: false,
    importantForAccessibility: 'auto',
  });
  expect(value('assigned-device-id')).toBeUndefined();
  expect(destinations).toEqual([
    'wss://assigned.azure-devices.net/$iothub/websocket',
  ]);
  expect(httpFetch.mock.calls[0][0]).toContain(
    'global-canary.azure-devices-provisioning.net/0ne123456/registrations/registration-phone/register?api-version=2019-03-31',
  );
  expect(JSON.parse(httpFetch.mock.calls[0][1].body).payload.modelId).toBe(
    PHONE_MODEL_ID,
  );
  expect(presented()).toHaveLength(0);
  await act(async () => {
    press('connection-details');
  });
  expect(presented()).toHaveLength(1);
  expect(value('assigned-device-id')).toBe('Assigned-Phone');
  expect(value('assigned-hub')).toBe('assigned.azure-devices.net');
  expect(value('model-id')).toBe(PHONE_MODEL_ID);
  expect(value('registration-id')).toBe('registration-phone');
  expect(value('registry-status')).toBe('Not checked');
  const nonce = 'native_mobile_proof_12345';
  await act(async () => {
    input('proof-nonce').props.onChangeText(nonce);
  });
  await act(async () => {
    press('proof-send');
  });
  expect(value('proof-status')).toBe('Submitted locally');
  expect(
    publications.some(
      item =>
        item.topic.startsWith('devices/Assigned-Phone/messages/events/') &&
        JSON.parse(item.payload).paadProofNonce === nonce,
    ),
  ).toBe(true);
  expect(
    publications.some(
      item =>
        item.topic.startsWith('$iothub/twin/PATCH/properties/reported/') &&
        JSON.parse(item.payload).paadProof?.nonce === nonce,
    ),
  ).toBe(true);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    press('connection-forget');
  });
  await act(async () => {
    await alert.mock.calls[0][2]
      .find(button => button.style === 'destructive')
      .onPress();
  });
  expect(
    JSON.parse(Keychain.setGenericPassword.mock.calls.at(-1)[1]).credentials,
  ).toBeNull();
});

test('failed restore stays visible on welcome and retries saved credentials without a bottom duplicate', async () => {
  Keychain.getGenericPassword.mockResolvedValue({
    username: 'IOTC_PAD_CLIENT',
    password: JSON.stringify({
      credentials: {
        registrationId: 'saved-phone',
        scopeId: '0ne123456',
        deviceKey: key,
      },
    }),
  });
  httpFetch.mockRejectedValueOnce(new Error('private-network-fixture'));
  await boot();
  expect(value('connection-error-code')).toBe('NETWORK_ERROR');
  expect(
    app.root.findAllByProps({testID: 'registration-manual'}).length,
  ).toBeGreaterThan(0);
  expect(
    app.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'connection-error',
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(app.toJSON())).not.toContain('private-network-fixture');
  await act(async () => {
    press('connection-error-reconnect');
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(value('connection-status')).toBe('Connected');
  expect(value('connection-error-code')).toBeUndefined();
});

test.each([
  ['individual', 'interrupted'],
  ['hub', 'interrupted'],
  ['individual', 'manual'],
  ['hub', 'manual'],
])(
  'Home reconnect starts a fresh %s transport after a %s disconnect and retains saved setup',
  async (mode, reason) => {
    const savedCredentials =
      mode === 'hub'
        ? {connectionString: direct}
        : {registrationId: 'saved-phone', scopeId: '0ne123456', deviceKey: key};
    Keychain.getGenericPassword.mockResolvedValue({
      username: 'IOTC_PAD_CLIENT',
      password: JSON.stringify({credentials: savedCredentials}),
    });
    await boot();
    expect(value('connection-status')).toBe('Connected');
    const previousSocket = [...sockets][0];
    if (reason === 'manual') {
      await act(async () => press('connection-details'));
      await act(async () => press('connection-disconnect'));
      await act(async () => press('connection-details-close'));
    } else {
      await act(async () => {
        emit(previousSocket, 'error', {message: 'private-transport-failure'});
      });
    }
    await act(async () => jest.advanceTimersByTimeAsync(1100));
    expect(value('connection-status')).toBe(
      reason === 'manual' ? 'Disconnected' : 'Connection interrupted',
    );
    expect(
      app.root.findAllByProps({testID: 'connection-summary-recovery'}).length,
    ).toBeGreaterThan(0);
    const summary = app.root.findAllByProps({testID: 'connection-summary'})[0];
    expect(summary.findAllByProps({testID: 'connection-error'})).toHaveLength(
      0,
    );
    expect(
      summary.findAllByProps({testID: 'connection-disconnected'}),
    ).toHaveLength(0);
    if (reason === 'manual') {
      expect(JSON.stringify(app.toJSON())).not.toContain('CONNECTION_LOST');
      expect(sockets.size).toBe(0);
    }
    expect(JSON.stringify(app.toJSON())).not.toContain(
      'private-transport-failure',
    );
    const channels = mode === 'hub' ? ['hub'] : ['dps', 'hub'];
    await act(async () => {
      for (const channel of channels) {
        const lane = app.root.findAllByProps({
          testID: `home-map-lane-${channel}`,
        })[0];
        if (lane) lane.props.onLayout({nativeEvent: {layout: {width: 320}}});
      }
    });
    for (const channel of channels) {
      const route = app.root.findAllByProps({
        testID: `home-map-phone-${channel}-path`,
      })[0];
      expect(route.props.strokeDasharray).toBe('6 5');
      expect(
        app.root.findAllByProps({testID: `home-map-flow-${channel}`}),
      ).toHaveLength(0);
    }

    let pendingSocket;
    jest.spyOn(native, 'connect').mockImplementationOnce((id, url) => {
      pendingSocket = id;
      sockets.add(id);
      destinations.push(url);
    });
    const reconnectID =
      reason === 'manual'
        ? 'connection-disconnected-reconnect'
        : 'connection-error-reconnect';
    await act(async () => press(reconnectID));
    expect(pendingSocket).toBeDefined();
    expect(pendingSocket).not.toBe(previousSocket);
    expect(sockets.size).toBe(1);
    expect(
      app.root.findAllByProps({testID: 'app-busy-overlay'}).length,
    ).toBeGreaterThan(0);
    expect(app.root.findAllByProps({testID: reconnectID})).toHaveLength(0);
    await act(async () => {
      emit(pendingSocket, 'open', {protocol: 'mqtt'});
      await jest.advanceTimersByTimeAsync(1100);
    });
    expect(value('connection-status')).toBe('Connected');
    for (const channel of channels) {
      const route = app.root.findAllByProps({
        testID: `home-map-phone-${channel}-path`,
      })[0];
      expect(route.props.strokeDasharray).toBeUndefined();
    }
    expect(app.root.findAllByProps({testID: 'app-busy-overlay'})).toHaveLength(
      0,
    );
    expect(destinations).toHaveLength(2);
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    expect(
      JSON.parse(Keychain.setGenericPassword.mock.calls.at(-1)[1]).credentials,
    ).toMatchObject(savedCredentials);
  },
);

test('one-shot restored real client lands Home even with batched connection updates', async () => {
  Keychain.getGenericPassword.mockResolvedValue({
    username: 'IOTC_PAD_CLIENT',
    password: JSON.stringify({credentials: {connectionString: direct}}),
  });

  await boot();
  expect({
    destinations,
    status: value('connection-status'),
    error: value('connection-error-code'),
    startup: app.root.findAllByProps({testID: 'startup-error'}).length,
  }).toEqual({
    destinations: ['wss://assigned.azure-devices.net/$iothub/websocket'],
    status: 'Connected',
    error: undefined,
    startup: 0,
  });
  expect(value('connection-status')).toBe('Connected');
  await act(async () => {
    press('connection-details');
  });
  expect(value('assigned-device-id')).toBe('Assigned-Phone');
  expect(httpFetch).not.toHaveBeenCalled();
  expect(destinations).toHaveLength(1);
  await act(async () => {
    press('connection-manual');
    await jest.advanceTimersByTimeAsync(500);
  });
  const input = app.root
    .findAllByType(TextInput)
    .find(node => node.props.testID === 'connection-connectionString');
  expect(input.props.editable).toBe(false);
  expect(input.props.secureTextEntry).toBe(true);
  await act(async () => {
    press('registration-close');
    await jest.advanceTimersByTimeAsync(500);
  });
  await act(async () => {
    press('connection-details');
  });
  await act(async () => {
    press('connection-disconnect');
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(value('connection-status')).toBe('Disconnected');
  expect(destinations).toHaveLength(1);
  await act(async () => {
    press('connection-reconnect');
    await jest.advanceTimersByTimeAsync(500);
  });
  expect(value('connection-status')).toBe('Connected');
  expect(destinations).toHaveLength(2);
});

test('new-device footer opens blank entry without changing the saved connected device', async () => {
  Keychain.getGenericPassword.mockResolvedValue({
    username: 'IOTC_PAD_CLIENT',
    password: JSON.stringify({credentials: {connectionString: direct}}),
  });
  await boot();
  await act(async () => {
    press('connection-details');
  });
  await act(async () => {
    press('connection-manual');
    await jest.advanceTimersByTimeAsync(500);
  });
  const saves = Keychain.setGenericPassword.mock.calls.length;
  const resets = Keychain.resetGenericPassword.mock.calls.length;
  await act(async () => {
    press('registration-new');
    await jest.advanceTimersByTimeAsync(500);
  });
  await act(async () => {
    press('registration-manual');
    await jest.advanceTimersByTimeAsync(500);
  });
  const registration = app.root
    .findAllByType(TextInput)
    .find(node => node.props.testID === 'connection-registrationId');
  expect(registration.props.editable).toBe(true);
  expect(registration.props.value).toBe('');
  expect(
    app.root.findAllByProps({testID: 'registration-actions'}),
  ).toHaveLength(0);
  expect(destinations).toHaveLength(1);
  expect(sockets.size).toBe(1);
  expect(httpFetch).not.toHaveBeenCalled();
  expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(saves);
  expect(Keychain.resetGenericPassword).toHaveBeenCalledTimes(resets);
});

test('versioned QR uses the same real client, suppresses duplicate scans and releases camera on Home', async () => {
  await boot();
  await act(async () => {
    press('registration-scan');
    await jest.advanceTimersByTimeAsync(500);
  });
  const camera = app.root.findByType('CameraView');
  await act(async () => {
    camera.props.onCameraReady();
  });
  const data = JSON.stringify({
    schema: 'paad.connection',
    version: 1,
    mode: 'hub',
    credentials: {connectionString: direct},
  });
  await act(async () => {
    camera.props.onBarcodeScanned({type: 'qr', data});
    camera.props.onBarcodeScanned({type: 'qr', data});
    await jest.advanceTimersByTimeAsync(500);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
  expect(value('connection-status')).toBe('Connected');
  expect(app.root.findAllByType('CameraView')).toHaveLength(0);
  expect(destinations).toHaveLength(1);
  expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
  expect(httpFetch).not.toHaveBeenCalled();
});
