import React from 'react';
import {View, FlatList} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ItemProps} from 'types';
import {Card} from './components/card';

type CardPressCallback = (item: ItemProps) => void | Promise<void>;
type CardEditCallback = (item: ItemProps, value: any) => void | Promise<void>;

const CardView = React.memo<{
  items: ItemProps[];
  componentName?: string;
  onItemPress?: CardPressCallback;
  onEdit?: CardEditCallback;
}>(({items, onItemPress, componentName, onEdit}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom}}>
      <FlatList
        numColumns={items.length > 4 ? 2 : 1}
        data={items}
        renderItem={getCard(componentName, onItemPress, onEdit)}
      />
    </View>
  );
});

const getCard = (
  componentName?: string,
  onItemPress?: CardPressCallback,
  onEdit?: CardEditCallback,
) => ({item, index}: {item: ItemProps; index: number}) => (
  <Card
    key={`${componentName ?? 'card'}-${index}`}
    title={item.name}
    value={item.value}
    unit={item.unit}
    dataType={item.dataType}
    enabled={item.enabled}
    editable={(item as any).editable}
    icon={item.icon}
    onToggle={() => item.enable(!item.enabled)}
    onLongPress={e => console.log('longpress')} // edit card
    onEdit={onEdit?.bind(null, item)}
    onPress={
      item.enabled && onItemPress ? onItemPress.bind(null, item) : undefined
    }
  />
);

export default CardView;
