import React, { useCallback, useState } from 'react';
import { IoTCCredentials } from 'react-native-azure-iotcentral-client';
import * as Keychain from 'react-native-keychain';
import { Debug, Log } from '../tools/CustomLogger';
import { StateUpdater, ThemeMode } from '../types';

const USERNAME = 'IOTC_PAD_CLIENT';

type IStorageState = {
  themeMode: ThemeMode;
  simulated: boolean;
  deliveryInterval: number;
  credentials: (IoTCCredentials & { authKey?: string; keyType?: 'group' | 'device' }) | null;
  initialized: boolean;
};

const initialState: IStorageState = {
  themeMode: ThemeMode.DEVICE,
  credentials: null,
  simulated: false,
  initialized: false,
  deliveryInterval: 5,
};

export type IStorageContext = IStorageState & {
  save: (state: Partial<IStorageState>, store?: boolean) => Promise<void>;
  read: () => Promise<void>;
  clear: () => Promise<void>;
};

const StorageContext = React.createContext({} as IStorageContext);
const { Provider } = StorageContext;

const retrieveStorage = async (update: StateUpdater<IStorageState>) => {
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
      update(current => ({ ...current, ...parsed, initialized: true }));
    }
  } else {
    update(current => ({ ...current, credentials: null, initialized: true }));
  }
};

const persist = async (state: IStorageState) => {
  Log(`Persisting ${JSON.stringify(state)}`);
  await Keychain.setGenericPassword(USERNAME, JSON.stringify(state));
};

const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<IStorageState>(initialState);

  const save = useCallback(
    async (data: Partial<IStorageState>, store: boolean = true) => {
      let newState;
      setState(current => {
        newState = { ...current, ...data };
        return newState;
      });
      if (store && newState) {
        await persist(newState);
      }
    },
    [],
  );

  const read = useCallback(async () => {
    await retrieveStorage(setState);
  }, [setState]);

  const clear = useCallback(async () => {
    await Keychain.resetGenericPassword();
    setState(initialState);
  }, []);
  const value = {
    ...state,
    save,
    read,
    clear,
  };

  return <Provider value={value}>{children}</Provider>;
};

export { StorageProvider as default, StorageContext };
