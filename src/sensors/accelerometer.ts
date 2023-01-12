// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  ISensor,
  DATA_AVAILABLE_EVENT,
  getRandom,
  Vector,
  SENSOR_UNAVAILABLE_EVENT,
} from './internal';
import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import EventEmitter from 'events';
import {Platform} from 'react-native';

export default class Accelerometer extends EventEmitter implements ISensor {
  private enabled: boolean;
  private simulated: boolean;
  private currentRun: any;

  constructor(public id: string, private interval: number) {
    super();
    setUpdateIntervalForType(SensorTypes.accelerometer, this.interval);
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
      setUpdateIntervalForType(SensorTypes.accelerometer, this.interval);
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

  getNormalizedData(x: number, y: number, z: number): Vector {
    // iOS returns accelerometer data in G's and Android returns it in m/s^2
    // normalize to m/s^2

    if (Platform.OS === 'ios') {
      return {
        x: x * 9.81,
        y: y * 9.81,
        z: z * 9.81,
      };
    }

    return {x, y, z};
  }

  async run() {
    if (this.simulated) {
      const intId = setInterval(
        function (this: Accelerometer) {
          this.emit(DATA_AVAILABLE_EVENT, this.id, {
            // Make limits +-2g
            x: getRandom(-19.62, 19.62),
            y: getRandom(-19.62, 19.62),
            z: getRandom(-19.62, 19.62),
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
      this.currentRun = accelerometer.subscribe(
        function (this: Accelerometer, {x, y, z}: Vector) {
          this.emit(
            DATA_AVAILABLE_EVENT,
            this.id,
            this.getNormalizedData(x, y, z),
          );
        }.bind(this),
        function (this: Accelerometer, error: any) {
          if (error) {
            this.enable(false);
            this.emit(SENSOR_UNAVAILABLE_EVENT, this.id);
          }
        }.bind(this),
      );
    }
  }
}
