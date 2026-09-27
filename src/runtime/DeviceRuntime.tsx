// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import {Alert} from 'react-native';
import {
  useLogger,
  useSensors,
  useProperties,
  useDeliveryInterval,
  useIoTCentralClient,
} from 'hooks';
import {
  IIoTCClient,
  IIoTCCommand,
  IIoTCCommandResponse,
  IIoTCProperty,
  IOTC_EVENTS,
  ConnectionError,
  JsonValue,
} from '../connection';
import {
  DATA_AVAILABLE_EVENT,
  ENABLE_DISABLE_COMMAND,
  ItemProps,
  LIGHT_TOGGLE_COMMAND,
  PROPERTY,
  SET_FREQUENCY_COMMAND,
  TELEMETRY,
} from 'types';
import Strings, {resolveString} from 'strings';
import {playTorch} from '../tools/Torch';
import {ExecutionOutcome, getObservationStore} from '../observation';
import {PropertyDraftProvider} from './propertyDrafts';

export async function executeCommand(
  command: IIoTCCommand,
  sensors: ItemProps[],
  append: (item: {eventName: string; eventData: string}) => void,
  observed?: (outcome: ExecutionOutcome) => void,
) {
  let status = IIoTCCommandResponse.ERROR;
  let outcome: ExecutionOutcome = 'rejected';
  let response: Record<string, unknown> = {
    error: 'Invalid or unavailable command',
  };
  try {
    if (
      typeof command.requestPayload !== 'string' ||
      command.requestPayload.length > 4096
    ) {
      throw new Error('Invalid command');
    }
    const data: unknown = JSON.parse(command.requestPayload);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid command');
    }
    const input = data as Record<string, unknown>;
    if (command.name === LIGHT_TOGGLE_COMMAND) {
      const {pulses, duration, delay = 1} = input;
      if (
        typeof pulses !== 'number' ||
        !Number.isInteger(pulses) ||
        pulses < 1 ||
        pulses > 100 ||
        typeof duration !== 'number' ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 60 ||
        typeof delay !== 'number' ||
        !Number.isFinite(delay) ||
        delay < 0 ||
        delay > 60
      ) {
        throw new Error('Invalid command');
      }
      await playTorch(pulses, duration, delay);
      response = {execution: 'completed'};
      outcome = 'completed';
    } else {
      const sensor = sensors.find(item => item.id === input.sensor);
      if (!sensor) {
        throw new Error('Invalid command');
      }
      if (
        command.name === ENABLE_DISABLE_COMMAND &&
        typeof input.enable === 'boolean'
      ) {
        if (input.enable && sensor.availability === 'unavailable') {
          throw new Error('Unavailable sensor');
        }
        await sensor.enable(input.enable);
        response = {enabled: input.enable, execution: 'requested'};
        outcome = 'requested';
      } else if (
        command.name === SET_FREQUENCY_COMMAND &&
        typeof input.interval === 'number' &&
        Number.isFinite(input.interval) &&
        input.interval >= 1 &&
        input.interval <= 3600 &&
        sensor.availability !== 'unavailable'
      ) {
        sensor.sendInterval(input.interval * 1000);
        response = {interval: input.interval};
        outcome = 'requested';
      } else {
        throw new Error('Invalid command');
      }
    }
    status = IIoTCCommandResponse.SUCCESS;
  } catch {
    append({
      eventName: 'ERROR',
      eventData: 'Command rejected or execution failed.',
    });
  }
  observed?.(outcome);
  try {
    await command.reply(status, JSON.stringify(response));
  } catch {
    append({
      eventName: 'ERROR',
      eventData: 'Command response could not be submitted.',
    });
  }
}

type DeviceRuntime = {
  client: IIoTCClient | null;
  sensors: ItemProps[];
  properties: ItemProps[];
  propertiesLoading: boolean;
  submitProperty(item: ItemProps, value: JsonValue): Promise<void>;
};

const RuntimeContext = createContext<DeviceRuntime | null>(null);

export function useDeviceRuntime(): DeviceRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error('DeviceRuntimeProvider is required');
  }
  return runtime;
}

