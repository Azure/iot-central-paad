import HealthKit from 'rn-apple-healthkit';
import {EventEmitter} from 'events';
import {NativeAppEventEmitter} from 'react-native';
import {HealthValue} from 'rn-apple-healthkit';
import {DATA_AVAILABLE_EVENT, LOG_DATA, ISensor} from 'sensors/internal';
import {requestPermissions} from '../internal';

export default class HealthKitSteps extends EventEmitter implements ISensor {
  private enabled: boolean;
  private simulated: boolean;
  private currentRun: any;
  private initialized: boolean;
  private simulatedStepCount: number;

  constructor(public id: string, private interval: number) {
    super();
    this.enabled = false;
    this.simulated = false;
    this.currentRun = null;
    this.initialized = false;
    this.simulatedStepCount = 0;
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
    } else {
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
      const intId = setInterval(
        function (this: HealthKitSteps) {
          this.emit(
            DATA_AVAILABLE_EVENT,
            this.id,
            (this.simulatedStepCount += 5),
          );
        }.bind(this),
        this.interval,
      );
      this.currentRun = {
        unsubscribe: () => {
          clearInterval(intId);
        },
      };
    } else {
      this.currentRun = NativeAppEventEmitter.addListener(
        'change:steps',
        (data) => {
          HealthKit.getStepCount(
            {},
            function (this: HealthKitSteps, err: string, result: HealthValue) {
              if (err) {
                this.emit(
                  LOG_DATA,
                  `Error from Apple HealthKit - Steps:\n${
                    (err as any).message
                  }`,
                );
                return;
              }
              this.emit(DATA_AVAILABLE_EVENT, this.id, result.value);
            }.bind(this),
          );
        },
      );
      let currentValue = 0;
      try {
        currentValue = await new Promise((res, rej) =>
          HealthKit.getStepCount({}, (err, result) => {
            err ? rej(err) : res(result.value);
          }),
        );
        this.emit(LOG_DATA, currentValue);
      } catch (e) {
        this.emit(LOG_DATA, e);
      } // do nothing
      this.emit(DATA_AVAILABLE_EVENT, this.id, currentValue);
    }
  }
}
