// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from '../hooks';
import {usePressSettle} from '../hooks/press';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {SurfacePaintProps, surfaceColor} from './surface';
import {Text} from './typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const RADIUS = 14;

type Props = {
  id: string;
  label: string;
  supporting: string;
  icon: string;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
  onInset?: boolean;
  visible?: boolean;
  onPress(): void | Promise<void>;
};

export default function DetailsRow({
  id,
  label,
  supporting,
  icon,
  destructive = false,
  disabled = false,
  busy = false,
  expanded,
  onInset = false,
  visible = true,
  onPress,
}: Props) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const {fontScale} = useWindowDimensions();
  const stacked = fontScale > 1.45;
  const inactive = disabled || busy;
  const accent = destructive ? appearance.danger : appearance.primary;
  const {pressed, scale, onPressIn, onPressOut} = usePressSettle(
    'card',
    inactive,
    visible,
  );
  // Rows share the action fill so a list of them reads as one material.
  const paint: SurfacePaintProps | null = inactive
    ? null
    : {
        tone: destructive
          ? 'danger'
          : expanded || !onInset
          ? 'secondary'
          : 'raised',
        radius: RADIUS,
        pressed,
        ...(destructive || (!expanded && onInset)
          ? {}
          : {from: appearance.tints[0]}),
      };
  const background = paint ? surfaceColor(dark, paint) : appearance.inset;
  // The glyph badge stays one step apart from the row it sits on, so rows keep
  // the same depth on a raised card and on the recessed Azure panel.
  const glyphBackground =
    !destructive && !expanded && onInset
      ? appearance.inset
      : appearance.surface;
  return (
    <AnimatedPressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={supporting}
      accessibilityState={{
        disabled: inactive,
        busy,
        ...(expanded === undefined ? {} : {expanded}),
      }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={2}
      style={[
        styles.row,
        stacked && styles.stacked,
        {
          backgroundColor: background,
          borderColor: destructive ? appearance.danger : appearance.border,
        },
        inactive && detailStyles.disabled,
        {transform: [{scale}]},
      ]}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.glyph,
          {backgroundColor: glyphBackground, borderColor: accent},
        ]}>
        {busy ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Icon
            name={icon}
            type="material-community"
            size={19}
            color={accent}
          />
        )}
      </View>
      <View style={styles.content}>
        <Text
          style={[
            detailStyles.actionLabel,
            {color: destructive ? appearance.danger : appearance.text},
          ]}>
          {label}
        </Text>
        <Text style={[detailStyles.supporting, {color: appearance.muted}]}>
          {supporting}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stacked: {alignItems: 'flex-start'},
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {flex: 1, minWidth: 0, gap: 3},
});
