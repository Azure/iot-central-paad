import {useContext, useState, useRef, useEffect, useCallback} from 'react';
import {
  DecryptCredentials,
  CancellationToken,
  IoTCClient,
  IOTC_CONNECT,
  IOTC_EVENTS,
  IoTCCredentials,
} from 'react-native-azure-iotcentral-client';
import {StorageContext, IoTCContext} from 'contexts';
import {Debug, EventLogger} from 'tools';
import {CommonCallback, LOG_DATA} from 'types';
import {useLogger} from './common';

export function useIoTCentralClient(
  onConnectionRefresh?: (client: IoTCClient) => void | Promise<void>,
): [IoTCClient | null, () => void] {
  const {client, setClient} = useContext(IoTCContext);
  const previousConnectionStatus = useRef(false);

  const clear = useCallback(() => {
    setClient(null);
  }, [setClient]);

  useEffect(() => {
    if (client && onConnectionRefresh) {
      const id = setInterval(async () => {
        const currentConnectionStatus = client.isConnected();
        if (currentConnectionStatus !== previousConnectionStatus.current) {
          previousConnectionStatus.current = currentConnectionStatus;
          if (currentConnectionStatus) {
            // only if re-connection
            await onConnectionRefresh(client);
          }
        }
      }, 3000);
      return () => clearInterval(id);
    }
  }, [client, onConnectionRefresh]);
  return [client, clear];
}

type ConnectionOptions = {
  encryptionKey?: string;
  onSuccess?: CommonCallback;
  onFailure?: CommonCallback;
};

export function useConnectIoTCentralClient(): [
  (encryptedCredentials: string, options?: ConnectionOptions) => Promise<void>,
  () => void,
  {loading: boolean; client: IoTCClient | null; error: any},
] {
  const {client, connecting, setConnecting, setClient} = useContext(
    IoTCContext,
  );
  const {save: store, credentials} = useContext(StorageContext);
  const [error, setError] = useState(null);
  const connectRequest = useRef(new CancellationToken());
  const eventLogger = useRef(new EventLogger(LOG_DATA));
  const [, append] = useLogger();

  const _connect_internal = useCallback(
    async (credentials: IoTCCredentials) => {
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
        Debug(
          `Error connecting IoTC Client: ${err}`,
          '_connect_internal',
          'connect_catch',
        );
        setError(err);
        setConnecting(false);
      }
    },
    [setClient, setError, setConnecting],
  );

  const connect = async (
    encryptedCredentials: string,
    options?: ConnectionOptions,
  ) => {
    setConnecting(true);
    const credentials = DecryptCredentials(
      encryptedCredentials,
      options?.encryptionKey,
    );
    await _connect_internal(credentials);
    await store({credentials});
  };

  const cancel = () => {
    connectRequest.current.cancel();
  };

  useEffect(() => {
    // run at startup if credentials are available
    if (credentials) {
      if (!connecting && !client) {
        Debug(
          `Setting connecting flag`,
          'useConnectIoTCentralClient',
          'useeffect_credentials_client_connecting',
        );
        setConnecting(true);
      } else if (connecting && !client) {
        Debug(
          `Connecting client. Connecting: ${connecting}.`,
          'useConnectIoTCentralClient',
          'useeffect_credentials_client_connecting',
        );
        _connect_internal(credentials);
      }
    }
  }, [client, setConnecting, connecting, credentials, _connect_internal]);

  useEffect(() => {
    const currentEventLog = eventLogger.current;
    Debug(
      `Going through initial useeffect.`,
      'useConnectIoTCentralClient',
      'iotc.ts:137',
    );
    currentEventLog.addListener(LOG_DATA, append);
    return () => {
      currentEventLog.removeListener(LOG_DATA, append);
    };
  }, [append]);

  return [
    connect,
    cancel,
    {
      loading: connecting,
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
