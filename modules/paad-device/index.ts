export type SocketEvent = {
  id: string;
  type: 'open' | 'message' | 'error' | 'close';
  protocol?: string;
  data?: string;
  code?: number;
  wasClean?: boolean;
};

export interface PaadDeviceNative {
  addListener(
    name: 'socketEvent',
    listener: (event: SocketEvent) => void,
  ): {remove(): void};
  connect(id: string, url: string, protocols: string[]): void;
  send(id: string, base64: string): void;
  close(id: string, code: number, reason: string): void;
  hasTorch(): Promise<boolean>;
}

let binding: PaadDeviceNative | undefined;

export function getPaadDevice(): PaadDeviceNative {
  if (!binding) {
    // Loading an app or an unsupported platform must not load native hardware.
    const {requireNativeModule} =
      require('expo-modules-core') as typeof import('expo-modules-core');
    binding = requireNativeModule<PaadDeviceNative>('PaadDevice');
  }
  return binding;
}
