import { useContext, useEffect } from "react";
import { IoTCClient, IOTC_CONNECT, IOTC_LOGGING, DecryptCredentials, IoTCCredentials } from "react-native-azure-iotcentral-client";
import { IoTCContext, CentralClient } from "../contexts/iotc";
import { StorageContext } from "../contexts/storage";

export function useIoTCentralClient(): [CentralClient, (creds: string, encKey: string) => Promise<void>] {
    const { client } = useContext(IoTCContext);
    const { save } = useContext(StorageContext);

    // register device for first time
    const register = async function (creds: string, encKey: string) {
        const credentials = DecryptCredentials(creds, encKey);
        await save(current => ({ ...current, credentials }));
    }

    return [client, register];
}

export function useSimulation(): [boolean, (val: boolean) => Promise<void>] {
    const { save, simulated } = useContext(StorageContext);

    const setSimulated = async function (val: boolean) {
        await save(current => ({ ...current, simulated: val }));
    }

    useEffect(() => {
        console.log('set simulated');
        setSimulated(simulated);
    }, [simulated])

    return [simulated, setSimulated];
}