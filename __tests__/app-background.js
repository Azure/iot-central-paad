import fs from 'fs';
import path from 'path';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';
import Svg, {LinearGradient, Stop} from 'react-native-svg';
import AppBackground from '../src/components/appBackground';
import {palette} from '../src/theme/palette';

let mockDark = false;
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: mockDark})}));

it.each([false, true])(
  'uses a decorative, non-interactive ground gradient (%s)',
  dark => {
    mockDark = dark;
    let tree;
    act(() => {
      tree = renderer.create(
        <>
          <AppBackground>
            <Text>Real content</Text>
          </AppBackground>
          <AppBackground>
            <Text>Another screen</Text>
          </AppBackground>
        </>,
      );
    });
    const gradients = tree.root.findAllByType(LinearGradient);
    const ids = [...new Set(gradients.map(node => node.props.id))];
    expect(ids).toHaveLength(2);
    const drawings = tree.root.findAllByType(Svg);
    expect(drawings).toHaveLength(2);
    drawings.forEach(drawing => {
      expect(drawing.props).toMatchObject({
        pointerEvents: 'none',
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
    });
    expect(
      tree.root.findAllByProps({stopColor: palette(dark).gradientStart}).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({stopColor: palette(dark).gradientEnd}).length,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Real content');
    act(() => tree.unmount());
  },
);

it.each([false, true])(
  'paints two page stops that are a visible fall apart (dark=%s)',
  dark => {
    mockDark = dark;
    let tree;
    act(() => {
      tree = renderer.create(
        <AppBackground>
          <Text>Real content</Text>
        </AppBackground>,
      );
    });
    // Read what is actually painted, not the tokens it was meant to use.
    const stops = tree.root
      .findAllByType(Stop)
      .map(node => [String(node.props.offset), node.props.stopColor]);
    expect(stops.map(([offset]) => offset)).toEqual(['0', '1']);
    const [top, bottom] = stops.map(([, color]) => color);
    expect(top).not.toBe(bottom);
    const channels = hex =>
      [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    const luminance = hex =>
      channels(hex)
        .map(value => value / 255)
        .map(value =>
          value <= 0.03928
            ? value / 12.92
            : Math.pow((value + 0.055) / 1.055, 2.4),
        )
        .reduce(
          (total, value, index) =>
            total + [0.2126, 0.7152, 0.0722][index] * value,
          0,
        );
    const step = (first, second) =>
      channels(first).reduce(
        (total, value, index) =>
          total + Math.abs(value - channels(second)[index]),
        0,
      );
    // A fall, not a flat wash: the lower stop is the deeper one, by an amount
    // a person can actually see on the page.
    expect(luminance(bottom)).toBeLessThan(luminance(top));
    expect(
      (luminance(top) + 0.05) / (luminance(bottom) + 0.05),
    ).toBeGreaterThanOrEqual(dark ? 1.05 : 1.2);
    expect(step(top, bottom)).toBeGreaterThanOrEqual(dark ? 24 : 60);
    if (!dark)
      for (const painted of [top, bottom]) {
        const [red, green, blue] = channels(painted);
        expect(green).toBeGreaterThan(red);
        expect(green).toBeGreaterThan(blue);
      }
    act(() => tree.unmount());
  },
);

it('keeps the gradient on the page and leaves every face a solid colour', () => {
  const root = path.join(__dirname, '..', 'src');
  const sources = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) sources.push(full);
    }
  };
  walk(root);
  const painted = sources.filter(file =>
    /\bLinearGradient\b/.test(fs.readFileSync(file, 'utf8')),
  );
  // Only the page ground and the map's travelling light are gradients;
  // controls, cards, panels and messages are one flat colour apiece, so their
  // outlines and edges stay readable.
  expect(painted.map(file => path.relative(root, file)).sort()).toEqual(
    [
      path.join('components', 'appBackground.tsx'),
      path.join('experience', 'ChannelFlow.tsx'),
    ].sort(),
  );
});

it('keeps the page a clear step away from the faces that sit on it', () => {
  for (const dark of [false, true]) {
    const colors = palette(dark);
    const step = (first, second) =>
      [1, 3, 5].reduce(
        (total, offset) =>
          total +
          Math.abs(
            parseInt(first.slice(offset, offset + 2), 16) -
              parseInt(second.slice(offset, offset + 2), 16),
          ),
        0,
      );
    for (const page of [colors.gradientStart, colors.gradientEnd])
      for (const face of [colors.surface, colors.surfaceRaised])
        expect(step(page, face)).toBeGreaterThanOrEqual(24);
    // The ground is a fall you can actually see - a pale top settling into a
    // deeper tone - while staying one material rather than two. Daylight
    // carries the visible fall; the night page stays quieter to avoid banding.
    const fall = step(colors.gradientStart, colors.gradientEnd);
    expect(fall).toBeGreaterThanOrEqual(dark ? 24 : 60);
    expect(fall).toBeLessThan(150);
  }
});

it('keeps the light page green rather than warm or grey', () => {
  const colors = palette(false);
  expect(colors.background).toBe(colors.gradientStart);
  const channel = (hex, offset) => parseInt(hex.slice(offset, offset + 2), 16);
  const chroma = hex =>
    Math.max(...[1, 3, 5].map(offset => channel(hex, offset))) -
    Math.min(...[1, 3, 5].map(offset => channel(hex, offset)));
  for (const page of [
    colors.background,
    colors.gradientStart,
    colors.gradientEnd,
  ]) {
    const [red, green, blue] = [1, 3, 5].map(offset => channel(page, offset));
    expect(green).toBeGreaterThan(red);
    expect(green).toBeGreaterThan(blue);
  }
  // The lower page carries the colour; the top is the pale end of the same
  // green, not a second hue.
  expect(chroma(colors.gradientEnd)).toBeGreaterThan(
    chroma(colors.gradientStart) + 8,
  );
});
