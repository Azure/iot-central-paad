import {Platform} from 'react-native';
import Torch from 'react-native-torch';
import {TimeOut} from '.';

export async function playTorch(
  repeats: number,
  duration: number,
  interval: number,
) {
  if (Platform.OS === 'android') {
    const cameraAllowed = await Torch.requestCameraPermission(
      'Camera Permissions', // dialog title
      'We require camera permissions to use the torch on the back of your phone.', // dialog body
    );
    if (!cameraAllowed) {
      return;
    }
  }
  if (repeats === 1) {
    return toggleLight(duration);
  }
  return new Promise<void>(async resolve => {
    let count = 0;
    await toggleLight(duration);
    await TimeOut(interval);
    count++;
    //@ts-ignore
    const intv = setInterval(async () => {
      if (count === repeats) {
        clearInterval(intv);
        return resolve();
      }
      await toggleLight(duration);
      count++;
    }, (duration + interval) * 1000);
  });
}

async function toggleLight(duration: number) {
  return new Promise<void>(resolve => {
    Torch.switchState(true);
    setTimeout(() => {
      Torch.switchState(false);
      resolve();
    }, duration * 1000);
  });
}