/** One owner above the destinations; tool screens only consume this state. */
export function DeviceRuntimeProvider({children}: {children: React.ReactNode}) {
  const [, append] = useLogger();
  const [sensors, addSensorListener, removeSensorListener] = useSensors();
  const [deliveryInterval] = useDeliveryInterval();
  const {
    loading: propertiesLoading,
    properties,
    updateProperty,
  } = useProperties();
  const propertyRef = useRef(properties);
  propertyRef.current = properties;
  const sensorRef = useRef(sensors);
  sensorRef.current = sensors;

  const onConnectionRefresh = useCallback(async (client: IIoTCClient) => {
    const active = getObservationStore(client)?.capture();
    await client.fetchTwin();
    if (active && !active()) {
      throw new ConnectionError('CANCELLED');
    }
    await client.sendProperty({
      [PROPERTY]: {
        __t: 'c',
        ...propertyRef.current
          .filter(property => property.value !== undefined)
          .reduce(
            (obj, property) => ({...obj, [property.id]: property.value}),
            {},
          ),
      },
    });
  }, []);
  const [client] = useIoTCentralClient(onConnectionRefresh);
  const currentClient = useRef(client);
  currentClient.current = client;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sendTelemetry = useCallback(
    async (id: string, value: JsonValue) => {
      if (client?.isConnected()) {
        try {
          await client.sendTelemetry({[id]: value}, {'$.sub': TELEMETRY});
        } catch {
          append({
            eventName: 'ERROR',
            eventData: 'Telemetry could not be submitted.',
          });
        }
      }
    },
    [client, append],
  );

  const onCommand = useCallback(
    (command: IIoTCCommand) =>
      executeCommand(
        command,
        sensorRef.current,
        append,
        getObservationStore(client)?.beginExecution(command),
      ),
    [append, client],
  );
  const onProperty = useCallback(
    async (property: IIoTCProperty) => {
      const {name, value} = property;
      if (
        name !== PROPERTY &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.__t === 'c'
      ) {
        return;
      }
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.__t === 'c'
      ) {
        for (const [field, entry] of Object.entries(value)) {
          if (field !== '__t') {
            updateProperty(field, entry);
          }
        }
      } else {
        updateProperty(name, value);
      }
      try {
        await property.ack();
      } catch {
        append({
          eventName: 'ERROR',
          eventData: 'Property response could not be submitted.',
        });
      }
    },
    [updateProperty, append],
  );

  useEffect(() => {
    const currentSensors = sensorRef.current;
    let unsubscribeCommands: (() => void) | undefined;
    let unsubscribeProperties: (() => void) | undefined;
    if (client) {
      currentSensors.forEach(sensor =>
        addSensorListener(sensor.id, DATA_AVAILABLE_EVENT, sendTelemetry),
      );
      append({eventName: 'INFO', eventData: 'Sensor initialized.'});
      append({eventName: 'INFO', eventData: 'Properties initialized.'});
      unsubscribeCommands = client.on(IOTC_EVENTS.Commands, onCommand);
      unsubscribeProperties = client.on(IOTC_EVENTS.Properties, onProperty);
      // Preserve the existing initial fetch AND the connection-refresh fetch.
      client.fetchTwin().catch(() => {
        append({
          eventName: 'ERROR',
          eventData: 'Device twin could not be requested.',
        });
      });
    }
    return () => {
      unsubscribeCommands?.();
      unsubscribeProperties?.();
      currentSensors.forEach(sensor =>
        removeSensorListener(sensor.id, DATA_AVAILABLE_EVENT, sendTelemetry),
      );
    };
  }, [
    client,
    addSensorListener,
    removeSensorListener,
    sendTelemetry,
    append,
    onCommand,
    onProperty,
  ]);

  useEffect(() => {
    if (
      Number.isFinite(deliveryInterval) &&
      deliveryInterval >= 1 &&
      deliveryInterval <= 3600
    ) {
      sensorRef.current.forEach(sensor =>
        sensor.sendInterval(deliveryInterval * 1000),
      );
    }
  }, [deliveryInterval]);

  const submitProperty = useCallback(
    async (item: ItemProps, value: JsonValue) => {
      const active = () => mounted.current && currentClient.current === client;
      try {
        if (!client?.isConnected()) {
          throw new ConnectionError('NOT_CONNECTED');
        }
        const submission = await client.sendProperty({
          [PROPERTY]: {__t: 'c', [item.id]: value},
        });
        if (active() && client.isConnected()) {
          Alert.alert(
            'Property',
            resolveString(
              submission.delivery === 'simulated'
                ? Strings.Client.Properties.Delivery.Simulated
                : Strings.Client.Properties.Delivery.Success,
              item.name,
            ),
            [{text: 'OK'}],
          );
        }
      } catch {
        if (active()) {
          Alert.alert(
            'Property',
            resolveString(
              Strings.Client.Properties.Delivery.Failure,
              item.name,
            ),
            [{text: 'OK'}],
          );
        }
      }
    },
    [client],
  );

  return (
    <RuntimeContext.Provider
      value={{client, sensors, properties, propertiesLoading, submitProperty}}>
      <PropertyDraftProvider properties={properties}>
        {children}
      </PropertyDraftProvider>
    </RuntimeContext.Provider>
  );
}
