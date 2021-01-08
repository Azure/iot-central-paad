import React, {useContext} from 'react';
import {View, Platform} from 'react-native';
import {IIcon, useScreenIcon} from './hooks/common';
import {Text} from './components/typography';
import {ScrollView} from 'react-native-gesture-handler';
import {useTheme} from '@react-navigation/native';
import {LogsContext} from './contexts/logs';

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
  const {logs} = useContext(LogsContext);

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
