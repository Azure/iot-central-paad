// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useTheme} from 'hooks';
import React, {useEffect} from 'react';
import {View} from 'react-native';
import {CheckBox, ListItem} from '@rneui/themed';
import {StyleDefinition} from 'types';
import {palette} from '../theme/palette';

export type Option = {
  id: string;
  name: string;
  details?: string;
};

export type OptionChangeCallback = (item: Option) => void | Promise<void>;
const Options = React.memo<{
  items: Option[];
  onChange: OptionChangeCallback;
  defaultId?: string;
}>(({items, onChange, defaultId}) => {
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [itemsState, setItems] = React.useState<(Option & {value: boolean})[]>(
    items.map(i => {
      if (defaultId && i.id === defaultId) {
        return {...i, value: true};
      }
      return {...i, value: false};
    }),
  );

  const style = React.useMemo<StyleDefinition>(
    () => ({
      container: {
        flex: 1,
      },
      listItem: {
        minHeight: 64,
        backgroundColor: colors.card,
        borderBottomColor: appearance.surfaceBorder,
      },
      subTitle: {
        color: appearance.muted,
        fontSize: 13,
        lineHeight: 19,
      },
      checkBox: {
        minWidth: 48,
        minHeight: 48,
        marginRight: 8,
        justifyContent: 'center',
        backgroundColor: 'transparent',
      },
      title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
      },
      selectedTitle: {
        color: appearance.primary,
      },
    }),
    [colors, appearance],
  );

  useEffect(() => {
    // every time something is checked, change theme
    const enabled = itemsState.find(i => i.value === true);
    if (enabled && enabled.id !== defaultId) {
      onChange(enabled);
    }
  }, [onChange, itemsState, defaultId]);

  return (
    <View style={style.container}>
      {itemsState.map((item: Option & {value: boolean}) => (
        <ListItem
          key={`theme-${item.id}`}
          bottomDivider
          containerStyle={style.listItem}>
          <CheckBox
            center
            containerStyle={style.checkBox}
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checkedColor={appearance.primary}
            uncheckedColor={appearance.controlBorder}
            checked={item.value}
            onPress={() =>
              setItems(current =>
                current.map(i => {
                  if (i.id === item.id) {
                    i = {...i, value: true};
                  } else {
                    i = {...i, value: false};
                  }
                  return i;
                }),
              )
            }
          />
          <ListItem.Content>
            <ListItem.Title
              style={[style.title, item.value && style.selectedTitle]}>
              {item.name}
            </ListItem.Title>
            {item.details && (
              <ListItem.Subtitle style={style.subTitle}>
                {item.details}
              </ListItem.Subtitle>
            )}
          </ListItem.Content>
        </ListItem>
      ))}
    </View>
  );
});

export default Options;
