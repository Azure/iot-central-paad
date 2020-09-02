import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './components/typography';
import QRCodeScanner, { Event } from 'react-native-qrcode-scanner'
import QRCodeMask from './components/qrcodeMask';
import { Button, Overlay, Input, Divider } from 'react-native-elements';
import { useScreenDimensions } from './hooks/layout';
import { DecryptCredentials, IoTCClient, IOTC_CONNECT, IOTC_LOGGING, IOTC_EVENTS } from 'react-native-azure-iotcentral-client';
import { RouteProp, useTheme } from '@react-navigation/native';
import { IoTCContext } from './contexts/iotc';
import { Loader } from './components/loader';
import { useIoTCentralClient } from './hooks/iotc';
import { LogItem, LOG_DATA, NavigationParams, NavigationProperty } from './types';
import { Log } from './tools/CustomLogger';

export default function Registration({ route, navigation }: { route?: RouteProp<Record<string, NavigationParams & { previousScreen?: string }>, "Registration">, navigation?: NavigationProperty }) {
    const [showqr, setshowqr] = useState(false);
    const [client, disconnect] = useIoTCentralClient();

    if (showqr) {
        return <QRCode onSuccess={(route && route.params.previousScreen && navigation) ? () => navigation.navigate(route.params.previousScreen as string) : undefined} />;
    }
    if (client) {
        return <View style={style.container}>
            <Text style={style.header}>Mobile device is currently registered to IoT Central with Id <Text style={{ fontWeight: 'bold' }}>"{(client as IoTCClient).id}" </Text>
            and Scope <Text style={{ fontWeight: 'bold' }}>"{(client as IoTCClient).scopeId}".</Text>
                {'\n'}To disconnect and register a different device, scan the associated QR Code</Text>
            <Button type='clear' title='Scan QR code' onPress={setshowqr.bind(null, true)} />
        </View>
    }
    return (
        <View style={style.container}>
            <Text style={style.header}>Mobile device is not currently registered to any device in IoT Central.
            To register a device, scan the associated QR Code</Text>
            <Button type='clear' title='Scan QR code' onPress={async () => {
                await disconnect();
                setshowqr(true);
            }} />
        </View>)
}

function QRCode(props: { onSuccess?(): void | Promise<void> }) {
    const { screen, orientation } = useScreenDimensions();
    const [prompt, showPrompt] = useState(false);
    const [encKey, setEncKey] = useState<string | undefined>(undefined);
    const [qrdata, setQrdata] = useState<string | undefined>(undefined);
    const { colors } = useTheme();
    const [client, disconnect, register] = useIoTCentralClient();
    const { addListener, removeListener } = useContext(IoTCContext);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('Loading ...');

    const clientId = useRef(client ? (client as IoTCClient).id : null);

    const onRead = async function (e: Event) {
        setQrdata(e.data);
        showPrompt(true);
    }

    const logConnection = (item: LogItem) => {
        setLoadingMsg(item.eventData);
        fetch('https://webhook.site/6b40aeec-0a58-45ee-87b6-132fcf9a1471', {
            method: 'POST',
            body: `${item.eventName}:${item.eventData}`,
            headers: {
                'ContentType': 'text/plain'
            }
        });
        console.log(`${item.eventName}:${item.eventData}`);
    }

    const connectIoTC = async function () {
        addListener(LOG_DATA, logConnection);
        if (qrdata && encKey) {
            Log(qrdata);
            Log(encKey);
            setLoading(true);
            try {
                await register(qrdata, encKey);
            }
            catch (ex) {
                setLoadingMsg(ex.message);
                setLoadingMsg(`Wrong qr value: ${qrdata}`);
            }
        }
    }

    useEffect(() => {
        // keep track of the current client id so it enters down only when connecting a different one
        if (client && clientId.current && (client as IoTCClient).id === clientId.current) {
            return;
        }
        if (client && client.isConnected() && loading) {
            setLoading(false);
            showPrompt(false);
            removeListener(LOG_DATA, logConnection);
            if (props.onSuccess) {
                props.onSuccess();
            }
        }
        return () => removeListener(LOG_DATA, logConnection);
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
                    {loading && <Loader message={loadingMsg} />}
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