import {Device} from 'react-native-ble-plx';
import {ItemProps} from 'types';

export interface BleDeviceModel<DataType = any> {
  /**
   * Return true if the given device matches this model, false if not
   * `onScan` will only be called for this device if it matches according to this function
   * Often this will be based on the name of the device but it can also be based on the
   * bytes of the advertisement packet as well.
   */
  matches(device: Device): boolean;
  /**
   * Process the data from the device advertisement and return an array of `ItemProps` that will
   * be used to render the telemetry in the detail view.
   *
   * Return `null` if the scan is invalid for your purposes and should be ignored.
   * (Some devices use multiple advertisement formats and not all of them contain sensor data)
   */
  onScan(device: Device): DataType | null;
  /**
   * Map the data read in `onScan` into `itemProps` so it can be displayed in the app's UI
   */
  getItemProps(data: DataType): DeviceItemProps[];
}

export type DeviceItemProps = Omit<ItemProps, 'enable' | 'sendInterval'>;
