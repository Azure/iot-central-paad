import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Button from '../src/components/button';
import {surfaceColor} from '../src/components/surface';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));

const originalOS = Platform.OS;
let view;
const body = () => view.root.findByProps({testID: 'RNE_BUTTON_PRESSABLE'});
const touch = () =>
  view.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.testID === 'RNE_BUTTON_PRESSABLE',
  )[0];
// A button paints its own body; no rounded layer is laid over its outline.
const paint = () =>
  view.root.findAll(
    node => typeof node.type !== 'string' && node.props.radius !== undefined,
  );
const bodyStyle = () => {
  const wrapper = view.root.findByProps({testID: 'RNE_BUTTON_WRAPPER'});
  const painted = wrapper.findAll(
    node => typeof node.type === 'string' && node.props.style?.padding,
  );
  return StyleSheet.flatten(painted[0].props.style);
};
const render = props =>
  act(() => {
    const element = <Button title="Send" onPress={() => {}} {...props} />;
    if (view) view.update(element);
    else view = renderer.create(element);
  });

afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  Platform.OS = originalOS;
});

test.each(['ios', 'android'])(
  'gives an unqualified button the same solid hierarchy on %s',
  os => {
    Platform.OS = os;
    useTheme.mockReturnValue({dark: false});
    render();
    expect(bodyStyle()).toMatchObject({
      minHeight: 52,
      borderRadius: 14,
      paddingHorizontal: 16,
      borderWidth: 0,
      backgroundColor: surfaceColor(false, {tone: 'primary'}),
    });
    expect(paint()).toEqual([]);
    expect(
      StyleSheet.flatten(
        view.root.findByProps({testID: 'RNE_BUTTON_WRAPPER'}).props.style,
      ).borderRadius,
    ).toBe(14);
  },
);

test.each([false, true])(
  'keeps the quiet and outline callers they asked for (dark %s)',
  dark => {
    useTheme.mockReturnValue({dark});
    const colors = palette(dark);
    render({type: 'outline'});
    expect(bodyStyle()).toMatchObject({
      minHeight: 48,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.controlBorder,
      backgroundColor: surfaceColor(dark, {tone: 'secondary'}),
    });
    expect(paint()).toEqual([]);
    render({type: 'clear'});
    expect(bodyStyle()).toMatchObject({
      minHeight: 48,
      borderWidth: 0,
      backgroundColor: 'transparent',
    });
    expect(paint()).toEqual([]);
  },
);

test('answers a press with a deeper surface instead of fading the label', () => {
  useTheme.mockReturnValue({dark: false});
  const onPressIn = jest.fn();
  const onPressOut = jest.fn();
  render({onPressIn, onPressOut});
  const resting = bodyStyle().backgroundColor;
  // The library's own 0.3 press fade never reaches the touchable.
  const opacity = () => StyleSheet.flatten(touch().props.style).opacity ?? 1;
  expect(opacity()).toBeGreaterThanOrEqual(0.9);
  act(() => body().props.onPressIn({}));
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(bodyStyle().backgroundColor).not.toBe(resting);
  expect(bodyStyle().backgroundColor).toBe(
    surfaceColor(false, {tone: 'primary', pressed: true}),
  );
  expect(opacity()).toBeGreaterThanOrEqual(0.9);
  act(() => body().props.onPressOut({}));
  expect(onPressOut).toHaveBeenCalledTimes(1);
  expect(bodyStyle().backgroundColor).toBe(resting);
});

test('a held or disabled button stops being painted and stops responding', () => {
  useTheme.mockReturnValue({dark: false});
  const colors = palette(false);
  const onPress = jest.fn();
  render({disabled: true, onPress});
  expect(paint()).toEqual([]);
  expect(bodyStyle()).toMatchObject({
    backgroundColor: colors.inset,
    borderColor: colors.controlBorder,
  });
  expect(body().props.accessibilityState).toMatchObject({disabled: true});
  act(() => body().props.onPress({}));
  expect(onPress).not.toHaveBeenCalled();
  act(() => body().props.onPressIn({}));
  expect(bodyStyle().backgroundColor).toBe(colors.inset);
  render({loading: true, onPress});
  expect(paint()).toEqual([]);
  expect(body().props.accessibilityState).toMatchObject({busy: true});
  act(() => body().props.onPress({}));
  expect(onPress).not.toHaveBeenCalled();
});

