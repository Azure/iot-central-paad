import React, {useState, useRef} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text} from './components/typography';
import {Button, Overlay} from 'react-native-elements';
import {useScreenDimensions} from './hooks/layout';
import {
  IoTCClient,
  CancellationToken,
} from 'react-native-azure-iotcentral-client';
import {RouteProp, useTheme} from '@react-navigation/native';
import {Loader} from './components/loader';
import {useIoTCentralClient} from './hooks/iotc';
import {LogItem, LOG_DATA, NavigationParams, NavigationProperty} from './types';
import {Log} from './tools/CustomLogger';
import QRCodeScanner, {Event} from './components/qrcodeScanner';

export default function Registration({
  route,
  navigation,
}: {
  route?: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    'Registration'
  >;
  navigation?: NavigationProperty;
}) {
  const {screen, orientation} = useScreenDimensions();
  const {colors} = useTheme();
  const [showqr, setshowqr] = useState(false);
  const {client} = useIoTCentralClient();

  if (showqr) {
    return (
      <Overlay
        isVisible={showqr}
        overlayStyle={{
          height: screen.height,
          width: screen.width,
          backgroundColor: colors.background,
        }}
        supportedOrientations={['portrait', 'landscape']}>
        <View style={{position: 'relative', margin: -10}}>
          <QRCode
            orientation={orientation}
            width={screen.width}
            height={screen.height}
            onSuccess={
              route && route.params.previousScreen && navigation
                ? () =>
                    navigation.navigate(route.params.previousScreen as string)
                : undefined
            }
            onFailure={(qrCode) => {
              Alert.alert(
                'Error',
                'The QR code you have scanned is not an Azure IoT Central Device QR code',
                [
                  {
                    text: 'Retry',
                    onPress: () => {
                      qrCode.current?.reactivate();
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                      setshowqr(false);
                    },
                  },
                ],
                {
                  cancelable: false,
                },
              );
            }}
            onClose={() => {
              setshowqr(false);
            }}
          />
        </View>
      </Overlay>
    );
  }
  if (client) {
    return (
      <View style={style.container}>
        <Text style={style.header}>
          Mobile device is currently registered to IoT Central with Id{' '}
          <Text style={{fontWeight: 'bold'}}>
            "{(client as IoTCClient).id}"{' '}
          </Text>
          and Scope{' '}
          <Text style={{fontWeight: 'bold'}}>
            "{(client as IoTCClient).scopeId}".
          </Text>
          {'\n'}To disconnect and register a different device, scan the
          associated QR Code
        </Text>
        <Button
          type="clear"
          title="Scan QR code"
          onPress={setshowqr.bind(null, true)}
        />
      </View>
    );
  }
  return (
    <View style={style.container}>
      <Text style={style.header}>
        Mobile device is not currently registered to any application in Azure
        IoT Central. To register this phone as a device scan the associated QR
        Code .
      </Text>
      <Button
        type="clear"
        title="Scan QR code"
        onPress={async () => {
          setshowqr(true);
        }}
      />
    </View>
  );
}

function QRCode(props: {
  height: number;
  width: number;
  orientation: 'portrait' | 'landscape';
  onClose?(): void;
  onSuccess?(qrcode: React.RefObject<QRCodeScanner>): void | Promise<void>;
  onFailure?(qrcode: React.RefObject<QRCodeScanner>): void | Promise<void>;
}) {
  // dialog with progress
  const {register, addListener, removeListener} = useIoTCentralClient();
  // connection in progress. Loading enabled
  const [connecting, setConnecting] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Connecting ...');

  const {height, width, orientation, onFailure, onClose, onSuccess} = props;
  const qrcode = useRef<QRCodeScanner>(null);
  const request = useRef(new CancellationToken());

  const onRead = async (e: Event) => {
    setConnecting(true);
    await connectIoTC(e.data);
  };

  const onComplete = (success: boolean | null) => {
    removeListener(LOG_DATA, updateLoadingMessage);
    if (success === null) {
      // close
      return onClose?.();
    }
    if (success) {
      return onSuccess?.(qrcode);
    } else {
      return onFailure?.(qrcode);
    }
  };

  const updateLoadingMessage = (logData: LogItem) => {
    setLoadingMsg(logData.eventData);
  };

  const connectIoTC = async (qrdata: string) => {
    if (qrdata) {
      Log(qrdata);
      try {
        addListener(LOG_DATA, updateLoadingMessage);
        await register(qrdata, request.current);
        onComplete(true); // registration successfull
      } catch (ex) {
        Log(ex);
        const reason = ex.name === 'Cancel' ? null : false;
        // registration failed. Set failure mode.
        onComplete(reason);
      }
    }
  };

  return (
    <View>
      <QRCodeScanner
        onRead={onRead}
        onClose={onClose}
        width={width}
        height={height}
        markerSize={Math.floor(
          (orientation === 'portrait' ? width : height) / 1.5,
        )}
      />
      {connecting && (
        <Loader
          visible={connecting}
          message={loadingMsg}
          modal
          buttons={[
            {
              text: 'Cancel',
              onPress: () => {
                setLoadingMsg('Canceling...');
                request.current.cancel.bind(request.current)();
              },
            },
          ]}
        />
      )}
    </View>
  );
}

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
