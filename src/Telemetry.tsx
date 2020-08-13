import React, { useContext, useState, useEffect } from 'react';
import { View, Platform, FlatList } from 'react-native';
import { useScreenIcon } from './hooks/navigation';
import { IoTCContext } from './contexts/iotc';
import Registration from './Registration';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from './components/card';
import { IconProps } from 'react-native-elements';
import Battery from './sensors/battery';
import { ISensor, DATA_AVAILABLE_EVENT } from './sensors';
import Gyroscope from './sensors/gyroscope';
import Accelerometer from './sensors/accelerometer';
import Barometer from './sensors/barometer';
import Magnetometer from './sensors/magnetometer';

type SensorProps = {
    id: string,
    value?: any,
    icon?: IconProps,
    enabled: boolean,
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
const sensorMap: { [id in keyof typeof AVAILABLE_SENSORS]?: ISensor } = {
    [AVAILABLE_SENSORS.BATTERY]: new Battery(AVAILABLE_SENSORS.BATTERY),
    [AVAILABLE_SENSORS.GYROSCOPE]: new Gyroscope(AVAILABLE_SENSORS.GYROSCOPE),
    [AVAILABLE_SENSORS.ACCELEROMETER]: new Accelerometer(AVAILABLE_SENSORS.ACCELEROMETER),
    [AVAILABLE_SENSORS.BAROMETER]: new Barometer(AVAILABLE_SENSORS.BAROMETER),
    [AVAILABLE_SENSORS.MAGNETOMETER]: new Magnetometer(AVAILABLE_SENSORS.MAGNETOMETER)
}



export default function Telemetry() {
    useScreenIcon(Platform.select({
        ios: {
            name: 'stats-chart-outline',
            type: 'ionicon'
        },
        android: {
            name: 'chart-bar',
            type: 'material-community'
        }
    }));

    const { client, simulated: centralSimulated } = useContext(IoTCContext);
    const insets = useSafeAreaInsets();

    const sendTelemetryData = async function (id: string, value: any) {
        if (!client.isConnected()) {
            await client.connect();
        }
        await client.sendTelemetry({ [id]: value });
    }

    const defaultSensors: SensorProps[] = [
        {
            id: AVAILABLE_SENSORS.ACCELEROMETER,
            icon: {
                name: 'rocket-outline',
                type: Platform.select({
                    android: 'material-community',
                    ios: 'ionicon'
                })
            },
            enabled: centralSimulated, // TODO: auto-enable based on settings
            simulated: false
        },
        {
            id: AVAILABLE_SENSORS.GYROSCOPE,
            enabled: centralSimulated, // TODO: auto-enable based on settings
            icon: {
                name: 'compass-outline',
                type: Platform.select({
                    android: 'material-community',
                    ios: 'ionicon'
                })
            },
            simulated: false
        },
        {
            id: AVAILABLE_SENSORS.MAGNETOMETER,
            enabled: centralSimulated, // TODO: auto-enable based on settings
            icon: {
                name: 'magnet-outline',
                type: Platform.select({
                    android: 'material-community',
                    ios: 'ionicon'
                })
            },
            simulated: false
        },
        {
            id: AVAILABLE_SENSORS.BAROMETER,
            enabled: centralSimulated, // TODO: auto-enable based on settings
            icon: {
                name: 'weather-partly-cloudy',
                type: 'material-community'
            },
            simulated: false
        },
        // {
        //     id: AVAILABLE_SENSORS.GEOLOCATION,
        //     enabled: simulated, // TODO: auto-enable based on settings
        //     icon: {
        //         name: 'location-outline',
        //         type: Platform.select({
        //             android: 'material-community',
        //             ios: 'ionicon'
        //         })
        //     }
        // },
        {
            id: AVAILABLE_SENSORS.BATTERY,
            enabled: centralSimulated, // TODO: auto-enable based on settings,
            simulated: false,
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

    const [data, setData] = useState<SensorProps[]>(defaultSensors);
    const updateUXValue = async function (id: string, value: any) {
        setData(current => (current.map(({ ...sensor }) => {
            if (sensor.id === id) {
                sensor.value = value
            }
            return sensor;
        })));
    }

    // TODO: remove and better handle simulation
    useEffect(() => {
        if (centralSimulated) {
            setData(current => (current.map(({ ...sensor }) => {
                sensorMap[sensor.id].enable(true);
                sensorMap[sensor.id].addListener(DATA_AVAILABLE_EVENT, updateUXValue);
                sensor.enabled = true;
                return sensor;
            })));
        }
    }, [centralSimulated]);
    // if (client) {
    //     return (<Text>Connected!</Text>)
    // }
    if (!client && !centralSimulated) {
        return <Registration />
    }

    return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

        <FlatList numColumns={2} data={data} renderItem={(item) => {
            let val = item.item.value;
            if (val && val.x && val.y && val.z) {
                val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            }
            return <Card key={item.index} title={sensorMap[item.item.id].name} value={val} unit={item.item.unit}
                enabled={item.item.enabled}
                icon={item.item.icon}
                onToggle={() => setData(current => (current.map(({ ...sensor }) => {
                    const newValue = !sensor.enabled;
                    if (sensor.id === item.item.id) {
                        // enable sensor data emitter
                        sensorMap[sensor.id].enable(newValue);

                        // add listeners
                        if (newValue) {

                            sensorMap[sensor.id].addListener(DATA_AVAILABLE_EVENT, updateUXValue);
                            if (!centralSimulated) {
                                sensorMap[sensor.id].addListener(DATA_AVAILABLE_EVENT, sendTelemetryData);
                            }
                        }
                        // change enable flag for UX
                        sensor.enabled = newValue;
                    }
                    return sensor;
                })))}
                onLongPress={e => console.log('longpress')} // edit card

            />
        }} contentContainerStyle={{ alignItems: 'center' }} />

    </View>)

}