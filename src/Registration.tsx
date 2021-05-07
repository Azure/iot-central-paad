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
import {Link, Name, Text, Detail} from './components/typography';
import {Button, CheckBox} from 'react-native-elements';
import {useScreenDimensions} from './hooks/layout';
import {
  getFocusedRouteNameFromRoute,
  RouteProp,
  useNavigation,
  useTheme,
} from '@react-navigation/native';
import {Loader} from './components/loader';
import {ConnectionOptions, useConnectIoTCentralClient} from './hooks/iotc';
import {
  NavigationParams,
  NavigationProperty,
  Pages,
  PagesNavigator,
  StyleDefinition,
} from './types';
import QRCodeScanner, {Event} from './components/qrcodeScanner';
import Strings from 'strings';
import {createStackNavigator} from '@react-navigation/stack';
import Form, {FormItem, FormValues} from 'components/form';
import {useBoolean, usePrevious} from 'hooks/common';
import {Buffer} from 'buffer';
import {computeKey} from 'react-native-azure-iotcentral-client';
import {StorageContext} from 'contexts';
import HeaderCloseButton from 'components/headerCloseButton';

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
  const qrCodeRef = useRef<QRCodeScanner>(null);

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
      parentNavigator?.navigate(Pages.ROOT);
    }
  }, [client, loading, parentNavigator, previousLoading]);

  if (error) {
    if (qrCodeRef.current) {
      Alert.alert(
        'Error',
        'The QR code you have scanned is not an Azure IoT Central Device QR code',
        [
          {
            text: 'Retry',
            onPress: qrCodeRef.current?.reactivate,
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log(`Loading: ${loading}`);
              cancel({clear: false});
            },
          },
        ],
        {
          cancelable: false,
        },
      );
    }
  }

  return (
    <Stack.Navigator
      initialRouteName={
        client && client.isConnected() ? screens.MANUAL : screens.EMPTY
      }
      screenOptions={{headerBackTitleVisible: false}}>
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
          return <QRCodeScreen connect={connect} />;
        }}
      </Stack.Screen>
      <Stack.Screen
        name={screens.MANUAL}
        options={({
          navigation,
          route,
        }: {
          navigation: NavigationProperty;
          route: any;
        }) => ({
          headerTitle: Strings.Registration.Manual.Title,
          headerShown: !client || !client?.isConnected(),
        })}
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
}>(({connect}) => {
  const {screen, orientation} = useScreenDimensions();
  const {navigate} = useNavigation();

  const onRead = useCallback(
    async (e: Event) => {
      await connect(e.data);
    },
    [connect],
  );
  return (
    <QRCodeScanner
      onRead={onRead}
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

const ManualConnect = React.memo<{navigation: PagesNavigator}>(
  ({navigation}) => {
    const {save, credentials} = useContext(StorageContext);
    const [
      connect,
      ,
      clearClient,
      {client, loading},
    ] = useConnectIoTCentralClient();
    const [checked, setChecked] = useState<'dps' | 'cstring'>(
      credentials && credentials.connectionString ? 'cstring' : 'dps',
    );
    const {orientation} = useScreenDimensions();
    const [startSubmit, setStartSubmit] = useBoolean(false);
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
          paddingTop: 40,
          marginBottom: 100,
        },
      }),
      [orientation],
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
      if (credentials) {
        if (checked === 'dps' && credentials.connectionString) {
          setChecked('cstring');
        } else if (checked === 'cstring' && credentials.scopeId) {
          setChecked('dps');
        }
      }
    }, [setChecked, credentials, checked]);

    const formItems = useMemo<FormItem[]>(() => {
      if (checked === 'dps') {
        return [
          {
            id: 'deviceId',
            label: 'Device Id',
            placeHolder: 'Enter a unique ID to identify this device',
            multiline: false,
            readonly,
            value: credentials?.deviceId,
          },
          {
            id: 'scopeId',
            label: 'ID Scope',
            placeHolder: 'Enter your provisioning service ID',
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
            label: 'Key type',
            multiline: false,
            readonly,
            value: credentials?.keyType,
          },
          {
            id: 'authKey',
            label: 'Shared access signature (SAS) key',
            placeHolder: 'Enter or paste SAS key',
            multiline: true,
            readonly,
            value: credentials?.authKey,
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
        <ScrollView
          bounces={false}
          style={style.scroll}
          keyboardShouldPersistTaps="handled">
          <View style={style.header}>
            <Detail>
              {Strings.Registration.Manual.Header}
              <Link
                onPress={() => {
                  Linking.openURL(Strings.Registration.Manual.StartHere.Url);
                }}>
                {Strings.Registration.Manual.StartHere.Title}
              </Link>
            </Detail>
          </View>
          <View style={style.body}>
            <Name>
              {readonly
                ? Strings.Registration.Manual.Registered
                : Strings.Registration.Manual.Body.ConnectionType.Title}
            </Name>
            <View style={{flex: 1}}>
              <CheckBox
                containerStyle={{
                  marginStart: 0,
                  backgroundColor: undefined,
                  borderWidth: 0,
                }}
                disabled={readonly}
                checkedIcon="dot-circle-o"
                uncheckedIcon="circle-o"
                checkedColor={readonly ? 'gray' : undefined}
                uncheckedColor={readonly ? 'gray' : undefined}
                checked={checked === 'dps'}
                title={Strings.Registration.Manual.Body.ConnectionType.Dps}
                onPress={() => setChecked('dps')}
              />
              <CheckBox
                containerStyle={{
                  marginStart: 0,
                  backgroundColor: undefined,
                  borderWidth: 0,
                }}
                disabled={readonly}
                checkedIcon="dot-circle-o"
                uncheckedIcon="circle-o"
                checkedColor={readonly ? 'gray' : undefined}
                uncheckedColor={readonly ? 'gray' : undefined}
                checked={checked === 'cstring'}
                title={Strings.Registration.Manual.Body.ConnectionType.CString}
                onPress={() => setChecked('cstring')}
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
                type={Platform.select({ios: 'clear', android: 'solid'})}
                title={Strings.Registration.Manual.RegisterNew.Title}
                onPress={() => {
                  Alert.alert(
                    Strings.Registration.Manual.RegisterNew.Alert.Title,
                    Strings.Registration.Manual.RegisterNew.Alert.Text,
                    [
                      {
                        text: 'Proceed',
                        onPress: async () => {
                          // IMPORTANT!: clear stored credentials before cleaning client, otherwise device will continue to re-connect
                          await client?.disconnect();
                          await save({credentials: null});
                          clearClient();
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
                type="clear"
                title={Strings.Registration.Clear}
                titleStyle={{color: 'red'}}
              />
            </>
          ) : (
            <Button
              key="connect-device-btn"
              type={Platform.select({ios: 'clear', android: 'solid'})}
              title={Strings.Registration.Manual.Footer.Connect}
              onPress={setStartSubmit.True}
            />
          )}
        </View>
        <Loader
          visible={loading}
          modal={true}
          message={Strings.Registration.Connection.Loading}
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
      <Text style={style.header}>{Strings.Registration.Header}</Text>
      <Button
        type="clear"
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
    marginHorizontal: 30,
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
