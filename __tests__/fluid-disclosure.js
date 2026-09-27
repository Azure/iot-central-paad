import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Animated, StyleSheet, Text, View} from 'react-native';
import FluidDisclosure from '../src/components/fluidDisclosure';
import {useMotionAllowed} from '../src/hooks/motion';

// Only the subscription is mocked; the shared curve stays the real one.
jest.mock('../src/hooks/motion', () => ({
  ...jest.requireActual('../src/hooks/motion'),
  useMotionAllowed: jest.fn(),
}));

let view;
let animations;
let timing;

const Sample = ({expanded, visible}) => (
  <FluidDisclosure expanded={expanded} visible={visible} testID="disclosure">
    <View testID="content">
      <Text>Safe metadata</Text>
    </View>
  </FluidDisclosure>
);

const render = props =>
  act(() => {
    const element = <Sample {...props} />;
    if (view) view.update(element);
    else view = renderer.create(element);
  });
const hosts = id =>
  view.root.findAll(
    node => node.props.testID === id && typeof node.type === 'string',
  );
const has = id => hosts(id).length > 0;
const wrapper = () => {
  const found = view.root.findAllByProps({testID: 'disclosure'});
  return found[found.length - 1];
};
const wrapperStyle = () => StyleSheet.flatten(wrapper().props.style) ?? {};
const measure = height =>
  act(() =>
    view.root
      .findAll(node => typeof node.props.onLayout === 'function')[0]
      .props.onLayout({nativeEvent: {layout: {height, width: 320}}}),
  );
const finish = index => act(() => animations[index].done({finished: true}));
/** Reach the resting open state the way a tap does: closed, expanded, settled. */
const open = (height = 140) => {
  render({expanded: false});
  render({expanded: true});
  measure(height);
  finish(animations.length - 1);
};

beforeEach(() => {
  animations = [];
  useMotionAllowed.mockReturnValue(false);
  timing = jest
    .spyOn(Animated, 'timing')
    .mockImplementation((value, config) => {
      const record = {value, config, stopped: false, done: undefined};
      animations.push(record);
      return {
        start: callback => {
          record.done = callback ?? (() => {});
        },
        stop: () => {
          record.stopped = true;
          record.done?.({finished: false});
        },
        reset: jest.fn(),
      };
    });
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.restoreAllMocks();
});

test('static content is the default: no animation, no measuring copy, nothing retained', () => {
  render({expanded: false});
  expect(has('content')).toBe(false);
  render({expanded: true});
  expect(has('content')).toBe(true);
  expect(hosts('content')).toHaveLength(1);
  expect(wrapperStyle()).toEqual({});
  render({expanded: false});
  expect(has('content')).toBe(false);
  expect(timing).not.toHaveBeenCalled();
});

test('opening measures the real content, then releases the height so nothing stays clipped', () => {
  useMotionAllowed.mockReturnValue(true);
  render({expanded: false});
  render({expanded: true});
  // Nothing animates until the natural height of this content is known.
  expect(animations).toHaveLength(0);
  expect(has('content')).toBe(true);
  expect(wrapperStyle().overflow).toBe('hidden');
  const contentLayout = () =>
    view.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  expect(StyleSheet.flatten(contentLayout().props.style)).toMatchObject({
    position: 'absolute',
    left: 0,
    right: 0,
  });
  measure(140);
  expect(animations).toHaveLength(1);
  expect(animations[0].config).toMatchObject({
    toValue: 1,
    duration: 300,
    useNativeDriver: false,
    isInteraction: false,
  });
  const {easing} = animations[0].config;
  expect([easing(0), easing(1)]).toEqual([0, 1]);
  expect(wrapper().props.accessibilityElementsHidden).toBe(false);
  finish(0);
  const open = wrapperStyle();
  expect(open.height).toBeUndefined();
  expect(open.overflow).toBeUndefined();
  expect(contentLayout().props.style).toBeUndefined();
  expect(has('content')).toBe(true);
});

test('closing keeps the content until it settles but hides it from touch and screen readers at once', () => {
  useMotionAllowed.mockReturnValue(true);
  open();
  render({expanded: false});
  expect(animations).toHaveLength(2);
  expect(animations[1].config).toMatchObject({toValue: 0, duration: 240});
  expect(has('content')).toBe(true);
  expect(wrapper().props.pointerEvents).toBe('none');
  expect(wrapper().props.accessibilityElementsHidden).toBe(true);
  expect(wrapper().props.importantForAccessibility).toBe('no-hide-descendants');
  expect(wrapperStyle().overflow).toBe('hidden');
  finish(1);
  expect(has('content')).toBe(false);
});

test('a rapid reversal cancels the old transition and a stale completion never closes the open row', () => {
  useMotionAllowed.mockReturnValue(true);
  open();
  render({expanded: false});
  expect(animations[1].config.toValue).toBe(0);
  render({expanded: true});
  expect(animations[1].stopped).toBe(true);
  expect(has('content')).toBe(true);
  expect(wrapper().props.pointerEvents).toBe('auto');
  // The cancelled close reports afterwards; the newly opened row must stay.
  act(() => animations[1].done({finished: true}));
  expect(has('content')).toBe(true);
  measure(140);
  const opening = animations[animations.length - 1];
  expect(opening.config.toValue).toBe(1);
  finish(animations.length - 1);
  expect(wrapperStyle().height).toBeUndefined();
  expect(has('content')).toBe(true);
});

