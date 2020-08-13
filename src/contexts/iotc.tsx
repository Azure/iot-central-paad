import React, { useReducer, useState } from "react";
import { IIoTCClient } from "react-native-azure-iotcentral-client";



export type CentralClient = IIoTCClient | null | undefined;
type ICentralState = { simulated: boolean, clientId: string | null, client: CentralClient };


export type IIoTCContext = {
    simulated: boolean,
    clientId: string | null,
    client: CentralClient,
    connect: (client: CentralClient) => void,
    disconnect: () => void,
    simulate: (val: boolean) => void
}



const initialState: ICentralState = {
    clientId: null,
    client: undefined,
    simulated: false
}

export const IoTCContext = React.createContext<IIoTCContext>({
    ...initialState,
    connect: (client: CentralClient) => { },
    disconnect: () => { },
    simulate: (val: boolean) => { }
});
const { Provider } = IoTCContext;
const IoTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ICentralState>(initialState);
    return (
        <Provider value={{
            ...state,
            connect: (client: CentralClient) => {
                setState(current => ({ ...current, client }));
            },
            disconnect: () => {
                setState(current => ({ ...current, client: undefined }))
            },
            simulate: (val: boolean) => {
                setState(current => ({ ...current, simulated: val }));
            }
        }}>
            {children}
        </Provider>
    )
};

export default IoTCProvider;