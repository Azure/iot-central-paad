import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ScrollView,
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
import {ConnectionOptions, useConnectIoTCentralClient} from './hooks/iotc';
import {NavigationParams, NavigationProperty, StyleDefinition} from './types';
import QRCodeScanner, {Event} from './components/qrcodeScanner';
import Strings from 'strings';
import {createStackNavigator} from '@react-navigation/stack';
import Form, {FormItem} from 'components/form';
import {useBoolean} from 'hooks/common';
import {Buffer} from 'buffer';

const Stack = createStackNavigator();
const screens = {
  EMPTY: 'EMPTY',
  QR: 'QR',
  MANUAL: 'MANUAL',
};

export const Registration = React.memo<{
  route?: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    'Registration'
  >;
  navigation?: any;
}>(({navigation: parentNavigation}) => {
  const {colors} = useTheme();
  const [
    connect,
    cancel,
    {loading, client, error},
  ] = useConnectIoTCentralClient();
  // const isFocused = useIsFocused();
  const qrCodeRef = useRef<QRCodeScanner>(null);

  useEffect(() => {
    if (client && !loading) {
      parentNavigation?.navigate('root');
    }
  }, [client, loading, parentNavigation]);

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
  return (
    <Stack.Navigator initialRouteName={screens.EMPTY}>
      <Stack.Screen
        name={screens.EMPTY}
        options={{
          headerShown: false,
        }}>
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
        {() => <ManualConnect connect={connect} />}
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
  connect: (
    encryptedCredentials: string,
    options?: ConnectionOptions,
  ) => Promise<void>;
}>(({connect}) => {
  const [checked, setChecked] = useState<'dps' | 'cstring'>('dps');
  const {orientation} = useScreenDimensions();
  const [startConnect, setStartConnect] = useBoolean(false);
  const {navigate} = useNavigation();
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
        paddingTop: 20,
        marginBottom: 40,
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
        },
        {
          id: 'scopeId',
          label: 'ID Scope',
          placeHolder: 'Enter your provisioning service ID',
          multiline: false,
        },
        {
          id: 'deviceKey',
          label: 'Shared access signature (SAS) key',
          placeHolder: 'Enter or paste SAS key',
          multiline: true,
        },
      ];
    } else {
      return [
        {
          id: 'connectionString',
          label: 'IoT Hub device connection string',
          placeHolder: 'Enter or paste connection string',
          multiline: true,
        },
      ];
    }
  }, [checked]);

  return (
    <View style={style.container}>
      <ScrollView contentContainerStyle={style.scroll}>
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
          <Name>{Strings.Registration.Manual.Body.ConnectionType.Title}</Name>
          <View style={{flex: 1}}>
            <CheckBox
              containerStyle={{
                marginStart: 0,
                backgroundColor: undefined,
                borderWidth: 0,
              }}
              checkedIcon="dot-circle-o"
              uncheckedIcon="circle-o"
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
              checkedIcon="dot-circle-o"
              uncheckedIcon="circle-o"
              checked={checked === 'cstring'}
              title={Strings.Registration.Manual.Body.ConnectionType.CString}
              onPress={() => setChecked('cstring')}
            />
          </View>
          <View style={{flex: 2}}>
            <Form
              title={Strings.Registration.Manual.Body.ConnectionInfo}
              items={formItems}
              submit={startConnect}
              onSubmitting={async values => {
                // TODO: pass object instead of encoded string
                await connect(
                  Buffer.from(JSON.stringify(values)).toString('base64'),
                );
                // await connect(
                //   Buffer.from(
                //     JSON.stringify({
                //       connectionString:
                //         'HostName=lucahub.azure-devices.net;DeviceId=device1;SharedAccessKey=PEQDPAS1O8PjIfSqmAKehGUxIK7cXx0VKXuSk3dypvw=',
                //     }),
                //   ).toString('base64'),
                // );
                navigate('root');
              }}
            />
          </View>
        </View>
      </ScrollView>
      <Button
        type={Platform.select({ios: 'clear', android: 'solid'})}
        containerStyle={style.footer}
        title={Strings.Registration.Manual.Footer.Connect}
        onPress={setStartConnect.True}
      />
    </View>
  );
});

const EmptyClient = React.memo<{
  navigation: any;
  parentNavigation: NavigationProperty;
}>(({navigation, parentNavigation}) => {
  /**
   * ---- UX TWEAK ----
   * All connection screens (qrcode and manual) must run on full screen.
   * If parent navigator is running, hide headers and footers
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
