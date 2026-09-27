import React from 'react';
import Svg, {Rect} from 'react-native-svg';
import {useTheme} from 'hooks';
import {palette} from '../theme/palette';

export default function PhoneMark() {
  const {dark} = useTheme();
  const {primary} = palette(dark);
  return (
    <Svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      accessible={false}>
      <Rect
        x={5.4}
        y={1.9}
        width={13.2}
        height={20.2}
        rx={4.4}
        stroke={primary}
        strokeWidth={1.7}
      />
      <Rect
        x={7.5}
        y={6.4}
        width={9}
        height={11.2}
        rx={2.4}
        fill={primary}
        opacity={0.12}
      />
      <Rect
        x={10.2}
        y={4.3}
        width={3.6}
        height={1.1}
        rx={0.55}
        fill={primary}
        opacity={0.55}
      />
      <Rect
        x={9.6}
        y={18.9}
        width={4.8}
        height={1.2}
        rx={0.6}
        fill={primary}
        opacity={0.55}
      />
    </Svg>
  );
}
