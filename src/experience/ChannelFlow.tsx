import React, {useId} from 'react';
import {Animated, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, {Defs, LinearGradient, Path, Rect, Stop} from 'react-native-svg';
import {Text} from '../components/typography';

/**
 * The phone's connectors. Each one carries a caret at both ends: the phone and
 * the service talk to each other, so neither end owns an arrow.
 *
 * Two layouts, because the map has two honest shapes. 'fork' is the side by
 * side map, where the services really do sit in a left and right column, so a
 * route can leave a service center and land on a phone quarter. 'lane' is the
 * stacked fallback, where the services are a single full width column and no
 * fork could touch them: each lane is instead a self contained, captioned,
 * horizontal connector for exactly one pair.
 *
 * Nothing here reads, sends or confirms anything; the tint and the light are
 * decorative connection-state indicators, never packets, throughput or
 * delivery.
 */
export const STRIP_HEIGHT = 64;
export const LANE_HEIGHT = 24;
const LANE_MID = LANE_HEIGHT / 2;
const TOP = 1;
const BOTTOM = STRIP_HEIGHT - 1;
const BEND_IN = 23;
const BEND_OUT = 41;
const CORNER = 7;
const CARET = 5;
/** The feather matches the static tint exactly, so the light adds no bloom. */
export const FEATHER = 9;
/**
 * A dropped connection breaks the route itself: the same shape, in the danger
 * tone, drawn as a broken line. Nothing moves and nothing glows, so the state
 * is legible without colour alone and without implying traffic.
 */
export const INTERRUPTED_DASH = '6 5';
const SWELL = 96;
const GLINT = 28;
/** The glint trails the swell by about a fifth of the sweep. */
const LAG = 0.2;

export type ChannelId = 'dps' | 'hub';
export type ChannelLayout = 'fork' | 'lane';
export type Channel = {id: ChannelId; from: number; to: number};

const round = (value: number) => Math.round(value * 100) / 100;

/** Vertical stub, rounded corner, short straight run, rounded corner, stub. */
export function channelPath(start: number, end: number): string {
  const from = round(start);
  const to = round(end);
  const length = Math.hypot(to - from, BEND_OUT - BEND_IN);
  const unitX = (to - from) / length;
  const unitY = (BEND_OUT - BEND_IN) / length;
  const enterX = round(from + unitX * CORNER);
  const enterY = round(BEND_IN + unitY * CORNER);
  const leaveX = round(to - unitX * CORNER);
  const leaveY = round(BEND_OUT - unitY * CORNER);
  return (
    `M${from} ${TOP} L${from} ${BEND_IN - CORNER} ` +
    `Q${from} ${BEND_IN} ${enterX} ${enterY} L${leaveX} ${leaveY} ` +
    `Q${to} ${BEND_OUT} ${to} ${BEND_OUT + CORNER} L${to} ${BOTTOM}`
  );
}

/** One caret at each end of the same route: a two-way connector, not a flow. */
export function caretPath(start: number, end: number): string {
  const from = round(start);
  const to = round(end);
  return (
    `M${from - CARET} ${TOP + CARET} L${from} ${TOP} L${from + CARET} ${
      TOP + CARET
    } ` +
    `M${to - CARET} ${BOTTOM - CARET} L${to} ${BOTTOM} L${to + CARET} ${
      BOTTOM - CARET
    }`
  );
}

/** A stacked lane: one straight, self contained, two-way horizontal channel. */
export function lanePath(start: number, end: number): string {
  return `M${round(start)} ${LANE_MID} L${round(end)} ${LANE_MID}`;
}

/** A caret on each end, each opening away from the other: still two-way. */
export function laneCaretPath(start: number, end: number): string {
  const from = round(start);
  const to = round(end);
  const step = to >= from ? CARET : -CARET;
  return (
    `M${from + step} ${LANE_MID - CARET} L${from} ${LANE_MID} L${from + step} ${
      LANE_MID + CARET
    } ` +
    `M${to - step} ${LANE_MID - CARET} L${to} ${LANE_MID} L${to - step} ${
      LANE_MID + CARET
    }`
  );
}

/** Every layout answers the same three questions, so the rest stays shared. */
export function channelGeometry(layout: ChannelLayout) {
  return layout === 'lane'
    ? {height: LANE_HEIGHT, route: lanePath, carets: laneCaretPath}
    : {height: STRIP_HEIGHT, route: channelPath, carets: caretPath};
}

function Band({
  width,
  height,
  peak,
  color,
  progress,
  lag,
  travel,
  gradientId,
}: {
  width: number;
  height: number;
  peak: number;
  color: string;
  progress: Animated.Value;
  lag: number;
  travel: readonly [number, number];
  gradientId: string;
}) {
  return (
    <Animated.View
      style={[
        styles.band,
        {
          width,
          opacity: progress.interpolate({
            inputRange: [lag, lag + 0.12, 0.9, 1],
            outputRange: [0, 1, 1, 0],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [lag, 1],
                outputRange: [travel[0] - width / 2, travel[1] - width / 2],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.5" stopColor={color} stopOpacity={peak} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/** Two offset bands share one progress value, so water needs no second timer. */
function Sweep({
  channel,
  layout,
  width,
  color,
  peak,
  progress,
  gradientId,
}: {
  channel: Channel;
  layout: ChannelLayout;
  width: number;
  color: string;
  peak: number;
  progress: Animated.Value;
  gradientId: string;
}) {
  const {height, route: routeOf} = channelGeometry(layout);
  const direction = channel.from >= channel.to ? 1 : -1;
  // Start and finish with each band's faded edge on an end of its own route.
  const swell = [
    channel.to - (direction * SWELL) / 2,
    channel.from + (direction * SWELL) / 2,
  ] as const;
  const glint = [
    channel.to - (direction * GLINT) / 2,
    channel.from + (direction * GLINT) / 2,
  ] as const;
  const route = routeOf(channel.from, channel.to);
  return (
    <MaskedView
      testID={`home-map-flow-${channel.id}`}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      maskElement={
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none">
          <Path
            d={route}
            stroke="#ffffff"
            strokeOpacity={0.4}
            strokeWidth={FEATHER}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={route}
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      }>
      <Band
        width={SWELL}
        height={height}
        peak={peak}
        color={color}
        progress={progress}
        lag={0}
        travel={swell}
        gradientId={`${gradientId}-swell`}
      />
      <Band
        width={GLINT}
        height={height}
        peak={round(peak * 0.41)}
        color={color}
        progress={progress}
        lag={LAG}
        travel={glint}
        gradientId={`${gradientId}-glint`}
      />
    </MaskedView>
  );
}

export default function ChannelFlow({
  width,
  channels,
  layout = 'fork',
  linesTestID = 'home-map-phone-lines',
  color,
  glow,
  peak,
  connected,
  flowing,
  interrupted = false,
  progress,
  style,
  labels,
}: {
  width: number;
  channels: Channel[];
  layout?: ChannelLayout;
  linesTestID?: string;
  color: string;
  glow: string;
  peak: number;
  connected: boolean;
  flowing: boolean;
  interrupted?: boolean;
  progress: Animated.Value;
  style?: StyleProp<ViewStyle>;
  labels?: {text: Record<ChannelId, string>; background: string};
}) {
  const prefix = `flow-${useId().replace(/\W/g, '')}`;
  const {height, route, carets} = channelGeometry(layout);
  return (
    <Animated.View pointerEvents="none" style={style}>
      <View style={[styles.strip, {height}]}>
        <Svg
          testID={linesTestID}
          height={height}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants">
          {connected &&
            channels.map(channel => (
              <Path
                key={`${channel.id}-tint`}
                testID={`home-map-phone-${channel.id}-tint`}
                d={route(channel.from, channel.to)}
                stroke={glow}
                strokeOpacity={0.14}
                strokeWidth={FEATHER}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          {channels.map(channel => (
            <Path
              key={`${channel.id}-route`}
              testID={`home-map-phone-${channel.id}-path`}
              d={route(channel.from, channel.to)}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={interrupted ? INTERRUPTED_DASH : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {channels.map(channel => (
            <Path
              key={`${channel.id}-carets`}
              testID={`home-map-phone-${channel.id}-arrows`}
              d={carets(channel.from, channel.to)}
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {flowing &&
          channels.map(channel => (
            <Sweep
              key={`${channel.id}-flow`}
              channel={channel}
              layout={layout}
              width={width}
              color={glow}
              peak={peak}
              progress={progress}
              gradientId={`${prefix}-${channel.id}`}
            />
          ))}
        {layout === 'fork' &&
          labels &&
          channels.map(channel => (
            <View
              key={`${channel.id}-label`}
              testID={`home-map-phone-${channel.id}-label`}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.label,
                {
                  left: (channel.from + channel.to) / 2 - 46,
                  borderColor: color,
                  backgroundColor: labels.background,
                },
              ]}>
              <Text style={[styles.labelText, {color}]}>
                {labels.text[channel.id]}
              </Text>
            </View>
          ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Routes are already mirrored; native absolute positions must not mirror again.
  strip: {overflow: 'hidden', direction: 'ltr'},
  band: {position: 'absolute', left: 0, top: 0},
  label: {
    position: 'absolute',
    top: 21,
    width: 92,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
