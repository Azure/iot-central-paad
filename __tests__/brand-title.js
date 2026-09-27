import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import BrandTitle from '../src/components/brandTitle';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';
import {useTheme} from '../src/hooks';
import PhoneMark from '../src/components/phoneMark';
import {DISPLAY_FONT_FAMILY} from '../src/theme/fonts';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

it.each([false, true])(
  'uses a theme-aware wordmark without losing its accessible title (%s)',
  dark => {
    useTheme.mockReturnValue({dark});
    let tree;
    act(() => {
      tree = renderer.create(<BrandTitle />);
    });
    const title = tree.root.findByProps({testID: 'app-header-title'});
    expect(title.props.accessibilityLabel).toBe('Phone as a Device');
    expect(title.props.accessibilityRole).toBe('header');
    expect(`${Strings.Header.Brand} ${Strings.Header.Descriptor}`).toBe(
      Strings.Header.Title,
    );
    const brand = title
      .findAllByType('Text')
      .find(node => node.props.children === Strings.Header.Brand);
    const typography = {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.15,
    };
    expect(StyleSheet.flatten(brand.props.style)).toMatchObject({
      ...typography,
      color: palette(dark).primary,
    });
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      ...typography,
      color: palette(dark).muted,
    });
    expect(StyleSheet.flatten(title.props.style).fontWeight).toBeUndefined();
    expect(title.props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.85,
      maxFontSizeMultiplier: 1.4,
    });
    expect(tree.toJSON().type).toBe('Text');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Cloud connection');
    act(() => tree.unmount());
  },
);

it.each([false, true])(
  'renders a decorative, theme-aware phone mark (%s)',
  dark => {
    useTheme.mockReturnValue({dark});
    let tree;
    act(() => {
      tree = renderer.create(<PhoneMark />);
    });
    const svg = tree.root.findByProps({viewBox: '0 0 24 24'});
    expect(svg.props).toMatchObject({width: 26, height: 26, accessible: false});
    const body = tree.root.findByProps({strokeWidth: 1.7});
    expect(body.props).toMatchObject({
      stroke: palette(dark).primary,
      width: 13.2,
      height: 20.2,
      rx: 4.4,
    });
    act(() => tree.unmount());
  },
);
