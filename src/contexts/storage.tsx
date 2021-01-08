import React, {useState, useEffect} from 'react';
import {IoTCCredentials} from 'react-native-azure-iotcentral-client';
import * as Keychain from 'react-native-keychain';
import {Log} from '../tools/CustomLogger';
import {StateUpdater} from '../types';

const USERNAME = 'IOTC_PAD_CLIENT';

type IStorageState = {
  dark?: boolean;
  simulated: boolean;
  credentials: IoTCCredentials | null;
};

export type IStorageContext = IStorageState & {
  save: (state: Partial<IStorageState>) => Promise<void>;
  read: () => Promise<void>;
  clear: () => Promise<void>;
};

let StorageContext: React.Context<IStorageContext>;

const retrieveStorage = async (update: StateUpdater<IStorageState>) => {
  /**
   * Credentials must be null if not available. This value means app has been initialized but no credentials are available.
   */
  console.log(`Retrieving credentials from storage`);
  const data = await Keychain.getGenericPassword();
  if (data && data.password) {
    const parsed = JSON.parse(data.password) as IStorageState;
    if (parsed) {
      if (!parsed.credentials) {
        parsed.credentials = null;
      }
      // update(parsed);
    }
  } else {
    // update(current => ({ ...current, credentials: null }));
  }
};

const persist = async (state: IStorageState) => {
  Log(`Persisting ${JSON.stringify(state)}`);
  await Keychain.setGenericPassword(USERNAME, JSON.stringify(state));
};

const StorageProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, setState] = useState<IStorageState>({
    credentials: null,
    simulated: false,
  });
  // read from storage
  useEffect(() => {
    retrieveStorage(setState);
  }, []);

  const contextObj = React.useMemo(
    () => ({
      ...state,
      save: async (data: Partial<IStorageState>) => {
        const newState = {...state, data};
        await persist(newState);
        setState(newState);
      },
      read: async () => {
        await retrieveStorage(setState);
      },
      clear: async () => {
        await Keychain.resetGenericPassword();
        setState({simulated: false, credentials: null});
      },
    }),
    [state],
  );

  StorageContext = React.createContext<IStorageContext>(contextObj);
  const {Provider} = StorageContext;
  return <Provider value={contextObj}>{children}</Provider>;
};

export {StorageProvider as default, StorageContext};
