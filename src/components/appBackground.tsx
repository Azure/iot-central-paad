import React, {useId} from 'react';
import {StyleSheet, View, ViewProps} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';

export default function AppBackground({children, style, ...props}: ViewProps) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const id = `ground-${useId().replace(/\W/g, '')}`;
  return (
    <View
      {...props}
      style={[styles.root, {backgroundColor: colors.background}, style]}>
      <Svg
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor={colors.gradientStart} />
            <Stop offset="1" stopColor={colors.gradientEnd} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({root: {flex: 1}});
