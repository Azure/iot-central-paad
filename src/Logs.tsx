import React, {useContext, useEffect} from 'react';
import {View, Platform} from 'react-native';
import {IIcon, useScreenIcon} from './hooks/common';
import {useIoTCentralClient, useTelemetry} from './hooks/iotc';
import {Text} from './components/typography';
import {SensorProps} from './contexts/iotc';
import {ScrollView} from 'react-native-gesture-handler';
import {
  IOTC_EVENTS,
  IIoTCCommand,
  IIoTCCommandResponse,
} from 'react-native-azure-iotcentral-client';
import {LogItem} from './types';
import {useTheme} from '@react-navigation/native';
import {LogsContext} from './contexts/logs';

const ENABLE_DISABLE_COMMAND = 'enableSensors';
const SET_FREQUENCY_COMMAND = 'changeInterval';

const onCommandUpdate = async (
  setTelemetry: (id: string, data: Partial<SensorProps>) => void,
  setLogs: (logItem: LogItem) => void,
  command: IIoTCCommand,
) => {
  let data: any;
  data = JSON.parse(command.requestPayload);

  if (command.name === ENABLE_DISABLE_COMMAND) {
    if (data.sensor) {
      setTelemetry(data.sensor, {enabled: data.enable ? data.enable : false});
      await command.reply(IIoTCCommandResponse.SUCCESS, 'Enable');
    }
  } else if (command.name === SET_FREQUENCY_COMMAND) {
    if (data.sensor) {
      setTelemetry(data.sensor, {
        interval: data.frequency ? data.frequency * 1000 : 5000,
      });
      await command.reply(IIoTCCommandResponse.SUCCESS, 'Frequency');
    }
  }
  setLogs({eventName: command.name, eventData: command.requestPayload});
};

export default function Logs() {
  useScreenIcon(
    Platform.select({
      ios: {
        name: 'console',
        type: 'material-community',
      },
      android: {
        name: 'console',
        type: 'material-community',
      },
    }) as IIcon,
  );

  const {colors} = useTheme();
  const {client} = useIoTCentralClient();
  const {set} = useTelemetry();
  const {logs, append} = useContext(LogsContext);

  useEffect(() => {
    if (client && client.isConnected()) {
      client.on(IOTC_EVENTS.Commands, onCommandUpdate.bind(null, set, append));
      client.fetchTwin();
    }
  }, [client]);

  return (
    <View style={{flex: 1, padding: 10}}>
      <Text>Received commands will be logged below.</Text>
      <ScrollView
        style={{
          margin: 10,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 10,
          paddingBottom: 100,
        }}>
        {logs.map((l, i) => (
          <React.Fragment key={`logf-${i}`}>
            <Text key={`log-${i}`}>
              {l.timestamp}:
              <Text key={`logdata-${i}`} style={{color: 'green'}}>
                {l.logItem.eventName}
              </Text>
            </Text>
            <Text style={{marginBottom: 5}} key={`logpayload-${i}`}>
              {l.logItem.eventData}
            </Text>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}
