import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import { barometer, setUpdateIntervalForType, SensorTypes } from "react-native-sensors";

export default class Barometer extends EventEmitter implements ISensor {

    private enabled: boolean;
    private simulated: boolean;
    private currentRun: any;

    constructor(public id: string, private interval: number) {
        super();
        setUpdateIntervalForType(SensorTypes.barometer, this.interval);
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
    }

    name: string = 'Barometer';

    enable(val: boolean): void {
        if (this.enabled === val) {
            return;
        }
        this.enabled = val;
        if (!this.enabled && this.currentRun) {
            this.currentRun.unsubscribe();
        }
        else {
            this.currentRun = barometer.subscribe(function ({ pressure }) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, pressure);
            }.bind(this));
        }
    }
    sendInterval(val: number) {
        if (this.interval === val) {
            return;
        }
        this.interval = val;
        setUpdateIntervalForType(SensorTypes.barometer, this.interval);
    }
    simulate(val: boolean): void {
        this.simulated = val;
    }

    async run() {
    }

}
