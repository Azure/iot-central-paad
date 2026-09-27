// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useContext, useRef, useEffect, useCallback} from 'react';
import {
  createDeviceClient,
  decodeCredentials,
  ConnectionError,
  DeviceClient,
  DeviceCredentials,
} from '../connection';
import {safeError} from '../connection/errors';
import {StorageContext, IoTCContext} from 'contexts';
import {CommonCallback} from 'types';
import {createSimulatedClient} from '../mocks/iotcMock';
import {secureWebSocket} from '../platform';
import {getObservationStore, observeClient} from '../observation';

export function useIoTCentralClient(
  onConnectionRefresh?: (client: DeviceClient) => void | Promise<void>,
): [DeviceClient | null, DeviceCredentials | null, () => void] {
  const {client, setClient, setError} = useContext(IoTCContext);
  const {credentials} = useContext(StorageContext);
  const previous = useRef(false);
  const clear = useCallback(() => {
    client?.cancel();
    setClient(null);
  }, [client, setClient]);
  useEffect(() => {
    previous.current = false;
    if (!client || !onConnectionRefresh) {
      return;
    }
    let active = true;
    let refreshing = false;
    const id = setInterval(async () => {
      const connected = client.isConnected();
      if (connected && !previous.current && !refreshing) {
        refreshing = true;
        previous.current = true;
        try {
          await onConnectionRefresh(client);
        } catch (error) {
          if (active) {
            setError(safeError(error));
          }
        } finally {
          refreshing = false;
        }
      } else {
        previous.current = connected;
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [client, onConnectionRefresh, setError]);
  return [client, credentials, clear];
}

export type ConnectionOptions = {
  restore?: boolean;
  encryptionKey?: string;
  onSuccess?: CommonCallback;
  onFailure?: CommonCallback;
};
export type ConnectionResult = {ok: true} | {ok: false; error: ConnectionError};

export function useConnectIoTCentralClient() {
  const {
    client,
    connecting,
    setConnecting,
    setClient,
    error,
    setError,
    stage,
    setStage,
    request,
  } = useContext(IoTCContext);
  const {save, simulated} = useContext(StorageContext);
  const clear = useCallback(
    (options?: {disconnected?: boolean}) => {
      request.current?.controller.abort();
      request.current?.client?.cancel();
      client?.cancel();
      setClient(null);
      setConnecting(false);
      setStage(options?.disconnected ? 'disconnected' : 'idle');
      setError(null);
    },
    [request, client, setClient, setConnecting, setStage, setError],
  );

  const connect = useCallback(
    async (
      input: unknown,
      options?: ConnectionOptions,
    ): Promise<ConnectionResult> => {
      if (request.current) {
        const busy = new ConnectionError('BUSY');
        setError(busy);
        return {ok: false, error: busy};
      }
      const attempt: {controller: AbortController; client?: DeviceClient} = {
        controller: new AbortController(),
      };
      request.current = attempt;
      setConnecting(true);
      setError(null);
      setStage('validating');
      try {
        const credentials = decodeCredentials(input, options?.encryptionKey);
        if (client) {
          await client.disconnect();
          setClient(null);
        }
        const candidate = observeClient(
          simulated
            ? createSimulatedClient(credentials)
            : createDeviceClient(credentials, {
                secureWebSocket,
                onStage(next, failure) {
                  if (!attempt.controller.signal.aborted) {
                    if (next === 'error') {
                      getObservationStore(attempt.client)?.invalidate();
                    }
                    setStage(next);
                    if (failure) {
                      setError(failure);
                    }
                  }
                },
              }),
          simulated,
        );
        attempt.client = candidate;
        await candidate.connect({
          signal: attempt.controller.signal,
          cleanSession: true,
          timeoutMs: 90000,
        });
        if (attempt.controller.signal.aborted) {
          throw new ConnectionError('CANCELLED');
        }
        try {
          await save({credentials});
        } catch {
          throw new ConnectionError('STORAGE_FAILED');
        }
        if (attempt.controller.signal.aborted) {
          throw new ConnectionError('CANCELLED');
        }
        setClient(candidate);
        setError(null);
        setStage('connected');
        await options?.onSuccess?.();
        return {ok: true};
      } catch (failure) {
        attempt.client?.cancel();
        const safe = attempt.controller.signal.aborted
          ? new ConnectionError('CANCELLED')
          : safeError(failure, 'CONNECT_FAILED');
        setError(safe.code === 'CANCELLED' ? null : safe);
        setStage(safe.code === 'CANCELLED' ? 'idle' : 'error');
        if (safe.code !== 'CANCELLED') {
          await options?.onFailure?.(safe);
        }
        return {ok: false, error: safe};
      } finally {
        if (request.current === attempt) {
          request.current = null;
          setConnecting(false);
        }
      }
    },
    [
      request,
      setConnecting,
      setError,
      setStage,
      client,
      simulated,
      save,
      setClient,
    ],
  );

  const cancel = useCallback(
    async (options?: {clear: boolean}) => {
      request.current?.controller.abort();
      request.current?.client?.cancel();
      setConnecting(false);
      setStage('idle');
      setError(null);
      if (options?.clear) {
        try {
          await save({credentials: null});
          clear();
        } catch {
          const failure = new ConnectionError('STORAGE_FAILED');
          setError(failure);
          setStage('error');
          throw failure;
        }
      }
    },
    [request, setConnecting, setStage, setError, save, clear],
  );

  return [
    connect,
    cancel,
    clear,
    {loading: connecting, client, error, stage},
  ] as const;
}

export function useSimulation(): [boolean, (val: boolean) => Promise<void>] {
  const {save, simulated} = useContext(StorageContext);
  const {client, setClient, setError, setStage, setConnecting, request} =
    useContext(IoTCContext);
  const setSimulated = useCallback(
    async (value: boolean) => {
      try {
        request.current?.controller.abort();
        request.current?.client?.cancel();
        client?.cancel();
        setClient(null);
        setConnecting(false);
        setStage('idle');
        setError(null);
        await save({simulated: value});
      } catch (failure) {
        const safe = safeError(failure, 'STORAGE_FAILED');
        setError(safe);
        throw safe;
      }
    },
    [client, request, setClient, setStage, setConnecting, save, setError],
  );
  return [simulated, setSimulated];
}

export function useDeliveryInterval(): [
  number,
  (interval: number) => Promise<void>,
] {
  const {save, deliveryInterval} = useContext(StorageContext);
  const setDeliveryInterval = useCallback(
    async (interval: number) => {
      if (!Number.isFinite(interval) || interval < 1 || interval > 3600) {
        throw new Error(
          'Delivery interval must be between 1 and 3600 seconds.',
        );
      }
      await save({deliveryInterval: interval});
    },
    [save],
  );
  return [deliveryInterval, setDeliveryInterval];
}
