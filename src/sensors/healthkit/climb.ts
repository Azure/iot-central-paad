import HealthKit, { SampleResult } from 'rn-apple-healthkit';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT, getRandom } from '../index';
import { OPTIONS, requestPermissions } from './index';
import { NativeAppEventEmitter } from 'react-native';
import { HealthValue } from 'rn-apple-healthkit';

export default class HealthKitClimb extends EventEmitter implements ISensor {

    private enabled: boolean;
    private simulated: boolean;
    private currentRun: any;
    private initialized: boolean;
    private simulatedFloorsCount: number;

    constructor(public id: string, private interval: number) {
        super();
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
        this.initialized = false;
        this.simulatedFloorsCount = 0;
    }

    name: string = 'Floor Climbed';

    async enable(val: boolean): Promise<void> {
        if (!this.initialized) {
            await requestPermissions();
            this.initialized = true;
        }
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
            const intId = setInterval(function (this: HealthKitClimb) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, this.simulatedFloorsCount += 1);
            }.bind(this), this.interval);
            this.currentRun = {
                unsubscribe: () => {
                    clearInterval(intId);
                }
            }
        }
        else {
            this.currentRun = NativeAppEventEmitter.addListener('observer', (data) => {
                HealthKit.getFlightsClimbed({}, function (this: HealthKitClimb, err: object, result: SampleResult[]) {
                    if (err) {
                        console.log(`Error from Apple HealthKit - Climbs:\n${(err as any).message}`);
                        return;
                    }
                    this.emit(DATA_AVAILABLE_EVENT, this.id, result);
                }.bind(this));
            });
            let currentValue = 0;
            try {
                currentValue = await new Promise((res, rej) => HealthKit.getFlightsClimbed({}, (err, result) => { err ? rej(err) : res(result[result.length-1].value); }));
                console.log(currentValue);
            }
            catch (e) { }// do nothing
            this.emit(DATA_AVAILABLE_EVENT, this.id, currentValue);
        }
    }

}
