import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import Svg from 'react-native-svg';
import {palette} from '../src/theme/palette';
import Surface, {surfaceColor, surfaceEdge} from '../src/components/surface';

let mockDark = false;
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: mockDark})}));

test.each([false, true])(
  'paint is one solid colour, opaque and free of overlays (%s)',
  dark => {
    mockDark = dark;
    let tree;
    const layout = jest.fn();
    act(() => {
      tree = renderer.create(
        <>
          <Surface testID="first" radius={24} level="raised" onLayout={layout}>
            <Text>Real content</Text>
          </Surface>
          <Surface testID="second" tone="primary">
            <Text>Connect</Text>
          </Surface>
        </>,
      );
    });
    const host = tree.root
      .findAllByProps({testID: 'first'})
      .find(node => typeof node.type === 'string');
    const face = StyleSheet.flatten(host.props.style);
    expect(face).toMatchObject({
      borderRadius: 24,
      borderColor: palette(dark).border,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: palette(dark).surfaceRaised,
    });
    // Nothing floats: hierarchy is the tone, the edge and the spacing.
    for (const key of [
      'shadowColor',
      'shadowOpacity',
      'shadowRadius',
      'shadowOffset',
      'elevation',
    ]) {
      expect(face[key]).toBeUndefined();
    }
    expect(host.props.onLayout).toBe(layout);
    const primary = tree.root
      .findAllByProps({testID: 'second'})
      .find(node => typeof node.type === 'string');
    const primaryFace = StyleSheet.flatten(primary.props.style);
    expect(primaryFace.backgroundColor).toBe(palette(dark).primary);
    expect(primaryFace.borderWidth).toBe(0);
    // Gradients belong to the page, never to a face sitting on it.
    expect(tree.root.findAllByType(Svg)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Real content');
    act(() => tree.unmount());
  },
);

test('a raised face is an edge, never a shadow, and ground stays plain', () => {
  expect(surfaceEdge(false, 'ground')).toEqual({});
  expect(surfaceEdge(true, 'ground')).toEqual({});
  for (const dark of [false, true]) {
    expect(surfaceEdge(dark, 'raised')).toEqual({
      borderColor: palette(dark).border,
    });
    expect(palette(dark).border).not.toBe(palette(dark).surfaceBorder);
  }
});

test.each([false, true])(
  'a press deepens the same material towards the page (%s)',
  dark => {
    const luminance = color =>
      [1, 3, 5].reduce(
        (sum, offset) => sum + parseInt(color.slice(offset, offset + 2), 16),
        0,
      );
    for (const tone of ['raised', 'secondary', 'primary', 'footer']) {
      const rest = surfaceColor(dark, {tone});
      const held = surfaceColor(dark, {tone, pressed: true});
      expect(held).not.toBe(rest);
      expect(luminance(held)).toBeLessThan(luminance(rest));
    }
  },
);

test('faces keep a visible step away from the page they sit on', () => {
  for (const dark of [false, true]) {
    const colors = palette(dark);
    const distance = (a, b) =>
      [1, 3, 5].reduce(
        (total, offset) =>
          total +
          Math.abs(
            parseInt(a.slice(offset, offset + 2), 16) -
              parseInt(b.slice(offset, offset + 2), 16),
          ),
        0,
      );
    for (const page of [colors.gradientStart, colors.gradientEnd]) {
      expect(distance(colors.surface, page)).toBeGreaterThanOrEqual(24);
      expect(distance(colors.surfaceRaised, page)).toBeGreaterThanOrEqual(24);
    }
  }
});

test.each([{from: '#fff'}, {accent: ''}, {from: 'red'}])(
  'invalid paint fails explicitly (%j)',
  paint => {
    expect(() => surfaceColor(false, paint)).toThrow('six-digit hex');
  },
);
