import {AppState, PermissionsAndroid, Platform} from 'react-native';
import {
  BleManager,
  BleManagerOptions,
  Device,
  State,
  Subscription,
} from 'react-native-ble-plx';
import {BleDeviceModel} from './devices/BleDevice';
import {GenericDeviceModel} from './devices/GenericDevice';
import {Govee5074Model} from './devices/Govee5074';

const DeviceModels = new Set<BleDeviceModel>([Govee5074Model]);

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export class IotcBleManager extends BleManager {
  protected constructor(options?: BleManagerOptions) {
    super(options);
  }

  private static instance: IotcBleManager;
  private resetDeviceListCallback: () => void = () => {};
  private scanOwner?: symbol;
  private scanQueue = Promise.resolve();
  private activeScan?: Subscription;

  public observeAdvertisements(
    onDevice: (device: Device) => void,
    onUnavailable: () => void,
  ): Subscription {
    this.activeScan?.remove();
    const owner = Symbol('scan');
    this.scanOwner = owner;
    let cancelled = false;
    let scanning = false;
    let permissionGranted = false;
    let stateSubscription: Subscription | undefined;
    const current = () => !cancelled && this.scanOwner === owner;
    const enqueue = (operation: () => Promise<void>) => {
      this.scanQueue = this.scanQueue.then(operation).catch(() => {
        fail();
      });
    };
    const stop = () => {
      if (scanning) {
        scanning = false;
        enqueue(() => this.stopDeviceScan());
      }
    };
    const fail = () => {
      if (current()) {
        stop();
        onUnavailable();
      }
    };
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active' && current()) {
        stop();
      } else if (state === 'active' && current()) {
        void this.state().then(update).catch(fail);
      }
    });
    const update = (state: State) => {
      if (!current() || !permissionGranted) {
        return;
      }
      if (state !== State.PoweredOn) {
        stop();
        if (state !== State.Unknown && state !== State.Resetting) {
          onUnavailable();
        }
        return;
      }
      if (scanning || AppState.currentState !== 'active') {
        return;
      }
      scanning = true;
      enqueue(async () => {
        if (!current() || !scanning) {
          return;
        }
        await this.stopDeviceScan();
        if (!current() || !scanning) {
          return;
        }
        await this.startDeviceScan(
          null,
          {scanMode: 2, allowDuplicates: true},
          (error, device) => {
            if (!current() || !scanning || AppState.currentState !== 'active') {
              return;
            }
            if (error) {
              fail();
            } else if (device) {
              onDevice(device);
            }
          },
        );
      });
    };
    void requestBluetoothPermissions()
      .then(granted => {
        if (!current()) {
          return;
        }
        if (!granted) {
          fail();
          return;
        }
        permissionGranted = true;
        stateSubscription = this.onStateChange(update, true);
      })
      .catch(fail);
    const subscription = {
      remove: () => {
        if (cancelled) {
          return;
        }
        const owned = this.scanOwner === owner;
        cancelled = true;
        stateSubscription?.remove();
        appState.remove();
        if (owned) {
          this.scanOwner = undefined;
          this.activeScan = undefined;
          stop();
        }
      },
    };
    this.activeScan = subscription;
    return subscription;
  }

  public static getInstance(): IotcBleManager {
    if (!this.instance) {
      this.instance = new IotcBleManager();
    }

    return this.instance;
  }

  public getModelForDevice(device: Device): BleDeviceModel {
    for (const model of DeviceModels.values()) {
      if (model.matches(device)) {
        return model;
      }
    }

    return GenericDeviceModel;
  }

  public resetDeviceList(): void {
    this.resetDeviceListCallback?.();
  }

  public setResetDeviceListCallback(callback: () => void) {
    this.resetDeviceListCallback = callback;
  }
}
