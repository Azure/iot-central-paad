import React, { useEffect, useState } from 'react';
import { View, FlatList, Platform, ListRenderItemInfo } from 'react-native';
import { useScreenIcon } from './hooks/common';
import { useSimulation, useIoTCentralClient, useTelemetry, useHealth } from './hooks/iotc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenDimensions } from './hooks/layout';
import { useNavigation } from '@react-navigation/native';
import Registration from './Registration';
import { Loader } from './components/loader';
import { camelToName } from './components/typography';
import { valueof } from './types';
import { DATA_AVAILABLE_EVENT, ISensor } from './sensors';
import HealthKitSteps from './sensors/healthkit/steps';
import { defaults } from './contexts/defaults';
import { SensorProps } from './contexts/iotc';
import { Card } from './components/card';
import HealthKitClimb from './sensors/healthkit/climb';
import GoogleFitSteps from './sensors/googlefit/steps';




export default function HealthPlatform() {




    const [simulated] = useSimulation();
    const {client} = useIoTCentralClient();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const navigation = useNavigation();
    const { healthData, getHealthName, set, addListener } = useHealth();



    const sendTelemetryData = async function (id: string, value: any) {
        if (client && client.isConnected()) {
            if (healthData.some(h => h.id === id)) {
                // await client.sendTelemetry({ [id]: value });
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

        <FlatList numColumns={1} data={healthData} renderItem={(item: ListRenderItemInfo<SensorProps>) => {
            let val = item.item.value;
            // if (val && val.x && val.y && val.z) {
            //     val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            // }
            return <Card key={`telem-${item.index}`} title={getHealthName(item.item.id)} value={val} unit={item.item.unit}
                enabled={item.item.enabled}
                icon={item.item.icon}
                onToggle={() => set(item.item.id, { enabled: !item.item.enabled })}
                onLongPress={e => console.log('longpress')} // edit card
                onPress={e => navigation.navigate('Insight', {
                    telemetryId: item.item.id,
                    currentValue: item.item.value,
                    title: camelToName(item.item.id),
                    backTitle: Platform.select({
                        ios: 'HealthKit',
                        android: 'GoogleFit'
                    })
                })}

            />
        }} />

    </View>)
}