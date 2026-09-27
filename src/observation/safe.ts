import type {
  DeviceIdentity,
  IIoTCCommand,
  IIoTCProperty,
} from '../connection/types';
import {safeNumber, safeOperationId} from '../connection/errors';
import {
  COMMAND_NAMES,
  PROPERTY_NAMES,
  TELEMETRY_NAMES,
  ObservationIdentity,
  RequestCorrelation,
  PropertySource,
} from './types';

function ownValue(value: unknown, name: string): unknown {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return Object.getOwnPropertyDescriptor(value, name)?.value;
}

function allowedName<T extends string>(
  value: string,
  names: readonly T[],
): T | null {
  return names.find(name => name === value) ?? null;
}

function presentNames<T extends string>(
  value: unknown,
  names: readonly T[],
): readonly T[] {
  return Object.freeze(
    names.filter(name => {
      const descriptor =
        value && typeof value === 'object'
          ? Object.getOwnPropertyDescriptor(value, name)
          : undefined;
      return descriptor !== undefined && 'value' in descriptor;
    }),
  );
}

export const telemetryNames = (payload: unknown) =>
  presentNames(payload, TELEMETRY_NAMES);

export function reportedNames(payload: unknown) {
  const component = ownValue(payload, 'device_info');
  return ownValue(component, '__t') === 'c'
    ? Object.freeze([
        ...presentNames(payload, PROPERTY_NAMES),
        ...presentNames(component, PROPERTY_NAMES).filter(
          name => name !== 'device_info',
        ),
      ])
    : presentNames(payload, PROPERTY_NAMES);
}

export function commandDetail(command: IIoTCCommand) {
  const requestId = safeOperationId(command.requestId);
  const correlation: RequestCorrelation =
    requestId !== undefined && requestId.length <= 64
      ? Object.freeze({category: 'requestId', value: requestId})
      : null;
  return Object.freeze({
    name: allowedName(command.name, COMMAND_NAMES),
    correlation,
  });
}

export function propertyDetail(property: IIoTCProperty) {
  const source: PropertySource =
    property.source === 'twin' || property.source === 'patch'
      ? property.source
      : 'unknown';
  return Object.freeze({
    name: allowedName(property.name, PROPERTY_NAMES),
    version: safeInteger(property.version),
    source,
  });
}

export function safeInteger(value: unknown): number | null {
  return safeNumber(value) ?? null;
}

export function observationIdentity(
  identity: DeviceIdentity | null,
): ObservationIdentity | null {
  if (!identity) {
    return null;
  }
  return Object.freeze({
    assignedHub:
      identity.assignedHub === 'Offline simulation' ||
      (typeof identity.assignedHub === 'string' &&
        /^[A-Za-z0-9.-]{1,253}$/.test(identity.assignedHub))
        ? identity.assignedHub
        : null,
    deviceId:
      typeof identity.deviceId === 'string' &&
      /^[A-Za-z0-9:._-]{1,128}$/.test(identity.deviceId)
        ? identity.deviceId
        : null,
    modelId:
      typeof identity.modelId === 'string' &&
      identity.modelId.length <= 512 &&
      /^dtmi:[A-Za-z][A-Za-z0-9_]*(?::[A-Za-z][A-Za-z0-9_]*)*;[1-9][0-9]{0,8}$/.test(
        identity.modelId,
      )
        ? identity.modelId
        : null,
  });
}
