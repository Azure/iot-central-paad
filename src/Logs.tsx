import React from 'react';
import {View} from 'react-native';
import {useLogger} from './hooks/common';
import {Text} from './components/typography';
import {ScrollView} from 'react-native-gesture-handler';
import {useTheme} from '@react-navigation/native';

const Logs = React.memo(() => {
  const {colors} = useTheme();
  const [logs] = useLogger();

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
});

export default Logs;
