import {useTheme} from '@react-navigation/native';
import {ThemeContext} from 'contexts';
import React, {useContext, useEffect} from 'react';
import {View} from 'react-native';
import {CheckBox, ListItem} from 'react-native-elements';
import Strings from 'strings';
import {ThemeMode} from 'types';

type ListItem = {
  id: string;
  name: string;
  details: string;
  value: boolean;
};
const Theme = React.memo(() => {
  const {colors} = useTheme();
  const {set, mode} = useContext(ThemeContext);
  const [items, setItems] = React.useState<ListItem[]>([
    {
      id: 'DEVICE',
      name: Strings.Settings.Theme.Device.Name,
      details: Strings.Settings.Theme.Device.Detail,
      value: mode === ThemeMode.DEVICE,
    },
    {
      id: 'DARK',
      name: Strings.Settings.Theme.Dark.Name,
      details: Strings.Settings.Theme.Dark.Detail,
      value: mode === ThemeMode.DARK,
    },
    {
      id: 'LIGHT',
      name: Strings.Settings.Theme.Light.Name,
      details: Strings.Settings.Theme.Light.Detail,
      value: mode === ThemeMode.LIGHT,
    },
  ]);

  const style = React.useMemo(
    () => ({
      container: {
        flex: 1,
      },
      listItem: {
        backgroundColor: colors.card,
      },
      subTitle: {
        color: colors.text,
      },
      checkBox: {
        color: colors.text,
      },
    }),
    [colors],
  );

  useEffect(() => {
    // every time something is checked, change theme
    const enabled = items.find(i => i.value === true);
    if (enabled) {
      set(ThemeMode[enabled.id as keyof typeof ThemeMode]);
    }
  }, [items, set]);

  return (
    <View style={style.container}>
      {items.map((item: ListItem, index: number) => (
        <ListItem
          key={`theme-${index}`}
          bottomDivider
          containerStyle={style.listItem}>
          <CheckBox
            center
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checkedColor={colors.text}
            uncheckedColor={colors.text}
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
            <ListItem.Title style={{color: colors.text}}>
              {item.name}
            </ListItem.Title>
            <ListItem.Subtitle style={style.subTitle}>
              {item.details}
            </ListItem.Subtitle>
          </ListItem.Content>
        </ListItem>
      ))}
    </View>
  );
});

export default Theme;
