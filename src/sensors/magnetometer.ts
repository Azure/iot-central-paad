import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import { magnetometer, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";

export default class Magnetometer extends EventEmitter implements ISensor {

    private enabled: boolean;
    private simulated: boolean;
    private currentRun: any;

    constructor(public id: string, private interval: number) {
        super();
        setUpdateIntervalForType(SensorTypes.magnetometer, this.interval);
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
    }

    name: string = 'Magnetometer';

    enable(val: boolean): void {
        if (this.enabled === val) {
            return;
        }
        this.enabled = val;
        if (!this.enabled && this.currentRun) {
            this.currentRun.unsubscribe();
        }
        else {
            this.currentRun = magnetometer.subscribe(function ({ x, y, z, timestamp }) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, { x, y, z });
            }.bind(this));
        }
    }
    sendInterval(val: number) {
        if (this.interval === val) {
            return;
        }
        this.interval = val;
        setUpdateIntervalForType(SensorTypes.magnetometer, this.interval);
    }
    simulate(val: boolean): void {
        this.simulated = val;
    }

    async run() {
    }

}
