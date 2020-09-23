import React, { useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-elements';
import Scanner, { Event as QRCodeEvent } from 'react-native-qrcode-scanner'
import { Text } from './typography';



interface QRCodeScannerProps {
    height: number,
    width: number,
    markerSize: number,
    onRead: (e: Event) => void | Promise<void>,
    onClose?: () => void | Promise<void>
}

interface IQRCodeScanner extends QRCodeScannerProps {
    reactivate: () => void
}

export type Event = QRCodeEvent;


export default class QRCodeScanner extends React.Component<QRCodeScannerProps, {}> implements IQRCodeScanner {

    public height: number;
    public width: number;
    public markerSize: number;
    public overlayDimension: any;
    private qrCodeRef: Scanner | null;
    public onRead: (e: Event) => void | Promise<void>;
    public onClose: (() => void | Promise<void>) | undefined;


    constructor(props: QRCodeScannerProps) {
        super(props);
        ({
            width: this.width,
            height: this.height,
            markerSize: this.markerSize,
            onRead: this.onRead,
            onClose: this.onClose
        } = props);
        this.overlayDimension = {
            sideWidth: (this.width - this.markerSize) / 2,
            verticals: (this.height - this.markerSize) / 2
        };
        this.qrCodeRef = null;
    }

    public reactivate() {
        this.qrCodeRef?.reactivate();
    }


    render() {
        return (<Scanner
            ref={sc => this.qrCodeRef = sc}
            onRead={this.onRead}
            topViewStyle={{ flex: 0, position: 'absolute', zIndex: 2 }}
            topContent={(
                <View style={{ position: 'relative', height: this.height, width: this.width }}>
                    <View key='left' style={{ height: this.height, backgroundColor: 'rgba(0,0,0,.5)', width: this.overlayDimension.sideWidth, left: 0, position: 'absolute', top: 0 }}></View>
                    <View key='right' style={{ height: this.height, backgroundColor: 'rgba(0,0,0,.5)', width: this.overlayDimension.sideWidth, right: 0, position: 'absolute', top: 0 }}></View>
                    <View key='top' style={{ marginHorizontal: this.overlayDimension.sideWidth, width: this.markerSize, backgroundColor: 'rgba(0,0,0,.5)', height: this.overlayDimension.verticals + 10, top: 0, position: 'absolute' }}></View>
                    <View key='bottom' style={{ marginHorizontal: this.overlayDimension.sideWidth, width: this.markerSize, backgroundColor: 'rgba(0,0,0,.5)', height: this.overlayDimension.verticals, bottom: -10, position: 'absolute' }}></View>
                    {this.onClose && <Icon name='close-circle-outline'
                        type={Platform.select({ ios: 'ionicon', android: 'material-community' })}
                        size={40}
                        color='black'
                        containerStyle={{ position: 'absolute', top: this.overlayDimension.verticals - 40, right: this.width / 10 }}
                        onPress={this.onClose}
                    />}
                </View>)}

            customMarker={
                <View>
                    <QRCodeMask width={this.markerSize} color={'black'} />
                    <Text style={{ ...style.center, textAlign: 'center' }}>Move closer to scan</Text>
                </View>
            }

            showMarker={true}
            cameraStyle={{ height: this.height + 20, width: this.width }}
        />)
    }
}


function QRCodeMask(props: { width: number, color: string }) {

    const { width: markerWidth, color } = props;
    const sectorWidth = markerWidth / 5;
    return (<View style={{ position: 'relative', width: markerWidth, height: markerWidth }}>
        <View
            key='top-left'
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: sectorWidth,
                width: sectorWidth,
                borderColor: color,
                borderLeftWidth: 5,
                borderTopWidth: 5,
            }}></View>
        <View
            key='top-right'
            style={{
                position: 'absolute',
                top: 0,
                left: markerWidth - sectorWidth,
                height: sectorWidth,
                width: sectorWidth,
                borderColor: color,
                borderRightWidth: 5,
                borderTopWidth: 5,
            }}></View>
        <View
            key='bottom-left'
            style={{
                position: 'absolute',
                top: markerWidth - sectorWidth,
                left: 0,
                height: sectorWidth,
                width: sectorWidth,
                borderColor: color,
                borderLeftWidth: 5,
                borderBottomWidth: 5,
            }}></View>
        <View
            key='bottom-right'
            style={{
                position: 'absolute',
                top: markerWidth - sectorWidth,
                left: markerWidth - sectorWidth,
                height: sectorWidth,
                width: sectorWidth,
                borderColor: color,
                borderRightWidth: 5,
                borderBottomWidth: 5,
            }}></View>
    </View>)
}

const style = StyleSheet.create({
    center: {
        position: 'absolute',
        top: '50%',
        bottom: 0,
        left: 0,
        right: 0
    }
})