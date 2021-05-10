import { useTheme } from '@react-navigation/native';
import React from 'react';
import { View, FlatList } from 'react-native';
import { BottomSheet, ListItem } from 'react-native-elements';
import Strings from 'strings';
import { ItemProps } from 'types';
import { Card } from './components/card';

type CardPressCallback = (item: ItemProps) => void | Promise<void>;
type CardEditCallback = (item: ItemProps, value: any) => void | Promise<void>;

const CardView = React.memo<{
  items: ItemProps[];
  componentName?: string;
  onItemPress?: CardPressCallback;
  onItemLongPress?: CardPressCallback;
  onEdit?: CardEditCallback;
}>(({ items, onItemPress, onItemLongPress, componentName, onEdit }) => {
  const [bottomItem, setBottomItem] = React.useState<ItemProps | undefined>(undefined);
  const { colors } = useTheme();
  const styles = React.useMemo(
    () => ({
      listItem: {
        backgroundColor: colors.card,
      },
      listItemText: {
        color: colors.text,
      },
      closeItemText: {
        color: 'gray',
      },
    }),
    [colors],
  );

  const onCardLongPress = React.useCallback<CardPressCallback>((item) => {
    console.log('qua');
    setBottomItem(item);
  }, [setBottomItem]);

  return (
    <View style={{ flex: 1, paddingVertical: 10 }}>
      <FlatList
        numColumns={items.length > 4 ? 2 : 1}
        data={items}
        renderItem={getCard(componentName, onItemPress, onCardLongPress, onEdit)}
      />
      <BottomSheet
        isVisible={bottomItem !== undefined}
        containerStyle={{ backgroundColor: 'rgba(0.5, 0.25, 0, 0.7)' }}
        modalProps={{}}>
        <ListItem
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.listItemText}>
              {bottomItem?.name}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
        <ListItem
          onPress={async () => {
            await onItemLongPress?.(bottomItem!);
            // close sheet
            setBottomItem(undefined);
          }}
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.closeItemText}>
              {bottomItem?.enabled ? Strings.Core.DisableSensor : Strings.Core.EnableSensor}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </BottomSheet>
    </View>
  );
});

const getCard = (
  componentName?: string,
  onItemPress?: CardPressCallback,
  onItemLongPress?: CardPressCallback,
  onEdit?: CardEditCallback,
) => ({ item, index }: { item: ItemProps; index: number }) => (
  <Card
    key={`${componentName ?? 'card'}-${index}`}
    title={item.name}
    value={item.value}
    unit={item.unit}
    dataType={item.dataType}
    enabled={item.enabled}
    editable={(item as any).editable}
    icon={item.icon}
    // onToggle={() => item.enable(!item.enabled)}
    onLongPress={onItemLongPress && onItemLongPress.bind(null, item)} // edit card
    onEdit={onEdit?.bind(null, item)}
    onPress={
      item.enabled && onItemPress ? onItemPress.bind(null, item) : undefined
    }
  />
);

export default CardView;
