// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {
  View,
  FlatList,
  ViewStyle,
  TextStyle,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {ListItem} from '@rneui/themed';
import Strings from 'strings';
import {ItemProps, Literal} from 'types';
import {Card} from './components/card';
import {useTheme} from 'hooks';
import {normalize, Text} from 'components/typography';
import BottomPopup from 'components/bottomPopup';
import {palette} from './theme/palette';
import {detailStyles} from './theme/detailStyles';
import ToolStrings from './experience/toolStrings';

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
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const {width, fontScale} = useWindowDimensions();
  const columns = width >= 700 && fontScale <= 1.3 ? 2 : 1;
  const styles = React.useMemo<Literal<ViewStyle | TextStyle>>(
    () => ({
      container: {flex: 1, backgroundColor: colors.background},
      list: {paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28},
      columns: {gap: 12},
      sectionTitle: {marginBottom: 4},
      sectionDetail: {marginBottom: 12},
      listItem: {
        minHeight: 56,
        justifyContent: 'center',
        backgroundColor: colors.card,
      },
      actionItem: {
        minHeight: 56,
        justifyContent: 'center',
        backgroundColor: 'transparent',
      },
      listItemText: {
        fontWeight: '600',
        fontSize: normalize(16),
        color: appearance.text,
      },
      detailItemText: {
        fontSize: normalize(15),
        fontWeight: '600',
        color: appearance.primary,
      },
    }),
    [colors, appearance],
  );

  // Popup actions keep their row semantics: a tonal fill, never a dimmed label.
  const rowFeedback = React.useCallback(
    ({pressed}: {pressed: boolean}) => ({
      backgroundColor: pressed ? appearance.inset : colors.card,
    }),
    [appearance, colors.card],
  );

  const onCardLongPress = React.useCallback<CardPressCallback>(
    item => {
      setBottomItem(item);
    },
    [setBottomItem],
  );

  return (
    <View style={styles.container}>
      {componentName === 'Property' ? (
        <ScrollView
          testID="properties-tool"
          contentContainerStyle={styles.list}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled">
          {[
            {
              id: 'phone',
              title: ToolStrings.Properties.Phone,
              detail: ToolStrings.Properties.PhoneDetail,
              items: items.filter(item => item.id === 'readOnlyProp'),
            },
            {
              id: 'cloud',
              title: ToolStrings.Properties.Cloud,
              detail: ToolStrings.Properties.CloudDetail,
              items: items.filter(item => item.id === 'writeableProp'),
            },
            {
              id: 'device',
              title: ToolStrings.Properties.Device,
              detail: ToolStrings.Properties.DeviceDetail,
              items: items.filter(
                item => !['readOnlyProp', 'writeableProp'].includes(item.id),
              ),
            },
          ].map(group => (
            <View key={group.id} testID={`properties-group-${group.id}`}>
              <Text
                accessibilityRole="header"
                style={[
                  detailStyles.sectionTitle,
                  styles.sectionTitle,
                  {color: appearance.text},
                ]}>
                {group.title}
              </Text>
              <Text
                style={[
                  detailStyles.supporting,
                  styles.sectionDetail,
                  {color: appearance.muted},
                ]}>
                {group.detail}
              </Text>
              {group.items.map(item => (
                <React.Fragment key={item.id}>
                  {getCard(
                    1,
                    onItemPress,
                    undefined,
                    onEdit,
                    undefined,
                    true,
                  )({item})}
                </React.Fragment>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          testID={componentName === 'Telemetry' ? 'telemetry-tool' : undefined}
          key={`flatlist-${componentName}-${columns}`}
          numColumns={columns}
          contentContainerStyle={styles.list}
          columnWrapperStyle={columns === 2 ? styles.columns : undefined}
          showsVerticalScrollIndicator={false}
          data={items}
          keyExtractor={item => item.id}
          renderItem={getCard(
            columns,
            onItemPress,
            onItemLongPress ? onCardLongPress : undefined,
            onEdit,
            onItemLongPress,
          )}
        />
      )}
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
        {bottomItem?.availability === 'unavailable' && bottomItem.enabled && (
          <ListItem
            onPress={() => {
              bottomItem.retry?.();
              setBottomItem(undefined);
            }}
            style={rowFeedback}
            containerStyle={styles.actionItem}>
            <ListItem.Content>
              <ListItem.Title style={styles.detailItemText}>
                {Strings.Sensors.Retry}
              </ListItem.Title>
            </ListItem.Content>
          </ListItem>
        )}
        <ListItem
          onPress={async () => {
            await onItemLongPress?.(bottomItem!);
            // close sheet
            setBottomItem(undefined);
          }}
          style={rowFeedback}
          containerStyle={styles.actionItem}>
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
    columns: number,
    onItemPress?: CardPressCallback,
    onItemLongPress?: CardPressCallback,
    onEdit?: CardEditCallback,
    onToggle?: CardPressCallback,
    property = false,
  ) =>
  ({item}: {item: ItemProps}) =>
    (
      <Card
        containerStyle={columns === 2 ? {flexBasis: 0} : undefined}
        accentKey={item.id}
        title={item.name}
        value={item.value}
        unit={item.unit}
        dataType={item.dataType}
        enabled={item.enabled}
        availability={item.availability}
        simulated={item.simulated}
        editable={item.editable}
        presentation={property ? propertyPresentation(item) : item.presentation}
        technicalName={property ? item.id : undefined}
        icon={item.icon}
        onToggle={onToggle?.bind(null, item)}
        onLongPress={onItemLongPress && onItemLongPress.bind(null, item)} // edit card
        onEdit={onEdit?.bind(null, item)}
        onPress={
          item.enabled && onItemPress ? onItemPress.bind(null, item) : undefined
        }
      />
    );

function propertyPresentation(item: ItemProps): ItemProps['presentation'] {
  const description = {
    swVersion: ToolStrings.Properties.SystemVersionDetail,
    totalStorage: ToolStrings.Properties.StorageDetail,
    totalMemory: ToolStrings.Properties.MemoryDetail,
  }[item.id];
  return description ? {...item.presentation, description} : item.presentation;
}

export default CardView;
