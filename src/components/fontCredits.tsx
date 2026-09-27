import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Constants from 'expo-constants';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import {Text} from './typography';

export default function FontCredits() {
  return (
    <LicenseCredits
      id="font"
      text={Strings.Settings.Font}
      license={Constants.expoConfig?.extra?.headerFontLicense}
    />
  );
}

export function ConnectionMapCredits() {
  return (
    <LicenseCredits
      id="connection-map"
      text={Strings.Settings.ConnectionMapArt}
      license={Constants.expoConfig?.extra?.connectionMapLicense}
    />
  );
}

function LicenseCredits({
  id,
  text,
  license,
}: {
  id: string;
  text: {Title: string; Unavailable: string};
  license: unknown;
}) {
  const [expanded, setExpanded] = useState(false);
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View style={styles.container}>
      <Pressable
        testID={`${id}-credits-toggle`}
        accessibilityRole="button"
        accessibilityState={{expanded}}
        onPress={() => setExpanded(!expanded)}
        style={styles.toggle}>
        {({pressed}) => (
          <View
            style={[
              styles.toggleFill,
              pressed && {backgroundColor: colors.inset},
            ]}>
            <Text style={[styles.toggleLabel, {color: colors.primary}]}>
              {text.Title}
            </Text>
          </View>
        )}
      </Pressable>
      {expanded && (
        <Text
          testID={`${id}-license`}
          selectable
          style={[styles.license, {color: colors.muted}]}>
          {typeof license === 'string' && license.length > 0
            ? license
            : text.Unavailable}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {paddingHorizontal: 8, paddingTop: 8},
  toggle: {minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center'},
  toggleFill: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  toggleLabel: {fontSize: 14, lineHeight: 20, fontWeight: '600'},
  license: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
});
