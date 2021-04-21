import { useContext, useState, useRef, useEffect, useCallback } from 'react';
import {
  DecryptCredentials,
  CancellationToken,
  IoTCClient,
  IOTC_CONNECT,
  IOTC_EVENTS,
  IoTCCredentials,
} from 'react-native-azure-iotcentral-client';
import { StorageContext, IoTCContext } from 'contexts';
import { Debug, EventLogger } from 'tools';
import { CommonCallback, LOG_DATA } from 'types';
import { useLogger } from './common';

export function useIoTCentralClient(
  onConnectionRefresh?: (client: IoTCClient) => void | Promise<void>,
): [IoTCClient | null, () => void] {
  const { client, setClient } = useContext(IoTCContext);
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

export type ConnectionOptions = {
  encryptionKey?: string;
  onSuccess?: CommonCallback;
  onFailure?: CommonCallback;
};

export function useConnectIoTCentralClient(): [
  (encryptedCredentials: string, options?: ConnectionOptions) => Promise<void>,
  (options?: { clear: boolean }) => void,
  { loading: boolean; client: IoTCClient | null; error: any },
] {
  const { client, connecting, setConnecting, setClient } = useContext(
    IoTCContext,
  );
  const { save: saveCredentials, credentials, initialized } = useContext(
    StorageContext,
  );
  const [error, setError] = useState<any>(null);
  const connectRequest = useRef(new CancellationToken());
  const eventLogger = useRef(new EventLogger(LOG_DATA));
  const [, append] = useLogger();

  const _connect_internal = useCallback(
    async (credentials: IoTCCredentials) => {
      let iotc: IoTCClient;
      if (credentials.connectionString) {
        iotc = IoTCClient.getFromConnectionString(credentials.connectionString);
      } else if (
        credentials.deviceId &&
        credentials.scopeId &&
        credentials.deviceKey
      ) {
        iotc = new IoTCClient(
          credentials.deviceId,
          credentials.scopeId,
          IOTC_CONNECT.DEVICE_KEY,
          credentials.deviceKey,
          eventLogger.current,
        );
        if (credentials.modelId) {
          iotc.setModelId(credentials.modelId);
        }
      } else {
        Debug(
          `Error connecting IoTC Client. Credentials invalid`,
          '_connect_internal',
          'connect_catch',
        );
        setError(`Credentials invalid`);
        setConnecting(false);
        return;
      }
      // iotc.setLogging(IOTC_LOGGING.ALL);
      try {
        iotc.on(IOTC_EVENTS.Properties, () => { });
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
    [setClient, setConnecting, setError],
  );

  const connect = useCallback(
    async (encryptedCredentials: string, options?: ConnectionOptions) => {
      setConnecting(true);
      try {
        const credentials = DecryptCredentials(
          encryptedCredentials,
          options?.encryptionKey,
        );
        await _connect_internal(credentials);
        await saveCredentials({ credentials });
      } catch (err) {
        setError(err);
      }
    },
    [setConnecting, _connect_internal, saveCredentials],
  );

  const cancel = useCallback(
    async (options?: { clear: boolean }) => {
      connectRequest.current?.cancel();
      // cleanup any credentials
      if (options?.clear) {
        //clear current credentials. connection will start over
        await saveCredentials({ credentials: null }, options.clear);
      }
      if (connecting) {
        setConnecting(false);
      }
    },
    [connecting, setConnecting, saveCredentials],
  );

  useEffect(() => {
    // run at startup if credentials are available
    if (initialized && credentials) {
      if (!client) {
        Debug(
          `Setting connecting flag`,
          'useConnectIoTCentralClient',
          'useeffect_credentials_client_connecting',
        );
        setConnecting(true);
        _connect_internal(credentials);
      } else {
        Debug(
          `Connecting client.`,
          'useConnectIoTCentralClient',
          'useeffect_credentials_client_connecting',
        );
      }
    }
  }, [initialized, client, setConnecting, _connect_internal, credentials]);

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
  const { save, simulated } = useContext(StorageContext);

  const setSimulated = async (simulated: boolean) => {
    save({ simulated });
  };
  return [simulated, setSimulated];
}


export function useDeliveryInterval(): [number, (interv: number) => Promise<void>] {
  const { deliveryInterval, save } = useContext(StorageContext);
  const setDeliveryInterval = useCallback(async (delInterval: number) => {
    await save({ deliveryInterval: delInterval });
  }, [save]);

  return [deliveryInterval, setDeliveryInterval];
}