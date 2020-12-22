import {EventEmitter} from 'events';

interface SensorId {
  id: string;
  name: string;
}

export type Vector = {x: number; y: number; z: number};

export const DATA_AVAILABLE_EVENT = 'DATA_AVAILABLE_EVENT';
export const SENSOR_UNAVAILABLE_EVENT = 'SENSOR_UNAVAILABLE_EVENT';

export interface ISensor extends SensorId, EventEmitter {
  enable(val: boolean): void | Promise<void>;
  sendInterval(val: number): void;
  simulate(val: boolean): void;
  run(): Promise<any>;
}

export function getRandom(): number {
  return Math.round(Math.random() * 20) - 10;
}
