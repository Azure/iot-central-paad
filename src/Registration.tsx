import React, {useRef} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text} from './components/typography';
import {Button, Overlay} from 'react-native-elements';
import {useScreenDimensions} from './hooks/layout';
import {RouteProp, useTheme} from '@react-navigation/native';
import {Loader} from './components/loader';
import {useConnectIoTCentralClient} from './hooks/iotc';
import {NavigationParams, NavigationProperty, OnPressCallback} from './types';
import QRCodeScanner, {Event} from './components/qrcodeScanner';
import {useBoolean} from 'hooks/common';

export const Registration = React.memo<{
  route?: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    'Registration'
  >;
  navigation?: NavigationProperty;
}>(({route, navigation}) => {
  const {screen, orientation} = useScreenDimensions();
  const {colors} = useTheme();
  const [showQR, setShowQR] = useBoolean(false);
  const [
    connect,
    cancel,
    {loading, client, error},
  ] = useConnectIoTCentralClient();
  const qrCodeRef = useRef<QRCodeScanner>(null);

  const onQRRead = useRef(async (e: Event) => {
    setShowQR.False();
    await connect(e.data);
  });

  if (error) {
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
          onPress: setShowQR.False,
        },
      ],
      {
        cancelable: false,
      },
    );
  }

  return (
    <>
      <Overlay
        isVisible={showQR || loading}
        overlayStyle={{
          height: screen.height,
          width: screen.width,
          backgroundColor: colors.background,
        }}
        supportedOrientations={['portrait', 'landscape']}>
        <View style={{position: 'relative', margin: -10}}>
          {showQR && (
            <QRCodeScanner
              ref={qrCodeRef}
              onRead={onQRRead.current}
              onClose={setShowQR.False}
              width={screen.width}
              height={screen.height}
              markerSize={Math.floor(
                (orientation === 'portrait' ? screen.width : screen.height) /
                  1.5,
              )}
            />
          )}
          <Loader
            visible={loading}
            message={'Connecting client...'}
            modal
            buttons={[
              {
                text: 'Cancel',
                onPress: cancel,
              },
            ]}
          />
        </View>
      </Overlay>
      {!showQR && client && (
        <View style={style.container}>
          <Text style={style.header}>
            Mobile device is currently registered to IoT Central with Id{' '}
            <Text style={{fontWeight: 'bold'}}>"{client.id}" </Text>
            and Scope{' '}
            <Text style={{fontWeight: 'bold'}}>"{client.scopeId}".</Text>
            {'\n'}To disconnect and register a different device, scan the
            associated QR Code
          </Text>
          <Button type="clear" title="Scan QR code" onPress={setShowQR.True} />
        </View>
      )}
      {!showQR && !client && <EmptyClient scan={setShowQR.True} />}
    </>
  );
});

const EmptyClient = React.memo<{scan: OnPressCallback}>(({scan}) => (
  <View style={style.container}>
    <Text style={style.header}>
      Mobile device is not currently registered to any application in Azure IoT
      Central. To register this phone as a device scan the associated QR Code .
    </Text>
    <Button type="clear" title="Scan QR code" onPress={scan} />
  </View>
));

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 30,
  },
  header: {},
  center: {
    position: 'absolute',
    top: '50%',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
