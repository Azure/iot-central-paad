// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export type DefaultProps = {
  emulator: boolean;
  initialized: boolean;
  dev: boolean;
  modelId: string;
  packageNameIOS: string;
  packageNameAndroid: string;
};

export const defaults: DefaultProps = {
  emulator: false,
  initialized: false,
  dev: false,
  modelId: 'dtmi:azureiot:PhoneAsADevice;2',
  packageNameIOS: 'com.microsoft.iotpnp',
  packageNameAndroid: 'com.iot_pnp',
};
