// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {EventEmitter} from 'events';
import {
  ISensor,
  DATA_AVAILABLE_EVENT,
  getRandom,
  Vector,
  SENSOR_UNAVAILABLE_EVENT,
} from './internal';
import {
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';

export default class Magnetometer extends EventEmitter implements ISensor {
  private enabled: boolean;
  private simulated: boolean;
  private currentRun: any;

  constructor(public id: string, private interval: number) {
    super();
    setUpdateIntervalForType(SensorTypes.magnetometer, this.interval);
    this.enabled = false;
    this.simulated = false;
    this.currentRun = null;
  }

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
      setUpdateIntervalForType(SensorTypes.magnetometer, this.interval);
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
        function (this: Magnetometer) {
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
      this.currentRun = magnetometer.subscribe(
        function (this: Magnetometer, {x, y, z}: Vector) {
          this.emit(DATA_AVAILABLE_EVENT, this.id, {x, y, z});
        }.bind(this),
        function (this: Magnetometer, error: any) {
          if (error) {
            this.enable(false);
            this.emit(SENSOR_UNAVAILABLE_EVENT, this.id);
          }
        }.bind(this),
      );
    }
  }
}
