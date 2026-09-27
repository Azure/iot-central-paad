import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {ScrollView, StyleSheet} from 'react-native';
import Explore from '../src/experience/Explore';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';

let mockDark = false;
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: mockDark})}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

let view;
afterEach(() => {
  act(() => view?.unmount());
  jest.restoreAllMocks();
});

test.each([false, true])(
  'directory immediately exposes all real tools in dark=%s',
  dark => {
    mockDark = dark;
    const onOpen = jest.fn();
    act(() => {
      view = renderer.create(<Explore onOpen={onOpen} />);
    });
    expect(view.root.findByType(ScrollView).props.testID).toBe(
      'explore-directory',
    );
    expect(
      view.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.testID?.startsWith('explore-tool-'),
      ),
    ).toHaveLength(4);
    for (const [id, route, index] of [
      ['telemetry', 'Telemetry', 0],
      ['properties', 'Properties', 1],
      ['image', 'Image Upload', 2],
      ['bluetooth', 'Bluetooth', 3],
    ]) {
      const tool = view.root.findByProps({testID: `explore-tool-${id}`});
      expect(tool.props.accessibilityRole).toBe('button');
      expect(tool.props.disabled).not.toBe(true);
      const style = StyleSheet.flatten(
        typeof tool.props.style === 'function'
          ? tool.props.style({pressed: false})
          : tool.props.style,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeUndefined();
      // One porcelain field for every tile; the accent is only a whisper.
      const accent = palette(dark).toolAccents[index];
      expect(style.backgroundColor).toBe(
        surfaceColor(dark, {tone: 'raised', accent, pressed: false}),
      );
      // A firmer hairline stands the tile up; nothing floats over the page.
      expect(style.borderColor).toBe(palette(dark).border);
      expect(style.opacity).toBeUndefined();
      expect(style.elevation).toBeUndefined();
      expect(style.shadowOpacity).toBeUndefined();
      expect(style.shadowRadius).toBeUndefined();
      const badge = view.root.findByProps({testID: `explore-plate-${id}`});
      expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
        width: 44,
        height: 44,
        borderRadius: 15,
      });
      // The plate carries the identity as one solid accent, not a gradient.
      expect(StyleSheet.flatten(badge.props.style).backgroundColor).toBe(
        accent,
      );
      expect(badge.props.children).toBeTruthy();
      act(() => tool.props.onPress());
      expect(onOpen).toHaveBeenLastCalledWith(route);
    }
    expect(onOpen).toHaveBeenCalledTimes(4);
    const text = JSON.stringify(view.toJSON());
    expect(text).toContain('Select an image to start uploading it to storage');
    expect(text).toContain('Bluetooth advertisements with supported decoders');
    expect(text).toContain('Open any tool to inspect its state');
    expect(text).not.toContain('Commands');
  },
);

test.each([false, true])(
  'answers a press with a surface step, never by dimming its own text (dark=%s)',
  dark => {
    mockDark = dark;
    const accent = palette(dark).toolAccents[0];
    const paint = pressed => ({tone: 'raised', accent, pressed});
    act(() => {
      view = renderer.create(<Explore onOpen={jest.fn()} />);
    });
    const field = () =>
      StyleSheet.flatten(
        view.root.findByProps({testID: 'explore-tool-telemetry'}).props.style,
      );
    expect(field().backgroundColor).toBe(surfaceColor(dark, paint(false)));
    expect(field().opacity).toBeUndefined();
    act(() =>
      view.root
        .findByProps({testID: 'explore-tool-telemetry'})
        .props.onPressIn(),
    );
    // Feedback survives even when the OS withholds decorative motion.
    expect(field().backgroundColor).toBe(surfaceColor(dark, paint(true)));
    expect(field().opacity).toBeUndefined();
    act(() =>
      view.root
        .findByProps({testID: 'explore-tool-telemetry'})
        .props.onPressOut(),
    );
    expect(field().backgroundColor).toBe(surfaceColor(dark, paint(false)));
    expect(
      view.root.findByProps({testID: 'explore-tool-telemetry'}).props.hitSlop,
    ).toBe(2);
  },
);

test.each([
  [390, 1, false],
  [320, 1, true],
])(
  'fills the row with equal faces and never clips large copy at %s / %s',
  (width, fontScale, stacked) => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({width, fontScale, height: 844, scale: 2});
    act(() => {
      view = renderer.create(<Explore onOpen={jest.fn()} />);
    });
    const faces = view.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID?.startsWith('explore-tool-'),
    );
    expect(faces).toHaveLength(4);
    for (const face of faces) {
      const style = StyleSheet.flatten(
        typeof face.props.style === 'function'
          ? face.props.style({pressed: false})
          : face.props.style,
      );
      // Copy of any length sets the row height; the face grows into it.
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(style.flexGrow).toBe(stacked ? 0 : 1);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      for (const label of face.findAllByType('Text')) {
        expect(label.props.numberOfLines).toBeUndefined();
        expect(label.props.allowFontScaling).not.toBe(false);
      }
    }
    // The frame carrying the press scale claims the row height the face fills.
    const frames = view.root
      .findAllByType(require('react-native').Animated.View)
      .map(node => StyleSheet.flatten(node.props.style))
      .filter(style => style?.flexBasis !== undefined);
    expect(frames).toHaveLength(4);
    for (const frame of frames) {
      expect(frame.height).toBeUndefined();
      expect(frame.flexGrow).toBe(1);
      expect(frame.flexBasis).toBe(stacked ? 'auto' : '47%');
    }
  },
);

test.each([
  [390, 1, 'row'],
  [320, 1, 'column'],
  [390, 1.5, 'column'],
])(
  'tools keep a readable grid/fallback at %s / %s',
  (width, fontScale, direction) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({
        width,
        fontScale,
        height: 844,
        scale: 2,
      });
    act(() => {
      view = renderer.create(<Explore onOpen={jest.fn()} />);
    });
    const grid = view.root.findByProps({testID: 'explore-tools-grid'});
    expect(dimensions).toHaveBeenCalled();
    expect(StyleSheet.flatten(grid.props.style).flexDirection).toBe(direction);
  },
);
