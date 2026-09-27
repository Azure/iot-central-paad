import {getPaadDevice} from '../../modules/paad-device';

export {SecureWebSocket, secureWebSocket} from './SecureWebSocket';

/** Capability query only: never requests camera permission or opens a camera. */
export async function hasTorch(): Promise<boolean> {
  return getPaadDevice().hasTorch();
}
