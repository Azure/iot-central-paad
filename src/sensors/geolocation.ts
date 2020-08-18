import DeviceInfo from 'react-native-device-info';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT } from './index';
import Geolocation from '@react-native-community/geolocation';

export default class GeoLocation extends EventEmitter implements ISensor {

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

    name: string = 'GeoLocation';

    enable(val: boolean): void {
        this.enabled = val;
        if (!this.enabled && this.currentRun) {
            clearInterval(this.currentRun);
            this.removeAllListeners();
        }
        else {
            //@ts-ignore
            this.currentRun = setInterval(async function (this: ISensor) {
                const val = await this.run();
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
        return new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(({ coords }) => {
                if (coords) {
                    resolve({ lat: coords.latitude, lon: coords.longitude });
                }
            }, (error) => {
                if (error) {
                    reject(error);
                }
            });
        });
    }

}
