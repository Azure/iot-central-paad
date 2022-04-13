// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useLogger, useTheme} from 'hooks';
import {Text} from './components/typography';
import Strings from 'strings';
import {ScrollView} from 'react-native-gesture-handler';

const Logs = React.memo(() => {
  const {colors} = useTheme();
  const [logs] = useLogger();

  const styles = useMemo(
    () => ({
      scroll: {marginTop: 10},
      body: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 10,
      },
      container: {flex: 1, padding: 20},
      logData: {color: 'green'},
      logPayload: {marginBottom: 5},
    }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <Text>{Strings.LogScreen.Header}</Text>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {logs.map((l, i) => (
            <React.Fragment key={`logf-${i}`}>
              <Text key={`log-${i}`}>
                {l.timestamp}:
                <Text key={`logdata-${i}`} style={styles.logData}>
                  {l.logItem.eventName}
                </Text>
              </Text>
              <Text style={styles.logPayload} key={`logpayload-${i}`}>
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
