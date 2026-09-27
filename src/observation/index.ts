import {useSyncExternalStore} from 'react';
import type {DeviceClient} from '../connection/types';
import {getObservationStore} from './client';
import {EMPTY_OBSERVATION_SNAPSHOT} from './store';

export {observeClient, getObservationStore} from './client';
export {ObservationStore, OBSERVATION_LIMITS} from './store';
export type * from './types';

const subscribeEmpty = () => () => {};
const getEmptySnapshot = () => EMPTY_OBSERVATION_SNAPSHOT;

export function useObservationSnapshot(
  client: DeviceClient | null | undefined,
) {
  const store = getObservationStore(client);
  return useSyncExternalStore(
    store?.subscribe ?? subscribeEmpty,
    store?.getSnapshot ?? getEmptySnapshot,
    store?.getSnapshot ?? getEmptySnapshot,
  );
}
