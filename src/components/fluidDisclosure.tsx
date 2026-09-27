import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {FLUID_EASING, useMotionAllowed} from '../hooks/motion';

type Phase = 'closed' | 'opening' | 'open' | 'closing';

type Props = {
  /** The intended state. The rest of this component only catches up to it. */
  expanded: boolean;
  children: React.ReactNode;
  /** Owners pass their own visibility; hidden layers never animate. */
  visible?: boolean;
  testID?: string;
  openDuration?: number;
  closeDuration?: number;
};

/**
 * A finite height transition around real content. Static content is the
 * default and the resting state; the animated path only exists between them.
 */
export default function FluidDisclosure({
  expanded,
  children,
  visible = true,
  testID,
  openDuration = 300,
  closeDuration = 240,
}: Props) {
  const motion = useMotionAllowed(visible);
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [phase, setPhase] = useState<Phase>(expanded ? 'open' : 'closed');
  const [measured, setMeasured] = useState<number | null>(null);

  useEffect(() => {
    setPhase(current => {
      if (!motion) return expanded ? 'open' : 'closed';
      if (expanded) return current === 'open' ? 'open' : 'opening';
      return current === 'closed' ? 'closed' : 'closing';
    });
  }, [expanded, motion]);

  useEffect(() => {
    if (phase === 'open') {
      progress.setValue(1);
      return;
    }
    if (phase === 'closed') {
      progress.setValue(0);
      // A later opening measures the content it actually shows.
      setMeasured(current => (current === null ? current : null));
      return;
    }
    const opening = phase === 'opening';
    if (!motion || opening !== expanded) return;
    if (opening && measured === null) return;
    let replaced = false;
    const animation = Animated.timing(progress, {
      toValue: opening ? 1 : 0,
      duration: opening ? openDuration : closeDuration,
      easing: FLUID_EASING,
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start(({finished}) => {
      // A stale completion must never reopen or close the current intent.
      if (!finished || replaced) return;
      setPhase(opening ? 'open' : 'closed');
    });
    return () => {
      replaced = true;
      animation.stop();
    };
  }, [
    closeDuration,
    expanded,
    measured,
    motion,
    openDuration,
    phase,
    progress,
  ]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setMeasured(current =>
      current !== null && Math.abs(current - height) < 0.5 ? current : height,
    );
  }, []);

  if (!motion) {
    return expanded ? <View testID={testID}>{children}</View> : null;
  }
  if (phase === 'closed') return null;
  const closing = !expanded;
  return (
    <Animated.View
      testID={testID}
      pointerEvents={closing ? 'none' : 'auto'}
      accessibilityElementsHidden={closing}
      importantForAccessibility={closing ? 'no-hide-descendants' : 'auto'}
      style={
        phase === 'open'
          ? undefined
          : [
              styles.clip,
              {
                height: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.max(measured ?? 0, 0)],
                }),
                opacity: progress.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0, 0.72, 1],
                }),
              },
            ]
      }>
      <View
        onLayout={onLayout}
        style={phase === 'open' ? undefined : styles.measuring}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {overflow: 'hidden'},
  // Measure intrinsic content, not the animated (initially zero-height) viewport.
  measuring: {position: 'absolute', top: 0, left: 0, right: 0},
});
