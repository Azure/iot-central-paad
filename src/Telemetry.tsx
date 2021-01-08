import React, {useCallback, useEffect, useRef} from 'react';
import {View, FlatList} from 'react-native';
import Registration from './Registration';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card} from './components/card';
import {useNavigation} from '@react-navigation/native';
import {Loader} from './components/loader';
import {camelToName} from './components/typography';
import {useSensors, useIoTCentralClient, useSimulation} from 'hooks';
import {SensorMap} from 'sensors';
import {
  DATA_AVAILABLE_EVENT,
  ENABLE_DISABLE_COMMAND,
  SET_FREQUENCY_COMMAND,
} from 'types';
import {
  IIoTCCommand,
  IIoTCCommandResponse,
  IOTC_EVENTS,
} from 'react-native-azure-iotcentral-client';

const TELEMETRY_COMPONENT = 'sensors';

export default function Telemetry() {
  const [simulated] = useSimulation();
  const iotcentralClient = useIoTCentralClient();
  const insets = useSafeAreaInsets();
  const sensors = useSensors();
  const navigation = useNavigation();

  const sendTelemetryHandler = useRef<(...args: any[]) => void | Promise<void>>(
    async (id: string, value: any) => {
      if (iotcentralClient && iotcentralClient.isConnected()) {
        await iotcentralClient.sendTelemetry(
          {[id]: value},
          {'$.sub': TELEMETRY_COMPONENT},
        );
      }
    },
  );

  const onCommandUpdate = useCallback(
    async (command: IIoTCCommand) => {
      let data: any;
      data = JSON.parse(command.requestPayload);
      if (data.sensor) {
        if (command.name === ENABLE_DISABLE_COMMAND) {
          sensors?.[data.sensor].enable(data.enable ? data.enable : false);
          await command.reply(IIoTCCommandResponse.SUCCESS, 'Enable');
        } else if (command.name === SET_FREQUENCY_COMMAND) {
          SensorMap[data.sensor].sendInterval(
            data.frequency ? data.frequency * 1000 : 5000,
          );
          await command.reply(IIoTCCommandResponse.SUCCESS, 'Frequency');
        }
      }
    },
    [sensors],
  );

  useEffect(() => {
    const handler = sendTelemetryHandler.current;
    sensors?.forEach((s) =>
      SensorMap[s.id].addListener(DATA_AVAILABLE_EVENT, handler),
    );
    return () => {
      sensors?.forEach((s) =>
        SensorMap[s.id].removeListener(DATA_AVAILABLE_EVENT, handler),
      );
    };
  }, [sensors]);

  useEffect(() => {
    if (iotcentralClient) {
      iotcentralClient.on(IOTC_EVENTS.Commands, onCommandUpdate);
    }
  }, [iotcentralClient, onCommandUpdate]);

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
              key={`telem-${index}`}
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
