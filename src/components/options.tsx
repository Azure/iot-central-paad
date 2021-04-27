import {useTheme} from '@react-navigation/native';
import React, {useEffect} from 'react';
import {View} from 'react-native';
import {CheckBox, ListItem} from 'react-native-elements';

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
  const {colors} = useTheme();
  const [itemsState, setItems] = React.useState<(Option & {value: boolean})[]>(
    items.map(i => {
      if (defaultId && i.id === defaultId) {
        return {...i, value: true};
      }
      return {...i, value: false};
    }),
  );

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
    const enabled = itemsState.find(i => i.value === true);
    if (enabled && enabled.id !== defaultId) {
      onChange(enabled);
    }
  }, [onChange, itemsState, defaultId]);

  return (
    <View style={style.container}>
      {itemsState.map((item: Option & {value: boolean}, index: number) => (
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
