import HealthKit, {HealthKitPermissions} from 'rn-apple-healthkit';

const PERMS = HealthKit.Constants.Permissions;
const OBSERVABLES = [
  PERMS.StepCount,
  PERMS.Steps,
  PERMS.DistanceWalkingRunning,
  PERMS.DistanceCycling,
  PERMS.BodyTemperature,
  PERMS.BloodPressureDiastolic,
  PERMS.BloodPressureSystolic,
];

export const OPTIONS: HealthKitPermissions = {
  permissions: {
    read: OBSERVABLES,
    write: [],
  },
};

export async function requestPermissions(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    HealthKit.isAvailable((availError, result) => {
      if (availError) {
        return reject(availError);
      }
      HealthKit.initHealthKit(OPTIONS, (initErr, results) => {
        if (initErr) {
          return reject(initErr);
        }
        // initialize the step count observer
        HealthKit.initStepCountObserver({}, () => {
          // no need to do anything
        });
        HealthKit.setObserver({type: 'StairClimbing'});
        return resolve();
      });
    });
  });
}

export const AVAILABLE_HEALTH = {
  STEPS: 'steps',
  FLOORS: 'flightsClimbed',
};

export type HealthNames = typeof AVAILABLE_HEALTH[keyof typeof AVAILABLE_HEALTH];
