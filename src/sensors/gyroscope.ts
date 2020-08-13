import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import { gyroscope, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";

export default class Gyroscope extends EventEmitter implements ISensor {

    private enabled: boolean;
    private interval: number;
    private simulated: boolean;
    private currentRun: any;

    constructor(public id: string) {
        super();
        this.interval = 5000;
        setUpdateIntervalForType(SensorTypes.gyroscope, this.interval);
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
    }

    name: string = 'Gyroscope';

    enable(val: boolean): void {
        console.log(`Enabling ${this.id}: ${val}`);
        this.enabled = val;
        if (!this.enabled && this.currentRun) {
            this.currentRun.unsubscribe();
            this.removeAllListeners();
        }
        else {
            this.currentRun = gyroscope.subscribe(function ({ x, y, z, timestamp }) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, { x, y, z });
            }.bind(this));
        }
    }
    sendInterval(val: number) {
        this.interval = val;
        // update interval
        // if (this.enabled && this.currentRun) {
        //     this.enable(false);
        //     this.enable(true);
        // }
    }
    simulate(val: boolean): void {
        this.simulated = val;
    }

    async run() {
    }

}
