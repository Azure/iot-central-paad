import React, {useContext} from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import StorageProvider, {StorageContext} from '../src/contexts/storage';
import {decodeCredentials} from '../src/connection';
import {ThemeMode} from '../src/types';

const credentials = {
  scopeId: '0ne12345678',
  deviceId: 'storage-lifecycle',
  deviceKey: Buffer.alloc(32, 1).toString('base64'),
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
};

describe('secure storage lifecycle', () => {
  let tree;
  let storage;
  const Probe = () => {
    storage = useContext(StorageContext);
    return null;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Keychain.getGenericPassword.mockReset().mockResolvedValue(false);
    Keychain.setGenericPassword.mockReset().mockResolvedValue(true);
    Keychain.resetGenericPassword.mockReset().mockResolvedValue(true);
    await act(async () => {
      tree = renderer.create(
        <StorageProvider>
          <Probe />
        </StorageProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => tree.unmount());
    expect(global.fetch).not.toHaveBeenCalled();
    expect(global.XMLHttpRequest).not.toHaveBeenCalled();
    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  it('queues concurrent writes and merges against the latest committed settings', async () => {
    const first = deferred();
    Keychain.setGenericPassword.mockImplementationOnce(() => first.promise);
    let writes;
    await act(async () => {
      writes = [
        storage.save({themeMode: ThemeMode.DARK}),
        storage.save({credentials}),
        storage.save({deliveryInterval: 30, skipVersion: '2.0.0'}),
      ];
    });
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
    expect(storage.themeMode).toBe(ThemeMode.DEVICE);
    expect(storage.credentials).toBeNull();
    await act(async () => {
      first.resolve(true);
      await Promise.all(writes);
    });
    const payloads = Keychain.setGenericPassword.mock.calls.map(
      ([username, password]) => {
        expect(username).toBe('IOTC_PAD_CLIENT');
        return JSON.parse(password);
      },
    );
    expect(payloads).toHaveLength(3);
    expect(payloads[1].themeMode).toBe(ThemeMode.DARK);
    expect(payloads[2]).toMatchObject({
      themeMode: ThemeMode.DARK,
      deliveryInterval: 30,
      skipVersion: '2.0.0',
    });
    expect(
      JSON.stringify(payloads[2].credentials) === JSON.stringify(credentials),
    ).toBe(true);
    expect(storage.deliveryInterval).toBe(30);
    expect(storage.credentials === credentials).toBe(true);
  });

  it('restores old generic-password JSON and validates/normalizes credentials', async () => {
    Keychain.getGenericPassword.mockResolvedValueOnce({
      username: 'IOTC_PAD_CLIENT',
      password: JSON.stringify({
        themeMode: ThemeMode.LIGHT,
        simulated: true,
        deliveryInterval: 10,
        skipVersion: '1.9.0',
        credentials,
      }),
    });
    let restored;
    await act(async () => {
      restored = await storage.read();
    });
    expect(restored).toMatchObject({
      initialized: true,
      themeMode: ThemeMode.LIGHT,
      simulated: true,
      deliveryInterval: 10,
      skipVersion: '1.9.0',
    });
    expect(
      JSON.stringify(restored.credentials) ===
        JSON.stringify(decodeCredentials(credentials)),
    ).toBe(true);
    expect(storage.credentials === restored.credentials).toBe(true);
    expect(Keychain.getGenericPassword).toHaveBeenCalledWith();
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  });

  it.each([
    [
      'write rejection',
      'save',
      () => ({themeMode: ThemeMode.LIGHT}),
      'setGenericPassword',
      true,
    ],
    [
      'write false',
      'save',
      () => ({themeMode: ThemeMode.LIGHT}),
      'setGenericPassword',
      false,
    ],
    ['reset rejection', 'clear', () => undefined, 'resetGenericPassword', true],
    ['reset false', 'clear', () => undefined, 'resetGenericPassword', false],
    ['read rejection', 'read', () => undefined, 'getGenericPassword', true],
  ])(
    '%s preserves committed state and does not poison queued work',
    async (_name, operation, input, nativeMethod, rejects) => {
      await act(async () => {
        await storage.save({credentials, themeMode: ThemeMode.DARK});
      });
      const gate = deferred();
      Keychain[nativeMethod].mockImplementationOnce(() => gate.promise);
      let failed;
      let queued;
      await act(async () => {
        failed = storage[operation](input()).then(
          () => false,
          () => true,
        );
        queued = storage.save({deliveryInterval: 45});
      });
      expect(storage.credentials === credentials).toBe(true);
      expect(storage.themeMode).toBe(ThemeMode.DARK);
      await act(async () => {
        if (rejects) {
          gate.reject(new Error('Native operation failed'));
        } else {
          gate.resolve(false);
        }
        expect(await failed).toBe(true);
        await queued;
      });
      expect(storage.credentials === credentials).toBe(true);
      expect(storage.themeMode).toBe(ThemeMode.DARK);
      expect(storage.deliveryInterval).toBe(45);
      if (operation !== 'clear') {
        expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    ['invalid JSON', '{'],
    ['invalid settings', JSON.stringify({deliveryInterval: 0})],
    [
      'invalid credentials',
      JSON.stringify({credentials: {deviceId: 'missing-key'}}),
    ],
  ])(
    'rejects %s without erasing state and permits a later valid read',
    async (_name, password) => {
      await act(async () => {
        await storage.save({credentials, themeMode: ThemeMode.DARK});
      });
      Keychain.getGenericPassword
        .mockResolvedValueOnce({username: 'IOTC_PAD_CLIENT', password})
        .mockResolvedValueOnce({
          username: 'IOTC_PAD_CLIENT',
          password: JSON.stringify({deliveryInterval: 30}),
        });
      await act(async () => {
        await expect(storage.read()).rejects.toBeInstanceOf(Error);
      });
      expect(storage.credentials === credentials).toBe(true);
      expect(storage.themeMode).toBe(ThemeMode.DARK);
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
      await act(async () => {
        await storage.read();
      });
      expect(storage.initialized).toBe(true);
      expect(storage.deliveryInterval).toBe(30);
      expect(storage.credentials).toBeNull();
      expect(storage.themeMode).toBe(ThemeMode.DEVICE);
    },
  );
});