test('caller body transforms are not replaced by the decorative press scale', () => {
  useTheme.mockReturnValue({dark: false});
  const transform = [{translateX: 12}, {rotate: '3deg'}];
  render({buttonStyle: {transform}});
  expect(bodyStyle().transform).toEqual(transform);
  expect(paint()).toEqual([]);
  act(() => body().props.onPressIn({}));
  expect(bodyStyle().transform).toEqual(transform);
});

test("a caller's own style callback still sees the real pressed state", () => {
  useTheme.mockReturnValue({dark: false});
  const callerStyle = jest.fn(({pressed}) => ({opacity: pressed ? 0.95 : 1}));
  render({style: callerStyle});
  const pressable = view.root.findByProps({testID: 'RNE_BUTTON_PRESSABLE'});
  expect(pressable.props.style).toBe(callerStyle);
  expect(pressable.props.style({pressed: true})).toEqual({opacity: 0.95});
  // Without a caller style the library's 0.3 fade callback is replaced
  // outright, not evaluated at a fixed state.
  render({style: undefined});
  const plain = view.root.findByProps({testID: 'RNE_BUTTON_PRESSABLE'}).props
    .style;
  expect(typeof plain).not.toBe('function');
  expect(StyleSheet.flatten(plain)).toEqual({opacity: 1});
});

test('public body and touchable slots stay the callers own', () => {
  useTheme.mockReturnValue({dark: false});
  class CallerBody extends React.Component {
    render() {
      return <View {...this.props} testID="caller-body" />;
    }
  }
  class CallerTouch extends React.Component {
    render() {
      return <Pressable {...this.props} />;
    }
  }
  render({
    ViewComponent: CallerBody,
    TouchableComponent: CallerTouch,
    title: 'Send',
  });
  expect(view.root.findAllByType(CallerBody)).toHaveLength(1);
  expect(view.root.findAllByType(CallerTouch)).toHaveLength(1);
  // A caller that owns the body owns its paint too.
  expect(paint()).toEqual([]);
  expect(view.root.findByProps({testID: 'caller-body'})).toBeTruthy();
  expect(
    view.root
      .findAllByType('Text')
      .some(node => node.props.children === 'Send'),
  ).toBe(true);
});

test('an explicit colour or background is never masked by the shared paint', () => {
  useTheme.mockReturnValue({dark: false});
  render({color: '#123456'});
  expect(bodyStyle().backgroundColor).toBe('#123456');
  expect(paint()).toEqual([]);
  render({color: undefined, buttonStyle: {backgroundColor: '#ABCDEF'}});
  expect(bodyStyle().backgroundColor).toBe('#ABCDEF');
  expect(paint()).toEqual([]);
  act(() => body().props.onPressIn({}));
  expect(bodyStyle().backgroundColor).toBe('#ABCDEF');
});

test('the loading spinner is readable on the held background', () => {
  useTheme.mockReturnValue({dark: false});
  const colors = palette(false);
  render({loading: true});
  const spinner = () => view.root.findByType(ActivityIndicator);
  expect(bodyStyle().backgroundColor).toBe(colors.inset);
  expect(spinner().props.color).toBe(colors.muted);
  render({loading: true, loadingProps: {color: colors.primary, size: 'large'}});
  expect(spinner().props.color).toBe(colors.primary);
  expect(spinner().props.size).toBe('large');
});

test('the solid body carries the icon and the label without a cover', () => {
  useTheme.mockReturnValue({dark: false});
  render({icon: {name: 'send', type: 'material'}, title: 'Send'});
  const painted = view.root
    .findByProps({testID: 'RNE_BUTTON_WRAPPER'})
    .findAll(
      node => typeof node.type === 'string' && node.props.style?.padding,
    )[0];
  expect(StyleSheet.flatten(painted.props.style).backgroundColor).toBe(
    surfaceColor(false, {tone: 'primary'}),
  );
  // Nothing is painted over the body, so its own outline stays a single edge.
  expect(paint()).toEqual([]);
  expect(
    painted.findAllByType('Text').some(node => node.props.children === 'Send'),
  ).toBe(true);
  expect(painted.findAllByProps({name: 'send'}).length).toBeGreaterThan(0);
});
