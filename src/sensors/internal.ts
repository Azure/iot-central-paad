// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import EventEmitter from 'events';

export interface ISensor extends EventEmitter {
  id: string;
  enable(val: boolean): void | Promise<void>;
  sendInterval(val: number): void;
  simulate(val: boolean): void;
  run(): Promise<any>;
}

export type Vector = {x: number; y: number; z: number};

export function getRandom(): number {
  return Math.round(Math.random() * 20) - 10;
}

export const AVAILABLE_SENSORS = {
  BATTERY: 'battery',
  ACCELEROMETER: 'accelerometer',
  MAGNETOMETER: 'magnetometer',
  BAROMETER: 'barometer',
  GEOLOCATION: 'geolocation',
  GYROSCOPE: 'gyroscope',
};

export type SensorNames =
  typeof AVAILABLE_SENSORS[keyof typeof AVAILABLE_SENSORS];
export {
  DATA_AVAILABLE_EVENT,
  SENSOR_UNAVAILABLE_EVENT,
  LOG_DATA,
} from '../types';
