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
  // const navigation = useNavigation();
  // const [, append] = useLogger();

  // const sendTelemetryHandler = useCallback(
  //   async (id: string, value: any) => {
  //     if (iotcentralClient && iotcentralClient.isConnected()) {
  //       await iotcentralClient.sendTelemetry(
  //         { [id]: value },
  //         { '$.sub': TELEMETRY_COMPONENT },
  //       );
  //     }
  //   }, [iotcentralClient]
  // );

  // const onCommandUpdate = useCallback(
  //   async (command: IIoTCCommand) => {
  //     let data: any;
  //     data = JSON.parse(command.requestPayload);
  //     if (data.item) {
  //       if (command.name === ENABLE_DISABLE_COMMAND) {
  //         items?.[data.item].enable(data.enable ? data.enable : false);
  //         await command.reply(IIoTCCommandResponse.SUCCESS, 'Enable');
  //       } else if (command.name === SET_FREQUENCY_COMMAND) {
  //         itemMap[data.item].sendInterval(
  //           data.frequency ? data.frequency * 1000 : 5000,
  //         );
  //         await command.reply(IIoTCCommandResponse.SUCCESS, 'Frequency');
  //       }
  //     }
  //   },
  //   [items],
  // );

  // useEffect(() => {
  //   if (iotcentralClient && iotcentralClient.isConnected()) {
  //     items?.forEach((s) =>
  //       itemMap[s.id].addListener(DATA_AVAILABLE_EVENT, sendTelemetryHandler),
  //     );
  //     append({
  //       eventName: 'INFO',
  //       eventData: 'item initialized.'
  //     });
  //   }
  //   return () => {
  //     items?.forEach((s) =>
  //       itemMap[s.id].removeListener(DATA_AVAILABLE_EVENT, sendTelemetryHandler),
  //     );
  //   };
  // }, [items, iotcentralClient]);

  // useEffect(() => {
  //   if (iotcentralClient) {
  //     iotcentralClient.on(IOTC_EVENTS.Commands, onCommandUpdate);
  //   }
  // }, [iotcentralClient, onCommandUpdate]);

  // if (!simulated) {
  //   if (iotcentralClient === null) {
  //     console.log('chiamo registration qua');
  //     return <Registration />;
  //   }

  //   if (!items) {
  //     return (
  //       <Loader
  //         message={'Waiting for items...'}
  //         visible={true}
  //         style={{ flex: 1, justifyContent: 'center' }}
  //       />
  //     );
  //   }
  // }

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
