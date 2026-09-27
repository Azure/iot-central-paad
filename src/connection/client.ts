import {decodeCredentials, parseConnectionString} from './credentials';
import {provision, sasToken} from './dps';
import {ConnectionError, safeError, reportDiagnostic} from './errors';
import {abortWithError, checkAbort, deadline, defaultHttp} from './http';
import {createLegacyHub, HubTransport} from './legacyHub';
import {
  ClientOptions,
  CommandCallback,
  ConnectOptions,
  DeviceClient,
  DeviceIdentity,
  IIoTCCommand,
  IIoTCProperty,
  IOTC_EVENTS,
  PropertyCallback,
} from './types';
import {upload} from './upload';

function validateJson(value: unknown, depth = 0): void {
  if (depth > 32) {
    throw new ConnectionError('OPERATION_FAILED');
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return;
  }
  if (
    value &&
    typeof value === 'object' &&
    (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)
  ) {
    for (const descriptor of Object.values(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if (descriptor.get || descriptor.set) {
        throw new ConnectionError('OPERATION_FAILED');
      }
      validateJson(descriptor.value, depth + 1);
    }
    return;
  }
  throw new ConnectionError('OPERATION_FAILED');
}

export function createDeviceClient(
  input: unknown,
  options: ClientOptions = {},
): DeviceClient {
  const stage = (
    value: Parameters<NonNullable<ClientOptions['onStage']>>[0],
    error?: ConnectionError,
  ) => {
    try {
      options.onStage?.(value, error);
    } catch (error) {
      reportDiagnostic(error);
    }
  };
  stage('validating');
  let credentials;
  try {
    credentials = decodeCredentials(input, options.encryptionKey);
  } catch (error) {
    const safe = safeError(error, 'INVALID_CREDENTIALS');
    stage('error', safe);
    throw safe;
  }
  const initialId = credentials.deviceId!;
  const http = options.http ?? defaultHttp;
  let identity: DeviceIdentity | null = null;
  let transport: HubTransport | undefined;
  let pending: ReturnType<typeof deadline> | undefined;
  let password = '';
  let operationId: string | undefined;
  const uploads = new Set<ReturnType<typeof deadline>>();
  const commandListeners = new Set<CommandCallback>();
  const propertyListeners = new Set<PropertyCallback>();
  const emit = <T>(
    listeners: Set<(value: T) => void | Promise<void>>,
    value: T,
  ) => {
    for (const listener of listeners) {
      try {
        Promise.resolve(listener(value)).catch(reportDiagnostic);
      } catch (error) {
        reportDiagnostic(error);
      }
    }
  };
  const connected = () => {
    if (!transport?.isConnected()) {
      throw new ConnectionError('NOT_CONNECTED');
    }
    return transport;
  };
  const cancel = () => {
    if (pending) {
      abortWithError(pending.controller, new ConnectionError('CANCELLED'));
    }
    for (const task of uploads) {
      abortWithError(task.controller, new ConnectionError('CANCELLED'));
    }
    transport?.close();
    password = '';
  };
  return {
    get id() {
      return identity?.deviceId ?? initialId;
    },
    get identity() {
      return identity;
    },
    isConnected: () => transport?.isConnected() ?? false,
    async connect(connectOptions: ConnectOptions = {}) {
      if (pending) {
        throw new ConnectionError('BUSY');
      }
      if (transport?.isConnected() && identity) {
        return identity;
      }
      transport?.close();
      operationId = undefined;
      const task = deadline(
        connectOptions.timeoutMs ?? options.timeoutMs ?? 60000,
        connectOptions.signal,
      );
      pending = task;
      const signal = task.controller.signal;
      try {
        checkAbort(signal);
        if (credentials.connectionString) {
          const direct = parseConnectionString(credentials.connectionString);
          identity = Object.freeze({
            assignedHub: direct.assignedHub,
            deviceId: direct.deviceId,
            modelId: credentials.modelId!,
          });
          password = sasToken(
            `${identity.assignedHub}/devices/${identity.deviceId}`,
            direct.deviceKey,
          );
        } else {
          stage('provisioning');
          identity = await provision(credentials, http, signal, value => {
            operationId = value;
          });
          password = sasToken(
            `${identity.assignedHub}/devices/${identity.deviceId}`,
            credentials.deviceKey!,
          );
        }
        checkAbort(signal);
        stage('connecting');
        let established = false;
        transport = createLegacyHub(
          identity,
          password,
          options.secureWebSocket,
          command => emit<IIoTCCommand>(commandListeners, command),
          property => emit<IIoTCProperty>(propertyListeners, property),
          () => {
            password = '';
            stage(
              'error',
              new ConnectionError(
                established ? 'CONNECTION_LOST' : 'CONNECT_FAILED',
              ),
            );
          },
        );
        await transport.connect(
          signal,
          connectOptions.timeoutMs ?? options.timeoutMs ?? 60000,
          connectOptions.cleanSession ?? true,
        );
        checkAbort(signal);
        established = true;
        stage('connected');
        return identity;
      } catch (error) {
        transport?.close();
        password = '';
        const safe = safeError(error, 'CONNECT_FAILED');
        const reported = new ConnectionError(safe.code, {
          status: safe.status,
          serviceCode: safe.serviceCode,
          operationId: safe.operationId ?? operationId,
        });
        stage('error', reported);
        throw reported;
      } finally {
        task.close();
        pending = undefined;
      }
    },
    cancel,
    async disconnect() {
      cancel();
    },
    async sendTelemetry(payload, properties) {
      validateJson(payload);
      if (
        properties &&
        (Object.getPrototypeOf(properties) !== Object.prototype ||
          Object.values(properties).some(v => typeof v !== 'string'))
      ) {
        throw new ConnectionError('OPERATION_FAILED');
      }
      return connected().sendTelemetry(payload, properties);
    },
    async sendProperty(payload) {
      validateJson(payload);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        throw new ConnectionError('OPERATION_FAILED');
      }
      return connected().sendProperty(payload);
    },
    async fetchTwin() {
      return connected().fetchTwin();
    },
    async uploadFile(fileName, contentType, data, encoding) {
      connected();
      const task = deadline(options.timeoutMs ?? 60000);
      uploads.add(task);
      try {
        return await upload(
          identity!,
          password,
          http,
          task.controller.signal,
          fileName,
          contentType,
          data,
          encoding,
        );
      } catch (error) {
        checkAbort(task.controller.signal);
        throw safeError(error);
      } finally {
        task.close();
        uploads.delete(task);
      }
    },
    on(
      event: IOTC_EVENTS | 'Commands' | 'Properties',
      callback: CommandCallback | PropertyCallback,
    ) {
      if (event === IOTC_EVENTS.Commands || event === 'Commands') {
        commandListeners.add(callback as CommandCallback);
        return () => {
          commandListeners.delete(callback as CommandCallback);
        };
      }
      if (event === IOTC_EVENTS.Properties || event === 'Properties') {
        propertyListeners.add(callback as PropertyCallback);
        return () => {
          propertyListeners.delete(callback as PropertyCallback);
        };
      }
      throw new ConnectionError('OPERATION_FAILED');
    },
  };
}
