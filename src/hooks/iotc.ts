import { useContext, useEffect } from "react";
import { IoTCClient, IOTC_CONNECT, IOTC_LOGGING, DecryptCredentials, IoTCCredentials } from "react-native-azure-iotcentral-client";
import { IoTCContext, CentralClient, SensorProps } from "../contexts/iotc";
import { StorageContext } from "../contexts/storage";

type ClientProps = [CentralClient, () => Promise<void>, (creds: string, encKey?: string) => Promise<void>,
    (eventname: string, listener: (...args: any[]) => void) => void,
    (eventname: string, listener: (...args: any[]) => void) => void
];

export function useIoTCentralClient(): ClientProps {
    const { client, disconnect, addListener, removeListener } = useContext(IoTCContext);
    const { save } = useContext(StorageContext);

    // register device for first time
    const register = async function (creds: string, encKey?: string) {
        const credentials = DecryptCredentials(creds, encKey);
        await save(current => ({ ...current, credentials }));
    }

    return [client, disconnect, register, addListener, removeListener];
}

export function useSimulation(): [boolean, (val: boolean) => Promise<void>] {
    const { save, simulated } = useContext(StorageContext);

    const setSimulated = async function (val: boolean) {
        await save(current => ({ ...current, simulated: val }));
    }

    useEffect(() => {
        if (simulated !== undefined) {
            setSimulated(simulated);
        }
    }, [simulated])

    return [simulated || false, setSimulated];
}

export function useTelemetry(): { telemetryData: SensorProps[], getTelemetryName: (id: string) => string, set: (id: string, data: Partial<SensorProps>) => void, addListener: (...args: any[]) => void, removeListener: (...args: any[]) => void } {
    const { telemetryData, updateSensors, getSensorName:getTelemetryName, addListener, removeListener } = useContext(IoTCContext);

    const set = function (id: string, data: Partial<SensorProps>) {
        updateSensors('telemetry', current => (current.map(({ ...sensor }) => {
            if (sensor.id === id) {
                sensor = { ...sensor, ...data };
            }
            return sensor;
        })));
    }

    return { telemetryData, getTelemetryName, set, addListener, removeListener };
}


export function useHealth(): { healthData: SensorProps[], getHealthName: (id: string) => string, set: (id: string, data: Partial<SensorProps>) => void, addListener: (...args: any[]) => void, removeListener: (...args: any[]) => void } {
    const { healthData, updateSensors, getSensorName: getHealthName, addListener, removeListener } = useContext(IoTCContext);

    const set = function (id: string, data: Partial<SensorProps>) {
        updateSensors('health', current => (current.map(({ ...sensor }) => {
            if (sensor.id === id) {
                sensor = { ...sensor, ...data };
            }
            return sensor;
        })));
    }

    return { healthData, getHealthName, set, addListener, removeListener };
}