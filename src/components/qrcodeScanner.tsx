// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {Icon} from 'react-native-elements';
import Scanner from 'react-native-qrcode-scanner';
import {BarCodeReadEvent} from 'react-native-camera';
import {Text} from './typography';

interface QRCodeScannerProps {
  height: number;
  width: number;
  markerSize: number;
}

export type Event = BarCodeReadEvent;
interface IQRCodeScanner {
  reactivate: () => void;
}

export type IQRCodeProps = QRCodeScannerProps & {
  onRead: (e: Event) => void | Promise<void>;
  onClose?: () => void | Promise<void>;
  bottomContent?: JSX.Element;
};

export default class QRCodeScanner
  extends React.Component<IQRCodeProps, {}>
  implements IQRCodeScanner {
  public overlayDimension: any;
  private qrCodeRef: Scanner | null;
  public onRead: (e: Event) => void | Promise<void>;
  public onClose: (() => void | Promise<void>) | undefined;

  private calculateSideWidth(width: number, markerSize: number): number {
    return (width - markerSize) / 2;
  }

  private calculateVerticals(height: number, markerSize: number): number {
    return (height - markerSize) / 2;
  }

  constructor(props: IQRCodeProps) {
    super(props);
    ({onRead: this.onRead, onClose: this.onClose} = props);
    this.qrCodeRef = null;
  }

  public reactivate() {
    this.qrCodeRef?.reactivate();
  }
  componentWillUnmount() {
    this.qrCodeRef = null;
  }

  render() {
    const sideWidth = this.calculateSideWidth(
      this.props.width,
      this.props.markerSize,
    );
    const verticals = this.calculateVerticals(
      this.props.height,
      this.props.markerSize,
    );

    return (
      <Scanner
        ref={sc => (this.qrCodeRef = sc)}
        onRead={this.onRead}
        // //@ts-ignore
        // flashMode={
        //   RNCamera.Constants.FlashMode.off
        // }
        containerStyle={{
          marginTop: -80,
        }}
        topViewStyle={{
          position: 'absolute',
          zIndex: 2,
          marginLeft:
            this.props.width > this.props.height ? sideWidth - verticals : 0,
        }} // hack: margin is needed when in landscape
        topContent={
          <View
            style={{
              position: 'relative',
              height: this.props.height,
              width: this.props.width,
            }}>
            <View
              key="left"
              style={{
                height: this.props.height + 80,
                backgroundColor: 'rgba(0,0,0,.5)',
                width: sideWidth,
                left: 0,
                position: 'absolute',
                top: 0,
              }}></View>
            <View
              key="right"
              style={{
                height: this.props.height + 80,
                backgroundColor: 'rgba(0,0,0,.5)',
                width: sideWidth,
                right: 0,
                position: 'absolute',
                top: 0,
              }}></View>
            <View
              key="top"
              style={{
                marginHorizontal: sideWidth,
                width: this.props.markerSize,
                backgroundColor: 'rgba(0,0,0,.5)',
                height: verticals + 40,
                top: 0,
                position: 'absolute',
              }}></View>
            <View
              key="bottom"
              style={{
                marginHorizontal: sideWidth,
                width: this.props.markerSize,
                backgroundColor: 'rgba(0,0,0,.5)',
                height: verticals + 40,
                bottom: -80,
                position: 'absolute',
              }}></View>
            {this.onClose && (
              <Icon
                name="close-circle-outline"
                type={Platform.select({
                  ios: 'ionicon',
                  android: 'material-community',
                })}
                size={40}
                color="black"
                containerStyle={{
                  position: 'absolute',
                  top: verticals - 40,
                  right: sideWidth - 40,
                }}
                onPress={this.onClose}
              />
            )}
          </View>
        }
        customMarker={
          <View>
            <QRCodeMask width={this.props.markerSize} color={'black'} />
            <Text style={{...style.center, textAlign: 'center'}}>
              Move closer to scan
            </Text>
          </View>
        }
        showMarker={true}
        bottomContent={this.props.bottomContent}
        bottomViewStyle={{
          position: 'absolute',
          zIndex: 2,
          bottom: 100,
        }}
        cameraStyle={{height: this.props.height + 80, width: this.props.width}}
      />
    );
  }
}

function QRCodeMask(props: {width: number; color: string}) {
  const {width: markerWidth, color} = props;
  const sectorWidth = markerWidth / 5;
  return (
    <View
      style={{position: 'relative', width: markerWidth, height: markerWidth}}>
      <View
        key="top-left"
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
        key="top-right"
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
        key="bottom-left"
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
        key="bottom-right"
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
    </View>
  );
}

const style = StyleSheet.create({
  center: {
    position: 'absolute',
    top: '50%',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
