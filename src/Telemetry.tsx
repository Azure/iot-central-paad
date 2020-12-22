import React, {useEffect} from 'react';
import {View, FlatList} from 'react-native';
import Registration from './Registration';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card} from './components/card';
import {DATA_AVAILABLE_EVENT} from './sensors';
import {useIoTCentralClient, useSimulation, useTelemetry} from './hooks/iotc';
import {useNavigation} from '@react-navigation/native';
import {Loader} from './components/loader';
import {camelToName} from './components/typography';

const TELEMETRY_COMPONENT = 'sensors';

export default function Telemetry() {
  const [simulated] = useSimulation();
  const {client} = useIoTCentralClient();
  const insets = useSafeAreaInsets();
  const {telemetryData, getTelemetryName, set, addListener} = useTelemetry();
  const navigation = useNavigation();

  const sendTelemetryData = async (id: string, value: any) => {
    if (client && client.isConnected()) {
      if (telemetryData.some((t) => t.id === id)) {
        await client.sendTelemetry(
          {[id]: value},
          {'$.sub': TELEMETRY_COMPONENT},
        );
      }
    }
  };
  useEffect(() => {
    if (!simulated && client && client.isConnected()) {
      addListener(DATA_AVAILABLE_EVENT, sendTelemetryData);
    }
  }, [simulated, client]);

  if (!simulated) {
    if (client === null) {
      return <Registration />;
    }

    if (client === undefined) {
      return (
        <Loader
          message={'Connecting to IoT Central ...'}
          visible={true}
          style={{flex: 1, justifyContent: 'center'}}
        />
      );
    }
  }

  return (
    <View
      style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom}}>
      <FlatList
        numColumns={2}
        data={telemetryData}
        renderItem={(item) => {
          return (
            <Card
              key={`telem-${item.index}`}
              title={getTelemetryName(item.item.id)}
              value={item.item.value}
              unit={item.item.unit}
              enabled={item.item.enabled}
              icon={item.item.icon}
              onToggle={() => set(item.item.id, {enabled: !item.item.enabled})}
              onLongPress={(e) => console.log('longpress')} // edit card
              onPress={
                item.item.enabled
                  ? (e) =>
                      navigation.navigate('Insight', {
                        telemetryId: item.item.id,
                        title: camelToName(item.item.id),
                        backTitle: 'Telemetry',
                      })
                  : undefined
              }
            />
          );
        }}
      />
    </View>
  );
}
