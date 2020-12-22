import {PermissionsAndroid} from 'react-native';
import GoogleFit, {Scopes} from 'react-native-google-fit';
import {Log} from '../../../tools/CustomLogger';

const SCOPES = [
  Scopes.FITNESS_ACTIVITY_READ,
  Scopes.FITNESS_BODY_READ,
  Scopes.FITNESS_BODY_TEMPERATURE_READ,
  Scopes.FITNESS_BLOOD_PRESSURE_READ,
];

export async function requestPermissions(): Promise<void> {
  await GoogleFit.checkIsAuthorized();
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message: `Application would like to use location permissions for distance calculation`,
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
    },
  );
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Health permissions not granted');
  }
  if (!GoogleFit.isAuthorized) {
    const authResult = await GoogleFit.authorize({scopes: SCOPES});
    if (authResult.success) {
      GoogleFit.startRecording(
        (data) => {
          Log(`Google fit data : ${data}`);
        },
        ['step', 'distance'],
      );
    } else {
      throw new Error(`Google Fit Authorization denied: ${authResult.message}`);
    }
  }
}
