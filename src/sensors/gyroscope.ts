import {EventEmitter} from 'events';
import {
  ISensor,
  DATA_AVAILABLE_EVENT,
  getRandom,
  Vector,
  SENSOR_UNAVAILABLE_EVENT,
} from './index';
import {
  gyroscope,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import {Log} from '../tools/CustomLogger';

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
    } else {
      this.run();
    }
  }
  sendInterval(val: number) {
    if (this.interval === val) {
      return;
    }
    this.interval = val;
    if (!this.simulated) {
      setUpdateIntervalForType(SensorTypes.gyroscope, this.interval);
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
      const intId = setInterval(
        function (this: Gyroscope) {
          this.emit(DATA_AVAILABLE_EVENT, this.id, {
            x: getRandom(),
            y: getRandom(),
            z: getRandom(),
          });
        }.bind(this),
        this.interval,
      );
      this.currentRun = {
        unsubscribe: () => {
          clearInterval(intId);
        },
      };
    } else {
      this.currentRun = gyroscope.subscribe(
        function (this: Gyroscope, {x, y, z}: Vector) {
          this.emit(DATA_AVAILABLE_EVENT, this.id, {x, y, z});
        }.bind(this),
        function (this: Gyroscope, error: any) {
          if (error) {
            Log(`${this.name} is not available`);
            this.enable(false);
            this.emit(SENSOR_UNAVAILABLE_EVENT, this.id);
          }
        }.bind(this),
      );
    }
  }
}
