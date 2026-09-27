import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, Animated, AppState, View} from 'react-native';
import {
  FLUID_EASING,
  useDecorativeLoop,
  useGentleTransition,
  useMotionAllowed,
} from '../src/hooks/motion';

let view;
let resolvePreference;
let rejectPreference;
let preferenceChanged;
let applicationChanged;
let removePreference;
let removeApplication;
const originalState = AppState.currentState;

function Probe({visible = true}) {
  const allowed = useMotionAllowed(visible);
  return <View testID="motion" accessibilityState={{busy: allowed}} />;
}

function Transition({visible = true, revision = 0, duration = 360}) {
  useGentleTransition(revision, visible, duration);
  return null;
}

function Loop({active = true}) {
  const phase = useDecorativeLoop(active);
  return <View testID="loop-phase" style={{opacity: phase}} />;
}

beforeEach(() => {
  AppState.currentState = 'active';
  removePreference = jest.fn();
  removeApplication = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        resolvePreference = resolve;
        rejectPreference = reject;
      }),
  );
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((name, callback) => {
      expect(name).toBe('reduceMotionChanged');
      preferenceChanged = callback;
      return {remove: removePreference};
    });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((name, callback) => {
      expect(name).toBe('change');
      applicationChanged = callback;
      return {remove: removeApplication};
    });
});

afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  AppState.currentState = originalState;
  jest.restoreAllMocks();
});

const allowed = () =>
  view.root.findByProps({testID: 'motion'}).props.accessibilityState.busy;

test('motion defaults to still and shares one native preference/background subscription', async () => {
  act(() => {
    view = renderer.create(
      <>
        <Probe />
        <Probe />
      </>,
    );
  });
  expect(
    view.root
      .findAllByType(View)
      .map(node => node.props.accessibilityState.busy),
  ).toEqual([false, false]);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
  expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  await act(async () => resolvePreference(false));
  expect(
    view.root
      .findAllByProps({testID: 'motion'})
      .every(node => node.props.accessibilityState.busy),
  ).toBe(true);
  act(() => view.unmount());
  view = undefined;
  expect(removePreference).toHaveBeenCalledTimes(1);
  expect(removeApplication).toHaveBeenCalledTimes(1);
});

test('Reduce Motion, backgrounding and hidden screens suppress decoration immediately', async () => {
  act(() => {
    view = renderer.create(<Probe />);
  });
  await act(async () => resolvePreference(false));
  expect(allowed()).toBe(true);
  act(() => applicationChanged('background'));
  expect(allowed()).toBe(false);
  act(() => applicationChanged('active'));
  expect(allowed()).toBe(true);
  act(() => preferenceChanged(true));
  expect(allowed()).toBe(false);
  act(() => preferenceChanged(false));
  expect(allowed()).toBe(true);
  act(() => view.update(<Probe visible={false} />));
  expect(allowed()).toBe(false);
});

test('a late preference read cannot override a newer native preference event', async () => {
  act(() => {
    view = renderer.create(<Probe />);
  });
  act(() => preferenceChanged(true));
  await act(async () => resolvePreference(false));
  expect(allowed()).toBe(false);
});

test('late callbacks from an unmounted subscription cannot enable a new subscriber', async () => {
  act(() => {
    view = renderer.create(<Probe />);
  });
  const oldResolve = resolvePreference;
  const oldEvent = preferenceChanged;
  act(() => view.unmount());
  act(() => {
    view = renderer.create(<Probe />);
  });
  await act(async () => {
    oldResolve(false);
    oldEvent(false);
  });
  expect(allowed()).toBe(false);
  await act(async () => resolvePreference(false));
  expect(allowed()).toBe(true);
});

test('an unavailable preference is explicit and leaves content static', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => {
    view = renderer.create(<Probe />);
  });
  await act(async () => rejectPreference(new Error('not available')));
  expect(allowed()).toBe(false);
  expect(warn).toHaveBeenCalledWith(
    'Motion preference unavailable; decorative motion disabled.',
  );
});

test('transitions are finite, non-interaction animations and stop on blur or reduced motion', async () => {
  const stop = jest.fn();
  const start = jest.fn();
  const timing = jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({start, stop, reset: jest.fn()});
  act(() => {
    view = renderer.create(<Transition />);
  });

  expect(timing).not.toHaveBeenCalled();
  await act(async () => resolvePreference(false));
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing.mock.calls[0][1]).toMatchObject({
    toValue: 1,
    duration: 360,
    useNativeDriver: true,
    isInteraction: false,
  });
  act(() => view.update(<Transition />));
  expect(timing).toHaveBeenCalledTimes(1);
  act(() => view.update(<Transition revision={1} />));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledTimes(2);
  act(() => view.update(<Transition revision={1} visible={false} />));
  expect(stop).toHaveBeenCalledTimes(2);
  act(() => view.update(<Transition revision={1} />));
  expect(timing).toHaveBeenCalledTimes(3);
  act(() => preferenceChanged(true));
  expect(stop).toHaveBeenCalledTimes(3);
});

test('channel light loops natively only while allowed and resets on every suppression', async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  });
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({
    start,
    stop,
    reset: jest.fn(),
  });
  act(() => {
    view = renderer.create(<Loop />);
  });
  expect(loop).not.toHaveBeenCalled();
  await act(async () => resolvePreference(false));
  expect(start).toHaveBeenCalledTimes(1);
  expect(timing.mock.calls[0][1]).toMatchObject({
    duration: 3800,
    useNativeDriver: true,
    isInteraction: false,
  });
  expect(timing.mock.calls[0][1].easing(0.8)).toBe(1);
  act(() => view.update(<Loop active={false} />));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(
    view.root
      .findByProps({testID: 'loop-phase'})
      .props.style.opacity.__getValue(),
  ).toBe(0);
  act(() => view.update(<Loop />));
  expect(start).toHaveBeenCalledTimes(2);
  act(() => applicationChanged('background'));
  expect(stop).toHaveBeenCalledTimes(2);
  act(() => applicationChanged('active'));
  expect(start).toHaveBeenCalledTimes(3);
  act(() => preferenceChanged(true));
  expect(stop).toHaveBeenCalledTimes(3);
});

test('tool entry can use a longer finite duration without changing its motion gates', async () => {
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
    start: jest.fn(),
    stop,
    reset: jest.fn(),
  });
  act(() => {
    view = renderer.create(<Transition duration={460} />);
  });
  await act(async () => resolvePreference(false));
  expect(timing.mock.calls[0][1]).toMatchObject({
    duration: 460,
    easing: FLUID_EASING,
    isInteraction: false,
    useNativeDriver: true,
  });
  act(() => view.unmount());
  view = undefined;
  expect(stop).toHaveBeenCalledTimes(1);
});

test('unmounting a moving channel stops its loop and restores the still phase', async () => {
  const stop = jest.fn();
  jest.spyOn(Animated, 'timing').mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  });
  jest.spyOn(Animated, 'loop').mockReturnValue({
    start: jest.fn(),
    stop,
    reset: jest.fn(),
  });
  act(() => {
    view = renderer.create(<Loop />);
  });
  await act(async () => resolvePreference(false));
  const phase = view.root.findByProps({testID: 'loop-phase'}).props.style
    .opacity;
  act(() => phase.setValue(0.6));
  act(() => view.unmount());
  view = undefined;
  expect(stop).toHaveBeenCalledTimes(1);
  expect(phase.__getValue()).toBe(0);
});
