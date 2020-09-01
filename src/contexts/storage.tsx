import React, { useState, useEffect, useRef } from "react";
import { IoTCCredentials } from "react-native-azure-iotcentral-client";
import * as Keychain from 'react-native-keychain';
import { StateUpdater } from "../types";

const USERNAME = 'IOTC_PAD_CLIENT';

type IStorageState = {
    dark?: boolean,
    simulated?: boolean,
    credentials?: IoTCCredentials | null
}

export type IStorageContext = IStorageState & {
    save: (state: IStorageState | ((currentState: IStorageState) => IStorageState)) => Promise<void>
    read: () => Promise<void>,
    clear: () => Promise<void>
}


const initialState: IStorageState = {
    simulated: false
}

export const StorageContext = React.createContext<IStorageContext>({
    ...initialState,
    save: () => Promise.resolve(),
    read: () => Promise.resolve(),
    clear: () => Promise.resolve()
});
const { Provider } = StorageContext;

const retrieveStorage = async function (update: StateUpdater<IStorageState>) {
    /**
     * Credentials must be null if not available. This value means app has been initialized but no credentials are available.
     */
    const data = await Keychain.getGenericPassword();
    if (data && data.password) {
        const parsed = JSON.parse(data.password) as IStorageState;
        if (parsed) {
            if (!parsed.credentials) {
                parsed.credentials = null;
            }
            update(parsed);
        }
    }
    else {
        update({ credentials: null });
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
                if (typeof param === 'function') {
                    setState(current => {
                        const newState = param(current);
                        if (current.dark != newState.dark || current.simulated != newState.simulated || JSON.stringify(newState.credentials) !== JSON.stringify(current.credentials)) {
                            dirty.current = true;
                        }
                        return { ...current, ...newState };
                    });
                }
                else {
                    setState(current => {
                        if (current.dark != param.dark || current.simulated != param.simulated || JSON.stringify(param.credentials) !== JSON.stringify(current.credentials)) {
                            dirty.current = true;
                        }
                        return { ...current, ...param }
                    });
                }
                dirty.current = true;
            },
            read: async () => {
                retrieveStorage(setState);
            },
            clear: async () => {
                setState({ credentials: null });
                await Keychain.resetGenericPassword();
            }
        }}>
            {children}
        </Provider>
    )
};

export default StorageProvider;