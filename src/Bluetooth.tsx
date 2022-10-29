import { ListItem } from '@rneui/themed';
import * as React from 'react';
import { View, FlatList, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { useTheme } from './hooks';

const bleManager = new BleManager();

interface IBluetoothDeviceListItem {
    name: string;

}

export function BluetoothPage() {
    const {colors} = useTheme();
    const {devices} = useBluetoothDevices();

    return (
        <View style={styles.container}>
            <FlatList<Device>
                data={devices}
                renderItem={({item}) => <BluetoothDeviceListItem item={item} colors={colors} />}
            />
        </View>
    );
}

interface BluetoothDeviceListItemProps {
    item: Device;
    colors: ReturnType<typeof useTheme>['colors'],
}

function BluetoothDeviceListItem({item, colors}: BluetoothDeviceListItemProps) {
    return (
        <ListItem
            bottomDivider
            style={{
                backgroundColor: colors.card,
            }}
        >
            <ListItem.Content
                style={{
                    ...styles.item,
                    backgroundColor: colors.card,
                }}
            >
                <ListItem.Title style={{color: colors.text}}>
                    {item.name}
                </ListItem.Title>
                <ListItem.Subtitle style={{color: colors.text}}>
                    {item.id}
                </ListItem.Subtitle>
            </ListItem.Content>
        </ListItem>
    )
}

function useBluetoothDevices() {
    const [devices, setDevices] = React.useState<Device[]>([]);
    const seenIds = React.useRef<Set<string> | null>(null);

    if (seenIds.current === null) {
        seenIds.current = new Set();
    }

    React.useEffect(() => {
        (async function() {
            if (Platform.OS === 'android') {
                console.log('REQUESTING PERMS');
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Bluetooth Permission',
                        message: `Application would like to use bluetooth and location permissions`,
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );

                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    throw new Error("Permission rejected");
                }
            }
        
            const sub = bleManager.onStateChange(s => {
                if (s === State.PoweredOn) {
                sub.remove();

                bleManager.startDeviceScan(null, {scanMode: 2}, (e, device) => {
                    if (!device?.name) {
                        return;
                    }

                    if (!seenIds.current?.has(device.id)) {
                        seenIds.current?.add(device.id);
                        setDevices(prev => [...prev, device]);
                    }

                    // if (device?.name?.startsWith('Govee') && device.manufacturerData) {
                    //     // console.log('manufacturer data: ', device.manufacturerData);
                    //     const buf = Buffer.from(device.manufacturerData, 'base64');
                    //     if (buf.toString('ascii').includes('INTELLI_ROCKS')) {
                    //         return;
                    //     }

                    //     // 88 ec 00 14 09 3b 0e 64 02
                    //     // 0  1  2 [3  4] [5  6] [7]  8
                    //     //          ^      ^      ^
                    //     //          temp   hum    batt

                    //     const temp = buf.readInt16LE(3) / 100;
                    //     const humidity = buf.readInt16LE(5) / 100;
                    //     const battery = buf.readUint8(7);
                    //     // console.log(device.manufacturerData)
                    //     console.log({platform: Platform.OS, temp, humidity, battery, rssi: device.rssi});
                    // }
                });
            }
        }, true);
    })();
  }, [setDevices]);

  return {devices};
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