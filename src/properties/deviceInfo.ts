// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import DeviceInfo from 'react-native-device-info';
import {DataType} from 'types';

type DeviceInfoValue = {
  value: string | number;
  dataType?: DataType;
};
export type DeviceInfo = {
  manufacturer: DeviceInfoValue;
  model: DeviceInfoValue;
  swVersion: DeviceInfoValue;
  osName: DeviceInfoValue;
  totalStorage: DeviceInfoValue;
  totalMemory: DeviceInfoValue;
};

export type DeviceInfoName = keyof DeviceInfo;

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    manufacturer: {
      value: await DeviceInfo.getManufacturer(),
      dataType: 'string',
    },
    model: {value: DeviceInfo.getModel(), dataType: 'string'},
    swVersion: {value: DeviceInfo.getSystemVersion(), dataType: 'string'},
    osName: {value: DeviceInfo.getSystemName(), dataType: 'string'},
    totalStorage: {
      value: await DeviceInfo.getTotalDiskCapacity(),
      dataType: 'bytes',
    },
    totalMemory: {value: await DeviceInfo.getTotalMemory(), dataType: 'bytes'},
  };
}
