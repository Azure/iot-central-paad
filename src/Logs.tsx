// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useLogger, useTheme} from 'hooks';
import {Text} from './components/typography';
import {ScrollView} from 'react-native-gesture-handler';
import Strings from 'strings';

const Logs = React.memo(() => {
  const {colors} = useTheme();
  const [logs] = useLogger();

  const styles = useMemo(
    () => ({
      scroll: {marginTop: 10, flex: 1},
      body: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 10,
      },
    }),
    [colors],
  );

  return (
    <View style={{flex: 1, padding: 20}}>
      <Text>{Strings.LogScreen.Header}</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
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
        </View>
      </ScrollView>
    </View>
  );
});

export default Logs;
