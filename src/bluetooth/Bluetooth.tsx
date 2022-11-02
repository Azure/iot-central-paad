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
import {BleManager} from './BleManager';
import {Pages} from 'types';
import {Loader, Text} from '../components';
import {useTheme} from '../hooks';
import {Buffer} from 'buffer';
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
      const bleManager = BleManager.getInstance();

      const sub = bleManager.onStateChange(s => {
        if (s === State.PoweredOn) {
          sub.remove();

          bleManager.startDeviceScan(null, {scanMode: 2}, (e, device) => {
            if (e) {
              console.error(
                e,
                e.message,
                e.reason,
                e.androidErrorCode,
                e.errorCode,
                e.attErrorCode,
              );
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

function tempEnable(_value?: boolean) {}
function tempSendInterval(_i: number) {}

function BluetoothDetail({
  route: {
    params: {deviceId},
  },
}: StackScreenProps<BluetoothStackParamList, typeof Pages.BLUETOOTH_DETAIL>) {
  //   const [device, setDevice] = React.useState<Device>();
  const [data, setData] = React.useState<any>(null);

  const onDeviceRead = React.useCallback((device: Device) => {
    if (device?.name?.startsWith('Govee') && device.manufacturerData) {
      const buf = Buffer.from(device.manufacturerData, 'base64');
      if (buf.toString('ascii').includes('INTELLI_ROCKS')) {
        return;
      }

      // 88 ec 00 14 09 3b 0e 64 02
      // 0  1  2 [3  4] [5  6] [7]  8
      //          ^      ^      ^
      //          temp   hum    batt

      const temp = buf.readInt16LE(3) / 100;
      const humidity = buf.readInt16LE(5) / 100;
      const battery = buf.readUint8(7);

      setData({
        name: device.name,
        temp,
        humidity,
        battery,
        rssi: device.rssi,
      });
    } else if (device.manufacturerData) {
      setData({
        name: device.name,
        rssi: device.rssi,
      });
    }
  }, []);

  React.useEffect(() => {
    const bleManager = BleManager.getInstance();
    bleManager.startDeviceScan(null, {scanMode: 2}, (e, d) => {
      if (e) {
        console.error(e);
      }

      if (d?.id === deviceId) {
        onDeviceRead(d);
      }
    });
  }, [deviceId, onDeviceRead]);

  if (!data) {
    return <Loader visible message="Scanning for device" />;
  }

  return (
    <>
      <Text style={{fontSize: 20, textAlign: 'center', marginTop: 10}}>
        {data.name}
      </Text>
      <CardView
        items={[
          data.temp && {
            id: 'temp',
            name: 'Temperature',
            enabled: true,
            simulated: false,
            enable: tempEnable,
            sendInterval: tempSendInterval,
            dataType: 'number',
            value: data.temp,
            unit: '°C',
          },
          data.humidity && {
            id: 'humidity',
            name: 'Humidity',
            enabled: true,
            simulated: false,
            enable: tempEnable,
            sendInterval: tempSendInterval,
            dataType: 'number',
            value: data.humidity,
            unit: '%',
          },
          {
            id: 'rssi',
            name: 'RSSI',
            enabled: true,
            simulated: false,
            enable: tempEnable,
            sendInterval: tempSendInterval,
            dataType: 'number',
            value: data.rssi,
            unit: 'dBm',
          },
          data.battery && {
            id: 'battery',
            name: 'Battery',
            enabled: true,
            simulated: false,
            enable: tempEnable,
            sendInterval: tempSendInterval,
            dataType: 'number',
            value: data.battery,
            unit: '%',
          },
        ].filter(Boolean)}
      />
    </>
    // <View>
    //     <Text>{device.name}</Text>
    //     { data !== null &&
    //         <>
    //             <Text>Temperature: {data.temp} °C</Text>
    //             <Text>Humidity: {data.humidity}%</Text>
    //             <Text>Battery: {data.battery}%</Text>
    //             <Text>RSSI: {data.rssi}</Text>
    //             <Text>TX Power Level: {data.tx}</Text>
    //         </>
    //     }
    //     <Text></Text>
    // </View>
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
