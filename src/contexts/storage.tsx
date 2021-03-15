import React, {useState, useEffect} from 'react';
import {IoTCCredentials} from 'react-native-azure-iotcentral-client';
import * as Keychain from 'react-native-keychain';
import {Debug, Log} from '../tools/CustomLogger';
import {StateUpdater} from '../types';

const USERNAME = 'IOTC_PAD_CLIENT';

type IStorageState = {
  dark?: boolean;
  simulated: boolean;
  credentials: IoTCCredentials | null;
  initialized: boolean;
};

export type IStorageContext = IStorageState & {
  save: (state: Partial<IStorageState>, store?: boolean) => Promise<void>;
  read: () => Promise<void>;
  clear: () => Promise<void>;
};

const StorageContext = React.createContext({} as IStorageContext);
const {Provider} = StorageContext;

const retrieveStorage = async (update: StateUpdater<IStorageContext>) => {
  /**
   * Credentials must be null if not available. This value means app has been initialized but no credentials are available.
   */
  Debug(
    `Retrieving credentials from storage.`,
    'storage_context',
    'retrieveStorage',
  );
  const data = await Keychain.getGenericPassword();
  if (data && data.password) {
    const parsed = JSON.parse(data.password) as IStorageState;
    Debug(
      `Parsed storage: ${data.password}`,
      'storage_context',
      'retrieveStorage',
    );
    if (parsed) {
      if (!parsed.credentials) {
        parsed.credentials = null;
      }
      update(current => ({...current, ...parsed, initialized: true}));
    }
  } else {
    update(current => ({...current, credentials: null, initialized: true}));
  }
};

const persist = async (state: IStorageState) => {
  Log(`Persisting ${JSON.stringify(state)}`);
  await Keychain.setGenericPassword(USERNAME, JSON.stringify(state));
};

const StorageProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, setState] = useState<IStorageContext>({
    credentials: null,
    simulated: false,
    initialized: false,
    save: async (data: Partial<IStorageState>, store: boolean = true) => {
      const newState = {...state, ...data};
      if (store) {
        await persist(newState);
      }
      setState(newState);
    },
    read: async () => {
      await retrieveStorage(setState);
    },
    clear: async () => {
      await Keychain.resetGenericPassword();
      setState(current => ({
        ...current,
        simulated: false,
        credentials: null,
      }));
    },
  });
  // read from storage
  useEffect(() => {
    Debug(
      `Currently credentials:${state.credentials}`,
      'storage_provider',
      'initial_useeffect',
    );
    retrieveStorage(setState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // const contextObj = React.useMemo(
  //   () => ({
  //     ...state,
  //    ,
  //   }),
  // [state],
  // );
  return <Provider value={state}>{children}</Provider>;
};

export {StorageProvider as default, StorageContext};
