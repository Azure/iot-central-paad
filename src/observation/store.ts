import {Buffer} from 'buffer';
import type {
  DeviceClient,
  DeviceIdentity,
  IIoTCCommand,
} from '../connection/types';
import {reportDiagnostic} from '../connection/errors';
import {commandDetail, observationIdentity} from './safe';
import {
  ExecutionOutcome,
  Observation,
  ObservationDetail,
  ObservationLatest,
  ObservationSnapshot,
} from './types';

export const OBSERVATION_LIMITS = Object.freeze({
  history: 120,
  bytes: 64 * 1024,
  entryBytes: 4 * 1024,
});

export const EMPTY_OBSERVATION_SNAPSHOT: ObservationSnapshot = Object.freeze({
  generation: 0,
  active: false,
  simulated: false,
  identity: null,
  history: Object.freeze([]),
  latest: Object.freeze({}),
  bytes: 0,
});

type Guard = () => boolean;
type CommandScope = {
  active: Guard;
  detail: ReturnType<typeof commandDetail>;
};
const bytes = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');
let generationSequence = 0;

export class ObservationStore {
  private snapshot: ObservationSnapshot;
  private listeners = new Set<() => void>();
  private identity: DeviceIdentity | null = null;
  private identityBound = false;
  private sequence = 0;
  private started = false;
  private telemetryFailureId: number | null = null;
  private commands = new WeakMap<IIoTCCommand, CommandScope>();

  constructor(private readonly client: DeviceClient, simulated: boolean) {
    this.snapshot = Object.freeze({
      ...EMPTY_OBSERVATION_SNAPSHOT,
      generation: ++generationSequence,
      simulated,
    });
  }

  getSnapshot = (): ObservationSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: ObservationSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        reportDiagnostic(error);
      }
    }
  }

  /** A new connect owns a generation before any startup callback can arrive. */
  start(): number {
    const generation = this.started
      ? ++generationSequence
      : this.snapshot.generation;
    this.started = true;
    this.identity = null;
    this.identityBound = false;
    this.telemetryFailureId = null;
    this.publish({
      ...EMPTY_OBSERVATION_SNAPSHOT,
      generation,
      active: true,
      simulated: this.snapshot.simulated,
    });
    return this.snapshot.generation;
  }

  invalidate(force = false): void {
    if (!this.snapshot.active && !force) {
      return;
    }
    this.identity = null;
    this.identityBound = false;
    this.telemetryFailureId = null;
    this.publish({
      ...EMPTY_OBSERVATION_SNAPSHOT,
      generation: ++generationSequence,
      simulated: this.snapshot.simulated,
    });
  }

  private current(generation: number): boolean {
    if (!this.snapshot.active || generation !== this.snapshot.generation) {
      return false;
    }
    if (!this.client.isConnected()) {
      this.invalidate();
      return false;
    }
    const identity = this.client.identity ?? null;
    if (
      this.identityBound &&
      (this.identity?.assignedHub !== identity?.assignedHub ||
        this.identity?.deviceId !== identity?.deviceId ||
        this.identity?.modelId !== identity?.modelId)
    ) {
      this.invalidate();
      return false;
    }
    if (!this.identityBound) {
      this.identityBound = true;
      this.identity = identity
        ? {
            assignedHub: identity.assignedHub,
            deviceId: identity.deviceId,
            modelId: identity.modelId,
          }
        : null;
      this.publish({...this.snapshot, identity: observationIdentity(identity)});
    }
    return this.snapshot.active && generation === this.snapshot.generation;
  }

  /** Capture before asynchronous work; false means the originating session ended. */
  capture(generation = this.snapshot.generation): Guard {
    const eligible = this.snapshot.active;
    return () => eligible && this.current(generation);
  }

  captureListener(): Guard {
    const generation = this.snapshot.generation;
    const eligible = this.snapshot.active || !this.started;
    return () => eligible && this.current(generation);
  }

  record(detail: ObservationDetail, active: Guard): void {
    if (!active()) {
      return;
    }
    const observation: Observation = Object.freeze({
      ...detail,
      id: ++this.sequence,
      generation: this.snapshot.generation,
      observedAt: Date.now(),
      observer: 'device-app',
      simulated: this.snapshot.simulated,
      identity: this.snapshot.identity,
    });
    // The fixed vocabulary and bounded identity/correlation make this invariant
    // independent of payload size. Never retain a truncated arbitrary payload.
    if (bytes(observation) > OBSERVATION_LIMITS.entryBytes) {
      throw new RangeError('Observation exceeds its safe metadata bound');
    }
    const latest: ObservationLatest = Object.freeze({
      ...this.snapshot.latest,
      [observation.kind]: observation,
    });
    let retain = observation.kind !== 'telemetry';
    if (observation.kind === 'telemetry') {
      const previous = this.snapshot.latest.telemetry;
      if (observation.outcome === 'failed') {
        const repeated =
          previous?.outcome === 'failed' &&
          previous.errorCode === observation.errorCode &&
          this.snapshot.history.some(row => row.id === this.telemetryFailureId);
        retain = !repeated;
        if (retain) {
          this.telemetryFailureId = observation.id;
        }
      } else {
        this.telemetryFailureId = null;
      }
    }
    const history = retain
      ? [...this.snapshot.history, observation].slice(
          -OBSERVATION_LIMITS.history,
        )
      : [...this.snapshot.history];
    const next = {
      ...this.snapshot,
      latest,
      history,
      bytes: OBSERVATION_LIMITS.bytes,
    };
    let size = bytes(next);
    while (size > OBSERVATION_LIMITS.bytes && history.length) {
      history.shift();
      size = bytes(next);
    }
    this.publish({...next, history: Object.freeze(history), bytes: size});
  }

  bindCommand(command: IIoTCCommand, active: Guard): void {
    this.commands.set(command, {active, detail: commandDetail(command)});
  }

  beginExecution(command: IIoTCCommand): (outcome: ExecutionOutcome) => void {
    const scope = this.commands.get(command) ?? {
      active: this.capture(),
      detail: commandDetail(command),
    };
    return outcome => {
      this.record(
        {kind: 'command-execution', ...scope.detail, outcome},
        scope.active,
      );
    };
  }

  recordExecution(command: IIoTCCommand, outcome: ExecutionOutcome): void {
    this.beginExecution(command)(outcome);
  }
}
