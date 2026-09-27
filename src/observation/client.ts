import {ConnectionError, safeError} from '../connection/errors';
import {
  CommandCallback,
  DeviceClient,
  IIoTCCommand,
  IIoTCCommandResponse,
  IIoTCProperty,
  IOTC_EVENTS,
  PropertyCallback,
} from '../connection/types';
import {
  commandDetail,
  propertyDetail,
  reportedNames,
  safeInteger,
  telemetryNames,
} from './safe';
import {ObservationStore} from './store';
import {ObservationDetail} from './types';

const stores = new WeakMap<DeviceClient, ObservationStore>();

export function getObservationStore(
  client: DeviceClient | null | undefined,
): ObservationStore | null {
  return client ? stores.get(client) ?? null : null;
}

/** Decorate one candidate before connect; do not add subscriptions or SDK calls. */
export function observeClient(
  client: DeviceClient,
  simulated: boolean,
): DeviceClient {
  const store = new ObservationStore(client, simulated);
  let commands = new WeakMap<IIoTCCommand, IIoTCCommand>();
  let properties = new WeakMap<IIoTCProperty, IIoTCProperty>();
  let connecting = false;

  async function observe<Result>(
    operation: () => Promise<Result>,
    success: (result: Result) => ObservationDetail,
    failure: (
      errorCode: ReturnType<typeof safeError>['code'],
    ) => ObservationDetail,
    active = store.capture(),
  ): Promise<Result> {
    let result: Result;
    try {
      result = await operation();
    } catch (error) {
      store.record(failure(safeError(error).code), active);
      throw error;
    }
    store.record(success(result), active);
    return result;
  }

  function on(
    event: IOTC_EVENTS.Commands | 'Commands',
    callback: CommandCallback,
  ): () => void;
  function on(
    event: IOTC_EVENTS.Properties | 'Properties',
    callback: PropertyCallback,
  ): () => void;
  function on(
    ...args:
      | [IOTC_EVENTS.Commands | 'Commands', CommandCallback]
      | [IOTC_EVENTS.Properties | 'Properties', PropertyCallback]
  ): () => void {
    // Pre-connect subscriptions belong to the first connect, never a later one.
    const active = store.captureListener();
    if (args[0] === IOTC_EVENTS.Commands || args[0] === 'Commands') {
      const [event, callback] = args;
      return client.on(event, command => {
        if (!active()) {
          return;
        }
        let wrapped = commands.get(command);
        if (!wrapped) {
          const detail = commandDetail(command);
          wrapped = {
            ...command,
            reply(status, message) {
              const response =
                status === IIoTCCommandResponse.SUCCESS
                  ? 'success'
                  : status === IIoTCCommandResponse.ERROR
                  ? 'error'
                  : 'unknown';
              return observe(
                () => command.reply(status, message),
                result => ({
                  kind: 'command-reply',
                  ...detail,
                  response,
                  outcome: result.delivery,
                }),
                errorCode => ({
                  kind: 'command-reply',
                  ...detail,
                  response,
                  outcome: 'failed',
                  errorCode,
                }),
                active,
              );
            },
          };
          commands.set(command, wrapped);
          store.bindCommand(wrapped, active);
          store.record(
            {kind: 'command', ...detail, outcome: 'observed'},
            active,
          );
        }
        if (active()) {
          return callback(wrapped);
        }
      });
    }
    if (args[0] === IOTC_EVENTS.Properties || args[0] === 'Properties') {
      const [event, callback] = args;
      return client.on(event, property => {
        if (!active()) {
          return;
        }
        let wrapped = properties.get(property);
        if (!wrapped) {
          const detail = propertyDetail(property);
          wrapped = {
            ...property,
            ack(...ackArgs) {
              return observe(
                () => property.ack(...ackArgs),
                result => ({
                  kind: 'property-ack',
                  ...detail,
                  outcome: result.delivery,
                }),
                errorCode => ({
                  kind: 'property-ack',
                  ...detail,
                  outcome: 'failed',
                  errorCode,
                }),
                active,
              );
            },
          };
          properties.set(property, wrapped);
          store.record(
            {kind: 'desired-property', ...detail, outcome: 'observed'},
            active,
          );
        }
        if (active()) {
          return callback(wrapped);
        }
      });
    }
    throw new ConnectionError('OPERATION_FAILED');
  }

  const decorated: DeviceClient = {
    get id() {
      return client.id;
    },
    get identity() {
      return client.identity;
    },
    isConnected() {
      const connected = client.isConnected();
      if (!connected) {
        store.invalidate();
      } else {
        store.capture()();
      }
      return connected;
    },
    async connect(options) {
      if (connecting) {
        return client.connect(options);
      }
      connecting = true;
      const generation = store.start();
      commands = new WeakMap();
      properties = new WeakMap();
      const active = store.capture(generation);
      const abort = () => {
        if (store.getSnapshot().generation === generation) {
          store.invalidate();
        }
      };
      options?.signal?.addEventListener('abort', abort, {once: true});
      if (options?.signal?.aborted) {
        abort();
      }
      try {
        const result = await client.connect(options);
        active();
        return result;
      } catch (error) {
        abort();
        throw error;
      } finally {
        options?.signal?.removeEventListener('abort', abort);
        connecting = false;
      }
    },
    cancel() {
      store.invalidate(true);
      client.cancel();
    },
    disconnect() {
      store.invalidate(true);
      return client.disconnect();
    },
    sendTelemetry(payload, attributes) {
      const names = telemetryNames(payload);
      return observe(
        () => client.sendTelemetry(payload, attributes),
        result => ({kind: 'telemetry', names, outcome: result.delivery}),
        errorCode => ({kind: 'telemetry', names, outcome: 'failed', errorCode}),
      );
    },
    sendProperty(payload) {
      const names = reportedNames(payload);
      return observe(
        () => client.sendProperty(payload),
        result => ({
          kind: 'reported-property',
          names,
          outcome: result.delivery,
        }),
        errorCode => ({
          kind: 'reported-property',
          names,
          outcome: 'failed',
          errorCode,
        }),
      );
    },
    fetchTwin() {
      return observe(
        () => client.fetchTwin(),
        result => ({kind: 'twin-request', outcome: result.delivery}),
        errorCode => ({kind: 'twin-request', outcome: 'failed', errorCode}),
      );
    },
    uploadFile(...args) {
      return observe(
        () => client.uploadFile(...args),
        result => ({
          kind: 'upload',
          outcome: result.delivery,
          status: safeInteger(result.status),
        }),
        errorCode => ({kind: 'upload', outcome: 'failed', errorCode}),
      );
    },
    on,
  };
  stores.set(decorated, store);
  return decorated;
}
