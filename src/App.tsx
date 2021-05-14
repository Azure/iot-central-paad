import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
} from 'react';
import {View, Platform, Alert} from 'react-native';
import Settings from './Settings';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  RouteProp,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  Screens,
  NavigationScreens,
  NavigationParams,
  NavigationProperty,
  ScreenNames,
  DATA_AVAILABLE_EVENT,
  TELEMETRY,
  PROPERTY,
  ENABLE_DISABLE_COMMAND,
  SET_FREQUENCY_COMMAND,
  ItemProps,
  LIGHT_TOGGLE_COMMAND,
  Pages,
  PagesNavigator,
  NavigationPages,
  // ChartType,
} from 'types';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  LogsProvider,
  StorageProvider,
  IoTCProvider,
  ThemeProvider,
  StorageContext,
} from 'contexts';
import LogoLight from './assets/IoT-Plug-And-Play_Dark.svg';
import LogoDark from './assets/IoT-Plug-And-Play_Light.svg';
import {Icon} from 'react-native-elements';
import {createStackNavigator} from '@react-navigation/stack';
import {Text} from './components/typography';
import {Welcome} from './Welcome';
import Logs from './Logs';
import {
  IIcon,
  useConnectIoTCentralClient,
  useDeliveryInterval,
  useIoTCentralClient,
  useLogger,
  useProperties,
  useSensors,
  useSimulation,
  useTheme,
  useThemeMode,
} from 'hooks';
import FileUpload from './FileUpload';
import {Registration} from './Registration';
import CardView from './CardView';
import {Loader} from './components/loader';
import {
  IIoTCCommand,
  IIoTCCommandResponse,
  IIoTCProperty,
  IoTCClient,
  IOTC_EVENTS,
} from 'react-native-azure-iotcentral-client';
// import { AVAILABLE_SENSORS } from 'sensors';
import Torch from 'react-native-torch';
import Chart from 'Chart';
import Strings, {resolveString} from 'strings';
import {Option} from 'components/options';
import Options from 'components/options';
import HeaderCloseButton from 'components/headerCloseButton';

const Tab = createBottomTabNavigator<NavigationScreens>();
const Stack = createStackNavigator<NavigationPages>();

