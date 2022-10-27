// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useContext, useState, useRef, useEffect, useCallback} from 'react';
import {
  DecryptCredentials,
  CancellationToken,
  IIoTCClient,
  IOTC_CONNECT,
  IOTC_EVENTS,
  IoTCCredentials,
  IoTCClient,
  IOTC_LOGGING,
} from 'react-native-azure-iotcentral-client';
import {StorageContext, IoTCContext} from 'contexts';
import {Debug, EventLogger} from 'tools';
import {CommonCallback, LOG_DATA} from 'types';
import {useLogger} from './common';
import {defaults} from '../contexts/defaults';
import {IoTCMock} from 'mocks/iotcMock';

export function useIoTCentralClient(
  onConnectionRefresh?: (client: IIoTCClient) => void | Promise<void>,
): [IIoTCClient | null, any, () => void] {
  const {client, setClient} = useContext(IoTCContext);
  const {credentials} = useContext(StorageContext);
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
  return [client, credentials, clear];
}

export type ConnectionOptions = {
  restore?: boolean;
  encryptionKey?: string;
  onSuccess?: CommonCallback;
  onFailure?: CommonCallback;
};

/**
 *
 * @returns [
    connect,
    cancel,
    clear,
    {
      loading: connecting,
      client,
      error,
    },
  ];
 */
export function useConnectIoTCentralClient(): [
  (credentialsData: any, options?: ConnectionOptions) => Promise<void>,
  (options?: {clear: boolean}) => Promise<void>,
  () => void,
  {loading: boolean; client: IIoTCClient | null; error: any},
] {
  const {client, connecting, setConnecting, setClient} =
    useContext(IoTCContext);
  const {save: saveCredentials, simulated} = useContext(StorageContext);
  const [error, setError] = useState<any>(null);
  const connectRequest = useRef(new CancellationToken());
  const eventLogger = useRef(new EventLogger(LOG_DATA));
  const [, append] = useLogger();

  const IoTCentralClient = simulated ? IoTCMock : IoTCClient;

  const clear = useCallback(() => {
    setClient(null);
  }, [setClient]);

  const _connect_internal = useCallback(
    async (credentials: IoTCCredentials) => {
      let iotc: IIoTCClient;
      if (credentials.connectionString) {
        iotc = IoTCentralClient.getFromConnectionString(
          credentials.connectionString,
          eventLogger.current,
        );
      } else if (
        credentials.deviceId &&
        credentials.scopeId &&
        credentials.deviceKey
      ) {
        iotc = new IoTCentralClient(
          credentials.deviceId,
          credentials.scopeId,
          IOTC_CONNECT.DEVICE_KEY,
          credentials.deviceKey,
          eventLogger.current,
        );
        console.log('setting client');
        iotc.setLogging(IOTC_LOGGING.ALL);
      } else {
        Debug(
          'Error connecting IoTC Client. Credentials invalid',
          '_connect_internal',
          'connect_catch',
        );
        setError('Credentials invalid');
        setConnecting(false);
        throw 'Credentials invalid';
      }
      // iotc.setLogging(IOTC_LOGGING.ALL);
      try {
        iotc.setModelId(credentials.modelId ?? defaults.modelId);
        iotc.on(IOTC_EVENTS.Properties, () => {});
        // disconnect potential connected client
        if (client && client.isConnected()) {
          await client.disconnect();
        }
        await iotc.connect({
          cleanSession: false,
          timeout: 30,
          cancellationToken: connectRequest.current,
        });
        console.log('connected');
        setClient(iotc);
      } catch (err) {
        console.log('errore');
        Debug(
          `Error connecting IoTC Client: ${err}`,
          '_connect_internal',
          'connect_catch',
        );
        setError(err);
        setConnecting(false);
        throw err;
      }
    },
    [setClient, setConnecting, setError, IoTCentralClient, client],
  );

  const connect = useCallback(
    async (credentialsData: any, options?: ConnectionOptions) => {
      // Guard against double scanning a code and recieving an error from DPS for trying to connect twice
      if (connecting) {
        return;
      }

      setConnecting(true);
      try {
        let credentials;
        if (options && options.restore) {
          credentials = credentialsData;
        } else {
          credentials = DecryptCredentials(
            credentialsData,
            options?.encryptionKey,
          );
          console.log(`Decripted: ${JSON.stringify(credentials)}`);
        }
        await _connect_internal(credentials);
        await saveCredentials({credentials});
      } catch (err) {
        console.log(err);
        setError(err);
        setConnecting(false);
      }
    },
    [setConnecting, _connect_internal, saveCredentials],
  );

  const cancel = useCallback(
    async (options?: {clear: boolean}) => {
      connectRequest.current?.cancel();
      // cleanup any credentials
      if (options?.clear) {
        //clear current credentials. connection will start over
        await saveCredentials({credentials: null}, options.clear);
      }
      if (connecting) {
        setConnecting(false);
      }
      if (error) {
        setError(null);
      }
    },
    [connecting, error, setError, setConnecting, saveCredentials],
  );

  useEffect(() => {
    const currentEventLog = eventLogger.current;
    Debug(
      'Going through initial useeffect.',
      'useConnectIoTCentralClient',
      'iotc.ts:137',
    );
    currentEventLog.addListener(LOG_DATA, append);
  }, [append]);

  return [
    connect,
    cancel,
    clear,
    {
      loading: connecting,
      client,
      error,
    },
  ];
}

export function useSimulation(): [boolean, (val: boolean) => Promise<void>] {
  const {save, simulated} = useContext(StorageContext);

  const setSimulated = useCallback(
    async (simulatedVal: boolean) => {
      await save({simulated: simulatedVal});
    },
    [save],
  );
  return [simulated, setSimulated];
}

export function useDeliveryInterval(): [
  number,
  (interv: number) => Promise<void>,
] {
  const {deliveryInterval, save} = useContext(StorageContext);
  const setDeliveryInterval = useCallback(
    async (delInterval: number) => {
      await save({deliveryInterval: delInterval});
    },
    [save],
  );

  return [deliveryInterval, setDeliveryInterval];
}