test.each([
  ['a hidden layer', {expanded: true, visible: false}, true],
  ['a collapsed row', {expanded: false, visible: false}, false],
])(
  'suppressing motion for %s settles to the intended state',
  (_, props, shown) => {
    useMotionAllowed.mockImplementation(visible => visible !== false);
    open();
    render({expanded: false});
    expect(has('content')).toBe(true);
    render(props);
    expect(animations[1].stopped).toBe(true);
    expect(has('content')).toBe(shown);
    expect(wrapperStyle()).toEqual({});
  },
);

test('unmounting during a transition stops it instead of leaving it running', () => {
  useMotionAllowed.mockReturnValue(true);
  render({expanded: false});
  render({expanded: true});
  measure(140);
  expect(animations[0].stopped).toBe(false);
  act(() => view.unmount());
  view = undefined;
  expect(animations[0].stopped).toBe(true);
});

test('a later opening measures again so a changed width or text size is not clipped', () => {
  useMotionAllowed.mockReturnValue(true);
  open();
  render({expanded: false});
  finish(1);
  expect(has('content')).toBe(false);
  render({expanded: true});
  // The stale measurement is discarded: this opening waits for a new layout.
  expect(animations).toHaveLength(2);
  measure(260);
  expect(animations).toHaveLength(3);
  expect(animations[2].config.toValue).toBe(1);
  finish(2);
  expect(wrapperStyle().height).toBeUndefined();
});

test('content that resizes while open is never re-animated or clipped', () => {
  useMotionAllowed.mockReturnValue(true);
  open();
  measure(300);
  expect(animations).toHaveLength(1);
  expect(wrapperStyle().height).toBeUndefined();
  expect(has('content')).toBe(true);
});

describe('a real timed transition', () => {
  let clock;
  let frames;
  let realFrame;

  const height = () => {
    for (const node of view.root.findAllByProps({testID: 'disclosure'})) {
      const style = node.props.style;
      const animated =
        Array.isArray(style) && style.find(entry => entry && entry.height);
      if (animated) return animated.height.__getValue();
    }
    return undefined;
  };
  const step = (times = 1) =>
    act(() => {
      for (let index = 0; index < times; index++) {
        clock += 16;
        const due = frames;
        frames = [];
        due.forEach(frame => frame(clock));
      }
    });

  beforeEach(() => {
    // The real Animated timing math drives these, one frame at a time.
    timing.mockRestore();
    useMotionAllowed.mockReturnValue(true);
    clock = 100000;
    frames = [];
    realFrame = global.requestAnimationFrame;
    global.requestAnimationFrame = frame => frames.push(frame);
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
  });
  afterEach(() => {
    global.requestAnimationFrame = realFrame;
  });

  test('opens from nothing to the measured height and settles unclipped', () => {
    render({expanded: false});
    render({expanded: true});
    measure(180);
    expect(height()).toBe(0);
    step(6);
    const early = height();
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(180);
    step(6);
    expect(height()).toBeGreaterThan(early);
    step(12);
    expect(wrapperStyle().height).toBeUndefined();
    expect(wrapperStyle().overflow).toBeUndefined();
    expect(has('content')).toBe(true);
  });

  test('closes back to nothing and only then releases the content', () => {
    render({expanded: false});
    render({expanded: true});
    measure(180);
    step(24);
    render({expanded: false});
    step(4);
    const closing = height();
    expect(closing).toBeGreaterThan(0);
    expect(closing).toBeLessThan(180);
    expect(has('content')).toBe(true);
    expect(wrapper().props.accessibilityElementsHidden).toBe(true);
    step(6);
    expect(height()).toBeLessThan(closing);
    step(8);
    expect(has('content')).toBe(false);
  });

  test('a rapid reversal resumes from where it is instead of jumping', () => {
    render({expanded: false});
    render({expanded: true});
    measure(180);
    step(24);
    render({expanded: false});
    step(5);
    const interrupted = height();
    expect(interrupted).toBeLessThan(180);
    render({expanded: true});
    expect(height()).toBe(interrupted);
    step(1);
    expect(height()).toBeGreaterThan(interrupted);
    step(24);
    expect(wrapperStyle().height).toBeUndefined();
    expect(has('content')).toBe(true);
  });

  test('a measurement that arrives late still opens to the real content height', () => {
    render({expanded: false});
    render({expanded: true});
    // Well past the open duration: an unmeasured row waits, it does not settle.
    step(24);
    expect(height()).toBe(0);
    expect(wrapperStyle().overflow).toBe('hidden');
    measure(240);
    step(6);
    expect(height()).toBeGreaterThan(0);
    step(20);
    expect(wrapperStyle().height).toBeUndefined();
    measure(240);
    expect(has('content')).toBe(true);
  });
});
