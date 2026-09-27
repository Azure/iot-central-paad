// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {Magnetometer as ExpoMagnetometer} from 'expo-sensors';
import {getRandom, Vector} from './internal';
import {MotionSensor} from './managed';

export default class Magnetometer extends MotionSensor<Vector, Vector> {
  protected hardware = ExpoMagnetometer;

  protected normalize({x, y, z}: Vector): Vector {
    return {x, y, z};
  }

  protected sampleSimulation(): Vector {
    return {x: getRandom(), y: getRandom(), z: getRandom()};
  }
}
