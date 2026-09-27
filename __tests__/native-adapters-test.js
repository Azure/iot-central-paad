import Accelerometer from '../src/sensors/accelerometer';
import Gyroscope from '../src/sensors/gyroscope';
import Battery from '../src/sensors/battery';
import Geolocation from '../src/sensors/geolocation';
import {
  DATA_AVAILABLE_EVENT,
  SENSOR_UNAVAILABLE_EVENT,
} from '../src/sensors/internal';
import * as Sensors from 'expo-sensors';
import * as ExpoBattery from 'expo-battery';
import * as Location from 'expo-location';
import {Camera} from 'expo-camera';
import QRCodeScanner from '../src/components/qrcodeScanner';
import {acquireCamera, playTorch} from '../src/tools/Torch';
import {Govee5074Model} from '../src/bluetooth/devices/Govee5074';
import {GenericDeviceModel} from '../src/bluetooth/devices/GenericDevice';
import {AppState, Platform, PermissionsAndroid} from 'react-native';
import {
  IotcBleManager,
  requestBluetoothPermissions,
} from '../src/bluetooth/BleManager';

jest.mock('react-native', () => ({
  Platform: {OS: 'android', Version: 31},
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
  },
  StyleSheet: {create: value => value},
  NativeModules: {},
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'scan',
      BLUETOOTH_CONNECT: 'connect',
      ACCESS_FINE_LOCATION: 'location',
    },
    RESULTS: {GRANTED: 'granted'},
    requestMultiple: jest.fn(async permissions =>
      Object.fromEntries(
        permissions.map(permission => [permission, 'granted']),
      ),
    ),
  },
}));
jest.mock('react-native-device-info', () => ({
  hasSystemFeature: jest.fn(async () => false),
}));
jest.mock('react-native-ble-plx', () => ({
  BleManager: class {
    startDeviceScan = jest.fn(async () => {});
    stopDeviceScan = jest.fn(async () => {});
    state = jest.fn(async () => 'PoweredOn');
    onStateChange = jest.fn(callback => {
      callback('PoweredOn');
      return {remove: jest.fn()};
    });
  },
  State: {PoweredOn: 'PoweredOn'},
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
// This suite exercises adapter logic against a minimal react-native stub, so the
// shared themed action is stubbed instead of pulling the whole UI kit in.
jest.mock('../src/components/detailsAction', () => 'DetailsAction');
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
jest.mock('expo-sensors', () => {
  const sensor = () => ({
    isAvailableAsync: jest.fn(async () => true),
    getPermissionsAsync: jest.fn(async () => ({
      granted: true,
      canAskAgain: true,
    })),
    requestPermissionsAsync: jest.fn(async () => ({granted: true})),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({remove: jest.fn()})),
  });
  return {
    Accelerometer: sensor(),
    Gyroscope: sensor(),
    Barometer: sensor(),
    Magnetometer: sensor(),
  };
});
jest.mock('expo-battery', () => ({
  isAvailableAsync: jest.fn(async () => true),
  getBatteryLevelAsync: jest.fn(async () => 0.5),
}));
jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(async () => ({remove: jest.fn()})),
  Accuracy: {Balanced: 3},
}));