export default function App() {
  const [initialized, setInitialized] = useState(false);
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <IoTCProvider>
          <StorageProvider>
            <LogsProvider>
              {initialized ? (
                <Navigation />
              ) : (
                <Welcome
                  title={Strings.Title}
                  setInitialized={setInitialized}
                />
              )}
            </LogsProvider>
          </StorageProvider>
        </IoTCProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const Navigation = React.memo(() => {
  const {mode, type: themeType, setThemeMode} = useThemeMode();
  const [simulated] = useSimulation();
  const {credentials, initialized} = useContext(StorageContext);
  const [deliveryInterval, setDeliveryInterval] = useDeliveryInterval();
  const [connect, , , {client, loading}] = useConnectIoTCentralClient();

  useEffect(() => {
    if (credentials && initialized && !client) {
      connect(credentials, {restore: true});
    }
  }, [connect, client, credentials, initialized]);

  return (
    <NavigationContainer theme={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        initialRouteName={simulated || client ? Pages.ROOT : Pages.REGISTRATION}
        screenOptions={({navigation, route}) => {
          const defaultOptions = {
            gestureEnabled: false,
            headerBackTitleVisible: false,
          };
          if (
            route.name === Pages.ROOT ||
            (route.name === Pages.REGISTRATION && !route.params?.previousScreen)
          ) {
            return {
              ...defaultOptions,
              headerTitle: () => null,
              headerLeft: () => <Logo />,
              headerRight: () => <Profile navigate={navigation.navigate} />,
            };
          }
          return defaultOptions;
        }}>
        {/* @ts-ignore */}
        <Stack.Screen name={Pages.ROOT} component={Root} />
        <Stack.Screen
          name={Pages.REGISTRATION}
          component={Registration}
          // options={({ route, navigation }) => {
          //   if (!route.params || !(route.params as any).previousScreen) {
          //     return {
          //       headerTitle: () => null,
          //       headerLeft: () => <Logo />,
          //       headerRight: () => <Profile navigate={navigation.navigate} />,
          //     };
          //   }
          //   return {};
          // }}
          // options={({ navigation }: { navigation: NavigationProperty }) => {
          //   return {
          //     stackAnimation: 'flip',
          //     headerTitle: Platform.select({
          //       ios: undefined,
          //       android: '',
          //     }),
          //     headerLeft: () => (
          //       <BackButton goBack={navigation.goBack} title="Settings" />
          //     ),
          //     headerRight: () => (null)
          //   }
          // }}
        />
        <Stack.Screen
          name={Pages.INSIGHT}
          component={Chart}
          options={({route}) => {
            let data = {};
            if (route.params) {
              const params = route.params as NavigationParams;
              if (params.title) {
                data = {...data, headerTitle: params.title};
              }
              if (params.backTitle) {
                data = {...data, headerBackTitle: params.backTitle};
              }
            }
            return data;
          }}
        />
        <Stack.Screen name={Pages.SETTINGS} component={Settings} />
        <Stack.Screen
          name={Pages.THEME}
          options={({navigation}: {navigation: NavigationProperty}) => ({
            stackAnimation: 'flip',
            headerTitle: Platform.select({
              ios: undefined,
              android: '',
            }),
            headerLeft: () => (
              <HeaderCloseButton
                goBack={navigation.goBack}
                title={Pages.SETTINGS}
              />
            ),
          })}>
          {() => (
            <Options
              items={[
                {
                  id: 'DEVICE',
                  name: Strings.Settings.Theme.Device.Name,
                  details: Strings.Settings.Theme.Device.Detail,
                },
                {
                  id: 'DARK',
                  name: Strings.Settings.Theme.Dark.Name,
                  details: Strings.Settings.Theme.Dark.Detail,
                },
                {
                  id: 'LIGHT',
                  name: Strings.Settings.Theme.Light.Name,
                  details: Strings.Settings.Theme.Light.Detail,
                },
              ]}
              defaultId={themeType}
              onChange={(item: Option) => {
                setThemeMode(item.id);
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name={Pages.INTERVAL}
          options={({navigation}: {navigation: NavigationProperty}) => ({
            stackAnimation: 'flip',
            headerTitle: Platform.select({
              ios: undefined,
              android: '',
            }),
            headerLeft: () => (
              <HeaderCloseButton
                goBack={navigation.goBack}
                title={Pages.SETTINGS}
              />
            ),
          })}>
          {() => (
            <Options
              items={[
                {
                  id: '2',
                  name: Strings.Settings.DeliveryInterval[2],
                },
                {
                  id: '5',
                  name: Strings.Settings.DeliveryInterval[5],
                },
                {
                  id: '10',
                  name: Strings.Settings.DeliveryInterval[10],
                },
                {
                  id: '30',
                  name: Strings.Settings.DeliveryInterval[30],
                },
                {
                  id: '45',
                  name: Strings.Settings.DeliveryInterval[45],
                },
              ]}
              defaultId={`${deliveryInterval}`}
              onChange={async (item: Option) => {
                await setDeliveryInterval(+item.id);
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
      <Loader
        visible={loading}
        modal={true}
        message={Strings.Registration.Connection.Loading}
      />
    </NavigationContainer>
  );
});

const Root = React.memo<{
  route: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    `Root`
  >;
  navigation: PagesNavigator;
}>(({navigation}) => {
  const [, append] = useLogger();
  const [sensors, addSensorListener, removeSensorListener] = useSensors();
  // const [healths, addHealthListener, removeHealthListener] = useHealth();
  const {
    loading: propertiesLoading,
    properties,
    updateProperty,
  } = useProperties();
  const [simulated] = useSimulation();

  const onConnectionRefresh = useCallback(
    async (client: IoTCClient) => {
      await client.fetchTwin();
      await client.sendProperty({
        [PROPERTY]: {
          __t: 'c',
          ...properties.reduce((obj, p) => ({...obj, [p.id]: p.value}), {}),
        },
      });
    },
    [properties],
  );
  const [iotcentralClient] = useIoTCentralClient(onConnectionRefresh);

  const iconsRef = useRef<{[x in ScreenNames]: IIcon}>({
    [Screens.TELEMETRY_SCREEN]: Platform.select({
      ios: {
        name: 'stats-chart-outline',
        type: 'ionicon',
      },
      android: {
        name: 'chart-bar',
        type: 'material-community',
      },
    }) as IIcon,
    [Screens.PROPERTIES_SCREEN]: Platform.select({
      ios: {
        name: 'create-outline',
        type: 'ionicon',
      },
      android: {
        name: 'playlist-edit',
        type: 'material-community',
      },
    }) as IIcon,
    [Screens.HEALTH_SCREEN]: {
      name: 'heartbeat',
      type: 'font-awesome',
    } as IIcon,
    [Screens.FILE_UPLOAD_SCREEN]: Platform.select({
      ios: {
        name: 'cloud-upload-outline',
        type: 'ionicon',
      },
      android: {
        name: 'cloud-upload-outline',
        type: 'material-community',
      },
    }) as IIcon,
    [Screens.LOGS_SCREEN]: Platform.select({
      ios: {
        name: 'console',
        type: 'material-community',
      },
      android: {
        name: 'console',
        type: 'material-community',
      },
    }) as IIcon,
  });

  const icons = iconsRef.current;
  const sensorRef = useRef(sensors);
  // const healthRef = useRef(healths);

  const sendToCentralHandler = useCallback(
    async (componentName: string, id: string, value: any) => {
      if (iotcentralClient && iotcentralClient.isConnected()) {
        await iotcentralClient.sendTelemetry(
          {[id]: value},
          {'$.sub': componentName},
        );
      }
    },
    [iotcentralClient],
  );

  const onCommandUpdate = useCallback(async (command: IIoTCCommand) => {
    let data: any;
    data = JSON.parse(command.requestPayload);

    if (command.name === LIGHT_TOGGLE_COMMAND) {
      const fn = async () => {
        return new Promise<void>(resolve => {
          Torch.switchState(true);
          setTimeout(() => {
            Torch.switchState(false);
            resolve();
          }, data.duration * 1000);
        });
      };
      if (data.pulses && data.pulses > 1) {
        let count = 0;
        const intv: number = setInterval(async () => {
          if (count === data.pulses) {
            clearInterval(intv);
            await command.reply(IIoTCCommandResponse.SUCCESS, 'Executed');
            return;
          }
          await fn();
          count++;
        }, data.duration * 1000 + data.delay); // repeat light on with 1s delay from each other
      } else {
        await fn();
        await command.reply(IIoTCCommandResponse.SUCCESS, 'Executed');
      }
      return;
    }
    if (data.sensor) {
      const sensor = sensorRef.current.find(s => s.id === data.sensor);
      if (sensor) {
        switch (command.name) {
          case ENABLE_DISABLE_COMMAND:
            sensor.enable(data.enable ? data.enable : false);
            await command.reply(IIoTCCommandResponse.SUCCESS, 'Enable');
            break;
          case SET_FREQUENCY_COMMAND:
            sensor.sendInterval(data.interval ? data.interval * 1000 : 5000);
            await command.reply(IIoTCCommandResponse.SUCCESS, 'Frequency');
            break;
        }
      }
    }
  }, []);

  const onPropUpdate = useCallback(
    async (prop: IIoTCProperty) => {
      let {name, value} = prop;
      if (value.__t === 'c') {
        // inside a component: TODO: change sdk
        name = Object.keys(value).filter(v => v !== '__t')[0];
        value = value[name];
      }
      updateProperty(name, value);
      await prop.ack();
    },
    [updateProperty],
  );

  const sendTelemetryHandler = useCallback(
    (id: string, value: any) => sendToCentralHandler(TELEMETRY, id, value),
    [sendToCentralHandler],
  );
  // const sendHealthHandler = useCallback(
  //   (id: string, value: any) => sendToCentralHandler(HEALTH, id, value),
  //   [sendToCentralHandler],
  // );

  useEffect(() => {
    const currentSensorRef = sensorRef.current;
    // const currentHealthRef = healthRef.current;
    if (iotcentralClient) {
      console.log('Device just connected');
      currentSensorRef.forEach(s =>
        addSensorListener(s.id, DATA_AVAILABLE_EVENT, sendTelemetryHandler),
      );
      append({
        eventName: 'INFO',
        eventData: 'Sensor initialized.',
      });

      // currentHealthRef.forEach(h =>
      //   addHealthListener(h.id, DATA_AVAILABLE_EVENT, sendHealthHandler),
      // );
      append({
        eventName: 'INFO',
        eventData: 'Health initialized.',
      });

      append({
        eventName: 'INFO',
        eventData: 'Properties initialized.',
      });
      iotcentralClient.on(IOTC_EVENTS.Commands, onCommandUpdate);
      iotcentralClient.on(IOTC_EVENTS.Properties, onPropUpdate);
      iotcentralClient.fetchTwin();
    }

    return () => {
      currentSensorRef.forEach(s =>
        removeSensorListener(s.id, DATA_AVAILABLE_EVENT, sendTelemetryHandler),
      );
      // currentHealthRef.forEach(h =>
      //   removeHealthListener(h.id, DATA_AVAILABLE_EVENT, sendHealthHandler),
      // );
    };
  }, [
    iotcentralClient,
    // addHealthListener,
    addSensorListener,
    append,
    onCommandUpdate,
    onPropUpdate,
    // removeHealthListener,
    removeSensorListener,
    // sendHealthHandler,
    sendTelemetryHandler,
    navigation,
    simulated,
  ]);

  return (
    <Tab.Navigator
      key="tab"
      tabBarOptions={Platform.select({
        android: {safeAreaInsets: {bottom: 0}},
      })}>
      <Tab.Screen
        name={Screens.TELEMETRY_SCREEN}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Telemetry} color={color} size={size} />
          ),
        }}>
        {getCardView(sensors, 'Telemetry', true)}
      </Tab.Screen>
      {/* <Tab.Screen
        name={Screens.HEALTH_SCREEN}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Health} color={color} size={size} />
          ),
        }}>
        {getCardView(healths, 'Health', true)}
      </Tab.Screen> */}
      <Tab.Screen
        name={Screens.PROPERTIES_SCREEN}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Properties} color={color} size={size} />
          ),
        }}>
        {propertiesLoading
          ? () => (
              <Loader
                message={Strings.Client.Properties.Loading}
                visible={true}
                style={{flex: 1, justifyContent: 'center'}}
              />
            )
          : () => (
              <CardView
                items={properties}
                componentName="Property"
                onEdit={async (item, value) => {
                  try {
                    await iotcentralClient?.sendProperty({
                      [PROPERTY]: {__t: 'c', [item.id]: value},
                    });
                    Alert.alert(
                      'Property',
                      resolveString(
                        Strings.Client.Properties.Delivery.Success,
                        item.name,
                      ),
                      [{text: 'OK'}],
                    );
                  } catch (e) {
                    Alert.alert(
                      'Property',
                      resolveString(
                        Strings.Client.Properties.Delivery.Failure,
                        item.name,
                      ),
                      [{text: 'OK'}],
                    );
                  }
                }}
              />
            )}
      </Tab.Screen>
      <Tab.Screen
        name={Screens.FILE_UPLOAD_SCREEN}
        component={FileUpload}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon
              icon={icons['Image Upload']}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name={Screens.LOGS_SCREEN}
        component={Logs}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Logs} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
});

const getCardView = (items: ItemProps[], name: string, detail: boolean) => ({
  navigation,
}: {
  navigation: any;
}) => (
  <CardView
    items={items}
    componentName={name}
    onItemLongPress={item => {
      item.enable(!item.enabled);
    }}
    // TEMP: temporary disabled charts
    // onItemPress={
    //   detail
    //     ? item => {
    //         navigation.navigate('Insight', {
    //           chartType:
    //             item.id === AVAILABLE_SENSORS.GEOLOCATION
    //               ? ChartType.MAP
    //               : ChartType.DEFAULT,
    //           currentValue: item.value,
    //           telemetryId: item.id,
    //           title: camelToName(item.id),
    //           backTitle: 'Telemetry',
    //         });
    //       }
    //     : undefined
    // }
  />
);

const Logo = React.memo(() => {
  const {colors, dark} = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginHorizontal: 10,
      }}>
      {dark ? (
        <LogoDark width={30} fill={colors.primary} />
      ) : (
        <LogoLight width={30} fill={colors.primary} />
      )}
      <Text
        style={{
          marginStart: 10,
          color: colors.text,
          fontWeight: 'bold',
          fontSize: 16,
          letterSpacing: 0.1,
        }}>
        {Strings.Title}
      </Text>
    </View>
  );
});

const Profile = React.memo((props: {navigate: any}) => {
  const {colors} = useTheme();
  return (
    <View style={{marginHorizontal: 10}}>
      <Icon
        style={{marginEnd: 20}}
        name={
          Platform.select({
            ios: 'settings-outline',
            android: 'settings',
          }) as string
        }
        type={Platform.select({ios: 'ionicon', android: 'material'})}
        color={colors.text}
        onPress={() => {
          props.navigate(Pages.SETTINGS);
        }}
      />
    </View>
  );
});

const TabBarIcon = React.memo<{icon: IIcon; color: string; size: number}>(
  ({icon, color, size}) => {
    return (
      <Icon
        name={icon ? icon.name : 'home'}
        type={icon ? icon.type : 'ionicon'}
        size={size}
        color={color}
      />
    );
  },
);
