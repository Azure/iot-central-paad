import React, { useContext, useState, useEffect } from 'react';
import { View, Platform, FlatList } from 'react-native';
import { useScreenIcon } from './hooks/navigation';
import { IoTCContext } from './contexts/iotc';
import Registration from './Registration';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from './components/card';
import { IconProps, Overlay } from 'react-native-elements';
import Battery from './sensors/battery';
import { ISensor, DATA_AVAILABLE_EVENT } from './sensors';
import Gyroscope from './sensors/gyroscope';
import Accelerometer from './sensors/accelerometer';
import Barometer from './sensors/barometer';
import Magnetometer from './sensors/magnetometer';
import GeoLocation from './sensors/geolocation';
import { useIoTCentralClient, useSimulation } from './hooks/iotc';
import { useTheme } from '@react-navigation/native';
import { Loader } from './components/loader';
import { useScreenDimensions } from './hooks/layout';

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
    [AVAILABLE_SENSORS.MAGNETOMETER]: new Magnetometer(AVAILABLE_SENSORS.MAGNETOMETER),
    [AVAILABLE_SENSORS.GEOLOCATION]: new GeoLocation(AVAILABLE_SENSORS.GEOLOCATION)
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

    // const { client, simulated: centralSimulated } = useContext(IoTCContext);
    const [simulated] = useSimulation();
    const [client] = useIoTCentralClient();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const { colors } = useTheme();

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
            enabled: true, // TODO: auto-enable based on settings
            simulated: false
        },
        {
            id: AVAILABLE_SENSORS.GYROSCOPE,
            enabled: true, // TODO: auto-enable based on settings
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
            enabled: true, // TODO: auto-enable based on settings
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
            enabled: true, // TODO: auto-enable based on settings
            icon: {
                name: 'weather-partly-cloudy',
                type: 'material-community'
            },
            simulated: false
        },
        {
            id: AVAILABLE_SENSORS.GEOLOCATION,
            enabled: true, // TODO: auto-enable based on settings
            icon: {
                name: 'location-outline',
                type: Platform.select({
                    android: 'material-community',
                    ios: 'ionicon'
                })
            },
            simulated: false
        },
        {
            id: AVAILABLE_SENSORS.BATTERY,
            enabled: true, // TODO: auto-enable based on settings,
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
    // useEffect(() => {
    //     if (centralSimulated) {
    //         setData(current => (current.map(({ ...sensor }) => {
    //             sensorMap[sensor.id].enable(true);
    //             sensorMap[sensor.id].addListener(DATA_AVAILABLE_EVENT, updateUXValue);
    //             sensor.enabled = true;
    //             return sensor;
    //         })));
    //     }
    // }, [centralSimulated]);
    // // if (client) {
    // //     return (<Text>Connected!</Text>)
    // // }
    useEffect(() => {
        Object.values(sensorMap).forEach(s => {
            s.addListener(DATA_AVAILABLE_EVENT, updateUXValue);
            s.enable(true);
        });
    }, []);

    if (!simulated) {
        if (client === null) {
            return <Registration />
        }

        if (client === undefined || (client && !client.isConnected())) {
            return (

                <View style={{ justifyContent: 'center', alignItems: 'center', height: screen.height / 4, padding: 20 }}>
                    <Loader message={'Connecting to IoT Central ...'} />
                </View>)
        }
    }

    return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

        <FlatList numColumns={2} data={data} renderItem={(item) => {
            let val = item.item.value;
            // if (val && val.x && val.y && val.z) {
            //     val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            // }
            return <Card key={`telem-${item.index}`} title={sensorMap[item.item.id].name} value={val} unit={item.item.unit}
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
                            if (!simulated) {
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
        }} />

    </View>)

}