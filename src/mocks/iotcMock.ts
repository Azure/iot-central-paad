import {
  DeviceClient,
  DeviceCredentials,
  ConnectionError,
  PHONE_MODEL_ID,
} from '../connection';

export function createSimulatedClient(
  credentials: DeviceCredentials,
): DeviceClient {
  let connected = false;
  const identity = Object.freeze({
    assignedHub: 'Offline simulation',
    deviceId: credentials.deviceId ?? 'simulated-phone',
    modelId: credentials.modelId ?? PHONE_MODEL_ID,
  });
  const submit = async () => {
    if (!connected) {
      throw new ConnectionError('NOT_CONNECTED');
    }
    return {delivery: 'simulated' as const};
  };
  return {
    id: identity.deviceId,
    identity,
    isConnected: () => connected,
    async connect({signal} = {}) {
      if (signal?.aborted) {
        throw new ConnectionError('CANCELLED');
      }
      connected = true;
      return identity;
    },
    cancel() {
      connected = false;
    },
    async disconnect() {
      connected = false;
    },
    sendTelemetry: submit,
    sendProperty: submit,
    fetchTwin: submit,
    async uploadFile() {
      throw new ConnectionError('OPERATION_FAILED');
    },
    on() {
      return () => {};
    },
  };
}
