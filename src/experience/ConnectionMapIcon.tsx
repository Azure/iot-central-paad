import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, G, Path, Polygon, Rect} from 'react-native-svg';
import AdrMark from '../assets/connection-map/adr.svg';
import DpsMark from '../assets/connection-map/dps.svg';
import HubMark from '../assets/connection-map/iot-hub.svg';

export type MapIcon = 'adr' | 'dps' | 'hub' | 'android' | 'iphone';
type Tones = readonly [string, string, string];

const paints = {
  light: {
    edge: '#8BA293',
    hair: '#C5D4C7',
    plate: '#FFFFFF',
    paper: '#FFFFFF',
    green: ['#3F7862', '#285A48', '#1B4335'],
    adr: ['#EDF5EC', '#D9E8D7', '#B5CCB3'],
    dps: ['#F2EEF8', '#E1D8EE', '#C2B3D9'],
    hub: ['#EEF4F2', '#D9E5E1', '#B3C7C0'],
    phone: ['#FAF1E9', '#F4E7DB', '#E3CCB6'],
  },
  dark: {
    edge: '#0B1512',
    hair: '#46604F',
    plate: '#EEF5F0',
    paper: '#F2F7F3',
    green: ['#B4E2CC', '#91CEB2', '#6A9F87'],
    adr: ['#557A64', '#41614F', '#2F4A3B'],
    dps: ['#6A5F85', '#544A6D', '#3E3652'],
    hub: ['#557570', '#425D58', '#304642'],
    phone: ['#2C4036', '#1E2F27', '#152219'],
  },
} as const;

const badges = {
  adr: {Mark: AdrMark, x: 14, y: 19, size: 28},
  dps: {Mark: DpsMark, x: 13, y: 25, size: 28},
  hub: {Mark: HubMark, x: 12, y: 28.5, size: 27},
};

// Google Material Icons, Apache-2.0; see LICENSE.material-icons and LICENSE.connection-map.
const phones = {
  android: {
    width: 25.67,
    radius: 5.5,
    hull: 'M24.87 13.61A5.5 5.5 0 0 1 28.17 12.51H42.83A5.5 5.5 0 0 1 48.33 18.01V47.34A5.5 5.5 0 0 1 46.13 51.74L40.63 55.87L19.37 17.73Z',
    side: 'M41.22 18.24L46.72 14.12A5.5 5.5 0 0 1 48.33 18.01V47.34A5.5 5.5 0 0 1 46.13 51.74L40.63 55.87Z',
    screenX: 20.38,
    screenWidth: 19.25,
    cueX: 27.8,
    outline:
      'M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z',
  },
  iphone: {
    width: 23.83,
    radius: 4.58,
    hull: 'M24.5 13.43A4.58 4.58 0 0 1 27.25 12.51H41.92A4.58 4.58 0 0 1 46.5 17.09V48.26A4.58 4.58 0 0 1 44.67 51.93L39.17 56.05L19 17.55Z',
    side: 'M39.66 17.98L45.16 13.85A4.58 4.58 0 0 1 46.5 17.09V48.26A4.58 4.58 0 0 1 44.67 51.93L39.17 56.05Z',
    screenX: 20.83,
    screenWidth: 16.5,
    cueX: 26.88,
    outline:
      'M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z',
  },
};

