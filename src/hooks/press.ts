import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing} from 'react-native';
import {FLUID_EASING, useMotionAllowed} from './motion';

export type PressKind = 'card' | 'compact' | 'footer';

export function usePressSettle(
  kind: PressKind = 'compact',
  disabled = false,
  visible = true,
) {
  const motion = useMotionAllowed(visible && !disabled);
  const [pressed, setPressed] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const scale = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [
          1,
          kind === 'card' ? 0.985 : kind === 'footer' ? 1 : 0.97,
        ],
      }),
    [kind, progress],
  );
  const move = useCallback(
    (down: boolean) => {
      animation.current?.stop();
      animation.current = null;
      if (!motion) {
        progress.setValue(0);
        return;
      }
      animation.current = Animated.timing(progress, {
        toValue: down ? 1 : 0,
        duration: down
          ? kind === 'footer'
            ? 120
            : 90
          : kind === 'footer'
          ? 240
          : 220,
        easing: down ? Easing.out(Easing.quad) : FLUID_EASING,
        useNativeDriver: true,
        isInteraction: false,
      });
      animation.current.start();
    },
    [kind, motion, progress],
  );
  useEffect(() => {
    if (!motion) {
      animation.current?.stop();
      animation.current = null;
      progress.setValue(0);
    }
    if (disabled || !visible) setPressed(false);
  }, [disabled, motion, progress, visible]);
  useEffect(
    () => () => {
      animation.current?.stop();
      progress.setValue(0);
    },
    [progress],
  );
  const onPressIn = useCallback(() => {
    if (disabled || !visible) return;
    setPressed(true);
    move(true);
  }, [disabled, move, visible]);
  const onPressOut = useCallback(() => {
    setPressed(false);
    move(false);
  }, [move]);
  return {pressed, progress, scale, onPressIn, onPressOut};
}
