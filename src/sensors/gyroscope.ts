import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import { gyroscope, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";

export default class Gyroscope extends EventEmitter implements ISensor {

    private enabled: boolean;
    private simulated: boolean;
    private currentRun: any;

    constructor(public id: string, private interval: number) {
        super();
        setUpdateIntervalForType(SensorTypes.gyroscope, this.interval);
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
    }

    name: string = 'Gyroscope';

    enable(val: boolean): void {
        if (this.enabled === val) {
            return;
        }
        this.enabled = val;
        if (!this.enabled && this.currentRun) {
            this.currentRun.unsubscribe();
        }
        else {
            this.currentRun = gyroscope.subscribe(function ({ x, y, z, timestamp }) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, { x, y, z });
            }.bind(this));
        }
    }
    sendInterval(val: number) {
        if (this.interval === val) {
            return;
        }
        this.interval = val;
        setUpdateIntervalForType(SensorTypes.gyroscope, this.interval);
    }
    simulate(val: boolean): void {
        this.simulated = val;
    }

    async run() {
    }

}
