// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {Text} from 'components/typography';
import {useTheme} from 'hooks';
import {formatValue, History, seriesColor, summarize} from './history';

const WIDTH = 320;
const HEIGHT = 190;
const EDGE = 8;

export function HistoryChart({
  history,
  unit,
}: {
  history: History;
  unit?: string;
}) {
  const {colors, dark} = useTheme();
  const samples = history.series.flatMap(series => series.samples);
  const values = samples
    .map(sample => sample.value)
    .filter((value): value is number => value !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const magnitude = Math.max(Math.abs(min), Math.abs(max)) || 1;
  const from = samples.length
    ? Math.min(...samples.map(sample => sample.timestamp))
    : 0;
  const to = samples.length
    ? Math.max(...samples.map(sample => sample.timestamp))
    : 0;
  const x = (timestamp: number) =>
    from === to
      ? WIDTH / 2
      : EDGE + ((timestamp - from) / (to - from)) * (WIDTH - EDGE * 2);
  const y = (value: number) =>
    min === max
      ? HEIGHT / 2
      : HEIGHT -
        EDGE -
        ((value / magnitude - min / magnitude) /
          (max / magnitude - min / magnitude)) *
          (HEIGHT - EDGE * 2);
  const withUnit = (value: number | null) =>
    `${formatValue(value)}${value !== null && unit ? ` ${unit}` : ''}`;

  return (
    <View style={styles.container}>
      {values.length > 0 && (
        <>
          <View style={styles.range}>
            <Text>High: {withUnit(max)}</Text>
            <Text>Low: {withUnit(min)}</Text>
          </View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="Recent sensor readings over time. Numeric summaries for each series follow.">
            <Svg
              width="100%"
              height={HEIGHT}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              accessible={false}>
              {[EDGE, HEIGHT / 2, HEIGHT - EDGE].map(position => (
                <Line
                  key={position}
                  x1={EDGE}
                  x2={WIDTH - EDGE}
                  y1={position}
                  y2={position}
                  stroke={colors.text}
                  strokeOpacity={0.15}
                />
              ))}
              {history.series.map(series => {
                const color = seriesColor(series.id, dark);
                let connected = false;
                const path = series.samples
                  .map(sample => {
                    if (sample.value === null) {
                      connected = false;
                      return '';
                    }
                    const command = connected ? 'L' : 'M';
                    connected = true;
                    return `${command}${x(sample.timestamp)},${y(
                      sample.value,
                    )}`;
                  })
                  .join(' ');
                return (
                  <React.Fragment key={series.id}>
                    <Path d={path} stroke={color} strokeWidth={2} fill="none" />
                    {series.samples.map((sample, index) =>
                      sample.value === null ? null : (
                        <Circle
                          key={index}
                          cx={x(sample.timestamp)}
                          cy={y(sample.value)}
                          r={2}
                          fill={color}
                        />
                      ),
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
          <View style={styles.range}>
            <Text>From {new Date(from).toLocaleTimeString()}</Text>
            <Text>To {new Date(to).toLocaleTimeString()}</Text>
          </View>
          <Text style={styles.caption}>
            Shared vertical scale · Gaps mark unavailable readings
          </Text>
        </>
      )}
      {history.series.map(series => {
        const summary = summarize(series.samples);
        const color = seriesColor(series.id, dark);
        return (
          <View
            key={series.id}
            style={[styles.summary, {borderColor: colors.border}]}>
            <View style={styles.legend}>
              <View style={[styles.swatch, {backgroundColor: color}]} />
              <Text accessibilityRole="header" style={styles.seriesName}>
                {series.id}
              </Text>
            </View>
            <Text style={styles.latest}>
              Latest: {withUnit(summary?.latest ?? null)}
            </Text>
            <Text>Minimum: {withUnit(summary?.min ?? null)}</Text>
            <Text>Maximum: {withUnit(summary?.max ?? null)}</Text>
            <Text>Average: {withUnit(summary?.average ?? null)}</Text>
            <Text style={styles.caption}>
              {summary?.count ?? 0} valid readings in retained history
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: 12},
  range: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  summary: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 8},
  legend: {flexDirection: 'row', alignItems: 'center', gap: 8},
  swatch: {height: 4, width: 20, borderRadius: 2},
  seriesName: {fontWeight: '600', flexShrink: 1},
  latest: {fontSize: 20, fontWeight: '600'},
  caption: {fontSize: 14},
});
