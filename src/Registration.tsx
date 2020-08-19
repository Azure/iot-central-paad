import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './components/typography';
import QRCodeScanner, { Event } from 'react-native-qrcode-scanner'
import QRCodeMask from './components/qrcodeMask';
import { Button, Overlay, Input, Divider } from 'react-native-elements';
import { useScreenDimensions } from './hooks/layout';
import { DecryptCredentials, IoTCClient, IOTC_CONNECT, IOTC_LOGGING, IOTC_EVENTS } from 'react-native-azure-iotcentral-client';
import { useTheme } from '@react-navigation/native';
import { IoTCContext } from './contexts/iotc';
import { Loader } from './components/loader';
import { useIoTCentralClient } from './hooks/iotc';

export default function Registration() {
    const [showqr, setshowqr] = useState(false);
    if (showqr) {
        return <QRCode />;
    }
    return (
        <View style={style.container}>
            <Text style={style.header}>Mobile device is not currently registered to any device in IoT Central.
            To register a device, scan the associated QR Code</Text>
            <Button type='clear' title='Scan QR code' onPress={setshowqr.bind(null, true)} />
        </View>)
}

function QRCode() {
    const { screen, orientation } = useScreenDimensions();
    const [prompt, showPrompt] = useState(false);
    const [encKey, setEncKey] = useState(null);
    const [qrdata, setQrdata] = useState(null);
    const { colors } = useTheme();
    const [client, register] = useIoTCentralClient();
    const [loading, setLoading] = useState(false);

    const onRead = async function (e: Event) {
        setQrdata(e.data);
        showPrompt(true);
    }

    const connectIoTC = async function () {
        setLoading(true);
        await register(qrdata, encKey);
        // const creds = DecryptCredentials(qrdata, encKey);
        // if (creds) {
        //     // start connection
        //     let iotc = new IoTCClient(creds.deviceId, creds.scopeId, IOTC_CONNECT.DEVICE_KEY, creds.deviceKey);
        //     if (creds.modelId) {
        //         iotc.setModelId(creds.modelId);
        //     }
        //     iotc.setLogging(IOTC_LOGGING.ALL);
        //     // iotc.on(IOTC_EVENTS.Properties,)
        //     await iotc.connect();
        //     connect(iotc); //assign client to context
        //     await iotc.sendProperty(await getDeviceInfo());
        // }
    }

    useEffect(() => {
        if (client && loading) {
            setLoading(false);
            showPrompt(false);
        }
    }, [client, loading])

    return (
        <View>
            <QRCodeScanner onRead={onRead}
                customMarker={
                    <View style={{ marginTop: -(screen.width / 2) }}>
                        <QRCodeMask />
                        <Text style={{ ...style.center, textAlign: 'center' }}>Move closer to scan</Text>
                    </View>
                }
                showMarker={true}
                cameraStyle={{ height: screen.height + 20, width: screen.width }}

            />
            <Overlay isVisible={prompt} onBackdropPress={showPrompt.bind(null, false)} overlayStyle={{ borderRadius: 20, backgroundColor: colors.card, width: screen.width / 1.5 }} backdropStyle={{ backgroundColor: colors.background }}>
                <View style={{ justifyContent: loading ? 'center' : 'space-between', alignItems: 'center', height: screen.height / 4, padding: 20 }}>
                    {loading && <Loader message={'Loading ...'} />}
                    {!loading && <><Text>Please provide the password to decrypt credentials</Text>
                        <Input placeholder='Password' value={encKey} onChangeText={val => setEncKey(val)} inputStyle={{ color: colors.text }} />
                        <Divider />
                        <Button type='clear' title='Confirm' onPress={connectIoTC} /></>}
                </View>
            </Overlay>
        </View >
    )
}

const style = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 30
    },
    header: {
    },
    center: {
        position: 'absolute',
        top: '50%',
        bottom: 0,
        left: 0,
        right: 0
    },
});