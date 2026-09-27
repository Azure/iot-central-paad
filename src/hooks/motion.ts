import {useEffect, useRef, useSyncExternalStore} from 'react';
import {AccessibilityInfo, Animated, AppState, Easing} from 'react-native';

export const FLUID_EASING = Easing.bezier(0.22, 0.7, 0.2, 1);

const listeners = new Set<() => void>();
let allowed = false;
let generation = 0;
let stop: (() => void) | undefined;
const snapshot = () => allowed;
const serverSnapshot = () => false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const current = ++generation;
    let reduced = true;
    let active = AppState.currentState === 'active';
    let preferenceChanged = false;
    const publish = () => {
      if (current !== generation) return;
      const next = active && !reduced;
      if (allowed === next) return;
      allowed = next;
      listeners.forEach(notify => notify());
    };
    const preference = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      value => {
        preferenceChanged = true;
        reduced = value;
        publish();
      },
    );
    const application = AppState.addEventListener('change', state => {
      active = state === 'active';
      publish();
    });
    // Stay still until the preference is known. A newer native event wins.
    AccessibilityInfo.isReduceMotionEnabled().then(
      value => {
        if (current !== generation || preferenceChanged) return;
        reduced = value;
        publish();
      },
      () => {
        if (current === generation && !preferenceChanged) {
          console.warn(
            'Motion preference unavailable; decorative motion disabled.',
          );
        }
      },
    );
    stop = () => {
      generation++;
      preference.remove();
      application.remove();
      allowed = false;
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop?.();
      stop = undefined;
    }
  };
}

/** Decorative motion shares one preference/background subscription, never a timer. */
export function useMotionAllowed(visible = true): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot) && visible;
}

/** A finite transition; static content is always the default and resting state. */
export function useGentleTransition(
  trigger: string | number | boolean,
  visible = true,
  duration = 360,
) {
  const permitted = useMotionAllowed(visible);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!permitted) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: FLUID_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(1);
    };
  }, [duration, permitted, progress, trigger]);
  return progress;
}

/** A native-driven light sweep with an end pause, never a data/transport timer. */
export function useDecorativeLoop(active: boolean) {
  const permitted = useMotionAllowed(active);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!permitted) {
      progress.setValue(0);
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 3800,
        easing: value => ease(Math.min((value * 3800) / 2600, 1)),
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [permitted, progress]);
  return progress;
}
