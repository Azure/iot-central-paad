import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  I18nManager,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useTheme} from '../hooks';
import {FLUID_EASING, useMotionAllowed} from '../hooks/motion';
import {palette} from '../theme/palette';
import {surfaceColor} from './surface';
import {Text} from './typography';

type Choice = {id: string; label: string};

type Props = {
  options: readonly [Choice, Choice];
  selected: 0 | 1;
  onSelect(index: 0 | 1): void;
  label: string;
  variant?: 'segmented' | 'filter';
  focused?: boolean;
};

export default function SelectionControl({
  options,
  selected,
  onSelect,
  label,
  variant = 'segmented',
  focused = true,
}: Props) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const {width, fontScale} = useWindowDimensions();
  const stacked = variant === 'segmented' && (fontScale > 1.3 || width < 360);
  const segmented = variant === 'segmented';
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = Math.max(0, (trackWidth - 8) / 2);
  const measuredWidth = useRef(0);
  const previousSelection = useRef(selected);
  const position = useRef(new Animated.Value(0)).current;
  const motion = useMotionAllowed(focused && segmented && !stacked);
  const direction = I18nManager.isRTL ? -1 : 1;
  useEffect(() => {
    const toValue = selected * segmentWidth * direction;
    const changed = previousSelection.current !== selected;
    const resized = measuredWidth.current !== segmentWidth;
    previousSelection.current = selected;
    measuredWidth.current = segmentWidth;
    if (!motion || !changed || resized || segmentWidth === 0) {
      position.setValue(toValue);
      return;
    }
    const animation = Animated.timing(position, {
      toValue,
      duration: 260,
      easing: FLUID_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [direction, motion, position, segmentWidth, selected]);

  const thumbVisible = segmented && !stacked && segmentWidth > 0;
  // The thumb is the one lifted piece of the control, so it carries the
  // shared raised gradient rather than a flat fill.
  const thumbPaint = {tone: 'raised', radius: 9} as const;
  return (
    <View
      accessible={false}
      accessibilityLabel={label}
      onLayout={
        segmented
          ? event => setTrackWidth(event.nativeEvent.layout.width)
          : undefined
      }
      style={[
        styles.container,
        segmented ? styles.segmented : styles.filters,
        stacked && styles.stacked,
      ]}>
      {segmented && !stacked && (
        <View
          pointerEvents="none"
          accessible={false}
          style={[styles.track, {backgroundColor: colors.inset}]}
        />
      )}
      {thumbVisible && (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              backgroundColor: surfaceColor(dark, thumbPaint),
              borderColor: colors.border,
              transform: [{translateX: position}],
            },
          ]}
        />
      )}
      {options.map((option, index) => {
        const active = index === selected;
        return (
          <Pressable
            key={option.id}
            testID={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{selected: active}}
            onPress={() => onSelect(index === 0 ? 0 : 1)}
            style={[styles.target, segmented && !stacked && styles.segment]}>
            {({pressed}) => (
              <View
                pointerEvents="none"
                style={[
                  styles.visual,
                  !segmented && styles.chip,
                  {
                    // A press deepens the seat instead of fading the label.
                    backgroundColor:
                      !segmented && active
                        ? colors.tints[0]
                        : segmented && active && !thumbVisible
                        ? colors.surface
                        : pressed
                        ? colors.inset
                        : 'transparent',
                    borderColor: !segmented
                      ? active
                        ? colors.primary
                        : colors.border
                      : active && !thumbVisible
                      ? colors.border
                      : 'transparent',
                  },
                ]}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: active
                        ? segmented
                          ? colors.text
                          : colors.primary
                        : colors.muted,
                    },
                  ]}>
                  {option.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flexDirection: 'row', alignItems: 'center'},
  segmented: {alignSelf: 'stretch', paddingHorizontal: 4},
  filters: {flexWrap: 'wrap', gap: 8},
  stacked: {flexDirection: 'column', alignItems: 'stretch', gap: 4},
  track: {
    position: 'absolute',
    start: 0,
    end: 0,
    top: 8,
    bottom: 8,
    borderRadius: 12,
  },
  thumb: {
    position: 'absolute',
    start: 4,
    top: 8,
    bottom: 8,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  target: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  segment: {flex: 1},
  visual: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chip: {borderRadius: 16},
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
