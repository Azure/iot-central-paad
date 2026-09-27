// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {Accelerometer as ExpoAccelerometer} from 'expo-sensors';
import {getRandom, Vector} from './internal';
import {MotionSensor} from './managed';

export default class Accelerometer extends MotionSensor<Vector, Vector> {
  protected hardware = ExpoAccelerometer;

  getNormalizedData(x: number, y: number, z: number): Vector {
    // Expo reports g on both platforms; the telemetry model expects m/s².
    return {x: x * 9.81, y: y * 9.81, z: z * 9.81};
  }

  protected normalize({x, y, z}: Vector): Vector {
    return this.getNormalizedData(x, y, z);
  }

  protected sampleSimulation(): Vector {
    return {
      x: getRandom(-19.62, 19.62),
      y: getRandom(-19.62, 19.62),
      z: getRandom(-19.62, 19.62),
    };
  }
}
