// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  CommonActions,
  getFocusedRouteNameFromRoute,
  RouteProp,
  StackActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import {
  ConnectionOptions,
  useConnectIoTCentralClient,
  useScreenDimensions,
  useTheme,
  useBoolean,
  usePrevious,
} from 'hooks';
import {
  NavigationParams,
  Pages,
  PagesNavigator,
  StyleDefinition,
} from './types';
import Strings from 'strings';
import {createStackNavigator} from '@react-navigation/stack';
import {
  Form,
  FormItem,
  FormValues,
  HeaderCloseButton,
  QRCodeScanner,
  Event,
  Loader,
  Button,
  Link,
  Name,
  Text,
  ButtonGroup,
  ButtonGroupItem,
} from 'components';
import {Buffer} from 'buffer';
import {computeKey} from 'react-native-azure-iotcentral-client';
import {StorageContext} from 'contexts';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const Stack = createStackNavigator();
const screens = {
  EMPTY: 'EMPTY',
  QR: 'QR',
  MANUAL: 'MANUAL',
};

export const Registration = React.memo<{
  route?: RouteProp<Record<string, NavigationParams>, 'Registration'>;
  navigation?: PagesNavigator;
}>(({navigation: parentNavigator, route}) => {
  const {colors} = useTheme();
  const [
    connect,
    cancel,
    ,
    {client, error, loading},
  ] = useConnectIoTCentralClient();
  const previousLoading = usePrevious(loading);
  const qrcodeRef = useRef<QRCodeScanner>(null);
  const {parentNavigatorKey, parentRoutes} = useNavigationState(state => ({
    parentNavigatorKey: state.key,
    parentRoutes: state.routes,
  }));

  useEffect(() => {
    if (route) {
      const routeName = getFocusedRouteNameFromRoute(route);
      if (
        routeName === screens.QR ||
        routeName === screens.MANUAL ||
        routeName === screens.EMPTY
      ) {
        parentNavigator?.setOptions({
          headerShown: routeName === screens.EMPTY,
        });
      }
    }
  }, [parentNavigator, route]);

  useEffect(() => {
    if (!loading && previousLoading && client && client.isConnected()) {
      // go back to root page. reset navigator in case we're not coming from root page.
      // registration screen must unmount in order to release camera.
      parentNavigator?.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{name: Pages.ROOT}],
        }),
      );
    }
  }, [client, loading, parentNavigator, previousLoading]);

  if (error && loading) {
    Alert.alert(
      'Error',
      'The QR code you have scanned is not an Azure IoT Central Device QR code',
      [
        {
          text: 'Retry',
          onPress: async () => {
            await cancel({clear: false});
            qrcodeRef.current?.reactivate();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: async () => {
            await cancel({clear: false});
            parentNavigator?.dispatch(
              CommonActions.navigate({
                name: screens.EMPTY,
              }),
            );
          },
        },
      ],
      {
        cancelable: false,
      },
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={
        client && client.isConnected() ? screens.MANUAL : screens.EMPTY
      }
      screenOptions={{headerBackTitleVisible: false}}
      headerMode={'float'}>
      <Stack.Screen
        name={screens.EMPTY}
        options={() => ({
          headerShown: false,
          headerLeft: () => (
            <HeaderCloseButton
              goBack={parentNavigator?.goBack}
              title={Pages.REGISTRATION}
            />
          ),
          headerTitle: Pages.REGISTRATION,
        })}
        component={EmptyClient}
      />
      <Stack.Screen
        name={screens.QR}
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: colors.text,
        }}>
        {() => {
          /**
           * ---- UX TWEAK ----
           * All connection screens (qrcode and manual) must run on full screen.
           * If parent navigator is running, hide headers and footers.
           * For "EmptyClient" screen show immediate parent.
           */
          return <QRCodeScreen scannerRef={qrcodeRef} connect={connect} />;
        }}
      </Stack.Screen>
      <Stack.Screen
        name={screens.MANUAL}
        options={() => ({
          headerTitle: Strings.Registration.Manual.Title,
          headerShown: !client || !client.isConnected(), // hide header when connecting and when clearing registration
        })}
        initialParams={{parentNavigatorKey, parentRoutes}}
        component={ManualConnect}
      />
    </Stack.Navigator>
  );
});
const QRCodeScreen = React.memo<{
  connect: (
    encryptedCredentials: string,
    options?: ConnectionOptions,
  ) => Promise<void>;
  scannerRef: React.MutableRefObject<QRCodeScanner | null>;
}>(({connect, scannerRef}) => {
  const {screen, orientation} = useScreenDimensions();
  const {navigate} = useNavigation();

  const onRead = useCallback(
    async (e: Event) => {
      await connect(e.data);
      // scannerRef.current?.reactivate(); // reactivate camera in order to make it available for other use (e.g. torch)
    },
    [connect],
  );
  return (
    <QRCodeScanner
      onRead={onRead}
      ref={scannerRef}
      width={screen.width}
      height={screen.height}
      markerSize={Math.floor(
        (orientation === 'portrait' ? screen.width : screen.height) / 1.5,
      )}
      bottomContent={
        <Button
          onPress={() => navigate(screens.MANUAL)}
          title={Strings.Registration.QRCode.Manually}
        />
      }
    />
  );
});

