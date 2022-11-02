import {NavigationProp} from '@react-navigation/native';
import {
  createStackNavigator,
  StackNavigationOptions,
  StackScreenProps,
} from '@react-navigation/stack';
import {ListItem} from '@rneui/themed';
import * as React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {Device, State, UUID} from 'react-native-ble-plx';
import {IotcBleManager} from './BleManager';
import {ItemProps, Pages} from 'types';
import {Loader, Text} from '../components';
import {useIoTCentralClient, useTheme} from '../hooks';
import CardView from 'CardView';

type BluetoothStackParamList = {
  [Pages.BLUETOOTH_LIST]: undefined;
  [Pages.BLUETOOTH_DETAIL]: {
    deviceId: UUID;
  };
};

const BluetoothStack = createStackNavigator<BluetoothStackParamList>();
const CommonScreenOptions: StackNavigationOptions = {
  headerShown: false,
};

interface BluetoothPageProps {
  navigation: NavigationProp<ReactNavigation.RootParamList>;
}

export function BluetoothPage(_props: BluetoothPageProps) {
  return (
    <BluetoothStack.Navigator initialRouteName={Pages.BLUETOOTH_LIST}>
      <BluetoothStack.Screen
        name={Pages.BLUETOOTH_LIST}
        component={BluetoothList}
        options={CommonScreenOptions}
      />
      <BluetoothStack.Screen
        name={Pages.BLUETOOTH_DETAIL}
        component={BluetoothDetail}
        options={CommonScreenOptions}
      />
    </BluetoothStack.Navigator>
  );
}

type BluetoothListProps = StackScreenProps<
  BluetoothStackParamList,
  typeof Pages.BLUETOOTH_LIST
>;

function BluetoothList({navigation}: BluetoothListProps) {
  const {colors} = useTheme();
  const [isVisible, setIsVisible] = React.useState(true);
  const {devices} = useBluetoothDevicesList(isVisible);

  React.useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsVisible(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsVisible(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, setIsVisible]);

  return (
    <View style={styles.container}>
      <FlatList<Device>
        data={devices}
        renderItem={({item}) => (
          <BluetoothDeviceListItem
            item={item}
            colors={colors}
            navigation={navigation}
          />
        )}
      />
    </View>
  );
}

interface BluetoothDeviceListItemProps {
  item: Device;
  colors: ReturnType<typeof useTheme>['colors'];
  navigation: BluetoothListProps['navigation'];
}

function BluetoothDeviceListItem({
  item,
  colors,
  navigation,
}: BluetoothDeviceListItemProps) {
  return (
    <ListItem
      onPress={_e => {
        navigation.navigate(Pages.BLUETOOTH_DETAIL, {deviceId: item.id});
      }}
      bottomDivider
      style={{
        backgroundColor: colors.card,
      }}>
      <ListItem.Content
        style={{
          ...styles.item,
          backgroundColor: colors.card,
        }}>
        <ListItem.Title style={{color: colors.text}}>
          {item.name}
        </ListItem.Title>
        <ListItem.Subtitle style={{color: colors.text}}>
          {item.id}
        </ListItem.Subtitle>
      </ListItem.Content>
    </ListItem>
  );
}

function useBluetoothDevicesList(shouldScan: boolean) {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const seenIds = React.useRef<Set<string> | null>(null);

  if (seenIds.current === null) {
    seenIds.current = new Set();
  }

  React.useEffect(() => {
    async function scan() {
      if (!shouldScan) {
        return;
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bluetooth Permission',
            message:
              'Application would like to use bluetooth and location permissions',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Permission rejected');
        }
      }
      const bleManager = IotcBleManager.getInstance();

      const sub = bleManager.onStateChange(s => {
        if (s === State.PoweredOn) {
          sub.remove();

          bleManager.startDeviceScan(null, {scanMode: 2}, (e, device) => {
            if (e) {
              console.error(e);
            }

            if (!device?.name) {
              return;
            }

            if (!seenIds.current?.has(device.id)) {
              seenIds.current?.add(device.id);
              setDevices(prev => [...prev, device]);
            }
          });
        }
      }, true);
    }

    scan().catch(console.error);
  }, [setDevices, shouldScan]);

  return {devices};
}

function BluetoothDetail({
  route: {
    params: {deviceId},
  },
}: StackScreenProps<BluetoothStackParamList, typeof Pages.BLUETOOTH_DETAIL>) {
  const [[items, deviceName], setData] = React.useState<
    [ItemProps[] | null, string]
  >(() => [null, '']);
  const [iotcentralClient] = useIoTCentralClient();

  React.useEffect(() => {
    const bleManager = IotcBleManager.getInstance();

    bleManager.startDeviceScan(null, {scanMode: 2}, (error, device) => {
      if (error) {
        console.error(error);
      }

      if (device?.id !== deviceId) {
        return;
      }

      const model = bleManager.getModelForDevice(device);
      if (!model) {
        // Default behavior for unmodelled device
        return;
      }

      const deviceData = model.onScan(device);
      if (!deviceData) {
        return;
      }

      const itemProps = model.getItemProps(deviceData);

      iotcentralClient?.sendTelemetry(deviceData);
      iotcentralClient?.sendProperty({bleDeviceName: device.name});

      setData([
        itemProps.map(item => ({
          ...item,
          sendInterval(_value) {},
          enable(_value) {},
        })),
        device.name ?? '',
      ]);
    });
  }, [deviceId, iotcentralClient]);

  if (!(deviceName && items)) {
    return <Loader visible message="Scanning for device" />;
  }

  return (
    <>
      <Text style={{fontSize: 20, textAlign: 'center', marginTop: 10}}>
        {deviceName}
      </Text>
      <CardView items={items} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 60,
  },
});
