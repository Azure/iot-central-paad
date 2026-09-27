// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import EventEmitter from 'events';
import {
  DATA_AVAILABLE_EVENT,
  ISensor,
  SENSOR_UNAVAILABLE_EVENT,
} from './internal';

export type Subscription = {remove(): void};

/** One cancellable run, including permission requests that outlive the run. */
export abstract class ManagedSensor<T> extends EventEmitter implements ISensor {
  private enabled = false;
  private simulated = false;
  private generation = 0;
  private subscription?: Subscription;

  constructor(public id: string, protected interval: number) {
    super();
  }

  enable(value: boolean): void {
    if (this.enabled === value) {
      return;
    }
    this.enabled = value;
    if (value) {
      void this.run();
    } else {
      this.stop();
    }
  }

  sendInterval(value: number): void {
    if (!Number.isFinite(value) || value <= 0 || value === this.interval) {
      return;
    }
    this.interval = value;
    if (this.enabled) {
      void this.run();
    }
  }

  simulate(value: boolean): void {
    if (this.simulated === value) {
      return;
    }
    this.simulated = value;
    if (this.enabled) {
      void this.run();
    }
  }

  private stop(): void {
    this.generation++;
    this.subscription?.remove();
    this.subscription = undefined;
  }

  async run(): Promise<void> {
    this.stop();
    if (!this.enabled) {
      return;
    }
    const generation = this.generation;
    const active = () => this.enabled && this.generation === generation;
    const emit = (data: T) => {
      if (active()) {
        this.emit(DATA_AVAILABLE_EVENT, this.id, data);
      }
    };
    const unavailable = () => {
      if (active()) {
        this.enable(false);
        this.emit(SENSOR_UNAVAILABLE_EVENT, this.id);
      }
    };
    try {
      const subscription = this.simulated
        ? this.poll(async () => this.sampleSimulation(), emit, unavailable)
        : await this.startHardware(emit, unavailable, active);
      if (active()) {
        this.subscription = subscription;
      } else {
        subscription.remove();
      }
    } catch {
      unavailable();
    }
  }

  protected poll(
    sample: () => Promise<T>,
    emit: (data: T) => void,
    unavailable: () => void,
  ): Subscription {
    let pending = false;
    let removed = false;
    const timer = setInterval(async () => {
      if (pending || removed) {
        return;
      }
      pending = true;
      try {
        const data = await sample();
        if (!removed) {
          emit(data);
        }
      } catch {
        if (!removed) {
          unavailable();
        }
      } finally {
        pending = false;
      }
    }, this.interval);
    return {
      remove() {
        removed = true;
        clearInterval(timer);
      },
    };
  }

  protected abstract sampleSimulation(): T;
  protected abstract startHardware(
    emit: (data: T) => void,
    unavailable: () => void,
    active: () => boolean,
  ): Promise<Subscription>;
}

type MotionModule<T> = {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<{granted: boolean; canAskAgain: boolean}>;
  requestPermissionsAsync(): Promise<{granted: boolean}>;
  setUpdateInterval(interval: number): void;
  addListener(listener: (data: T) => void): Subscription;
};

export abstract class MotionSensor<T, R> extends ManagedSensor<R> {
  protected abstract hardware: MotionModule<T>;
  protected abstract normalize(data: T): R;

  protected async startHardware(
    emit: (data: R) => void,
    _unavailable: () => void,
    active: () => boolean,
  ): Promise<Subscription> {
    if (!(await this.hardware.isAvailableAsync())) {
      throw new Error('Sensor unavailable');
    }
    if (!active()) {
      return {remove() {}};
    }
    let permission = await this.hardware.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain && active()) {
      permission = {
        ...permission,
        ...(await this.hardware.requestPermissionsAsync()),
      };
    }
    if (!permission.granted) {
      throw new Error('Sensor permission denied');
    }
    if (!active()) {
      return {remove() {}};
    }
    this.hardware.setUpdateInterval(this.interval);
    return this.hardware.addListener(data => emit(this.normalize(data)));
  }
}
