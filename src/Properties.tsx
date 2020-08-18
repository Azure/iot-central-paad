
import React, { useContext, useState, useEffect } from 'react';
import { View, Platform, FlatList } from 'react-native';
import { useScreenIcon } from './hooks/navigation';
import { IoTCContext } from './contexts/iotc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from './components/card';
import { useSimulation, useIoTCentralClient } from './hooks/iotc';
import { Overlay, Text } from 'react-native-elements';
import { Loader } from './components/loader';
import { useTheme } from '@react-navigation/native';
import Registration from './Registration';
import { useScreenDimensions } from './hooks/layout';

export const PROPERTY_CHANGED = 'PROPERTY_CHANGED';

type PropertiesProps = {
    id: string,
    name: string,
    value?: any
}

const AVAILABLE_PROPERTIES = {
    WRITEABLE_PROP: 'writeableProp',
    READONLY_PROP: 'readOnlyProp'
}

const propsMap: { [id in keyof typeof AVAILABLE_PROPERTIES]?: PropertiesProps } = {
    [AVAILABLE_PROPERTIES.WRITEABLE_PROP]: {
        id: [AVAILABLE_PROPERTIES.WRITEABLE_PROP],
        name: 'WriteableProp',
        value: 'ciao'
    },
    [AVAILABLE_PROPERTIES.READONLY_PROP]: {
        id: [AVAILABLE_PROPERTIES.READONLY_PROP],
        name: 'ReadOnlyProp'
    }
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

    // const [simulated] = useSimulation();
    const [client] = useIoTCentralClient();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const [simulated] = useSimulation();
    const [data, setData] = useState<PropertiesProps[]>(Object.values(propsMap));
    const { colors } = useTheme();

    if (!simulated) {
        if (client === null) {
            return <Registration />
        }

        if (client === undefined || (client && !client.isConnected())) {
            return (

                <View style={{ justifyContent: 'center', alignItems: 'center', height: screen.height / 4, padding: 20 }}>
                    <Loader message={'Connecting to IoT Central ...'} />
                </View>
            )
        }
    }
    return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

        <FlatList numColumns={1} data={data} renderItem={(item) => {
            let val = item.item.value;
            // if (val && val.x && val.y && val.z) {
            //     val = Object.values(val).map((v: number) => Math.round(v * 100) / 100).join(',');
            // }
            return <Card title={item.item.name} value={val}
                enabled
                editable
                onEdit={() => { }}
                onToggle={() => { }}
            />
        }} keyExtractor={(item, index) => `prop-${index}`} />

    </View>)
    // return (<View></View>)

}