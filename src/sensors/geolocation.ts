// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as Location from 'expo-location';
import {getRandom} from './internal';
import {ManagedSensor, Subscription} from './managed';

type Position = {lat: number; lon: number; alt: number | null};

export default class GeoLocation extends ManagedSensor<Position> {
  protected sampleSimulation(): Position {
    return {
      lat: getRandom(-90, 90),
      lon: getRandom(-180, 180),
      alt: getRandom(),
    };
  }

  protected async startHardware(
    emit: (data: Position) => void,
    unavailable: () => void,
    active: () => boolean,
  ): Promise<Subscription> {
    if (!(await Location.hasServicesEnabledAsync())) {
      throw new Error('Location services disabled');
    }
    if (!active()) {
      return {remove() {}};
    }
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain && active()) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) {
      throw new Error('Location permission denied');
    }
    if (!active()) {
      return {remove() {}};
    }
    let lastSent = -Infinity;
    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: this.interval,
        distanceInterval: 0,
      },
      ({coords}) => {
        // iOS does not implement timeInterval, so throttle actual fixes here.
        const now = Date.now();
        if (now - lastSent >= this.interval) {
          lastSent = now;
          emit({
            lat: coords.latitude,
            lon: coords.longitude,
            alt: coords.altitude,
          });
        }
      },
      unavailable,
    );
  }
}
