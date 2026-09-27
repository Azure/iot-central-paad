import React from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Native from 'react-native';
import CardView from '../src/CardView';
import {Headline, Detail, Name, Text} from '../src/components/typography';
import {cardTint, palette} from '../src/theme/palette';
import {Loader} from '../src/components/loader';
import {surfaceColor} from '../src/components/surface';

jest.mock('../src/hooks', () => ({
  useTheme: () => ({
    dark: false,
    colors: {text: '#17252A', card: '#FFFFFF', background: '#F5F4F0'},
  }),
  useScreenDimensions: () => ({
    screen: {width: 390, height: 844, scale: 2, fontScale: 1},
  }),
}));
jest.mock('../src/components/card', () => ({Card: 'Card'}));
jest.mock('../src/components/bottomPopup', () => 'BottomPopup');
jest.mock('@rneui/themed', () => {
  const React = require('react');
  const ListItem = props =>
    React.createElement('ListItem', props, props.children);
  ListItem.Content = 'ListItemContent';
  ListItem.Title = 'ListItemTitle';
  return {Text: 'NativeText', ListItem, Button: 'Button', Overlay: 'Overlay'};
});

let view;
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.restoreAllMocks();
});

test.each([Headline, Detail, Name, Text])(
  'typography keeps native scaling and forwards accessibility/value IDs (%#)',
  Component => {
    act(() => {
      view = renderer.create(
        <Component testID="value-only" accessibilityRole="header" selectable>
          exact-value
        </Component>,
      );
    });
    const node = view.root.findByType('NativeText');
    expect(node.props).toMatchObject({
      testID: 'value-only',
      accessibilityRole: 'header',
      selectable: true,
      children: 'exact-value',
    });
    expect(node.props.allowFontScaling).not.toBe(false);
    expect(node.props.maxFontSizeMultiplier).toBeUndefined();
  },
);

const item = id => ({
  id,
  name: id,
  value: 12.5,
  dataType: 'number',
  enabled: true,
  simulated: false,
});

test.each([
  [390, 1, 1],
  [800, 1, 2],
  [800, 2, 1],
])(
  'readings use a readable responsive layout at width %s / font scale %s',
  (width, fontScale, columns) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({
        width,
        fontScale,
        height: 900,
        scale: 2,
      });
    const items = Array.from({length: 6}, (_, index) =>
      item(`sensor-${index}`),
    );
    act(() => {
      view = renderer.create(
        <CardView items={items} componentName="Telemetry" />,
      );
    });
    const list = view.root.findByType(Native.FlatList);
    expect(dimensions).toHaveBeenCalled();
    expect(list.props.numColumns).toBe(columns);
    expect(
      list.props.renderItem({item: items[0], index: 0}).props.accentKey,
    ).toBe(items[0].id);
    const instance = list.instance;
    act(() => {
      view.update(
        <CardView
          items={[...items, item('extra')]}
          componentName="Telemetry"
        />,
      );
    });
    expect(view.root.findByType(Native.FlatList).instance).toBe(instance);
  },
);

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function lightness(hex) {
  const value = luminance(hex);
  return value > 0.008856 ? 116 * Math.cbrt(value) - 16 : 903.3 * value;
}