const ManualConnect = React.memo<{navigation: any; route: any}>(
  ({navigation, route}) => {
    const {save, credentials} = useContext(StorageContext);
    const [
      connect,
      cancel,
      clearClient,
      {client, loading},
    ] = useConnectIoTCentralClient();
    const [newReg, setNewReg] = useBoolean(false);

    const [checked, setChecked] = useState<'dps' | 'cstring'>(
      credentials && credentials.connectionString ? 'cstring' : 'dps',
    );
    const {orientation} = useScreenDimensions();
    const [startSubmit, setStartSubmit] = useBoolean(false);
    const {bottom} = useSafeAreaInsets();
    const {parentNavigatorKey, parentRoutes} = route.params;
    const style = useMemo<StyleDefinition>(
      () => ({
        container: {
          flex: 1,
          marginHorizontal: orientation === 'landscape' ? 60 : 20,
        },
        scroll: {},
        header: {
          marginVertical: 20,
        },
        body: {
          flex: 4,
        },
        footer: {
          alignItems: 'center',
          marginBottom: Platform.select({ios: bottom, android: 20}),
          marginTop: Platform.select({ios: bottom, android: 20}),
        },
      }),
      [orientation, bottom],
    );

    const readonly = !!client && client?.isConnected();
    const connectDevice = useCallback(
      async (values: FormValues) => {
        if (values.keyType) {
          if (values.keyType === 'group' && values.deviceId) {
            // generate deviceKey
            values['deviceKey'] = computeKey(values.authKey, values.deviceId);
          } else {
            values['deviceKey'] = values.authKey;
          }
        }
        await connect(Buffer.from(JSON.stringify(values)).toString('base64'));
        navigation.navigate(Pages.ROOT);
      },
      [connect, navigation],
    );
    // update checkbox when credentials changes
    useEffect(() => {
      if (credentials && client && client.isConnected()) {
        if (checked === 'dps' && credentials.connectionString) {
          setChecked('cstring');
        } else if (checked === 'cstring' && credentials.scopeId) {
          setChecked('dps');
        }
      }
    }, [setChecked, credentials, checked, client]);

    useEffect(() => {
      if (newReg && client?.isConnected()) {
        navigation.setOptions({headerShown: false});
      }
    }, [newReg, navigation, client]);

    const connectionTypes = useMemo<ButtonGroupItem[]>(
      () => [
        {
          id: 'dps',
          label: Strings.Registration.Manual.Body.ConnectionType.Dps,
        },
        {
          id: 'cstring',
          label: Strings.Registration.Manual.Body.ConnectionType.CString,
        },
      ],
      [],
    );

    const formItems = useMemo<FormItem[]>(() => {
      // console.log(`Checked: ${checked}, credentials: ${JSON.stringify(credentials)}, readonly: ${readonly}`);
      if (checked === 'dps') {
        return [
          {
            id: 'deviceId',
            label: Strings.Registration.Manual.DeviceId.Label,
            placeHolder: Strings.Registration.Manual.DeviceId.PlaceHolder,
            multiline: false,
            readonly,
            value: credentials?.deviceId,
          },
          {
            id: 'scopeId',
            label: Strings.Registration.Manual.ScopeId.Label,
            placeHolder: Strings.Registration.Manual.ScopeId.PlaceHolder,
            multiline: false,
            readonly,
            value: credentials?.scopeId,
          },
          {
            id: 'keyType',
            choices: [
              {
                id: 'group',
                label: Strings.Registration.Manual.KeyTypes.Group,
                default: true,
              },
              {
                id: 'device',
                label: Strings.Registration.Manual.KeyTypes.Device,
              },
            ],
            label: Strings.Registration.Manual.KeyTypes.Label,
            multiline: false,
            readonly,
            value:
              credentials?.keyType ||
              (credentials?.deviceKey ? 'device' : 'group'),
          },
          {
            id: 'authKey',
            label: Strings.Registration.Manual.SASKey.Label,
            placeHolder: Strings.Registration.Manual.SASKey.PlaceHolder,
            multiline: true,
            readonly,
            value: credentials?.authKey || credentials?.deviceKey,
          },
        ];
      } else {
        return [
          {
            id: 'connectionString',
            label: 'IoT Hub device connection string',
            placeHolder: 'Enter or paste connection string',
            multiline: true,
            readonly,
            value: credentials?.connectionString,
          },
        ];
      }
    }, [checked, credentials, readonly]);

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={style.container}>
        <ScrollView bounces={false} style={style.scroll}>
          <View style={style.header}>
            {!readonly && (
              <Text>
                {Strings.Registration.Manual.Header}
                <Link
                  onPress={() => {
                    Linking.openURL(Strings.Registration.Manual.StartHere.Url);
                  }}>
                  {Strings.Registration.Manual.StartHere.Title}
                </Link>
              </Text>
            )}
          </View>
          <View style={style.body}>
            <Name>
              {readonly
                ? Strings.Registration.Manual.Registered
                : Strings.Registration.Manual.Body.ConnectionType.Title}
            </Name>
            <View style={{flex: 1}}>
              <ButtonGroup
                readonly={readonly}
                items={connectionTypes}
                containerStyle={{marginVertical: 10}}
                onCheckedChange={choiceId => {
                  console.log(choiceId);
                  setChecked(choiceId as any);
                }}
                defaultCheckedId="dps"
              />
            </View>
            <View style={{flex: 2}}>
              <Form
                title={Strings.Registration.Manual.Body.ConnectionInfo}
                items={formItems}
                submit={startSubmit}
                submitAction={connectDevice}
                onSubmit={setStartSubmit.False}
              />
            </View>
          </View>
        </ScrollView>
        <View style={style.footer}>
          {readonly ? (
            <>
              <Button
                key="register-new-device"
                title={Strings.Registration.Manual.RegisterNew.Title}
                containerStyle={{marginBottom: 5}}
                onPress={() => {
                  Alert.alert(
                    Strings.Registration.Manual.RegisterNew.Alert.Title,
                    Strings.Registration.Manual.RegisterNew.Alert.Text,
                    [
                      {
                        text: 'Proceed',
                        onPress: async () => {
                          // IMPORTANT!: clear stored credentials before cleaning client, otherwise device will continue to re-connect
                          // await client?.disconnect();
                          // clearClient();
                          setNewReg.True();
                          navigation.navigate(screens.EMPTY);

                          //  HACK: remove root screen from state and replace with registration
                          // navigation.dispatch({
                          //   ...StackActions.replace(Pages.REGISTRATION),
                          //   source: parentRoutes.find((r: any) => r.name === Pages.ROOT)?.key,
                          //   target: parentNavigatorKey.key
                          // });
                        },
                      },
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => {},
                      },
                    ],
                    {
                      cancelable: false,
                    },
                  );
                }}
              />
              <Button
                key="clear-device-credentials"
                title={Strings.Registration.Manual.Clear.Title}
                titleStyle={{color: 'red'}}
                onPress={() => {
                  Alert.alert(
                    Strings.Registration.Manual.Clear.Alert.Title,
                    Strings.Registration.Manual.Clear.Alert.Text,
                    [
                      {
                        text: 'Proceed',
                        onPress: async () => {
                          setNewReg.True();
                          await client?.disconnect();
                          await save({credentials: null});
                          clearClient();
                          // HACK: remove root screen from state and replace with registration
                          navigation.dispatch({
                            ...StackActions.replace(Pages.REGISTRATION),
                            source: parentRoutes.find(
                              (r: any) => r.name === Pages.ROOT,
                            )?.key,
                            target: parentNavigatorKey.key,
                          });
                        },
                      },
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => {},
                      },
                    ],
                    {
                      cancelable: false,
                    },
                  );
                }}
              />
            </>
          ) : (
            <Button
              key="connect-device-btn"
              title={Strings.Registration.Manual.Footer.Connect}
              onPress={setStartSubmit.True}
            />
          )}
        </View>
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
      </KeyboardAvoidingView>
    );
  },
);

const EmptyClient = React.memo<{
  navigation: any;
}>(({navigation}) => {
  return (
    <View style={style.container}>
      <Text style={style.header}>
        <Name>{Strings.Registration.Header.Welcome}</Name>
        {Strings.Registration.Header.Text}
      </Text>
      <Button
        title="Scan QR code"
        onPress={() => navigation.navigate(screens.QR)}
      />
      <Text style={style.footer}>
        {Strings.Registration.Footer}
        <Link
          onPress={() => Linking.openURL(Strings.Registration.StartHere.Url)}>
          {Strings.Registration.StartHere.Title}
        </Link>
      </Text>
    </View>
  );
});

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  header: {},
  footer: {
    alignSelf: 'center',
  },
  center: {
    position: 'absolute',
    top: '50%',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
