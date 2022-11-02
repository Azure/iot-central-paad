import {BleManager, BleManagerOptions, Device} from 'react-native-ble-plx';
import {BleDeviceModel} from './devices/BleDevice';
import {GenericDeviceModel} from './devices/GenericDevice';
import {Govee5074Model} from './devices/Govee5074';

const DeviceModels = new Set<BleDeviceModel>([Govee5074Model]);

export class IotcBleManager extends BleManager {
  protected constructor(options?: BleManagerOptions) {
    super(options);
  }

  private static instance: IotcBleManager;
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
}
