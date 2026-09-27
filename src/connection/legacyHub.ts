import {
  IoTCClient as VendorClient,
  IOTC_CONNECT,
  CancellationToken,
} from 'react-native-azure-iotcentral-client';
import {ConnectionError, safeError, reportDiagnostic} from './errors';
import {bounded, checkAbort} from './http';
import {
  ClientOptions,
  CommandCallback,
  DeviceIdentity,
  IIoTCCommandResponse,
  JsonObject,
  JsonValue,
  PropertyCallback,
  SubmissionResult,
} from './types';
import {record} from './credentials';
import {IOT_HUB_API_VERSION} from './protocol';

type Mqtt = {
  connect(options: Record<string, unknown>): Promise<void>;
  subscribe(topic: string, options: {timeout: number}): Promise<unknown>;
  send(topic: string, payload: string, qos: number, retained: boolean): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  _client: {
    webSocket: typeof WebSocket;
    socket?: {readyState: number; close(): void} | null;
    _disconnected(): void;
  };
};
type LegacyInternals = {
  mqttClient?: Mqtt;
  connected: boolean;
  receivedDisconnession: boolean;
  clientConnect(config: {
    cleanSession: boolean;
    timeout: number;
  }): Promise<void>;
  subscribe(): Promise<void>;
  onMessageReceived(message: {
    destinationName: string;
    payloadString: string;
  }): void;
};

export interface HubTransport {
  connect(
    signal: AbortSignal,
    timeoutMs: number,
    cleanSession: boolean,
  ): Promise<void>;
  close(): void;
  isConnected(): boolean;
  sendTelemetry(
    payload: JsonValue,
    properties?: Record<string, string>,
  ): SubmissionResult;
  sendProperty(payload: JsonObject): SubmissionResult;
  fetchTwin(): SubmissionResult;
}

/**
 * Version-specific containment of 1.1.10. Its DPS, retry loop, logger, upload,
 * and unbounded reconnect behavior are never used. The vendor is private.
 */
