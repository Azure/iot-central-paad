import React from 'react';
import {StyleSheet} from 'react-native';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import {Text} from './typography';
import {DISPLAY_FONT_FAMILY} from '../theme/fonts';

export default function BrandTitle() {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <Text
      testID="app-header-title"
      accessibilityRole="header"
      accessibilityLabel={Strings.Header.Title}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      maxFontSizeMultiplier={1.4}
      style={[styles.title, {color: colors.muted}]}>
      <Text
        style={[styles.title, {color: colors.primary}]}
        maxFontSizeMultiplier={1.4}>
        {Strings.Header.Brand}
      </Text>
      {` ${Strings.Header.Descriptor}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.15,
  },
});
