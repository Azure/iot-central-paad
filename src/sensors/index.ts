import Accelerometer from './accelerometer';
import Barometer from './barometer';
import Battery from './battery';
import GeoLocation from './geolocation';
import Gyroscope from './gyroscope';
// import HealthKitClimb from './health/healthkit/climb';
// import HealthKitSteps from './health/healthkit/steps';
// import GoogleFitSteps from './health/googlefit/steps';
// import {AVAILABLE_HEALTH, HealthNames} from './health/internal';
import {
  AVAILABLE_SENSORS,
  ISensor as SensorInterface,
  SensorNames,
} from './internal';
import Magnetometer from './magnetometer';

export const SensorMap: {[x in SensorNames]: SensorInterface} = {
  [AVAILABLE_SENSORS.BATTERY]: new Battery(AVAILABLE_SENSORS.BATTERY, 5000),
  [AVAILABLE_SENSORS.GYROSCOPE]: new Gyroscope(
    AVAILABLE_SENSORS.GYROSCOPE,
    5000,
  ),
  [AVAILABLE_SENSORS.ACCELEROMETER]: new Accelerometer(
    AVAILABLE_SENSORS.ACCELEROMETER,
    5000,
  ),
  [AVAILABLE_SENSORS.BAROMETER]: new Barometer(
    AVAILABLE_SENSORS.BAROMETER,
    5000,
  ),
  [AVAILABLE_SENSORS.MAGNETOMETER]: new Magnetometer(
    AVAILABLE_SENSORS.MAGNETOMETER,
    5000,
  ),
  [AVAILABLE_SENSORS.GEOLOCATION]: new GeoLocation(
    AVAILABLE_SENSORS.GEOLOCATION,
    5000,
  ),
};

// export const HealthMap: {[x in HealthNames]: SensorInterface} = Platform.select<
//   {[x in HealthNames]: SensorInterface}
// >({
//   ios: {
//     [AVAILABLE_HEALTH.STEPS]: new HealthKitSteps(AVAILABLE_HEALTH.STEPS, 5000),
//     [AVAILABLE_HEALTH.FLOORS]: new HealthKitClimb(
//       AVAILABLE_HEALTH.FLOORS,
//       5000,
//     ),
//   },
//   android: {
//     [AVAILABLE_HEALTH.STEPS]: new GoogleFitSteps(AVAILABLE_HEALTH.STEPS, 5000),
//   },
//   default: {},
// });

export type ISensor = SensorInterface;
export {
  //AVAILABLE_HEALTH,
  AVAILABLE_SENSORS,
};
