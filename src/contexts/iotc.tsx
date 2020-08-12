import React, { useReducer, useState } from "react";
import { IIoTCClient } from "react-native-azure-iotcentral-client";



export type CentralClient = IIoTCClient | null | undefined;



export type IIoTCContext = {
    client: CentralClient,
    connect: (client: CentralClient) => void,
    disconnect: () => void
}



const initialState: { client: CentralClient } = {
    client: undefined
}

export const IoTCContext = React.createContext<IIoTCContext>({
    ...initialState,
    connect: (client: CentralClient) => { },
    disconnect: () => { }
});
const { Provider } = IoTCContext;
const IoTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<{ client: CentralClient }>(initialState);
    return (
        <Provider value={{
            ...state,
            connect: (client: CentralClient) => {
                setState(current => ({ ...current, client }));
            },
            disconnect: () => {
                setState(current => ({ ...current, client: undefined }))
            }
        }}>
            {children}
        </Provider>
    )
};

export default IoTCProvider;