import {useContext, useState, useRef} from 'react';
import {
  DecryptCredentials,
  CancellationToken,
  IoTCClient,
  IOTC_CONNECT,
  IOTC_EVENTS,
} from 'react-native-azure-iotcentral-client';
import {StorageContext, IoTCContext} from 'contexts';
import {Log, EventLogger} from 'tools';
import {LOG_DATA} from 'types';

export function useIoTCentralClient(): IoTCClient | null {
  const {client} = useContext(IoTCContext);
  return client;
}

export function useConnectIoTCentralClient(): [
  (encryptedCredentials: string, encryptionKey?: string) => Promise<void>,
  () => void,
  {loading: boolean; client: IoTCClient | null; error: any},
] {
  const {client, setClient} = useContext(IoTCContext);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState(null);
  const connectRequest = useRef(new CancellationToken());
  const eventLogger = useRef(new EventLogger(LOG_DATA));

  const connect = async (
    encryptedCredentials: string,
    encryptionKey?: string,
  ) => {
    setLoading(true);
    const credentials = DecryptCredentials(encryptedCredentials, encryptionKey);
    Log('Connecting Iotcentral client');
    const iotc = new IoTCClient(
      credentials.deviceId,
      credentials.scopeId,
      IOTC_CONNECT.DEVICE_KEY,
      credentials.deviceKey,
      eventLogger.current,
    );
    if (credentials.modelId) {
      iotc.setModelId(credentials.modelId);
    }
    // iotc.setLogging(IOTC_LOGGING.ALL);
    try {
      iotc.on(IOTC_EVENTS.Properties, () => {});
      await iotc.connect({
        cleanSession: false,
        timeout: 20,
        cancellationToken: connectRequest.current,
      });
      setClient(iotc);
    } catch (err) {
      setError(err);
    }
    setLoading(false);
  };

  const cancel = () => {
    connectRequest.current.cancel();
  };

  return [
    connect,
    cancel,
    {
      loading,
      client,
      error,
    },
  ];
}

export function useSimulation(): [boolean, (val: boolean) => Promise<void>] {
  const {save, simulated} = useContext(StorageContext);

  const setSimulated = async (simulated: boolean) => {
    save({simulated});
  };
  return [simulated, setSimulated];
}
