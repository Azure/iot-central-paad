import React, { useState, useEffect, useRef } from "react";
import { IoTCCredentials } from "react-native-azure-iotcentral-client";
import * as Keychain from 'react-native-keychain';

const USERNAME = 'IOTC_PAD_CLIENT';

type IStorageState = {
    dark?: boolean,
    simulated?: boolean,
    credentials?: IoTCCredentials
}

export type IStorageContext = IStorageState & {
    save: (state: IStorageState | ((currentState: IStorageState) => IStorageState)) => Promise<void>
    read: () => Promise<void>
}


const initialState: IStorageState = {
    simulated: true
}

export const StorageContext = React.createContext<IStorageContext>({
    ...initialState,
    save: () => Promise.resolve(),
    read: () => Promise.resolve()
});
const { Provider } = StorageContext;

const retrieveStorage = async function (update: React.Dispatch<React.SetStateAction<IStorageState>>) {
    const data = await Keychain.getGenericPassword();
    if (data && data.password) {
        update(JSON.parse(data.password) as IStorageState)
    }
    else {
        update({});
    }
}

const persist = async function (state: IStorageState) {
    console.log(`Persisting ${JSON.stringify(state)}`);
    await Keychain.setGenericPassword(USERNAME, JSON.stringify(state));
}

const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<IStorageState>(initialState);
    const dirty = useRef<boolean>(false);
    // read from storage
    useEffect(() => {
        retrieveStorage(setState);
    }, [])

    useEffect(() => {
        if (dirty.current) {
            dirty.current = false;
            persist(state);
        }
    }, [state])
    return (
        <Provider value={{
            ...state,
            save: async (param) => {
                console.log('saving');
                if (typeof param === 'function') {
                    setState(current => param(current));
                }
                else {
                    setState(param);
                }
                dirty.current = true;
            },
            read: async () => {
                retrieveStorage(setState);
            }
        }}>
            {children}
        </Provider>
    )
};

export default StorageProvider;