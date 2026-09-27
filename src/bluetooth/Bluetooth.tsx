import {createStackNavigator, StackScreenProps} from '@react-navigation/stack';
import {Icon} from '@rneui/themed';
import * as React from 'react';
import {
  Animated,
  View,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {Device, UUID} from 'react-native-ble-plx';
import {useIsFocused} from '@react-navigation/native';
import {IotcBleManager} from './BleManager';
import {ItemProps, Pages} from 'types';
import {Text} from '../components';
import DetailsAction from '../components/detailsAction';
import {surfaceColor} from '../components/surface';
import {useIoTCentralClient, useTheme} from '../hooks';
import {useMotionAllowed} from '../hooks/motion';
import {usePressSettle} from '../hooks/press';
import CardView from 'CardView';
import Strings from 'strings';
import {cardTint, palette} from '../theme/palette';

type BluetoothStackParamList = {
  [Pages.BLUETOOTH_LIST]: undefined;
  [Pages.BLUETOOTH_DETAIL]: {
    deviceId: UUID;
    deviceName: string;
  };
};

const BluetoothStack = createStackNavigator<BluetoothStackParamList>();

export function BluetoothPage() {
  return (
    <BluetoothStack.Navigator
      initialRouteName={Pages.BLUETOOTH_LIST}
      screenOptions={({route}) => {
        const isListPage: boolean = route.name === Pages.BLUETOOTH_LIST;

        return {
          headerShown: !isListPage,
          headerTitle: route.params?.deviceName ?? Strings.Bluetooth.Title,
          headerTitleAlign: 'left',
          headerBackButtonDisplayMode: 'minimal',
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
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [isVisible, setIsVisible] = React.useState(true);
  const {devices, unavailable} = useBluetoothDevicesList(isVisible);

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

  // The manager reports advertisements and failures, never a scan progress value.
  // "Waiting" means observation is subscribed and nothing has arrived yet; it ends
  // on the first advertisement, on failure, and when the screen stops observing.
  const waiting = isVisible && !unavailable && devices.length === 0;
  const status = unavailable
    ? Strings.Bluetooth.Unavailable
    : waiting
    ? Strings.Bluetooth.Scanning
    : Strings.Bluetooth.Observing;

  return (
    <View style={[styles.container, {backgroundColor: appearance.background}]}>
      <View style={styles.heading}>
        <Text
          testID="bluetooth-tool-title"
          accessibilityRole="header"
          style={styles.title}>
          {Strings.Bluetooth.Title}
        </Text>
        <Text style={[styles.description, {color: appearance.muted}]}>
          {Strings.Bluetooth.Description}
        </Text>
      </View>
      <ScanStatus
        id="bluetooth-scan-status"
        icon={unavailable ? 'bluetooth-off' : 'bluetooth'}
        label={status}
        waiting={waiting}
        action={<ScanAgainControl />}
      />
      <FlatList<Device>
        data={devices}
        keyExtractor={device => device.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          unavailable && devices.length > 0 ? (
            <Text style={[styles.notice, {color: appearance.danger}]}>
              {Strings.Bluetooth.UnavailableDetail}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <StatusCard
            icon={unavailable ? 'bluetooth-off' : 'bluetooth'}
            title={
              unavailable
                ? Strings.Bluetooth.Unavailable
                : Strings.Bluetooth.Empty
            }
            description={
              unavailable
                ? Strings.Bluetooth.UnavailableDetail
                : Strings.Bluetooth.ScanningDetail
            }
          />
        }
        renderItem={({item}) => (
          <BluetoothDeviceListItem item={item} navigation={navigation} />
        )}
        refreshControl={
          // Pull to refresh clears the observed list; the manager keeps scanning,
          // so the control returns immediately instead of spinning without end.
          <RefreshControl
            refreshing={false}
            onRefresh={() => IotcBleManager.getInstance().resetDeviceList()}
            colors={[colors.text]}
            tintColor={appearance.muted}
          />
        }
      />
    </View>
  );
}

/** A decorative indicator only while this screen is genuinely waiting for data. */
function ScanStatus({
  id,
  icon,
  label,
  waiting,
  action,
}: {
  id: string;
  icon: string;
  label: string;
  waiting: boolean;
  action?: React.ReactNode;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const animated = useMotionAllowed(waiting);
  return (
    <View testID={id} style={styles.status}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.statusGlyph}>
        {waiting && animated ? (
          <ActivityIndicator size="small" color={appearance.primary} />
        ) : (
          <Icon
            name={icon}
            type="material-community"
            size={20}
            color={waiting ? appearance.primary : appearance.muted}
          />
        )}
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.statusText, {color: appearance.muted}]}>
        {label}
      </Text>
      {action}
    </View>
  );
}

function StatusCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <View style={[styles.empty, {backgroundColor: appearance.tints[1]}]}>
      <View
        accessible={false}
        style={[styles.emptyIcon, {backgroundColor: appearance.surface}]}>
        <Icon
          name={icon}
          type="material-community"
          size={30}
          color={appearance.text}
        />
      </View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={[styles.emptyDescription, {color: appearance.muted}]}>
        {description}
      </Text>
    </View>
  );
}

interface BluetoothDeviceListItemProps {
  item: Device;
  navigation: BluetoothListProps['navigation'];
}

function BluetoothDeviceListItem({
  item,
  navigation,
}: BluetoothDeviceListItemProps) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const signal =
    item.rssi == null
      ? Strings.Bluetooth.SignalUnavailable
      : `${item.rssi} dBm`;
  const {pressed, scale, onPressIn, onPressOut} = usePressSettle('card');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name ?? ''}, ${signal}`}
      onPress={() => {
        navigation.navigate(Pages.BLUETOOTH_DETAIL, {
          deviceId: item.id,
          deviceName: item.name ?? '',
        });
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.deviceRow}>
      <Animated.View
        style={[
          styles.deviceCard,
          {
            backgroundColor: surfaceColor(dark, {tone: 'raised', pressed}),
            borderColor: appearance.surfaceBorder,
            transform: [{scale}],
          },
        ]}>
        <View
          accessible={false}
          style={[
            styles.deviceIcon,
            {backgroundColor: cardTint(item.id, dark)},
          ]}>
          <Icon
            name="bluetooth"
            type="material-community"
            size={20}
            color={appearance.text}
          />
        </View>
        <View style={styles.deviceBody}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={[styles.rssiText, {color: appearance.muted}]}>
            {signal}
          </Text>
        </View>
        <View accessible={false}>
          <Icon
            name="chevron-right"
            type="material-community"
            size={20}
            color={appearance.muted}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function useBluetoothDevicesList(shouldScan: boolean) {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [unavailable, setUnavailable] = React.useState(false);
  const [revision, refresh] = React.useReducer(value => value + 1, 0);
  const deviceMap = React.useRef<Map<UUID, Device> | null>(null);

  if (deviceMap.current === null) {
    deviceMap.current = new Map();
  }

  const bleManager = IotcBleManager.getInstance();

  React.useEffect(() => {
    if (!shouldScan) {
      return;
    }
    setUnavailable(false);
    bleManager.setResetDeviceListCallback(() => {
      deviceMap.current?.clear();
      setDevices([]);
      refresh();
    });
    const subscription = bleManager.observeAdvertisements(
      device => {
        if (!device.name) {
          return;
        }
        setUnavailable(false);
        deviceMap.current?.set(device.id, device);
        setDevices(Array.from(deviceMap.current?.values() ?? []));
      },
      () => setUnavailable(true),
    );
    return () => {
      subscription.remove();
      bleManager.setResetDeviceListCallback(() => {});
    };
  }, [bleManager, shouldScan, revision]);

  return {devices, unavailable};
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
  const focused = useIsFocused();
  const [unavailable, setUnavailable] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      return;
    }
    const bleManager = IotcBleManager.getInstance();
    const subscription = bleManager.observeAdvertisements(
      device => {
        if (device.id !== deviceId) {
          return;
        }

        const model = bleManager.getModelForDevice(device);

        const deviceData = model.onScan(device);
        if (!deviceData) {
          return;
        }

        const itemProps = model.getItemProps(deviceData);

        setUnavailable(false);
        void Promise.resolve(iotcentralClient?.sendTelemetry(deviceData)).catch(
          () => {},
        );
        void Promise.resolve(
          iotcentralClient?.sendProperty({bleDeviceName: device.name}),
        ).catch(() => {});

        setData(
          itemProps.map(item => ({
            ...item,
            sendInterval(_value) {},
            enable(_value) {},
          })),
        );
      },
      () => setUnavailable(true),
    );
    return () => subscription.remove();
  }, [deviceId, iotcentralClient, focused]);

  const {dark} = useTheme();
  const appearance = palette(dark);
  if (unavailable || !(deviceName && items)) {
    return (
      <ScrollView
        style={[styles.page, {backgroundColor: appearance.background}]}
        contentContainerStyle={styles.pageBody}>
        <ScanStatus
          id="bluetooth-detail-status"
          icon={unavailable ? 'bluetooth-off' : 'bluetooth'}
          label={
            unavailable
              ? Strings.Bluetooth.Unavailable
              : Strings.Bluetooth.Waiting
          }
          waiting={!unavailable && focused}
        />
        <View style={styles.pageContent}>
          <StatusCard
            icon={unavailable ? 'bluetooth-off' : 'bluetooth'}
            title={
              unavailable
                ? Strings.Bluetooth.Unavailable
                : Strings.Bluetooth.NoReadings
            }
            description={
              unavailable
                ? Strings.Bluetooth.UnavailableDetail
                : Strings.Bluetooth.WaitingDetail
            }
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <CardView items={items} />
    </>
  );
}

function ScanAgainControl() {
  return (
    <DetailsAction
      id="bluetooth-scan-again"
      label={Strings.Bluetooth.Refresh}
      accessibilityLabel={Strings.Bluetooth.Refresh}
      icon="reload"
      variant="secondary"
      style={styles.scanAgain}
      onPress={() => {
        IotcBleManager.getInstance().resetDeviceList();
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {flex: 1},
  pageBody: {flexGrow: 1, paddingVertical: 16},
  pageContent: {paddingHorizontal: 20},
  heading: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 5},
  title: {fontSize: 24, lineHeight: 31, fontWeight: '600'},
  description: {fontSize: 13, lineHeight: 20},
  status: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  statusGlyph: {width: 24, alignItems: 'center', justifyContent: 'center'},
  statusText: {flex: 1, minWidth: 140, fontSize: 13, lineHeight: 19},
  scanAgain: {
    minWidth: 48,
    maxWidth: '100%',
  },
  listContent: {paddingHorizontal: 20, paddingBottom: 24},
  deviceRow: {marginBottom: 12},
  deviceCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceBody: {flex: 1, minWidth: 0, gap: 2},
  notice: {marginBottom: 16, fontSize: 14, lineHeight: 21},
  empty: {borderRadius: 24, padding: 28, alignItems: 'center', gap: 14},
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {fontSize: 14, lineHeight: 21, textAlign: 'center'},
  item: {
    gap: 6,
  },
  itemTitle: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 23,
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
    fontSize: 13,
    lineHeight: 19,
  },
});
