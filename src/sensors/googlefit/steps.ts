import HealthKit from 'rn-apple-healthkit';
import { EventEmitter } from 'events';
import { ISensor, DATA_AVAILABLE_EVENT, getRandom } from '../index';
import { requestPermissions } from './index';
import { NativeAppEventEmitter } from 'react-native';
import { HealthValue } from 'rn-apple-healthkit';
import GoogleFit from 'react-native-google-fit';
import { GoogleFitStepResult } from '../../types';

export default class GoogleFitSteps extends EventEmitter implements ISensor {

    private enabled: boolean;
    private simulated: boolean;
    private currentRun: any;
    private initialized: boolean;
    private simulatedStepCount: number;
    private realStepCount: number;

    constructor(public id: string, private interval: number) {
        super();
        this.enabled = false;
        this.simulated = false;
        this.currentRun = null;
        this.initialized = false;
        this.simulatedStepCount = 0;
        this.realStepCount = 0;
    }

    name: string = 'Steps';

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
            const intId = setInterval(function (this: GoogleFitSteps) {
                this.emit(DATA_AVAILABLE_EVENT, this.id, this.simulatedStepCount += 5);
            }.bind(this), this.interval);
            this.currentRun = {
                unsubscribe: () => {
                    clearInterval(intId);
                }
            }
        }
        else {
            this.currentRun = GoogleFit.observeSteps(function (this: GoogleFitSteps, err: boolean, result: any) {
                if (err) {
                    console.log(`Error from Google Fit observe Steps`);
                    return;
                }
                this.emit(DATA_AVAILABLE_EVENT, this.id, this.realStepCount += result.steps);
            }.bind(this));

            let startDate = new Date();
            startDate.setDate(startDate.getDate() - 1);
            const results = await GoogleFit.getDailyStepCountSamples({ startDate: startDate.toISOString(), endDate: new Date().toISOString() }) as GoogleFitStepResult[];
            console.log(JSON.stringify(results));
            results.forEach(function (this: GoogleFitSteps, result: any) {
                if (result.steps && result.steps.length > 0) {
                    const currentValue = result.steps[result.steps.length - 1].value;
                    if (currentValue && currentValue > 0) {
                        this.realStepCount = currentValue;
                    }
                    this.emit(DATA_AVAILABLE_EVENT, this.id, this.realStepCount);
                }
            }.bind(this));

        }
    }

}
