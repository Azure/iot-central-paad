/* eslint-disable react/no-unstable-nested-components */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useState, useEffect, useContext, useRef} from 'react';
import {Animated, View, Platform, Pressable, StyleSheet} from 'react-native';
import Settings from './Settings';
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
  useTheme as useNavigationTheme,
} from '@react-navigation/native';
import {
  NavigationParams,
  Pages,
  NavigationPages,
  RegistrationScreens,
  // ChartType,
} from 'types';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  LogsProvider,
  StorageProvider,
  IoTCProvider,
  ThemeProvider,
  StorageContext,
  IoTCContext,
} from 'contexts';
import {Icon} from '@rneui/themed';
import {createStackNavigator} from '@react-navigation/stack';
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
import {TorchCameraHost} from './tools/Torch';
import BrandTitle from './components/brandTitle';
import PhoneMark from './components/phoneMark';
import {surfaceColor} from './components/surface';
import {usePressSettle} from './hooks/press';
import {palette} from './theme/palette';

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
              <TorchCameraHost />
            </LogsProvider>
          </StorageProvider>
        </IoTCProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const Navigation = React.memo(() => {
  const {type: themeType, setThemeMode} = useThemeMode();
  const {credentials, initialized} = useContext(StorageContext);
  const {registeringNew} = useContext(IoTCContext);
  const [deliveryInterval, setDeliveryInterval] = useDeliveryInterval();
  const [connect, cancel, , {client, loading, stage}] =
    useConnectIoTCentralClient();
  const [simulated] = useSimulation();
  const restored = useRef(false);

  const {colors} = useTheme();
  const navigationTheme = useNavigationTheme();

  useEffect(() => {
    if (!initialized || loading || restored.current) {
      return;
    }
    // Restore once per launch, never after an explicit disconnect or failed save.
    restored.current = true;
    if (credentials && !client) {
      connect(credentials, {restore: true});
    }
  }, [connect, client, credentials, initialized, loading]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <View
        testID="navigation-content"
        style={{flex: 1}}
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
        <Stack.Navigator
          initialRouteName={simulated ? Pages.ROOT : Pages.REGISTRATION}
          screenOptions={({navigation, route}) => {
            const childRoute = getFocusedRouteNameFromRoute(route);
            const registrationHasHeader =
              route.name === Pages.REGISTRATION &&
              (childRoute === RegistrationScreens.QR ||
                (childRoute === RegistrationScreens.MANUAL &&
                  (registeringNew || !client?.isConnected())));
            const defaultOptions = {
              gestureEnabled: false,
              headerBackButtonDisplayMode: 'minimal' as const,
              headerShown: !registrationHasHeader,
              headerStyle: {backgroundColor: colors.background},
              headerShadowVisible: false,
              headerTintColor: colors.text,
              headerTitleStyle: styles.logoText,
            };
            if (
              route.name === Pages.ROOT ||
              (route.name === Pages.REGISTRATION &&
                !route.params?.previousScreen)
            ) {
              return {
                ...defaultOptions,
                headerShown: !registrationHasHeader,
                headerTitle: () => <BrandTitle />,
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
          {/* @ts-ignore */}
          <Stack.Screen name={Pages.REGISTRATION} component={Registration} />
          <Stack.Screen
            name={Pages.INSIGHT}
            //@ts-ignore
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
      </View>
      <Loader
        visible={loading}
        modal={true}
        nativeModal={false}
        message={Strings.Connection.Stages[stage]}
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

export const Logo = React.memo(function HeaderLogo() {
  return (
    <View
      testID="app-header-logo"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.logoContainer}>
      <PhoneMark />
    </View>
  );
});

export const Profile = React.memo((props: {navigate: any}) => {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const {pressed, scale, onPressIn, onPressOut} = usePressSettle('compact');
  return (
    <Pressable
      testID="app-settings"
      accessibilityRole="button"
      accessibilityLabel={Strings.Settings.Title}
      onPress={() => props.navigate(Pages.SETTINGS)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={4}
      style={styles.settingsButton}>
      <Animated.View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.settingsPlate,
          {
            backgroundColor: surfaceColor(dark, {
              tone: 'secondary',
              pressed,
            }),
            borderColor: appearance.surfaceBorder,
            transform: [{scale}],
          },
        ]}>
        <Icon
          name={
            Platform.select({
              ios: 'settings-outline',
              android: 'settings',
            }) as string
          }
          type={Platform.select({ios: 'ionicon', android: 'material'})}
          color={appearance.primary}
          size={20}
        />
      </Animated.View>
    </Pressable>
  );
});

export const styles = StyleSheet.create({
  logoContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
    marginRight: 8,
  },
  logoText: {
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: -0.2,
  },
  settingsButton: {
    minWidth: 48,
    minHeight: 48,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPlate: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
