// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {AppState, AppStateStatus, StyleSheet, View} from 'react-native';
import {BarcodeScanningResult, Camera, CameraView} from 'expo-camera';
import {Text} from './typography';
import DetailsAction from './detailsAction';
import Strings from '../strings';
import {acquireCamera} from '../tools/Torch';

export type Event = BarcodeScanningResult;
export type IQRCodeProps = {
  height: number;
  width: number;
  markerSize: number;
  onRead: (event: Event) => void | Promise<void>;
  onClose?: () => void | Promise<void>;
  bottomContent?: React.ReactNode;
};
type State = {active: boolean; error: string | null};

export default class QRCodeScanner extends React.Component<
  IQRCodeProps,
  State
> {
  state: State = {active: false, error: null};
  private mounted = false;
  private generation = 0;
  private accepted = true;
  private ready = false;
  private release?: () => void;
  private appState?: {remove(): void};
  private startupTimer?: ReturnType<typeof setTimeout>;
  private resumeOnForeground = false;

  componentDidMount() {
    this.mounted = true;
    this.appState = AppState.addEventListener('change', this.onAppState);
    this.resumeOnForeground = AppState.currentState !== 'active';
    this.reactivate();
  }

  componentWillUnmount() {
    this.mounted = false;
    this.generation++;
    this.accepted = true;
    clearTimeout(this.startupTimer);
    this.appState?.remove();
    this.release?.();
    this.release = undefined;
  }

  private onAppState = (state: AppStateStatus) => {
    if (state !== 'active') {
      this.resumeOnForeground = this.state.active;
      this.pause();
    } else if (this.resumeOnForeground) {
      this.resumeOnForeground = false;
      this.reactivate();
    }
  };

  private pause = (after?: () => void) => {
    this.generation++;
    this.accepted = true;
    this.ready = false;
    clearTimeout(this.startupTimer);
    const release = this.release;
    this.release = undefined;
    if (!this.mounted) {
      release?.();
      return;
    }
    this.setState({active: false}, () => {
      release?.();
      after?.();
    });
  };

  public reactivate = () => {
    if (
      !this.mounted ||
      this.state.active ||
      AppState.currentState !== 'active'
    ) {
      return;
    }
    const generation = ++this.generation;
    const current = () => this.mounted && generation === this.generation;
    void (async () => {
      try {
        let permission = await Camera.getCameraPermissionsAsync();
        if (!current()) {
          return;
        }
        if (!permission.granted && permission.canAskAgain) {
          permission = await Camera.requestCameraPermissionsAsync();
        }
        if (!current()) {
          return;
        }
        if (!permission.granted) {
          throw new Error('Camera permission is required to scan a QR code.');
        }
        this.release = acquireCamera('qr');
        this.accepted = false;
        this.ready = false;
        this.setState({active: true, error: null}, () => {
          this.startupTimer = setTimeout(() => {
            if (current() && !this.ready) {
              this.pause(() =>
                this.setState({
                  error: 'Camera unavailable. Please connect manually.',
                }),
              );
            }
          }, 10000);
        });
      } catch {
        if (current()) {
          this.setState({
            active: false,
            error:
              'Camera unavailable. Allow camera access in Settings, or connect manually.',
          });
        }
      }
    })();
  };

  private onRead = (event: Event) => {
    if (
      this.accepted ||
      !this.ready ||
      !this.state.active ||
      event.type !== 'qr'
    ) {
      return;
    }
    // Synchronous gate, before setState/async registration, rejects duplicates.
    this.accepted = true;
    this.pause(() => {
      Promise.resolve()
        .then(() => this.props.onRead(event))
        .catch(() => {
          if (this.mounted) {
            this.setState({
              error: 'Unable to read this QR code. Please retry.',
            });
          }
        });
    });
  };

  private close = () =>
    this.pause(() => {
      void Promise.resolve()
        .then(() => this.props.onClose?.())
        .catch(() => {});
    });

  render() {
    const {height, width, markerSize, bottomContent, onClose} = this.props;
    return (
      <View style={{height, width}}>
        {this.state.active && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{barcodeTypes: ['qr']}}
            onBarcodeScanned={this.onRead}
            onCameraReady={() => {
              this.ready = true;
              clearTimeout(this.startupTimer);
            }}
            onMountError={() =>
              this.pause(() =>
                this.setState({
                  error: 'Camera unavailable. Please connect manually.',
                }),
              )
            }
          />
        )}
        <View pointerEvents="box-none" style={styles.overlay}>
          <View
            pointerEvents="none"
            style={[styles.marker, {height: markerSize, width: markerSize}]}
          />
          {this.state.error && (
            <Text style={styles.message}>{this.state.error}</Text>
          )}
          {(!this.state.active || onClose) && (
            <View style={styles.controls}>
              {!this.state.active && (
                <DetailsAction
                  label={Strings.Core.Retry}
                  icon="reload"
                  variant="primary"
                  block
                  onPress={this.reactivate}
                />
              )}
              {onClose && (
                <DetailsAction
                  label={Strings.Core.Close}
                  variant="secondary"
                  block
                  onPress={this.close}
                />
              )}
            </View>
          )}
          {bottomContent}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  overlay: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  controls: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  marker: {borderWidth: 3, borderColor: 'white'},
  message: {
    textAlign: 'center',
    backgroundColor: 'white',
    color: 'black',
    padding: 12,
  },
});