const settle = async () => {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('maintained sensor adapters', () => {
  it.each(['android', 'ios'])('normalizes Expo g on %s to m/s²', platform => {
    Platform.OS = platform;
    expect(
      new Accelerometer('accelerometer', 100).getNormalizedData(1, -0.5, 0),
    ).toEqual({x: 9.81, y: -4.905, z: 0});
  });

  it('preserves gyroscope radians per second and tears down listeners', async () => {
    const sensor = new Gyroscope('gyroscope', 100);
    const data = jest.fn();
    sensor.on(DATA_AVAILABLE_EVENT, data);
    sensor.enable(true);
    await settle();
    Sensors.Gyroscope.addListener.mock.calls[0][0]({x: 1, y: -2, z: 3});
    expect(data).toHaveBeenCalledWith('gyroscope', {x: 1, y: -2, z: 3});
    const subscription = Sensors.Gyroscope.addListener.mock.results[0].value;
    sensor.enable(false);
    expect(subscription.remove).toHaveBeenCalledTimes(1);
    Sensors.Gyroscope.addListener.mock.calls[0][0]({x: 2, y: 3, z: 4});
    expect(data).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe after cancellation during availability lookup', async () => {
    let resolve;
    Sensors.Accelerometer.isAvailableAsync.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const sensor = new Accelerometer('accelerometer', 100);
    sensor.enable(true);
    sensor.enable(false);
    resolve(true);
    await settle();
    expect(Sensors.Accelerometer.addListener).not.toHaveBeenCalled();
  });

  it('reports unavailable without manufacturing values, but supports explicit simulation', async () => {
    Sensors.Accelerometer.isAvailableAsync.mockResolvedValueOnce(false);
    const sensor = new Accelerometer('accelerometer', 100);
    const data = jest.fn();
    const unavailable = jest.fn();
    sensor
      .on(DATA_AVAILABLE_EVENT, data)
      .on(SENSOR_UNAVAILABLE_EVENT, unavailable);
    sensor.enable(true);
    await settle();
    expect(unavailable).toHaveBeenCalledWith('accelerometer');
    expect(data).not.toHaveBeenCalled();
    sensor.simulate(true);
    sensor.enable(true);
    await jest.advanceTimersByTimeAsync(100);
    expect(data).toHaveBeenCalledTimes(1);
    sensor.enable(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('switches both simulation directions and does not enable a disabled sensor on interval changes', async () => {
    const sensor = new Accelerometer('accelerometer', 100);
    sensor.sendInterval(200);
    await settle();
    expect(Sensors.Accelerometer.addListener).not.toHaveBeenCalled();
    sensor.enable(true);
    await settle();
    sensor.simulate(true);
    expect(
      Sensors.Accelerometer.addListener.mock.results[0].value.remove,
    ).toHaveBeenCalled();
    sensor.sendInterval(50);
    expect(jest.getTimerCount()).toBe(1);
    sensor.simulate(false);
    await settle();
    expect(jest.getTimerCount()).toBe(0);
    expect(Sensors.Accelerometer.setUpdateInterval).toHaveBeenLastCalledWith(
      50,
    );
    expect(Sensors.Accelerometer.addListener).toHaveBeenCalledTimes(2);
    sensor.enable(false);
  });

  it('treats unknown battery level as unavailable rather than -100%', async () => {
    ExpoBattery.getBatteryLevelAsync.mockResolvedValueOnce(-1);
    const sensor = new Battery('battery', 100);
    const data = jest.fn();
    const unavailable = jest.fn();
    sensor
      .on(DATA_AVAILABLE_EVENT, data)
      .on(SENSOR_UNAVAILABLE_EVENT, unavailable);
    sensor.enable(true);
    await settle();
    await jest.advanceTimersByTimeAsync(100);
    expect(data).not.toHaveBeenCalled();
    expect(unavailable).toHaveBeenCalledWith('battery');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('honors denied location permission without a native subscription', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    const sensor = new Geolocation('geolocation', 100);
    const unavailable = jest.fn();
    sensor.on(SENSOR_UNAVAILABLE_EVENT, unavailable);
    sensor.enable(true);
    await settle();
    expect(unavailable).toHaveBeenCalledWith('geolocation');
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('removes a location watch that resolves after disable', async () => {
    let resolve;
    const remove = jest.fn();
    Location.watchPositionAsync.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const sensor = new Geolocation('geolocation', 100);
    sensor.enable(true);
    await settle();
    sensor.enable(false);
    resolve({remove});
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('camera ownership and QR gating', () => {
  const scanner = onRead => {
    const result = new QRCodeScanner({
      width: 300,
      height: 600,
      markerSize: 200,
      onRead,
    });
    result.setState = (state, callback) => {
      result.state = {...result.state, ...state};
      callback?.();
    };
    return result;
  };

  it('accepts one real QR only after ready, releases the camera, and can reactivate', async () => {
    const onRead = jest.fn();
    const view = scanner(onRead);
    view.componentDidMount();
    await settle();
    const event = {type: 'qr', data: 'synthetic-qr'};
    view.onRead(event);
    expect(onRead).not.toHaveBeenCalled();
    view.ready = true;
    view.onRead(event);
    view.onRead(event);
    await settle();
    expect(onRead).toHaveBeenCalledTimes(1);
    const release = acquireCamera('torch');
    release();
    view.reactivate();
    await settle();
    expect(view.state.active).toBe(true);
    view.componentWillUnmount();
  });

  it('does not open the camera when permission is denied', async () => {
    Camera.getCameraPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    const view = scanner(jest.fn());
    view.componentDidMount();
    await settle();
    expect(view.state.active).toBe(false);
    expect(view.state.error).toBeTruthy();
    view.componentWillUnmount();
  });

  it('prevents overlapping camera owners and rejects an unavailable torch', async () => {
    const release = acquireCamera('qr');
    expect(() => acquireCamera('torch')).toThrow('already in use');
    release();
    await expect(playTorch(1, 1, 0)).rejects.toThrow('unavailable');
  });
});

describe('advertisement-only BLE', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    Platform.Version = 31;
  });

  it('requests Android 31+ scan/connect instead of location', async () => {
    Platform.OS = 'android';
    Platform.Version = 31;
    expect(await requestBluetoothPermissions()).toBe(true);
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      'scan',
      'connect',
    ]);
    Platform.Version = 30;
    expect(await requestBluetoothPermissions()).toBe(true);
    expect(PermissionsAndroid.requestMultiple).toHaveBeenLastCalledWith([
      'location',
    ]);
  });

  it('rejects truncated Govee packets and preserves genuine zero measurements', () => {
    expect(Govee5074Model.onScan({manufacturerData: 'AA=='})).toBeNull();
    const bytes = Buffer.from([0x88, 0xec, 0, 0, 0, 0, 0, 0, 2]);
    const data = Govee5074Model.onScan({
      manufacturerData: bytes.toString('base64'),
      rssi: -50,
    });
    expect(data).toEqual({temperature: 0, humidity: 0, battery: 0, rssi: -50});
    expect(Govee5074Model.getItemProps(data)).toHaveLength(4);
    expect(GenericDeviceModel.onScan({rssi: null})).toBeNull();
  });

  it('replaces scan ownership, ignores stale packets, and cleans up on blur', async () => {
    const manager = IotcBleManager.getInstance();
    const first = jest.fn();
    const second = jest.fn();
    const old = manager.observeAdvertisements(first, jest.fn());
    await settle();
    const firstCallback = manager.startDeviceScan.mock.calls[0][2];
    const active = manager.observeAdvertisements(second, jest.fn());
    await settle();
    old.remove();
    firstCallback(null, {id: 'old'});
    expect(first).not.toHaveBeenCalled();
    const callback = manager.startDeviceScan.mock.calls[1][2];
    callback(null, {id: 'active'});
    expect(second).toHaveBeenCalledWith({id: 'active'});
    active.remove();
    await settle();
    callback(null, {id: 'late'});
    expect(second).toHaveBeenCalledTimes(1);
    expect(
      manager.onStateChange.mock.results[1].value.remove,
    ).toHaveBeenCalledTimes(1);
  });

  it('cannot start a denied scan by resuming the application', async () => {
    PermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      scan: 'denied',
      connect: 'denied',
    });
    const manager = IotcBleManager.getInstance();
    const unavailable = jest.fn();
    const subscription = manager.observeAdvertisements(jest.fn(), unavailable);
    await settle();
    expect(unavailable).toHaveBeenCalled();
    const onState = AppState.addEventListener.mock.calls.at(-1)[1];
    onState('active');
    await settle();
    expect(manager.startDeviceScan).not.toHaveBeenCalled();
    subscription.remove();
  });
});
