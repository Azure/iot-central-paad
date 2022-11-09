/* eslint-disable react/no-unstable-nested-components */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useState, useEffect, useContext} from 'react';
import {View, Platform, StyleSheet} from 'react-native';
import Settings from './Settings';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import {
  NavigationParams,
  Pages,
  NavigationPages,
  Screens,
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
import {Icon} from '@rneui/themed';
import {createStackNavigator} from '@react-navigation/stack';
import {Text} from './components/typography';
import {Welcome} from './Welcome';
import Home from './Home';
import {
  useConnectIoTCentralClient,
  useDeliveryInterval,
  useSimulation,
  useTheme,
  useThemeMode,
} from 'hooks';
import {Registration} from './Registration';
import {Loader} from './components/loader';
import Chart from 'Chart';
import Strings from 'strings';
import {Option} from 'components/options';
import Options from 'components/options';

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
  const {credentials, initialized} = useContext(StorageContext);
  const [deliveryInterval, setDeliveryInterval] = useDeliveryInterval();
  const [connect, cancel, , {client, loading}] = useConnectIoTCentralClient();
  const [simulated] = useSimulation();

  const {colors} = useTheme();

  useEffect(() => {
    if (credentials && initialized && !client) {
      connect(credentials, {restore: true});
    }
  }, [connect, client, credentials, initialized]);

  return (
    <NavigationContainer theme={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        initialRouteName={simulated ? Pages.ROOT : Pages.REGISTRATION}
        screenOptions={({navigation, route}) => {
          // console.log(getFocusedRouteNameFromRoute(route));
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
              headerShown:
                getFocusedRouteNameFromRoute(route) !== Screens.BLUETOOTH_STACK,
              headerTitle: () => (
                <Text
                  style={{
                    ...styles.logoText,
                    color: colors.text,
                  }}>
                  {Strings.Title}
                </Text>
              ),
              headerTitleAlign: 'left',
              headerLeft: () => <Logo />,
              headerRight: () => (
                <View style={styles.headerButtons}>
                  <Profile navigate={navigation.navigate} />
                </View>
              ),
            };
          }
          return defaultOptions;
        }}>
        {/* @ts-ignore */}
        <Stack.Screen name={Pages.ROOT} component={Home} />
        <Stack.Screen name={Pages.REGISTRATION} component={Registration} />
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
          options={() => ({
            stackAnimation: 'flip',
            headerTitle: Platform.select({
              ios: undefined,
              android: Pages.THEME,
            }),
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
          options={() => ({
            stackAnimation: 'flip',
            headerTitle: Platform.select({
              ios: undefined,
              android: Pages.INTERVAL,
            }),
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
        buttons={[
          {
            text: Strings.Registration.Connection.Cancel,
            onPress: cancel,
          },
        ]}
      />
    </NavigationContainer>
  );
});

export const Logo = React.memo(function Logo() {
  const {colors, dark} = useTheme();

  return (
    <View style={styles.logoContainer}>
      {dark ? (
        <LogoDark width={30} fill={colors.primary} />
      ) : (
        <LogoLight width={30} fill={colors.primary} />
      )}
    </View>
  );
});

export const Profile = React.memo((props: {navigate: any}) => {
  const {colors} = useTheme();
  return (
    <View style={styles.marginHorizontal10}>
      <Icon
        style={styles.marginEnd20}
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

export const styles = StyleSheet.create({
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 10,
  },
  logoText: {
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.1,
  },
  marginHorizontal10: {
    marginHorizontal: 10,
  },
  marginEnd20: {
    marginEnd: 20,
  },
  marginEnd10: {
    marginEnd: 10,
  },
  headerButtons: {
    flexDirection: 'row',
  },
});
