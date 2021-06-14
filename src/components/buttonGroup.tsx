// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {View, ViewStyle} from 'react-native';
import {CheckBox} from 'react-native-elements';

export type ButtonGroupItem = {
  id: string;
  label: string;
};

const ButtonGroup = React.memo<{
  items: ButtonGroupItem[];
  onCheckedChange: (id: string) => void | Promise<void>;
  containerStyle?: ViewStyle;
  defaultCheckedId?: string;
  readonly?: boolean;
}>(({items, onCheckedChange, defaultCheckedId, readonly, containerStyle}) => {
  const ids = items.map(i => i.id);
  const [checked, setChecked] = React.useState<typeof ids[number]>(
    defaultCheckedId ?? ids[0],
  );
  return (
    <View style={[{flex: 1}, containerStyle]} key={`btnGroup-${Math.random()}`}>
      {items.map((item, index) => (
        <CheckBox
          key={`chkb-${index}-${Math.random()}`}
          containerStyle={{
            marginStart: 0,
            paddingVertical: 0,
            backgroundColor: undefined,
            borderWidth: 0,
          }}
          disabled={readonly}
          checkedIcon="dot-circle-o"
          uncheckedIcon="circle-o"
          checked={checked === item.id}
          checkedColor={readonly ? 'gray' : undefined}
          uncheckedColor={readonly ? 'gray' : undefined}
          title={item.label}
          onPress={() => {
            setChecked(item.id);
            onCheckedChange(item.id);
          }}
        />
      ))}
    </View>
  );
});

export default ButtonGroup;
