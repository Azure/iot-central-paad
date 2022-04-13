// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {View, FlatList, ViewStyle, TextStyle} from 'react-native';
import {ListItem} from '@rneui/themed';
import Strings from 'strings';
import {ItemProps, Literal} from 'types';
import {Card} from './components/card';
import {useTheme} from 'hooks';
import {normalize} from 'components/typography';
import BottomPopup from 'components/bottomPopup';

type CardPressCallback = (item: ItemProps) => void | Promise<void>;
type CardEditCallback = (item: ItemProps, value: any) => void | Promise<void>;

const CardView = React.memo<{
  items: ItemProps[];
  componentName?: string;
  onItemPress?: CardPressCallback;
  onItemLongPress?: CardPressCallback;
  onEdit?: CardEditCallback;
}>(({items, onItemPress, onItemLongPress, componentName, onEdit}) => {
  const [bottomItem, setBottomItem] = React.useState<ItemProps | undefined>(
    undefined,
  );
  const {colors} = useTheme();
  const styles = React.useMemo<Literal<ViewStyle | TextStyle>>(
    () => ({
      container: {flex: 1, paddingVertical: 10},
      listItem: {
        backgroundColor: colors.card,
      },
      listItemText: {
        fontWeight: 'bold',
        fontSize: normalize(16),
        color: colors.text,
      },
      detailItemText: {
        fontSize: normalize(14),
        color: colors.text,
      },
    }),
    [colors],
  );

  const onCardLongPress = React.useCallback<CardPressCallback>(
    item => {
      setBottomItem(item);
    },
    [setBottomItem],
  );

  return (
    <View style={styles.container}>
      <FlatList
        key={`flatlist-${componentName}-${items.length}`}
        numColumns={items.length > 4 ? 2 : 1}
        data={items}
        renderItem={getCard(
          componentName,
          onItemPress,
          onItemLongPress ? onCardLongPress : undefined,
          onEdit,
        )}
      />
      <BottomPopup
        isVisible={bottomItem !== undefined}
        onDismiss={() => setBottomItem(undefined)}>
        <ListItem containerStyle={styles.listItem}>
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
            <ListItem.Title style={styles.detailItemText}>
              {bottomItem?.enabled
                ? Strings.Core.DisableSensor
                : Strings.Core.EnableSensor}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </BottomPopup>
    </View>
  );
});

const getCard =
  (
    componentName?: string,
    onItemPress?: CardPressCallback,
    onItemLongPress?: CardPressCallback,
    onEdit?: CardEditCallback,
  ) =>
  ({item, index}: {item: ItemProps; index: number}) =>
    (
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
