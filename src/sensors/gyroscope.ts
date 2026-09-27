// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {Gyroscope as ExpoGyroscope} from 'expo-sensors';
import {getRandom, Vector} from './internal';
import {MotionSensor} from './managed';

export default class Gyroscope extends MotionSensor<Vector, Vector> {
  protected hardware = ExpoGyroscope;

  protected normalize({x, y, z}: Vector): Vector {
    // Both Expo and the original native adapter report radians per second.
    return {x, y, z};
  }

  protected sampleSimulation(): Vector {
    return {x: getRandom(), y: getRandom(), z: getRandom()};
  }
}