function ConnectionMapIcon({node, dark}: {node: MapIcon; dark: boolean}) {
  const colors = paints[dark ? 'dark' : 'light'];
  const green = colors.green;
  const badge = node === 'android' || node === 'iphone' ? null : badges[node];
  const phone = node === 'android' || node === 'iphone' ? phones[node] : null;

  // Two flat passes soften the silhouette without shadows, gradients or a pedestal.
  const solid = (draw: (edge: boolean) => React.ReactNode) => (
    <>
      <G stroke={colors.edge} strokeWidth={4.4} strokeLinejoin="round">
        {draw(true)}
      </G>
      <G strokeWidth={3} strokeLinejoin="round">
        {draw(false)}
      </G>
    </>
  );
  const box = (
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    tones: Tones,
  ) =>
    solid(edge => {
      const [top, front, side] = edge
        ? [colors.edge, colors.edge, colors.edge]
        : tones;
      const right = x + width;
      const back = right + depth;
      const rise = depth * 0.75;
      return (
        <>
          <Polygon
            points={`${x},${y} ${x + depth},${y - rise} ${back},${
              y - rise
            } ${right},${y}`}
            fill={top}
            stroke={top}
          />
          <Polygon
            points={`${right},${y} ${back},${y - rise} ${back},${
              y + height - rise
            } ${right},${y + height}`}
            fill={side}
            stroke={side}
          />
          <Rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={1}
            fill={front}
            stroke={front}
          />
        </>
      );
    });

  return (
    <View
      testID={`home-icon-${node}`}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.icon}>
      <Svg width={64} height={64} viewBox="0 0 64 64" accessible={false}>
        {node === 'adr' && (
          <>
            {box(11, 16, 34, 42, 8, colors.adr)}
            {solid(edge => (
              <Rect
                x={22}
                y={6.5}
                width={14}
                height={6.5}
                rx={1}
                fill={edge ? colors.edge : colors.paper}
                stroke={edge ? colors.edge : colors.paper}
              />
            ))}
            <Path
              d="M13 50.5H43"
              stroke={colors.adr[2]}
              strokeWidth={1.1}
              strokeLinecap="round"
            />
            {solid(edge => (
              <Rect
                x={22.5}
                y={53.2}
                width={11}
                height={1.6}
                rx={1}
                fill={edge ? colors.edge : green[1]}
                stroke={edge ? colors.edge : green[1]}
              />
            ))}
          </>
        )}
        {node === 'dps' && (
          <>
            {box(10, 22, 34, 36, 8, colors.dps)}
            {box(15, 8, 5, 11, 3, green)}
            {box(25.5, 12, 5, 7, 3, colors.dps)}
            {box(36, 12, 5, 7, 3, colors.dps)}
          </>
        )}
        {node === 'hub' && (
          <>
            {box(7, 26, 40, 32, 8, colors.hub)}
            {[32, 39, 46].map(y => (
              <Polygon
                key={y}
                points={`49,${y} 53,${y - 3} 53,${y + 1} 49,${y + 4}`}
                fill={green[1]}
              />
            ))}
            <Circle cx={43.5} cy={32} r={1.3} fill={green[1]} />
            <Circle cx={43.5} cy={37} r={1.3} fill={colors.hub[2]} />
            <Path
              d="M34 22.5V10.5"
              stroke={green[1]}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <Circle
              cx={34}
              cy={8.5}
              r={3.4}
              fill={colors.edge}
              stroke={colors.edge}
              strokeWidth={1.4}
            />
            <Circle cx={34} cy={8.5} r={3} fill={green[0]} />
          </>
        )}
        {phone && (
          <>
            <G
              fill={colors.edge}
              stroke={colors.edge}
              strokeWidth={1.4}
              strokeLinejoin="round">
              <Path d={phone.hull} />
              <Rect
                x={17.17}
                y={16.63}
                width={phone.width}
                height={40.33}
                rx={phone.radius}
              />
            </G>
            <Path d={phone.hull} fill={green[0]} />
            <Path d={phone.side} fill={green[2]} />
            <Rect
              x={17.17}
              y={16.63}
              width={phone.width}
              height={40.33}
              rx={phone.radius}
              fill={colors.phone[0]}
            />
            <Rect
              x={phone.screenX}
              y={22.13}
              width={phone.screenWidth}
              height={25.67}
              fill={colors.phone[1]}
            />
            <Path
              d={phone.outline}
              transform="translate(8 14.8) scale(1.8333)"
              fill={green[1]}
            />
            <Circle cx={phone.cueX} cy={37.37} r={1.3} fill={green[1]} />
            <Path
              d={`M${phone.cueX} 33.77a3.6 3.6 0 0 1 3.6 3.6M${phone.cueX} 30.77a6.6 6.6 0 0 1 6.6 6.6`}
              fill="none"
              stroke={green[1]}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </>
        )}
        {badge && (
          <Rect
            x={badge.x}
            y={badge.y}
            width={badge.size}
            height={badge.size}
            rx={4}
            fill={colors.plate}
            stroke={colors.hair}
            strokeWidth={1}
          />
        )}
      </Svg>
      {/* Separate SVG roots isolate the official marks' fixed gradient IDs. */}
      {badge && (
        <badge.Mark
          testID={`home-icon-${node}-mark`}
          accessible={false}
          width={badge.size - 2}
          height={badge.size - 2}
          preserveAspectRatio="xMidYMid meet"
          style={[styles.mark, {left: badge.x + 1, top: badge.y + 1}]}
        />
      )}
    </View>
  );
}

export default memo(ConnectionMapIcon);

const styles = StyleSheet.create({
  icon: {width: 64, height: 64, flexShrink: 0, direction: 'ltr'},
  mark: {position: 'absolute'},
});
