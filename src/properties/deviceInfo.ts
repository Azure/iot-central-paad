import DeviceInfo from 'react-native-device-info';
export type DeviceInfo = {
  manufacturer: string;
  model: string;
  swVersion: string;
  osName: string;
  processorArchitecture?: string;
  processorManufacturer?: string;
  totalStorage: number;
  totalMemory: number;
};

export type DeviceInfoName = keyof DeviceInfo;

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    manufacturer: await DeviceInfo.getManufacturer(),
    model: DeviceInfo.getModel(),
    swVersion: DeviceInfo.getSystemVersion(),
    osName: DeviceInfo.getSystemName(),
    processorArchitecture: undefined,
    processorManufacturer: undefined,
    totalStorage: await DeviceInfo.getTotalDiskCapacity(),
    totalMemory: await DeviceInfo.getTotalMemory(),
  };
}
