import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import { IconProps } from 'react-native-elements';
import { Platform } from 'react-native';

export default class Battery extends EventEmitter implements ISensor {

    private enabled: boolean;
    private simulated: boolean;
    private currentRun: any;

    constructor(public id: string, private interval: number) {
        super();
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
    }

    name: string = 'Battery Level';

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
        if (this.enabled && this.currentRun) {
            this.enable(false);
            this.enable(true);
        }
    }

    simulate(val: boolean): void {
        if (this.simulated === val) {
            return;
        }
        this.simulated = val;
        if (this.enabled && this.currentRun) {
            this.enable(false);
            this.enable(true);
        }
    }

    async run() {
        let intId: number;
        if (this.simulated) {
            intId = setInterval(function (this: Battery) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, Math.floor(Math.random() * 100));
            }.bind(this), this.interval);

        }
        else {
            intId = setInterval(async function (this: Battery) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, Math.floor((await DeviceInfo.getBatteryLevel()) * 100));
            }.bind(this), this.interval);
        }
        this.currentRun = {
            unsubscribe: () => {
                clearInterval(intId);
            }
        }
    }

}
