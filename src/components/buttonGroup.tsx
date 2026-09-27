// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {View, ViewStyle} from 'react-native';
import {CheckBox} from '@rneui/themed';
import {StyleDefinition} from 'types';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';

export type ButtonGroupItem = {
  id: string;
  label: string;
};

const styles: StyleDefinition = {
  container: {
    flex: 1,
  },
  item: {
    minHeight: 48,
    marginStart: 0,
    marginVertical: 0,
    paddingVertical: 12,
    justifyContent: 'center',
    backgroundColor: undefined,
    borderWidth: 0,
  },
};

interface ButtonGroupProps {
  items: ButtonGroupItem[];
  onCheckedChange: (id: string) => void | Promise<void>;
  containerStyle?: ViewStyle;
  defaultCheckedId?: string;
  readonly?: boolean;
}
const ButtonGroup = React.memo<ButtonGroupProps>(
  ({items, onCheckedChange, defaultCheckedId, readonly, containerStyle}) => {
    const ids = items.map(i => i.id);
    const {dark} = useTheme();
    const colors = palette(dark);
    const [checked, setChecked] = React.useState<(typeof ids)[number]>(
      defaultCheckedId ?? ids[0],
    );
    return (
      // Stable keys keep press feedback attached to the same control.
      <View style={[styles.container, containerStyle]}>
        {items.map(item => (
          <CheckBox
            key={`chkb-${item.id}`}
            containerStyle={styles.item}
            disabled={readonly}
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checked={checked === item.id}
            checkedColor={readonly ? colors.muted : colors.primary}
            uncheckedColor={readonly ? colors.muted : colors.controlBorder}
            textStyle={{
              color: checked === item.id ? colors.primary : colors.text,
            }}
            title={item.label}
            onPress={() => {
              setChecked(item.id);
              onCheckedChange(item.id);
            }}
          />
        ))}
      </View>
    );
  },
);

export default ButtonGroup;
