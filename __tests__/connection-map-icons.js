import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import ConnectionMapIcon from '../src/experience/ConnectionMapIcon';

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  G: 'G',
  Path: 'Path',
  Polygon: 'Polygon',
  Rect: 'Rect',
}));

let tree;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
});

test.each(['adr', 'dps', 'hub', 'android', 'iphone'])(
  '%s has a static pedestal-free 64-unit silhouette in both themes',
  node => {
    let geometry;
    for (const dark of [false, true]) {
      act(() => {
        tree?.unmount();
        tree = renderer.create(<ConnectionMapIcon node={node} dark={dark} />);
      });
      const root = tree.root.findAllByProps({testID: `home-icon-${node}`})[0];
      expect(root.props).toMatchObject({
        pointerEvents: 'none',
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
      expect(StyleSheet.flatten(root.props.style)).toEqual({
        width: 64,
        height: 64,
        flexShrink: 0,
        direction: 'ltr',
      });
      const svg = tree.root.findByType('Svg');
      expect(svg.props).toMatchObject({
        width: 64,
        height: 64,
        viewBox: '0 0 64 64',
      });
      const shapes = svg.findAll(n =>
        ['Path', 'Polygon', 'Rect', 'Circle'].includes(n.type),
      );
      const coordinates = shapes.map(({type, props}) => ({
        type,
        d: props.d,
        points: props.points,
        x: props.x,
        y: props.y,
        width: props.width,
        height: props.height,
        cx: props.cx,
        cy: props.cy,
        r: props.r,
      }));
      if (geometry) expect(coordinates).toEqual(geometry);
      geometry = coordinates;
      // Every rectangular face belongs to the object, never a tray beneath it.
      for (const rect of svg.findAllByType('Rect'))
        expect(rect.props.y + rect.props.height).toBeLessThanOrEqual(58);
      expect(JSON.stringify(tree.toJSON())).not.toMatch(
        /LinearGradient|filter|shadow|Animated|MaskedView/,
      );
    }
  },
);

test.each([
  ['adr', 15, 20, 26],
  ['dps', 14, 26, 26],
  ['hub', 13, 29.5, 25],
])(
  '%s keeps its official mark in an isolated, untinted SVG root',
  (node, left, top, size) => {
    act(() => {
      tree = renderer.create(<ConnectionMapIcon node={node} dark />);
    });
    const mark = tree.root.findByType('SvgAsset');
    expect(StyleSheet.flatten(mark.props.style)).toEqual({
      position: 'absolute',
      left,
      top,
    });
    expect(mark.props).toMatchObject({
      width: size,
      height: size,
      preserveAspectRatio: 'xMidYMid meet',
      accessible: false,
    });
    expect(mark.props.fill).toBeUndefined();
    expect(mark.props.opacity).toBeUndefined();
    expect(mark.props.transform).toBeUndefined();
    expect(mark.parent.type).not.toBe('Svg');
  },
);

test('Android and iPhone keep different Material silhouettes and no external marks', () => {
  const outlines = [];
  for (const node of ['android', 'iphone']) {
    act(() => {
      tree?.unmount();
      tree = renderer.create(<ConnectionMapIcon node={node} dark={false} />);
    });
    const outline = tree.root
      .findAllByType('Path')
      .find(p => p.props.transform === 'translate(8 14.8) scale(1.8333)');
    expect(outline.props.fill).toBe('#285A48');
    outlines.push(outline.props.d);
    expect(tree.root.findAllByType('SvgAsset')).toHaveLength(0);
  }
  expect(outlines[0]).not.toBe(outlines[1]);
});

test.each([
  [
    'adr.svg',
    '8c058b3f6bd97178d0354ab130e23e4861ea5c32a5777b66bb31fa255ca1425b',
  ],
  [
    'dps.svg',
    '830289414574d42a0ef2ac87f95d5d4a2fbb3eff40686bc4b30d79b37e0bcbc8',
  ],
  [
    'iot-hub.svg',
    '919f07454d5648351455a60965a443c83b51e1f725ab70478d5f579349a29649',
  ],
])('%s is byte-for-byte the publicly sourced artwork', (file, digest) => {
  const svg = readFileSync(
    join(__dirname, '../src/assets/connection-map', file),
  );
  expect(createHash('sha256').update(svg).digest('hex')).toBe(digest);
});
