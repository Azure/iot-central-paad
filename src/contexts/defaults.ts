export type DefaultProps = {
  emulator: boolean;
  initialized: boolean;
  dev: boolean;
  modelId: string;
};

export const defaults: DefaultProps = {
  emulator: false,
  initialized: false,
  dev: false,
  modelId: 'dtmi:azureiot:PhoneAsADevice;1',
};
