import React, { useEffect, useState } from 'react';
import { View, FlatList, Platform, ListRenderItemInfo } from 'react-native';
import { useScreenIcon } from './hooks/common';
import { useSimulation, useIoTCentralClient, useTelemetry } from './hooks/iotc';
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


const AVAILABLE_HEALTH = {
    STEPS: 'steps',
    FLOORS: 'floors'
}


const sensorMap: { [id in valueof<typeof AVAILABLE_HEALTH>]: ISensor } = {
    [AVAILABLE_HEALTH.STEPS]: Platform.select<ISensor>({
        ios: new HealthKitSteps(AVAILABLE_HEALTH.STEPS, 5000),
        android: new GoogleFitSteps(AVAILABLE_HEALTH.STEPS, 5000)
    }) as ISensor,
    [AVAILABLE_HEALTH.FLOORS]: Platform.select<ISensor>({
        ios: new HealthKitClimb(AVAILABLE_HEALTH.FLOORS, 5000)
        // android: new HealthKitClimb(AVAILABLE_HEALTH.FLOORS, 5000)
    }) as ISensor
}

export default function HealthPlatform() {

    useScreenIcon({
        name: 'heartbeat',
        type: 'font-awesome'
    });

    const defaultSensors: SensorProps[] = [
        {
            id: AVAILABLE_HEALTH.STEPS,
            interval: 5000,
            icon: {
                name: 'foot-print',
                type: 'material-community'
            },
            enabled: true, // TODO: auto-enable based on settings
            simulated: defaults.emulator
        },
        ...Platform.select({
            ios: [{
                id: AVAILABLE_HEALTH.FLOORS,
                interval: 5000,
                icon: {
                    name: 'stairs',
                    type: 'material-community'
                },
                enabled: true, // TODO: auto-enable based on settings
                simulated: defaults.emulator
            }],
            android: []
        }) as SensorProps[]
    ]

    const [simulated] = useSimulation();
    const [client] = useIoTCentralClient();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const navigation = useNavigation();

    const [healthData, setHealthData] = useState(defaultSensors);

    const updateValues = function (id: string, value: any) {
        setHealthData(current => (current.map(({ ...sensor }) => {
            if (sensor.id === id) {
                sensor = { ...sensor, value };
            }
            return sensor;
        })));
    }

    const sendTelemetryData = async function (id: string, value: any) {
        if (client && client.isConnected()) {
            await client.sendTelemetry({ [id]: value });
        }
    }

    useEffect(() => {
        if (!simulated && client && client.isConnected()) {
            healthData.forEach(health => {
                const id = health.id as keyof typeof AVAILABLE_HEALTH;
                (sensorMap[id] as ISensor).addListener(DATA_AVAILABLE_EVENT, sendTelemetryData);
            });
        }
    }, [simulated, client]);

    useEffect(() => {
        // update sensors
        healthData.forEach(health => {
            const id = health.id as keyof typeof AVAILABLE_HEALTH;
            (sensorMap[id] as ISensor).simulate(health.simulated);
            (sensorMap[id] as ISensor).enable(health.enabled);
            (sensorMap[id] as ISensor).sendInterval(health.interval);
        });
    }, [healthData]);

    /**
     * Runs initially to add ux listeners to data_change event
     */
    useEffect(() => {
        Object.values(sensorMap).forEach(s => s ? s.addListener(DATA_AVAILABLE_EVENT, updateValues) : null);
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

        <FlatList numColumns={1} data={healthData} renderItem={(item: ListRenderItemInfo<SensorProps>) => {
            let val = item.item.value;
            // if (val && val.x && val.y && val.z) {
            //     val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            // }
            return <Card key={`telem-${item.index}`} title={sensorMap[item.item.id].name} value={val} unit={item.item.unit}
                enabled={item.item.enabled}
                icon={item.item.icon}
                onToggle={() => setHealthData(current => (
                    current.map(({ ...sensor }) => {
                        if (sensor.id === item.item.id) {
                            sensor = { ...sensor, enabled: !sensor.enabled };
                        }
                        return sensor;
                    })))}
                onLongPress={e => console.log('longpress')} // edit card
                onPress={e => navigation.navigate('Insight', {
                    telemetryId: item.item.id,
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