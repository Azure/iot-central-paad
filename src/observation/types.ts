import type {ConnectionErrorCode} from '../connection/errors';
import type {SubmissionResult} from '../connection/types';

export const COMMAND_NAMES = [
  'lightOn',
  'sensors*enableSensors',
  'sensors*changeInterval',
] as const;
export const PROPERTY_NAMES = [
  'device_info',
  'writeableProp',
  'readOnlyProp',
  'manufacturer',
  'model',
  'swVersion',
  'osName',
  'processorArchitecture',
  'processorManufacturer',
  'totalStorage',
  'totalMemory',
  'bleDeviceName',
  'paadProof',
] as const;
export const TELEMETRY_NAMES = [
  'battery',
  'accelerometer',
  'magnetometer',
  'barometer',
  'geolocation',
  'gyroscope',
  'temperature',
  'humidity',
  'rssi',
  'paadProofNonce',
  'paadProofPlatform',
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];
export type PropertyName = (typeof PROPERTY_NAMES)[number];
export type TelemetryName = (typeof TELEMETRY_NAMES)[number];
export type ExecutionOutcome = 'completed' | 'requested' | 'rejected';
export type PropertySource = 'twin' | 'patch' | 'unknown';
export type ObservationIdentity = Readonly<{
  assignedHub: string | null;
  deviceId: string | null;
  modelId: string | null;
}>;
export type RequestCorrelation = Readonly<{
  category: 'requestId';
  value: string;
}> | null;

type Failure = {outcome: 'failed'; errorCode: ConnectionErrorCode};
type Submission = {outcome: SubmissionResult['delivery']} | Failure;
type CommandDetail = {
  name: CommandName | null;
  correlation: RequestCorrelation;
};
type PropertyDetail = {
  name: PropertyName | null;
  version: number | null;
  source: PropertySource;
};

export type ObservationDetail =
  | ({kind: 'telemetry'; names: readonly TelemetryName[]} & Submission)
  | ({kind: 'reported-property'; names: readonly PropertyName[]} & Submission)
  | ({kind: 'twin-request'} & Submission)
  | ({kind: 'command'; outcome: 'observed'} & CommandDetail)
  | ({
      kind: 'command-reply';
      response: 'success' | 'error' | 'unknown';
    } & CommandDetail &
      Submission)
  | ({kind: 'command-execution'; outcome: ExecutionOutcome} & CommandDetail)
  | ({kind: 'desired-property'; outcome: 'observed'} & PropertyDetail)
  | ({kind: 'property-ack'} & PropertyDetail & Submission)
  | ({
      kind: 'upload';
    } & ({outcome: 'acknowledged'; status: number | null} | Failure));

export type ObservationKind = ObservationDetail['kind'];
export type Observation = Readonly<
  ObservationDetail & {
    id: number;
    generation: number;
    observedAt: number;
    observer: 'device-app';
    simulated: boolean;
    identity: ObservationIdentity | null;
  }
>;
export type ObservationLatest = {
  readonly [Kind in ObservationKind]?: Extract<Observation, {kind: Kind}>;
};
export type ObservationSnapshot = Readonly<{
  generation: number;
  active: boolean;
  simulated: boolean;
  identity: ObservationIdentity | null;
  history: readonly Observation[];
  latest: ObservationLatest;
  bytes: number;
}>;
