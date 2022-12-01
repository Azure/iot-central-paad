import {Device} from 'react-native-ble-plx';
import {BleDeviceModel, DeviceItemProps} from './BleDevice';

interface GenericDeviceData {
  rssi: number;
}

export const GenericDeviceModel: BleDeviceModel<GenericDeviceData> = {
  matches(_device: Device): boolean {
    return true;
  },
  onScan(device: Device) {
    return {
      rssi: device.rssi ?? 0,
    };
  },
  getItemProps: function (data: any): DeviceItemProps[] {
    return [
      {
        id: 'rssi',
        name: 'RSSI',
        enabled: true,
        simulated: false,
        dataType: 'number',
        value: data.rssi,
        unit: 'dBm',
      },
    ];
  },
};
