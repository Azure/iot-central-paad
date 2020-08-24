import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT, getRandom } from './index';
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
            this.run();
        }
    }
    sendInterval(val: number) {
        if (this.interval === val) {
            return;
        }
        this.interval = val;
        if (!this.simulated) {
            setUpdateIntervalForType(SensorTypes.barometer, this.interval);
        }
        if (this.simulated && this.enabled && this.currentRun) {
            this.enable(false);
            this.enable(true);
        }
    }

    simulate(val: boolean): void {
        if (this.simulated === val) {
            return;
        }
        this.simulated = val;
        if (this.simulated && this.enabled && this.currentRun) {
            this.enable(false);
            this.enable(true);
        }
    }

    async run() {
        if (this.simulated) {
            const intId = setInterval(function (this: Barometer) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, { pressure: getRandom() });
            }.bind(this), this.interval);
            this.currentRun = {
                unsubscribe: () => {
                    clearInterval(intId);
                }
            }
        }
        else {
            this.currentRun = barometer.subscribe(function (this: Barometer, { pressure }: { pressure: number }) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, pressure);
            }.bind(this));
        }
    }

}