test.each([false, true])('solid surfaces stay readable in dark=%s', dark => {
  const colors = palette(dark);
  const contrast = (foreground, background) =>
    (Math.max(luminance(foreground), luminance(background)) + 0.05) /
    (Math.min(luminance(foreground), luminance(background)) + 0.05);
  for (const pressed of [false, true]) {
    for (const tone of [
      'raised',
      'secondary',
      'primary',
      'footer',
      'danger',
      'inset',
    ]) {
      const background = surfaceColor(dark, {tone, pressed});
      const foreground =
        tone === 'primary'
          ? colors.onPrimary
          : tone === 'danger'
          ? colors.danger
          : colors.primary;
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const accent of colors.toolAccents) {
      const background = surfaceColor(dark, {tone: 'raised', accent, pressed});
      for (const foreground of [colors.text, colors.muted]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(colors.toolOnAccent, accent)).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(
    Math.abs(lightness(colors.channelGlow) - lightness(colors.channel)),
  ).toBeGreaterThanOrEqual(25);
});

test.each([false, true])(
  'pastel surfaces retain readable text and controls in dark=%s',
  dark => {
    const colors = palette(dark);
    const pairs = [
      ...[
        colors.surface,
        colors.background,
        colors.inset,
        colors.gradientStart,
        colors.gradientEnd,
        ...colors.tints,
        ...colors.toolSurfaces,
      ].flatMap(background => [
        [colors.text, background],
        [colors.muted, background],
      ]),
      [colors.onPrimary, colors.primary],
      [colors.positive, colors.positiveSurface],
      [colors.danger, colors.dangerSurface],
      ...colors.toolAccents.map(background => [
        colors.toolOnAccent,
        background,
      ]),
    ];
    for (const [foreground, background] of pairs) {
      const a = luminance(foreground);
      const b = luminance(background);
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of [colors.surface, colors.inset]) {
      const a = luminance(colors.controlBorder);
      const b = luminance(background);
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      ).toBeGreaterThanOrEqual(3);
    }
    expect(cardTint('accelerometer', dark)).toBe(
      cardTint('accelerometer', dark),
    );
    expect(colors.tints).toContain(cardTint('accelerometer', dark));
  },
);

test('a page recolour never moves a tool identity colour', () => {
  // Each tool's surface, accent and card tint is its identity. Page work is
  // free to change the ground under them; it may not repaint them.
  expect(palette(false).tints).toEqual([
    '#E5EDE3',
    '#ECE6F2',
    '#F4E7DB',
    '#E7EDEB',
  ]);
  expect(palette(false).toolSurfaces).toEqual([
    '#DCEFE7',
    '#E5E1F6',
    '#FAE3D3',
    '#DBE8F7',
  ]);
  expect(palette(false).toolAccents).toEqual([
    '#1F6B57',
    '#4A5A86',
    '#8A5A32',
    '#2A6E86',
  ]);
  expect(palette(true).tints).toEqual([
    '#253C35',
    '#343347',
    '#433831',
    '#3D3C2F',
  ]);
  expect(palette(true).toolSurfaces).toEqual([
    '#1D3A33',
    '#2B2947',
    '#3C2A1E',
    '#1C3047',
  ]);
  expect(palette(true).toolAccents).toEqual([
    '#6FC7AC',
    '#9AA8DC',
    '#D79E70',
    '#7FBCD0',
  ]);
  for (const dark of [false, true])
    expect(new Set(palette(dark).toolSurfaces).size).toBe(4);
});

test('the blocking busy state stays in-tree so it cannot compete with a native sheet presentation', () => {
  const cancel = jest.fn();
  act(() => {
    view = renderer.create(
      <Loader
        visible
        modal
        nativeModal={false}
        message="Connecting to the assigned IoT Hub..."
        buttons={[{text: 'Cancel', onPress: cancel}]}
      />,
    );
  });
  // A native busy modal could compete with Details during iOS dismissal.
  expect(view.root.findAllByType(Native.Modal)).toHaveLength(0);
  const overlay = view.root.findAllByProps({testID: 'app-busy-overlay'})[0];
  expect(overlay.props.accessibilityViewIsModal).toBe(true);
  expect(overlay.props.accessibilityLiveRegion).toBe('polite');
  expect(Native.StyleSheet.flatten(overlay.props.style)).toMatchObject({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });
  expect(JSON.stringify(view.toJSON())).toContain(
    'Connecting to the assigned IoT Hub...',
  );
  const cancelControl = () => view.root.findByType('Button');
  expect(cancelControl().props.type).toBe('clear');
  expect(
    Native.StyleSheet.flatten(cancelControl().props.buttonStyle),
  ).toMatchObject({
    minHeight: 48,
    backgroundColor: 'transparent',
    borderWidth: 0,
  });
  act(() => cancelControl().props.onPressIn({}));
  expect(
    Native.StyleSheet.flatten(cancelControl().props.buttonStyle)
      .backgroundColor,
  ).toBe(palette(false).inset);
  act(() => cancelControl().props.onPressOut({}));
  cancelControl().props.onPress();
  expect(cancel).toHaveBeenCalledTimes(1);
});

test('screen-local modal loaders retain native blocking, including the navigation header', () => {
  act(() => {
    view = renderer.create(<Loader visible modal message="Loading..." />);
  });
  expect(view.root.findByType('Overlay').props.isVisible).toBe(true);
  expect(view.root.findAllByProps({testID: 'app-busy-overlay'})).toHaveLength(
    0,
  );
  // Blocking comes from the modal, never from a floating sheet.
  const sheet = Native.StyleSheet.flatten(
    view.root.findByType('Overlay').props.overlayStyle,
  );
  expect(sheet).toMatchObject({elevation: 0, shadowOpacity: 0});
});

test('in-tree Android busy overlays swallow back only while visible and release the listener', () => {
  jest.replaceProperty(Native.Platform, 'OS', 'android');
  const remove = jest.fn();
  const listen = jest
    .spyOn(Native.BackHandler, 'addEventListener')
    .mockReturnValue({remove});
  act(() => {
    view = renderer.create(
      <Loader visible modal nativeModal={false} message="Loading..." />,
    );
  });
  expect(listen.mock.calls[0][0]).toBe('hardwareBackPress');
  expect(listen.mock.calls[0][1]()).toBe(true);
  act(() => {
    view.update(
      <Loader visible={false} modal nativeModal={false} message="Loading..." />,
    );
  });
  expect(remove).toHaveBeenCalledTimes(1);
});
