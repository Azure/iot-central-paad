import React, { useReducer, useState, useEffect } from "react";
import { IIoTCClient, IoTCCredentials, IoTCClient, IOTC_CONNECT, IOTC_LOGGING } from "react-native-azure-iotcentral-client";
import { IconProps } from "react-native-elements";
import { Platform } from "react-native";
import DeviceInfo from 'react-native-device-info';
import { ISensor, DATA_AVAILABLE_EVENT } from "../sensors";
import Battery from "../sensors/battery";
import Gyroscope from "../sensors/gyroscope";
import Accelerometer from "../sensors/accelerometer";
import Barometer from "../sensors/barometer";
import Magnetometer from "../sensors/magnetometer";
import GeoLocation from "../sensors/geolocation";


// const emulator = DeviceInfo.isEmulatorSync();
const emulator = false;

export type SensorProps = {
    id: string,
    value?: any,
    icon?: IconProps,
    enabled: boolean,
    interval: number,
    simulated: boolean,
    unit?: string
}

const AVAILABLE_SENSORS = {
    BATTERY: 'battery',
    ACCELEROMETER: 'accelerometer',
    MAGNETOMETER: 'magnetometer',
    BAROMETER: 'barometer',
    GEOLOCATION: 'geolocation',
    GYROSCOPE: 'gyroscope'
}

const defaultSensors: SensorProps[] = [
    {
        id: AVAILABLE_SENSORS.ACCELEROMETER,
        interval: 5000,
        icon: {
            name: 'rocket-outline',
            type: Platform.select({
                android: 'material-community',
                ios: 'ionicon'
            })
        },
        enabled: true, // TODO: auto-enable based on settings
        simulated: emulator
    },
    {
        id: AVAILABLE_SENSORS.GYROSCOPE,
        interval: 5000,
        enabled: true, // TODO: auto-enable based on settings
        icon: {
            name: 'compass-outline',
            type: Platform.select({
                android: 'material-community',
                ios: 'ionicon'
            })
        },
        simulated: emulator
    },
    {
        id: AVAILABLE_SENSORS.MAGNETOMETER,
        interval: 5000,
        enabled: true, // TODO: auto-enable based on settings
        icon: {
            name: 'magnet-outline',
            type: Platform.select({
                android: 'material-community',
                ios: 'ionicon'
            })
        },
        simulated: emulator
    },
    {
        id: AVAILABLE_SENSORS.BAROMETER,
        interval: 5000,
        enabled: true, // TODO: auto-enable based on settings
        icon: {
            name: 'weather-partly-cloudy',
            type: 'material-community'
        },
        simulated: emulator
    },
    {
        id: AVAILABLE_SENSORS.GEOLOCATION,
        interval: 5000,
        enabled: true, // TODO: auto-enable based on settings
        icon: {
            name: 'location-outline',
            type: Platform.select({
                android: 'material-community',
                ios: 'ionicon'
            })
        },
        simulated: emulator
    },
    {
        id: AVAILABLE_SENSORS.BATTERY,
        interval: 5000,
        enabled: true, // TODO: auto-enable based on settings,
        simulated: emulator,
        icon: {
            name: Platform.select({
                android: 'battery-medium',
                ios: 'battery-half-sharp'
            }),
            type: Platform.select({
                android: 'material-community',
                ios: 'ionicon'
            })
        }
    }
]

const sensorMap: { [id in keyof typeof AVAILABLE_SENSORS]?: ISensor } = {
    [AVAILABLE_SENSORS.BATTERY]: new Battery(AVAILABLE_SENSORS.BATTERY, 5000),
    [AVAILABLE_SENSORS.GYROSCOPE]: new Gyroscope(AVAILABLE_SENSORS.GYROSCOPE, 5000),
    [AVAILABLE_SENSORS.ACCELEROMETER]: new Accelerometer(AVAILABLE_SENSORS.ACCELEROMETER, 5000),
    [AVAILABLE_SENSORS.BAROMETER]: new Barometer(AVAILABLE_SENSORS.BAROMETER, 5000),
    [AVAILABLE_SENSORS.MAGNETOMETER]: new Magnetometer(AVAILABLE_SENSORS.MAGNETOMETER, 5000),
    [AVAILABLE_SENSORS.GEOLOCATION]: new GeoLocation(AVAILABLE_SENSORS.GEOLOCATION, 5000)
}

export type CentralClient = IIoTCClient | null | undefined;
type ICentralState = { telemetryData: SensorProps[], client: CentralClient };


export type IIoTCContext = ICentralState & {
    connect: (credentials: IoTCCredentials) => Promise<void>,
    disconnect: () => Promise<void>,
    updateTelemetry: (fn: (currentData: SensorProps[]) => SensorProps[]) => void,
    getTelemetryName: (id: string) => string,
    addListener: (eventname: string, listener: (...args: any[]) => void) => void,
    removeListener: (eventname: string, listener: (...args: any[]) => void) => void,
}



const initialState: ICentralState = {
    telemetryData: defaultSensors,
    client: undefined
}

export const IoTCContext = React.createContext<IIoTCContext>({
    ...initialState,
    connect: (credentials: IoTCCredentials) => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    updateTelemetry: () => { },
    getTelemetryName: (id: string) => '',
    addListener: () => { },
    removeListener: () => { },

});

const connectClient = async function (credentials: IoTCCredentials) {
    console.log('Connecting Iotcentral client');
    let iotc = new IoTCClient(credentials.deviceId, credentials.scopeId, IOTC_CONNECT.DEVICE_KEY, credentials.deviceKey);
    if (credentials.modelId) {
        iotc.setModelId(credentials.modelId);
    }
    iotc.setLogging(IOTC_LOGGING.ALL);
    await iotc.connect(false);
    return iotc;
}


const { Provider } = IoTCContext;
const IoTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ICentralState>(initialState);

    const updateValues = function (id: string, value: any) {
        setState(current => ({
            ...current, telemetryData: current.telemetryData.map(({ ...sensor }) => {
                if (sensor.id === id) {
                    sensor = { ...sensor, value };
                }
                return sensor;
            })
        }));
    }
    useEffect(() => {
        // update sensors
        state.telemetryData.forEach(telem => {
            (sensorMap[telem.id] as ISensor).enable(telem.enabled);
            (sensorMap[telem.id] as ISensor).sendInterval(telem.interval);
        });
    }, [state.telemetryData]);

    /**
     * Runs initially to add ux listeners to data_change event
     */
    useEffect(() => {
        Object.values(sensorMap).forEach(s => s.addListener(DATA_AVAILABLE_EVENT, updateValues));
    }, []);



    return (
        <Provider value={{
            ...state,
            updateTelemetry: (fn: (currentData: SensorProps[]) => SensorProps[]) => {
                setState(current => ({ ...current, telemetryData: fn(current.telemetryData) }));
            },
            getTelemetryName: (id: string) => (sensorMap[id].name),
            addListener: (eventname: string, listener: (...args: any[]) => void) => {
                Object.values(sensorMap).forEach(s => s.addListener(eventname, listener));
            },
            removeListener: (eventname: string, listener: (...args: any[]) => void) => {
                Object.values(sensorMap).forEach(s => s.removeListener(eventname, listener));
            },
            connect: async (credentials: IoTCCredentials) => {

                // disconnect previous client if any
                if (state.client) {
                    await state.client.disconnect();
                }
                let client: CentralClient = null;
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
        </Provider >
    )
};

export default IoTCProvider;