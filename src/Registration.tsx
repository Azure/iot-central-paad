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
  RouteProp,
  useIsFocused,
  useNavigation,
  useTheme,
} from '@react-navigation/native';
import {Loader} from './components/loader';
import {
  ConnectionOptions,
  useConnectIoTCentralClient,
  useIoTCentralClient,
  useSimulation,
} from './hooks/iotc';
import {
  NavigationParams,
  NavigationProperty,
  NavigatorRoots,
  StyleDefinition,
} from './types';
import QRCodeScanner, {Event} from './components/qrcodeScanner';
import Strings from 'strings';
import {createStackNavigator} from '@react-navigation/stack';
import Form, {FormItem, FormValues} from 'components/form';
import {ISetBooleanFunctions, useBoolean, usePrevious} from 'hooks/common';
import {Buffer} from 'buffer';
import {computeKey} from 'react-native-azure-iotcentral-client';
import {StorageContext} from 'contexts';

const Stack = createStackNavigator();
const screens = {
  EMPTY: 'EMPTY',
  QR: 'QR',
  MANUAL: 'MANUAL',
};

export const Registration = React.memo<{
  route: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    'Registration'
  >;
  navigation: any;
}>(({navigation: parentNavigation, route}) => {
  const {colors} = useTheme();
  const {clear} = useContext(StorageContext);
  const [simulated] = useSimulation();
  const [
    connect,
    cancel,
    clearClient,
    {loading, client, error},
  ] = useConnectIoTCentralClient();
  // const isFocused = useIsFocused();
  const qrCodeRef = useRef<QRCodeScanner>(null);
  const previousLoading = usePrevious(loading);

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
      parentNavigation.navigate(NavigatorRoots.MAIN);
    },
    [parentNavigation, connect],
  );

  useEffect(() => {
    if (client && previousLoading && !loading) {
      parentNavigation?.navigate(NavigatorRoots.MAIN);
    }
  }, [client, previousLoading, loading, parentNavigation]);

  useEffect(() => {
    if (simulated) {
      parentNavigation?.navigate(NavigatorRoots.MAIN);
    }
  }, [simulated, parentNavigation]);

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
  if ((!client || !client.isConnected()) && loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center'}}>
        <Loader
          visible={true}
          message={
            loading ? Strings.Registration.Connection.Loading : 'Loading...'
          }
        />
      </View>
    );
  }

  if (client && client.isConnected()) {
    return (
      <ManualConnect
        readonly={true}
        submit={values => {}}
        footer={submitForm => (
          <>
            <Button
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
                        await client.disconnect();
                        await clear();
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
              type="clear"
              title={Strings.Registration.Clear}
              titleStyle={{color: 'red'}}
            />
          </>
        )}
      />
    );
  }
  return (
    <Stack.Navigator initialRouteName={screens.EMPTY}>
      <Stack.Screen name={screens.EMPTY} options={{headerShown: false}}>
        {({navigation}) => (
          <EmptyClient
            navigation={navigation}
            parentNavigation={parentNavigation}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name={screens.QR}
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: ' ',
          headerTintColor: colors.text,
        }}>
        {() => <QRCodeScreen connect={connect} />}
      </Stack.Screen>
      <Stack.Screen
        name={screens.MANUAL}
        options={({navigation}: {navigation: NavigationProperty}) => {
          return {
            headerTitle: Strings.Registration.Manual.Title,
            headerBackTitle: ' ', // HACK: empty,null or undefined causes library to use screen name.
          };
        }}>
        {() => (
          <ManualConnect
            footer={submitForm => (
              <Button
                type={Platform.select({ios: 'clear', android: 'solid'})}
                title={Strings.Registration.Manual.Footer.Connect}
                onPress={submitForm.True}
              />
            )}
            submit={connectDevice}
          />
        )}
      </Stack.Screen>
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
    // <Overlay
    //   isVisible={true}
    //   overlayStyle={{
    //     height: screen.height,
    //     width: screen.width,
    //     backgroundColor: colors.background,
    //   }}
    //   supportedOrientations={['portrait', 'landscape']}>

    <QRCodeScanner
      // ref={qrCodeRef}
      onRead={onRead}
      // onClose={setShowQR.False}
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

    // </Overlay>
  );
});

const ManualConnect = React.memo<{
  submit: (values: FormValues) => void | Promise<void>;
  footer: (sumbitForm: ISetBooleanFunctions) => JSX.Element;
  readonly?: boolean;
}>(({submit, footer, readonly}) => {
  const [, credentials] = useIoTCentralClient();
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
            {id: 'device', label: Strings.Registration.Manual.KeyTypes.Device},
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
  }, [checked, readonly, credentials]);

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
              onPress={() =>
                Linking.openURL(Strings.Registration.Manual.StartHere.Url)
              }>
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
              onSubmitting={submit}
            />
          </View>
        </View>
      </ScrollView>
      <View style={style.footer}>{footer(setStartSubmit)}</View>
    </KeyboardAvoidingView>
  );
});

const EmptyClient = React.memo<{
  navigation: any;
  parentNavigation: NavigationProperty;
}>(({navigation, parentNavigation}) => {
  /**
   * ---- UX TWEAK ----
   * All connection screens (qrcode and manual) must run on full screen.
   * If parent navigator is running, hide headers and footers.
   * For "EmptyClient" screen show immediate parent.
   */
  const isFocused = useIsFocused();
  useEffect(() => {
    parentNavigation?.setOptions({
      headerShown: isFocused,
    });
  }, [isFocused, parentNavigation]);
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
