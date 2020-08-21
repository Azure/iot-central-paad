import HealthKit, { HealthKitPermissions } from 'rn-apple-healthkit';

const PERMS = HealthKit.Constants.Permissions;
const OBSERVABLES = [PERMS.StepCount, PERMS.DistanceWalkingRunning, PERMS.DistanceCycling, PERMS.BodyTemperature, PERMS.BloodPressureDiastolic, PERMS.BloodPressureSystolic];

export const OPTIONS: HealthKitPermissions = {
    permissions: {
        read: OBSERVABLES,
        write: []
    }
}

export async function requestPermissions(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        HealthKit.isAvailable((err, result) => {
            if (err) {
                return reject(err);
            }
            HealthKit.initHealthKit(OPTIONS, (err, results) => {
                if (err) {
                    return reject(err);
                }
                // initialize the step count observer
                HealthKit.initStepCountObserver({}, () => { });
                return resolve();
            });
        })
    });
}