
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



export default function Properties() {
    useScreenIcon(Platform.select({
        ios: {
            name: 'create-outline',
            type: 'ionicon'
        },
        android: {
            name: 'playlist-edit',
            type: 'material-community'
        }
    }));

    const { client, simulated: centralSimulated } = useContext(IoTCContext);
    const insets = useSafeAreaInsets();

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