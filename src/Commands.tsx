import React, { useContext, useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { IIcon, useScreenIcon } from './hooks/common';
import { useSimulation, useIoTCentralClient, useTelemetry } from './hooks/iotc';
import Registration from './Registration';
import { Text, Headline } from './components/typography';
import { IoTCContext, SensorProps } from './contexts/iotc';
import { Loader } from './components/loader';
import { ScrollView } from 'react-native-gesture-handler';
import { useScreenDimensions } from './hooks/layout';
import { IOTC_EVENTS, IIoTCCommand, IIoTCCommandResponse } from 'react-native-azure-iotcentral-client';
import { StateUpdater } from './types';
import { colors } from 'react-native-elements';
import { useTheme } from '@react-navigation/native';


type CommandInfo = { timestamp: number, cmd: IIoTCCommand }[];

const ENABLE_DISABLE_COMMAND = 'EnableDisable';
const SET_FREQUENCY_COMMAND = 'SetFrequency';


const onCommandUpdate = async function (setTelemetry: (id: string, data: Partial<SensorProps>) => void, setCommands: StateUpdater<CommandInfo>, command: IIoTCCommand) {
    let data: any;
    try {
        data = JSON.parse(command.requestPayload);
    }
    catch (e) {
        return;
    }
    if (command.name === ENABLE_DISABLE_COMMAND) {
        if (data.item && data.enable !== undefined) {
            setTelemetry(data.item, { enabled: data.enable });
            await command.reply(IIoTCCommandResponse.SUCCESS, 'Enable');
        }
    }
    else if (command.name === SET_FREQUENCY_COMMAND) {
        if (data.item && data.frequency !== undefined) {
            setTelemetry(data.item, { interval: data.frequency * 1000 });
            await command.reply(IIoTCCommandResponse.SUCCESS, 'Frequency');
        }
    }
    setCommands(current => ([...current, { timestamp: Date.now(), cmd: command }]));

}


export default function Commands() {
    const { screen } = useScreenDimensions();
    useScreenIcon(Platform.select({
        ios: {
            name: 'console',
            type: 'material-community'
        },
        android: {
            name: 'console',
            type: 'material-community'
        }
    }) as IIcon);

    const { colors } = useTheme();
    const [simulated] = useSimulation();
    const [client] = useIoTCentralClient();
    const { set } = useTelemetry();
    const [commands, setCommands] = useState<CommandInfo>([]);

    useEffect(() => {
        if (client && client.isConnected()) {
            client.on(IOTC_EVENTS.Commands, onCommandUpdate.bind(null, set, setCommands));
            client.fetchTwin();
        }
    }, [client]);

    if (simulated) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginHorizontal: 30 }}>
                <Headline style={{ textAlign: 'center' }}>Simulation mode is enabled</Headline>
                <Text style={{ textAlign: 'center' }}> Commands are not available.
                Disable simulation mode and connect to IoT Central to work with commands.
                </Text>
            </View>
        )
    }
    if (client === null) {
        return <Registration />
    }

    if (client === undefined) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: screen.height / 4, padding: 20 }}>
                <Loader message={'Connecting to IoT Central ...'} />
            </View>)
    }
    return (<View style={{ flex: 1, padding: 10 }}>
        <Text>Received commands will be logged below.</Text>
        <ScrollView style={{ margin: 10, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
            {commands.map((c, i) => (
                <React.Fragment key={`logf-${i}`}>
                    <Text key={`log-${i}`}>{c.timestamp} - Received:
                    <Text key={`logdata-${i}`} style={{ color: 'green' }}>{c.cmd.name}</Text>
                    </Text>
                    <Text key={`logpayload-${i}`}>{c.cmd.requestPayload}</Text>
                </React.Fragment>
            ))}
        </ScrollView>
    </View>)
}