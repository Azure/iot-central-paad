import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Animated} from 'react-native';
import {usePressSettle} from '../src/hooks/press';
import {useMotionAllowed} from '../src/hooks/motion';

jest.mock('../src/hooks/motion', () => ({
  ...jest.requireActual('../src/hooks/motion'),
  useMotionAllowed: jest.fn(),
}));

let tree;
let state;
let animations;

function Probe({kind, disabled, visible}) {
  state = usePressSettle(kind, disabled, visible);
  return null;
}
function render(props = {}) {
  act(() => {
    if (tree) tree.update(<Probe {...props} />);
    else tree = renderer.create(<Probe {...props} />);
  });
}
beforeEach(() => {
  animations = [];
  useMotionAllowed.mockImplementation(visible => visible);
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const record = {
      value,
      config,
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    };
    animations.push(record);
    return record;
  });
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

test.each([
  ['compact', 0.97, 90, 220],
  ['card', 0.985, 90, 220],
  ['footer', 1, 120, 240],
])(
  '%s pressure settles locally without changing layout',
  (kind, scale, press, release) => {
    render({kind});
    act(() => state.onPressIn());
    expect(state.pressed).toBe(true);
    expect(animations[0].config).toMatchObject({
      toValue: 1,
      duration: press,
      useNativeDriver: true,
      isInteraction: false,
    });
    act(() => animations[0].value.setValue(1));
    expect(state.scale.__getValue()).toBe(scale);
    act(() => state.onPressOut());
    expect(state.pressed).toBe(false);
    expect(animations[0].stop).toHaveBeenCalledTimes(1);
    expect(animations[1].config).toMatchObject({toValue: 0, duration: release});
  },
);

test('Reduce Motion keeps tonal feedback but never scales content', () => {
  useMotionAllowed.mockReturnValue(false);
  render();
  act(() => state.onPressIn());
  expect(state.pressed).toBe(true);
  expect(state.scale.__getValue()).toBe(1);
  expect(animations).toHaveLength(0);
  act(() => state.onPressOut());
  expect(state.pressed).toBe(false);
});

test.each([{disabled: true}, {visible: false}])(
  'inactive controls cannot begin feedback (%j)',
  props => {
    render(props);
    act(() => state.onPressIn());
    expect(state.pressed).toBe(false);
    expect(animations).toHaveLength(0);
  },
);

test('suppression and unmount cancel the owned animation and leave a stable face', () => {
  render();
  act(() => state.onPressIn());
  render({disabled: true});
  expect(animations[0].stop).toHaveBeenCalledTimes(1);
  expect(state.pressed).toBe(false);
  expect(state.progress.__getValue()).toBe(0);
  render();
  act(() => state.onPressIn());
  act(() => tree.unmount());
  tree = undefined;
  expect(animations[1].stop).toHaveBeenCalledTimes(1);
});
