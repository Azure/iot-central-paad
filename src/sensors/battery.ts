import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import { IconProps } from 'react-native-elements';
import { Platform } from 'react-native';

export default class Battery extends EventEmitter implements ISensor {

    private enabled: boolean;
    private interval: number;
    private simulated: boolean;
    private currentRun: number;

    constructor(public id: string) {
        super();
        this.interval = 5000;
        this.enabled = false;
        this.simulated = false;
        this.currentRun = -1;
    }

    name: string = 'Battery Level';

    enable(val: boolean): void {
        this.enabled = val;
        if (!this.enabled && this.currentRun) {
            clearInterval(this.currentRun);
            this.removeAllListeners();
        }
        else {
            //@ts-ignore
            this.currentRun = setInterval(async function (this: ISensor) {
                const val = Math.floor((await this.run()) * 100);
                this.emit(DATA_AVAILABLE_EVENT, this.id, val);
            }.bind(this), this.interval);
        }
    }
    sendInterval(val: number) {
        this.interval = val;
        // update interval
        if (this.enabled && this.currentRun) {
            this.enable(false);
            this.enable(true);
        }
    }
    simulate(val: boolean): void {
        this.simulated = val;
    }

    async run() {
        if (this.simulated) {
            return Promise.resolve(Math.random());
        }
        return DeviceInfo.getBatteryLevel();
    }

}
