// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {Barometer as ExpoBarometer} from 'expo-sensors';
import {getRandom} from './internal';
import {MotionSensor} from './managed';

export default class Barometer extends MotionSensor<
  {pressure: number},
  number
> {
  protected hardware = ExpoBarometer;

  protected normalize({pressure}: {pressure: number}): number {
    return pressure;
  }

  protected sampleSimulation(): number {
    return getRandom(980, 1040);
  }
}
