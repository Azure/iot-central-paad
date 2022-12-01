import {Device} from 'react-native-ble-plx';
import {BleDeviceModel, DeviceItemProps} from './BleDevice';
import {Buffer} from 'buffer';

interface Govee5074Data {
  temperature: number;
  humidity: number;
  battery: number;
  rssi?: number;
}

export const Govee5074Model: BleDeviceModel<Govee5074Data> = {
  matches(device: Device): boolean {
    return device.name?.startsWith('Govee_H5074') ?? false;
  },
  onScan(device: Device): Govee5074Data | null {
    if (!device.manufacturerData) {
      return null;
    }

    const buf = Buffer.from(device.manufacturerData, 'base64');
    if (buf.toString('ascii').includes('INTELLI_ROCKS')) {
      return null;
    }

    // 88 ec 00 14 09 3b 0e 64 02
    // 0  1  2 [3  4] [5 6] [7] 8
    //          ^      ^     ^
    //          temp   hum   batt
    const temperature = buf.readInt16LE(3) / 100;
    const humidity = buf.readInt16LE(5) / 100;
    const battery = buf.readUint8(7);

    const data: Govee5074Data = {
      temperature,
      humidity,
      battery,
      rssi: device.rssi ?? undefined,
    };

    return data;
  },
  getItemProps: function (data: Govee5074Data): DeviceItemProps[] {
    const props: DeviceItemProps[] = [
      data.temperature && {
        id: 'temp',
        name: 'Temperature',
        enabled: true,
        simulated: false,
        dataType: 'number',
        value: data.temperature,
        unit: '°C',
      },
      data.humidity && {
        id: 'humidity',
        name: 'Humidity',
        enabled: true,
        simulated: false,
        dataType: 'number',
        value: data.humidity,
        unit: '%',
      },
      {
        id: 'rssi',
        name: 'RSSI',
        enabled: true,
        simulated: false,
        dataType: 'number',
        value: data.rssi,
        unit: 'dBm',
      },
      data.battery && {
        id: 'battery',
        name: 'Battery',
        enabled: true,
        simulated: false,
        dataType: 'number',
        value: data.battery,
        unit: '%',
      },
    ].filter(Boolean) as DeviceItemProps[];

    return props;
  },
};
