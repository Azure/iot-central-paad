import React, { useContext } from 'react';
import { View, Platform } from 'react-native';
import { useScreenIcon } from './hooks/navigation';
import { IoTCContext } from './contexts/iotc';
import { Text } from './components/typography';
import Registration from './Registration';

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

    const { client } = useContext(IoTCContext);
    
    if (client) {
        return (<Text>Connected!</Text>)
    }
    return <Registration />
    
}