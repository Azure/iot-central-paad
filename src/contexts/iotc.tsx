import React, { useReducer, useState } from "react";
import { IIoTCClient, IoTCCredentials, IoTCClient, IOTC_CONNECT, IOTC_LOGGING } from "react-native-azure-iotcentral-client";



export type CentralClient = IIoTCClient | null | undefined;
type ICentralState = { clientId: string | null, client: CentralClient };


export type IIoTCContext = {
    clientId: string | null,
    client: CentralClient,
    connect: (credentials: IoTCCredentials) => Promise<void>,
    disconnect: () => Promise<void>
}



const initialState: ICentralState = {
    clientId: null,
    client: undefined
}

export const IoTCContext = React.createContext<IIoTCContext>({
    ...initialState,
    connect: (credentials: IoTCCredentials) => Promise.resolve(),
    disconnect: () => Promise.resolve()
});

const connectClient = async function (credentials: IoTCCredentials) {
    let iotc = new IoTCClient(credentials.deviceId, credentials.scopeId, IOTC_CONNECT.DEVICE_KEY, credentials.deviceKey);
    if (credentials.modelId) {
        iotc.setModelId(credentials.modelId);
    }
    iotc.setLogging(IOTC_LOGGING.ALL);
    await iotc.connect();
    return iotc;
}


const { Provider } = IoTCContext;
const IoTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ICentralState>(initialState);
    return (
        <Provider value={{
            ...state,
            connect: async (credentials: IoTCCredentials) => {
                let client: CentralClient;
                if (credentials) {
                    try {
                        client = await connectClient(credentials);
                    }
                    catch (e) {
                        client = null;
                    }
                }
                setState(current => ({ ...current, client }));
            },
            disconnect: async () => {
                await state.client.disconnect();
                setState(current => ({ ...current, client: undefined }))
            }
        }}>
            {children}
        </Provider>
    )
};

export default IoTCProvider;