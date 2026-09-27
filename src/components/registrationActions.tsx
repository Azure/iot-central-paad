// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import Button from './button';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';
import Strings from '../strings';

export default function RegistrationActions({
  onClose,
  onRegisterNew,
}: {
  onClose(): void;
  onRegisterNew(): void;
}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const {width, fontScale} = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  return (
    <View
      testID="registration-actions"
      style={[
        styles.footer,
        stacked && styles.stacked,
        {borderTopColor: colors.border},
      ]}>
      <Button
        testID="registration-close"
        title={Strings.Core.Close}
        type="outline"
        containerStyle={[styles.control, stacked && styles.stackedControl]}
        buttonStyle={styles.button}
        titleStyle={styles.title}
        onPress={onClose}
      />
      <Button
        testID="registration-new"
        title={Strings.Registration.Manual.RegisterNew.ShortTitle}
        accessibilityLabel={Strings.Registration.Manual.RegisterNew.Title}
        icon={{
          name: 'plus',
          type: 'material-community',
          size: 18,
          color: colors.onPrimary,
        }}
        iconContainerStyle={styles.icon}
        type="solid"
        containerStyle={[styles.control, stacked && styles.stackedControl]}
        buttonStyle={styles.primaryButton}
        titleStyle={styles.title}
        onPress={onRegisterNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 20,
    paddingTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stacked: {flexDirection: 'column', alignItems: 'center'},
  control: {width: 'auto', maxWidth: '100%', flexShrink: 1, borderRadius: 14},
  stackedControl: {width: '100%', maxWidth: 320},
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primaryButton: {
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  title: {fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center'},
  icon: {marginRight: 6},
});
