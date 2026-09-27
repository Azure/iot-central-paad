import React from 'react';
import renderer, {act} from 'react-test-renderer';
import Constants from 'expo-constants';
import FontCredits, {ConnectionMapCredits} from '../src/components/fontCredits';
import Strings from '../src/strings';
import {StyleSheet} from 'react-native';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: () => ({dark: false})}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {extra: {}}},
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

let tree;
afterEach(() => act(() => tree?.unmount()));

it('exposes the complete distributed license in an optional selectable disclosure', () => {
  const license = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'LICENSE.fraunces'),
    'utf8',
  );
  Constants.expoConfig.extra.headerFontLicense = license;
  act(() => {
    tree = renderer.create(<FontCredits />);
  });
  expect(tree.root.findAllByProps({testID: 'font-license'})).toHaveLength(0);
  const toggle = tree.root.findByProps({testID: 'font-credits-toggle'});
  expect(
    StyleSheet.flatten(toggle.props.style).minHeight,
  ).toBeGreaterThanOrEqual(48);
  act(() => toggle.props.onPress());
  const text = tree.root.findByProps({testID: 'font-license'});
  expect(text.props.children).toBe(license);
  expect(text.props.selectable).toBe(true);
  expect(toggle.props.accessibilityState.expanded).toBe(true);
  act(() => toggle.props.onPress());
  expect(tree.root.findAllByProps({testID: 'font-license'})).toHaveLength(0);
});

it.each([undefined, '', 42])(
  'reports unavailable bundled metadata explicitly (%s)',
  license => {
    Constants.expoConfig.extra.headerFontLicense = license;
    act(() => {
      tree = renderer.create(<FontCredits />);
    });
    act(() =>
      tree.root.findByProps({testID: 'font-credits-toggle'}).props.onPress(),
    );
    expect(tree.root.findByProps({testID: 'font-license'}).props.children).toBe(
      Strings.Settings.Font.Unavailable,
    );
  },
);

it('distributes artwork provenance and the full Apache license in Settings', () => {
  const config = require('../app.config')({config: {}});
  Constants.expoConfig.extra.connectionMapLicense =
    config.extra.connectionMapLicense;
  act(() => {
    tree = renderer.create(<ConnectionMapCredits />);
  });
  expect(
    tree.root.findAllByProps({testID: 'connection-map-license'}),
  ).toHaveLength(0);
  act(() =>
    tree.root
      .findByProps({testID: 'connection-map-credits-toggle'})
      .props.onPress(),
  );
  const license = tree.root.findByProps({testID: 'connection-map-license'});
  expect(license.props.selectable).toBe(true);
  expect(license.props.children).toContain('maskati/azure-icons');
  expect(license.props.children).toContain('not a Microsoft-hosted');
  expect(license.props.children).toContain('phone_android');
  expect(license.props.children).toContain('phone_iphone');
  expect(license.props.children).toContain(
    require('fs').readFileSync(
      require('path').join(__dirname, '..', 'LICENSE.material-icons'),
      'utf8',
    ),
  );
});

it('reports unavailable artwork licenses instead of silently hiding missing attribution', () => {
  delete Constants.expoConfig.extra.connectionMapLicense;
  act(() => {
    tree = renderer.create(<ConnectionMapCredits />);
  });
  act(() =>
    tree.root
      .findByProps({testID: 'connection-map-credits-toggle'})
      .props.onPress(),
  );
  expect(
    tree.root.findByProps({testID: 'connection-map-license'}).props.children,
  ).toBe(Strings.Settings.ConnectionMapArt.Unavailable);
});
it('presents the disclosure as a quiet control with a tonal pressed step', () => {
  act(() => {
    tree = renderer.create(<FontCredits />);
  });
  const toggle = tree.root.findByProps({testID: 'font-credits-toggle'});
  expect(toggle.props.accessibilityRole).toBe('button');
  const target = StyleSheet.flatten(toggle.props.style);
  expect(target.minHeight).toBeGreaterThanOrEqual(48);
  expect(target.backgroundColor).toBeUndefined();
  const fill = pressed =>
    StyleSheet.flatten(toggle.props.children({pressed}).props.style);
  expect(fill(false).backgroundColor).toBeUndefined();
  expect(fill(false).borderWidth).toBeUndefined();
  // Pressed feedback deepens the background instead of dimming the label.
  expect(fill(true).backgroundColor).toBe(palette(false).inset);
  expect(fill(true).opacity).toBeUndefined();
  const label = tree.root.findAllByType('Text')[0];
  expect(StyleSheet.flatten(label.props.style).color).toBe(
    palette(false).primary,
  );
});
