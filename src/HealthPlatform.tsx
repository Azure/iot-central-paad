import React, {useEffect} from 'react';
import {View, FlatList, Platform, ListRenderItemInfo} from 'react-native';
import {useSimulation, useIoTCentralClient, useHealth} from './hooks/iotc';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Registration from './Registration';
import {Loader} from './components/loader';
import {camelToName} from './components/typography';
import {DATA_AVAILABLE_EVENT} from './sensors';
import {SensorProps} from './contexts/iotc';
import {Card} from './components/card';

const HEALTH_COMPONENT = 'health';

export default function HealthPlatform() {
  const [simulated] = useSimulation();
  const {client} = useIoTCentralClient();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {healthData, getHealthName, set, addListener} = useHealth();

  const sendTelemetryData = async (id: string, value: any) => {
    if (client && client.isConnected()) {
      if (healthData.some((h) => h.id === id)) {
        await client.sendTelemetry({[id]: value}, {'$.sub': HEALTH_COMPONENT});
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
        numColumns={1}
        data={healthData}
        renderItem={(item: ListRenderItemInfo<SensorProps>) => {
          return (
            <Card
              key={`telem-${item.index}`}
              title={getHealthName(item.item.id)}
              value={item.item.value}
              unit={item.item.unit}
              enabled={item.item.enabled}
              icon={item.item.icon}
              onToggle={() => set(item.item.id, {enabled: !item.item.enabled})}
              onLongPress={(e) => console.log('longpress')} // edit card
              onPress={(e) =>
                navigation.navigate('Insight', {
                  telemetryId: item.item.id,
                  currentValue: item.item.value,
                  title: camelToName(item.item.id),
                  backTitle: Platform.select({
                    ios: 'HealthKit',
                    android: 'GoogleFit',
                  }),
                })
              }
            />
          );
        }}
      />
    </View>
  );
}
