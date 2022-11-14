/* eslint-disable react/no-unstable-nested-components */
import {createStackNavigator, StackScreenProps} from '@react-navigation/stack';
import {Icon, ListItem} from '@rneui/themed';
import * as React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {Device, State, UUID} from 'react-native-ble-plx';
import {IotcBleManager} from './BleManager';
import {ItemProps, Pages} from 'types';
import {Loader, Text} from '../components';
import {useIoTCentralClient, useTheme} from '../hooks';
import CardView from 'CardView';
import {Logo, Profile, styles as appStyles} from 'App';
import Strings from 'strings';

type BluetoothStackParamList = {
  [Pages.BLUETOOTH_LIST]: undefined;
  [Pages.BLUETOOTH_DETAIL]: {
    deviceId: UUID;
    deviceName: string;
  };
};

const BluetoothStack = createStackNavigator<BluetoothStackParamList>();

export function BluetoothPage() {
  const {colors} = useTheme();

  return (
    <BluetoothStack.Navigator
      initialRouteName={Pages.BLUETOOTH_LIST}
      screenOptions={({navigation, route}) => {
        const isListPage: boolean = route.name === Pages.BLUETOOTH_LIST;

        return {
          headerTitle: () => (
            <Text
              style={{
                ...appStyles.logoText,
                color: colors.text,
              }}>
              {isListPage ? Strings.Title : route.params?.deviceName ?? ''}
            </Text>
          ),
          headerTitleAlign: 'left',
          headerLeft: isListPage ? () => <Logo /> : undefined,
          headerBackTitleVisible: false,
          headerRight: () => (
            <View style={appStyles.headerButtons}>
              {isListPage && <ReloadButton />}
              <Profile navigate={navigation.navigate} />
            </View>
          ),
        };
      }}>
      <BluetoothStack.Screen
        name={Pages.BLUETOOTH_LIST}
        component={BluetoothList}
      />
      <BluetoothStack.Screen
        name={Pages.BLUETOOTH_DETAIL}
        component={BluetoothDetail}
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
        onRefresh={() => IotcBleManager.getInstance().resetDeviceList()}
        refreshing={devices.length === 0}
        refreshControl={
          <RefreshControl
            refreshing={devices.length === 0}
            onRefresh={() => IotcBleManager.getInstance().resetDeviceList()}
            colors={[colors.text]}
          />
        }
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
    <TouchableOpacity
      onPress={_e => {
        navigation.navigate(Pages.BLUETOOTH_DETAIL, {
          deviceId: item.id,
          deviceName: item.name ?? '',
        });
      }}>
      <ListItem bottomDivider containerStyle={{backgroundColor: colors.card}}>
        <ListItem.Content
          style={{
            ...styles.item,
            backgroundColor: colors.card,
          }}>
          <ListItem.Title style={{...styles.itemTitle, color: colors.text}}>
            {item.name}
          </ListItem.Title>

          <ListItem.Subtitle
            style={{...styles.subtitleContainer, color: colors.text}}>
            <View style={styles.subtitleContent}>
              <Icon
                name="signal"
                type="material-community"
                color={colors.text}
              />
              <Text style={styles.rssiText}>{item.rssi} dBm</Text>
            </View>
          </ListItem.Subtitle>
        </ListItem.Content>
      </ListItem>
    </TouchableOpacity>
  );
}

function useBluetoothDevicesList(shouldScan: boolean) {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const deviceMap = React.useRef<Map<UUID, Device> | null>(null);

  if (deviceMap.current === null) {
    deviceMap.current = new Map();
  }

  const bleManager = IotcBleManager.getInstance();

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

            deviceMap.current?.set(device.id, device);
            setDevices(Array.from(deviceMap.current?.values() ?? []));
          });
        }
      }, true);
    }

    bleManager.setResetDeviceListCallback(() => {
      deviceMap.current?.clear();
      setDevices([]);
    });

    scan().catch(console.error);
  }, [bleManager, setDevices, shouldScan]);

  return {devices};
}

type BluetoothDetailProps = StackScreenProps<
  BluetoothStackParamList,
  typeof Pages.BLUETOOTH_DETAIL
>;

function BluetoothDetail({
  route: {
    params: {deviceId, deviceName},
  },
}: BluetoothDetailProps) {
  const [items, setData] = React.useState<ItemProps[] | null>(() => null);
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

      const deviceData = model.onScan(device);
      if (!deviceData) {
        return;
      }

      const itemProps = model.getItemProps(deviceData);

      iotcentralClient?.sendTelemetry(deviceData);
      iotcentralClient?.sendProperty({bleDeviceName: device.name});

      setData(
        itemProps.map(item => ({
          ...item,
          sendInterval(_value) {},
          enable(_value) {},
        })),
      );
    });
  }, [deviceId, iotcentralClient]);

  if (!(deviceName && items)) {
    return (
      <View style={styles.listLoaderContainer}>
        <Loader visible message="Scanning for device" style={styles.loader} />
      </View>
    );
  }

  return (
    <>
      <CardView items={items} />
    </>
  );
}

function ReloadButton() {
  const {colors} = useTheme();
  return (
    <View>
      <Icon
        style={styles.marginEnd10}
        name="reload"
        type={Platform.select({ios: 'ionicon', android: 'material-community'})}
        color={colors.text}
        onPress={() => {
          IotcBleManager.getInstance().resetDeviceList();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
  },
  item: {
    fontSize: 18,
    height: 60,
  },
  itemTitle: {
    fontWeight: 'bold',
  },
  marginEnd10: {
    marginEnd: 10,
  },
  deviceName: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  subtitleContainer: {
    marginTop: 10,
  },
  subtitleContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 0,
  },
  rssiText: {
    marginStart: 5,
  },
  listLoaderContainer: {
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    width: '75%',
  },
});
