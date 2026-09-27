// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {RouteProp} from '@react-navigation/native';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  NavigationParams,
  DATA_AVAILABLE_EVENT,
  SENSOR_UNAVAILABLE_EVENT,
  ChartType,
} from 'types';
import {SensorMap} from 'sensors';
import {Text, camelToName} from 'components/typography';
import Map from 'components/map';
import {useTheme} from 'hooks';
import {HistoryChart} from './charts/HistoryChart';
import {
  appendSample,
  emptyHistory,
  formatValue,
  HISTORY_LIMIT,
  readLocation,
} from './charts/history';

type ChartParams = NavigationParams & {
  chartType: ChartType;
  telemetryId: string;
  currentValue: unknown;
};

function ChartContent({
  chartType,
  telemetryId,
  currentValue,
  title,
}: ChartParams) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const sensor = SensorMap[telemetryId];
  const [history, setHistory] = React.useState(() =>
    appendSample(emptyHistory(), telemetryId, currentValue, Date.now()),
  );
  const [location, setLocation] = React.useState(() =>
    readLocation(currentValue),
  );

  React.useEffect(() => {
    const receive = (id: string, value: unknown) => {
      if (id !== telemetryId) {
        return;
      }
      if (chartType === ChartType.MAP) {
        setLocation(readLocation(value));
      } else {
        const timestamp = Date.now();
        setHistory(previous =>
          appendSample(previous, telemetryId, value, timestamp),
        );
      }
    };
    const unavailable = (id: string) => receive(id, undefined);
    sensor?.addListener(DATA_AVAILABLE_EVENT, receive);
    sensor?.addListener(SENSOR_UNAVAILABLE_EVENT, unavailable);
    return () => {
      sensor?.removeListener(DATA_AVAILABLE_EVENT, receive);
      sensor?.removeListener(SENSOR_UNAVAILABLE_EVENT, unavailable);
    };
  }, [sensor, telemetryId, chartType]);

  // Metadata is optional: older sensor adapters expose only the event interface.
  const metadata = sensor as
    | {unit?: string; simulated?: boolean; name?: string}
    | undefined;
  const unit =
    typeof metadata?.unit === 'string' && metadata.unit.trim()
      ? metadata.unit
      : undefined;
  const source =
    metadata?.simulated === true
      ? 'Simulated sensor data'
      : metadata?.simulated === false
      ? 'Device sensor data'
      : 'Simulation status unavailable';

  return (
    <ScrollView
      style={[styles.screen, {backgroundColor: colors.background}]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: Math.max(insets.bottom, 20),
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
        },
      ]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title || metadata?.name || camelToName(telemetryId)}
      </Text>
      <Text style={styles.description}>{source}</Text>
      {chartType === ChartType.MAP ? (
        location ? (
          <>
            <View style={styles.mapFrame}>
              <Map style={styles.map} location={location} />
            </View>
            <Text>Latitude: {formatValue(location.lat)}°</Text>
            <Text>Longitude: {formatValue(location.lon)}°</Text>
          </>
        ) : (
          <Text accessibilityRole="alert" style={styles.empty}>
            Location unavailable. A valid location fix is needed to show the
            map.
          </Text>
        )
      ) : (
        <>
          <Text style={styles.description}>
            {unit ? `Unit: ${unit}` : 'Unit unavailable'} · Last {HISTORY_LIMIT}{' '}
            readings, kept on this screen
          </Text>
          {history.unavailable && (
            <Text accessibilityRole="alert" style={styles.empty}>
              Latest reading unavailable. No valid numeric value was received.
              {history.series.length > 0
                ? ' Earlier readings remain below.'
                : ''}
            </Text>
          )}
          <HistoryChart history={history} unit={unit} />
        </>
      )}
    </ScrollView>
  );
}

export default function Chart({
  route,
}: {
  route: RouteProp<Record<string, ChartParams>, 'Insight'>;
}) {
  // A new telemetry route gets one initial sample; stream updates never reseed it.
  return (
    <ChartContent
      key={`${route.params.telemetryId}:${route.params.chartType}`}
      {...route.params}
    />
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {paddingTop: 20, gap: 12},
  title: {fontSize: 24, fontWeight: '600'},
  description: {fontSize: 15},
  empty: {paddingVertical: 16},
  mapFrame: {height: 300, borderRadius: 16, overflow: 'hidden'},
  map: {flex: 1},
});
