import React, { useContext, useState, useEffect } from 'react';
import { View, Platform, FlatList } from 'react-native';
import { IIcon, useScreenIcon } from './hooks/common';
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
import { useIoTCentralClient, useSimulation, useTelemetry } from './hooks/iotc';
import { useTheme, useNavigation } from '@react-navigation/native';
import { Loader } from './components/loader';
import { useScreenDimensions } from './hooks/layout';
import { camelToName } from './components/typography';



export default function Telemetry() {

    // const { client, simulated: centralSimulated } = useContext(IoTCContext);
    const [simulated] = useSimulation();
    const { client } = useIoTCentralClient();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const { telemetryData, getTelemetryName, set, addListener } = useTelemetry();
    const navigation = useNavigation();

    const sendTelemetryData = async function (id: string, value: any) {
        if (client && client.isConnected()) {
            if (telemetryData.some(t => t.id === id)) {
                await client.sendTelemetry({ [id]: value });
            }
        }
    }
    useEffect(() => {
        if (!simulated && client && client.isConnected()) {
            addListener(DATA_AVAILABLE_EVENT, sendTelemetryData);
        }
    }, [simulated, client]);

    if (!simulated) {
        if (client === null) {
            return <Registration />
        }

        if (client === undefined) {
            return (
                <Loader message={'Connecting to IoT Central ...'} visible={true} style={{ flex: 1, justifyContent: 'center' }} />
            )
        }
    }

    return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

        <FlatList numColumns={2} data={telemetryData} renderItem={(item) => {
            let val = item.item.value;
            // if (val && val.x && val.y && val.z) {
            //     val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            // }
            return <Card key={`telem-${item.index}`} title={getTelemetryName(item.item.id)} value={val} unit={item.item.unit}
                enabled={item.item.enabled}
                icon={item.item.icon}
                onToggle={() => set(item.item.id, { enabled: !item.item.enabled })}
                onLongPress={e => console.log('longpress')} // edit card
                onPress={item.item.enabled ? (e) => navigation.navigate('Insight', {
                    telemetryId: item.item.id,
                    title: camelToName(item.item.id),
                    backTitle: 'Telemetry'
                }) : undefined}

            />
        }} />

    </View>)

}