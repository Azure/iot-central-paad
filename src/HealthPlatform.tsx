import React, {useEffect, useRef} from 'react';
import {View, FlatList} from 'react-native';
import Registration from './Registration';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card} from './components/card';
import {useIoTCentralClient, useSimulation} from './hooks/iotc';
import {useNavigation} from '@react-navigation/native';
import {Loader} from './components/loader';
import {camelToName} from './components/typography';
import {useHealth} from 'hooks/common';
import {HealthMap} from 'sensors';
import {DATA_AVAILABLE_EVENT} from 'types';

const HEALTH_COMPONENT = 'health';

export default function HealthPlatform() {
  const [simulated] = useSimulation();
  const iotcentralClient = useIoTCentralClient();
  const insets = useSafeAreaInsets();
  const sensors = useHealth();
  const navigation = useNavigation();
  const sendTelemetryHandler = useRef<(...args: any[]) => void | Promise<void>>(
    async (id: string, value: any) => {
      if (iotcentralClient && iotcentralClient.isConnected()) {
        await iotcentralClient.sendTelemetry(
          {[id]: value},
          {'$.sub': HEALTH_COMPONENT},
        );
      }
    },
  );

  useEffect(() => {
    const handler = sendTelemetryHandler.current;
    sensors?.forEach((s) =>
      HealthMap[s.id].addListener(DATA_AVAILABLE_EVENT, handler),
    );
    return () => {
      sensors?.forEach((s) =>
        HealthMap[s.id].removeListener(DATA_AVAILABLE_EVENT, handler),
      );
    };
  }, [sensors]);

  if (!simulated) {
    if (iotcentralClient === null) {
      return <Registration />;
    }

    if (!sensors || iotcentralClient === undefined) {
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
        data={sensors}
        renderItem={({item: sensor, index}) => {
          return (
            <Card
              key={`health-${index}`}
              title={sensor.name}
              value={sensor.value}
              unit={sensor.unit}
              enabled={sensor.enabled}
              icon={sensor.icon}
              onToggle={() => sensor.enable(!sensor.enabled)}
              onLongPress={(e) => console.log('longpress')} // edit card
              onPress={
                sensor.enabled
                  ? (e) =>
                      navigation.navigate('Insight', {
                        telemetryId: sensor.id,
                        title: camelToName(sensor.id),
                        backTitle: 'Health',
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
