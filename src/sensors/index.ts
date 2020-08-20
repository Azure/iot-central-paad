import { IconProps } from "react-native-elements";
import { EventEmitter } from "events";

interface SensorId {
    id: string,
    name: string
}

export const DATA_AVAILABLE_EVENT = 'DATA_AVAILABLE_EVENT';

export interface ISensor extends SensorId, EventEmitter {
    enable(val: boolean): void,
    sendInterval(val: number),
    simulate(val: boolean): void,
    run(): Promise<any>
}

export function getRandom(): number {
    return Math.round(Math.random() * 20) - 10
}