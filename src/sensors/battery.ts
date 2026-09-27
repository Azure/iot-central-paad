// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as ExpoBattery from 'expo-battery';
import {ManagedSensor, Subscription} from './managed';

export default class Battery extends ManagedSensor<number> {
  protected sampleSimulation(): number {
    return Math.floor(Math.random() * 100);
  }

  protected async startHardware(
    emit: (data: number) => void,
    unavailable: () => void,
    active: () => boolean,
  ): Promise<Subscription> {
    if (!(await ExpoBattery.isAvailableAsync())) {
      throw new Error('Battery unavailable');
    }
    if (!active()) {
      return {remove() {}};
    }
    return this.poll(
      async () => {
        const level = await ExpoBattery.getBatteryLevelAsync();
        if (!Number.isFinite(level) || level < 0 || level > 1) {
          throw new Error('Battery unavailable');
        }
        return Math.floor(level * 100);
      },
      emit,
      unavailable,
    );
  }
}
