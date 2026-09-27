import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
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
  label: string;
  onPress(): void | Promise<void>;
  id?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  accessibilityLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
  external?: boolean;
  onInset?: boolean;
  block?: boolean;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function DetailsAction({
  label,
  onPress,
  id,
  icon,
  variant = 'secondary',
  accessibilityLabel = label,
  disabled = false,
  busy = false,
  expanded,
  external = false,
  onInset = false,
  block = false,
  visible = true,
  style,
}: Props) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const inactive = disabled || busy;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const quiet = variant === 'quiet';
  const {pressed, scale, onPressIn, onPressOut} = usePressSettle(
    'compact',
    inactive,
    visible,
  );
  const color = inactive
    ? colors.muted
    : primary
    ? colors.onPrimary
    : danger
    ? colors.danger
    : colors.primary;
  // Painted actions share one solid language: a flat fill inside a crisp
  // hairline, and pressing deepens that fill instead of dimming the label.
  const paint: SurfacePaintProps | null =
    inactive || quiet
      ? null
      : {
          tone: primary
            ? 'primary'
            : danger
            ? 'danger'
            : onInset
            ? 'raised'
            : 'secondary',
          radius: RADIUS,
          pressed,
          ...(expanded && !primary && !danger ? {from: colors.tints[0]} : {}),
        };
  const backgroundColor = inactive
    ? colors.inset
    : paint
    ? surfaceColor(dark, paint)
    : pressed
    ? colors.inset
    : 'transparent';
  const trailing = external
    ? 'open-in-new'
    : expanded === undefined
    ? undefined
    : expanded
    ? 'chevron-up'
    : 'chevron-down';
  const glyph = (name: string) => (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Icon
        name={name}
        type="material-community"
        size={quiet ? 16 : 18}
        color={color}
      />
    </View>
  );
  return (
    <AnimatedPressable
      testID={id}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: inactive,
        busy,
        ...(expanded === undefined ? {} : {expanded}),
      }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      // The settle shrinks the paint, never the reachable target.
      hitSlop={2}
      style={[
        detailStyles.action,
        primary && detailStyles.primaryAction,
        styles.control,
        block && styles.block,
        quiet && styles.quiet,
        quiet || (primary && !inactive) ? styles.borderless : styles.edged,
        {
          backgroundColor,
          borderColor: danger ? colors.danger : colors.controlBorder,
        },
        inactive && detailStyles.disabled,
        style,
        {transform: [{scale}]},
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        glyph(icon)
      ) : null}
      <Text
        style={[
          detailStyles.actionLabel,
          styles.label,
          quiet && styles.quietLabel,
          {color},
        ]}>
        {label}
      </Text>
      {trailing && glyph(trailing)}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  borderless: {borderWidth: 0},
  edged: {borderWidth: StyleSheet.hairlineWidth},
  block: {alignSelf: 'stretch'},
  label: {flexShrink: 1, textAlign: 'center'},
  quiet: {
    minWidth: 48,
    paddingHorizontal: 0,
    paddingVertical: 10,
    gap: 6,
  },
  quietLabel: {fontSize: 13, lineHeight: 18},
});
