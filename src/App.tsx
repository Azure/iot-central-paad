import React, {useContext, useEffect, useState, useRef} from 'react';
import {View, Platform} from 'react-native';
import Settings from './Settings';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  useTheme,
} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  Screens,
  NavigationScreens,
  NavigationParams,
  NavigationProperty,
  ScreenNames,
} from './types';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  LogsProvider,
  StorageProvider,
  IoTCProvider,
  ThemeProvider,
  ThemeContext,
  StorageContext,
  ThemeMode,
} from 'contexts';
import LogoIcon from './assets/IotcLogo.svg';
import Telemetry from './Telemetry';
import {Icon} from 'react-native-elements';
import Property from './Property';
import {createStackNavigator, HeaderTitle} from '@react-navigation/stack';
import {Text} from './components/typography';
import Insight from './Insight';
import {Welcome} from './Welcome';
import HealthPlatform from './HealthPlatform';
import Logs from './Logs';
import {IIcon} from 'hooks';
import {Log} from 'tools';
import FileUpload from './FileUpload';

const Tab = createBottomTabNavigator<NavigationScreens>();
const Stack = createStackNavigator();

export default function App() {
  const [initialized, setInitialized] = useState(false);
  if (initialized) {
    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <LogsProvider>
            <StorageProvider>
              <IoTCProvider>
                <Navigation />
              </IoTCProvider>
            </StorageProvider>
          </LogsProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }
  return <Welcome setInitialized={setInitialized} />;
}

const Navigation = React.memo(() => {
  const {mode} = useContext(ThemeContext);
  return (
    <NavigationContainer
      theme={mode === ThemeMode.DARK ? DarkTheme : DefaultTheme}>
      <Stack.Navigator>
        {/* @ts-ignore */}
        <Stack.Screen
          name="root"
          options={({navigation}: {navigation: NavigationProperty}) => ({
            headerTitle: () => null,
            headerLeft: () => <Logo />,
            headerRight: () => <Profile navigate={navigation.navigate} />,
          })}
          component={Root}
        />
        <Stack.Screen
          name="Insight"
          component={Insight}
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
        <Stack.Screen
          name="Settings"
          options={({navigation}: {navigation: NavigationProperty}) => ({
            stackAnimation: 'flip',
            headerTitle: Platform.select({
              ios: undefined,
              android: '',
            }),
            headerLeft: () => (
              <BackButton goBack={navigation.goBack} title="Settings" />
            ),
          })}
          component={Settings}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
});

const Root = React.memo(() => {
  const {credentials, simulated} = useContext(StorageContext);
  // const { connect, addListener, removeListener } = useContext(IoTCContext);
  // const { append } = useContext(LogsContext);

  // const prevCredentials = usePrevious(credentials);

  // connect client if credentials are retrieved

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

  useEffect(() => {
    Log(`Simulated: ${simulated}. Credentials: ${credentials}`);
    // if (!simulated) {
    //   addListener(LOG_DATA, append);
    //   try {
    //     connect(credentials);
    //   } catch (ex) {
    //     console.log('Connection failed');
    //   }
    // }
    // return () => removeListener(LOG_DATA, append);
  }, [credentials, simulated]);

  const icons = iconsRef.current;
  console.log(`Rerender`);
  return (
    <Tab.Navigator
      key="tab"
      tabBarOptions={Platform.select({
        android: {safeAreaInsets: {bottom: 0}},
      })}>
      <Tab.Screen
        name={Screens.TELEMETRY_SCREEN}
        component={Telemetry}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Telemetry} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name={Screens.HEALTH_SCREEN}
        component={HealthPlatform}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Health} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name={Screens.PROPERTIES_SCREEN}
        component={Property}
        options={{
          tabBarIcon: ({color, size}) => (
            <TabBarIcon icon={icons.Properties} color={color} size={size} />
          ),
        }}
      />
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

const Logo = React.memo(() => {
  const {colors} = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginHorizontal: 10,
      }}>
      <LogoIcon width={30} fill={colors.primary} />
      <Text
        style={{
          marginStart: 10,
          color: colors.text,
          fontWeight: 'bold',
          fontSize: 16,
          letterSpacing: 0.1,
        }}>
        Azure IoT Central
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
          props.navigate('Settings');
        }}
      />
    </View>
  );
});

const BackButton = React.memo((props: {goBack: any; title: string}) => {
  const {colors} = useTheme();
  const {goBack, title} = props;
  return (
    <View style={{flexDirection: 'row', marginLeft: 10, alignItems: 'center'}}>
      <Icon name="close" color={colors.text} onPress={goBack} />
      {Platform.OS === 'android' && (
        <HeaderTitle style={{marginLeft: 20}}>{title}</HeaderTitle>
      )}
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