export function createLegacyHub(
  identity: DeviceIdentity,
  password: string,
  socket: ClientOptions['secureWebSocket'],
  onCommand: CommandCallback,
  onProperty: PropertyCallback,
  onLost: () => void,
): HubTransport {
  const silent = {log() {}, debug() {}, setLogLevel() {}};
  const vendor = new VendorClient(
    identity.deviceId,
    '',
    IOTC_CONNECT.CONN_STRING,
    {host: identity.assignedHub, password},
    silent,
  );
  const internal = vendor as unknown as LegacyInternals;
  internal.receivedDisconnession = true;
  vendor.setModelId(identity.modelId);
  let closed = false;
  let requestId = 0;
  let activeSignal: AbortSignal;
  const ensure = () => {
    if (closed || !internal.connected || !internal.mqttClient) {
      throw new ConnectionError('NOT_CONNECTED');
    }
    return internal.mqttClient;
  };
  const publish = (topic: string, payload: string): SubmissionResult => {
    try {
      ensure().send(topic, payload, 0, false);
      return {delivery: 'submitted'};
    } catch (error) {
      throw safeError(error);
    }
  };
  const sendProperty = (payload: JsonObject) =>
    publish(
      `$iothub/twin/PATCH/properties/reported/?$rid=${++requestId}`,
      JSON.stringify(payload),
    );
  const fetchTwin = () => publish(`$iothub/twin/GET/?$rid=${++requestId}`, '');
  const close = () => {
    closed = true;
    internal.receivedDisconnession = true;
    internal.connected = false;
    const mqtt = internal.mqttClient;
    if (mqtt) {
      const pendingSocket = mqtt._client.socket;
      try {
        mqtt._client._disconnected();
      } catch (error) {
        reportDiagnostic(error);
      }
      // Paho's teardown closes OPEN sockets only; close CONNECTING sockets too.
      if (pendingSocket?.readyState === 0) {
        try {
          pendingSocket.close();
        } catch (error) {
          reportDiagnostic(error);
        }
      }
      internal.mqttClient = undefined;
    }
  };
  internal.clientConnect = async config => {
    checkAbort(activeSignal);
    if (!socket || socket.rejectsRedirects !== true) {
      // RN's stock WebSocket follows redirects. Never silently trust it.
      throw new ConnectionError('SECURE_TRANSPORT_REQUIRED');
    }
    if (closed) {
      throw new ConnectionError('CANCELLED');
    }
    const mqtt = internal.mqttClient;
    if (!mqtt?._client || typeof mqtt._client._disconnected !== 'function') {
      throw new ConnectionError('CONNECT_FAILED');
    }
    mqtt._client.webSocket = socket.implementation;
    mqtt.on('connectionLost', () => {
      internal.connected = false;
      if (!closed) {
        close();
        onLost();
      }
    });
    await bounded(
      mqtt.connect({
        userName: `${identity.assignedHub}/${
          identity.deviceId
        }/?api-version=${IOT_HUB_API_VERSION}&model-id=${encodeURIComponent(
          identity.modelId,
        )}`,
        password,
        timeout: config.timeout * 1000,
        cleanSession: config.cleanSession,
        delay: 0,
      }),
      activeSignal,
    );
    checkAbort(activeSignal);
    if (closed) {
      throw new ConnectionError('CANCELLED');
    }
    internal.connected = true;
  };
  internal.subscribe = async () => {
    for (const topic of [
      '$iothub/twin/res/#',
      '$iothub/twin/PATCH/properties/desired/#',
      '$iothub/methods/POST/#',
    ]) {
      checkAbort(activeSignal);
      // A single enclosing deadline owns cancellation; no Paho subscription timers.
      await bounded(ensure().subscribe(topic, {timeout: 0}), activeSignal);
    }
  };
  vendor.fetchTwin = async () => {
    fetchTwin();
  };
  const dispatchProperties = (value: unknown, source: 'twin' | 'patch') => {
    const desired = record(value);
    const version = desired.$version;
    if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
      return;
    }
    for (const [name, raw] of Object.entries(desired)) {
      if (name.startsWith('$')) {
        continue;
      }
      let propertyValue = raw as JsonValue;
      if (
        raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        !('__t' in raw && raw.__t === 'c') &&
        Object.prototype.hasOwnProperty.call(raw, 'value')
      ) {
        propertyValue = (raw as JsonObject).value;
      }
      Promise.resolve(
        onProperty({
          name,
          value: propertyValue,
          version,
          source,
          ack: async (message = 'Property applied') => {
            const acknowledgement = (item: JsonValue): JsonObject => ({
              value: item,
              ac: 200,
              av: version,
              ad: message,
            });
            if (
              propertyValue &&
              typeof propertyValue === 'object' &&
              !Array.isArray(propertyValue) &&
              propertyValue.__t === 'c'
            ) {
              const component: JsonObject = {__t: 'c'};
              for (const [property, item] of Object.entries(propertyValue)) {
                if (property !== '__t' && !property.startsWith('$')) {
                  component[property] = acknowledgement(item);
                }
              }
              return sendProperty({[name]: component});
            }
            return sendProperty({[name]: acknowledgement(propertyValue)});
          },
        }),
      ).catch(reportDiagnostic);
    }
  };
  internal.onMessageReceived = message => {
    if (closed || message.payloadString.length > 262144) {
      return;
    }
    try {
      const {destinationName: topic, payloadString: payload} = message;
      if (topic.startsWith('$iothub/twin/PATCH/properties/desired/')) {
        dispatchProperties(JSON.parse(payload), 'patch');
      } else if (topic.startsWith('$iothub/twin/res/200/')) {
        const twin = record(JSON.parse(payload));
        if (twin.desired) {
          dispatchProperties(twin.desired, 'twin');
        }
      } else {
        const match =
          /^\$iothub\/methods\/POST\/([^/]+)\/\?\$rid=([^&]+)$/.exec(topic);
        if (!match) {
          return;
        }
        const id = decodeURIComponent(match[2]);
        Promise.resolve(
          onCommand({
            name: decodeURIComponent(match[1]),
            requestId: id,
            requestPayload: payload,
            reply: async (status, body) => {
              if (
                ![
                  IIoTCCommandResponse.SUCCESS,
                  IIoTCCommandResponse.ERROR,
                ].includes(status) ||
                typeof body !== 'string'
              ) {
                throw new ConnectionError('OPERATION_FAILED');
              }
              return publish(
                `$iothub/methods/res/${
                  status === IIoTCCommandResponse.SUCCESS ? 200 : 500
                }/?$rid=${encodeURIComponent(id)}`,
                body,
              );
            },
          }),
        ).catch(reportDiagnostic);
      }
    } catch (error) {
      reportDiagnostic(error);
    }
  };
  return {
    async connect(signal, timeoutMs, cleanSession) {
      activeSignal = signal;
      const token = new CancellationToken();
      const abort = () => {
        token.cancel();
        close();
      };
      signal.addEventListener('abort', abort, {once: true});
      let work: Promise<unknown> | undefined;
      try {
        checkAbort(signal);
        work = vendor.connect({
          timeout: timeoutMs / 1000,
          cleanSession,
          cancellationToken: token,
        });
        await bounded(work, signal);
        checkAbort(signal);
        if (!internal.connected || closed) {
          throw new ConnectionError('CONNECT_FAILED');
        }
      } catch (error) {
        close();
        // All overridden vendor awaits are abortable. Drain its timeout wrappers
        // before returning cancellation, so no vendor timers outlive this attempt.
        await work?.catch(() => {});
        checkAbort(signal);
        throw safeError(error, 'CONNECT_FAILED');
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
    close,
    isConnected: () => !closed && internal.connected,
    sendProperty,
    fetchTwin,
    sendTelemetry(payload, properties) {
      const query = properties
        ? Object.entries(properties)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join('&')
        : '';
      return publish(
        `devices/${identity.deviceId}/messages/events/${query}`,
        JSON.stringify(payload),
      );
    },
  };
}
