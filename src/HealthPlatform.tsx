import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { useScreenIcon } from './hooks/common';
import { useSimulation, useIoTCentralClient, useTelemetry } from './hooks/iotc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenDimensions } from './hooks/layout';
import { useNavigation } from '@react-navigation/native';
import Registration from './Registration';
import { Loader } from './components/loader';
import { Card } from 'react-native-elements';
import { camelToName } from './components/typography';

export default function HealthPlatform() {

    useScreenIcon({
        name: 'heartbeat',
        type: 'font-awesome'
    });

    const [simulated] = useSimulation();
    const [client] = useIoTCentralClient();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const navigation = useNavigation();

    const [healthData, setHealthData] = useState([]);

    useEffect(() => {

    }, []);


    if (!simulated) {
        if (client === null) {
            return <Registration />
        }

        if (client === undefined) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: screen.height / 4, padding: 20 }}>
                    <Loader message={'Connecting to IoT Central ...'} />
                </View>)
        }
    }

    return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

        {/* <FlatList numColumns={2} data={healthData} renderItem={(item) => {
            let val = item.item.value;
            // if (val && val.x && val.y && val.z) {
            //     val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            // }
            return <Card key={`telem-${item.index}`} title={'test'} value={val} unit={item.item.unit}
                enabled={item.item.enabled}
                icon={item.item.icon}
                onToggle={() => set(item.item.id, { enabled: !item.item.enabled })}
                onLongPress={e => console.log('longpress')} // edit card
                onPress={e => navigation.navigate('Insight', {
                    telemetryId: item.item.id,
                    title: camelToName(item.item.id),
                    backTitle: 'Telemetry'
                })}

            />
        }} /> */}

    </View>)
}