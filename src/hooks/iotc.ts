import { useContext, useEffect } from "react";
import { IoTCClient, IOTC_CONNECT, IOTC_LOGGING, DecryptCredentials, IoTCCredentials } from "react-native-azure-iotcentral-client";
import { IoTCContext, CentralClient, SensorProps } from "../contexts/iotc";
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
        setSimulated(simulated);
    }, [simulated])

    return [simulated, setSimulated];
}

export function useTelemetry(): { telemetryData: SensorProps[], getTelemetryName: (id: string) => string, set: (id: string, data: Partial<SensorProps>) => void, addListener: (...args: any[]) => void } {
    const { telemetryData, updateTelemetry, getTelemetryName, addListener } = useContext(IoTCContext);

    const set = function (id: string, data: Partial<SensorProps>) {
        updateTelemetry(current => (current.map(({ ...sensor }) => {
            if (sensor.id === id) {
                sensor = { ...sensor, ...data };
            }
            return sensor;
        })));
    }

    return { telemetryData, getTelemetryName, set, addListener };
}