// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {Camera, CameraView} from 'expo-camera';
import {hasTorch} from '../platform';

let cameraOwner: symbol | undefined;

/** Camera previews and the torch must never own the native camera together. */
export function acquireCamera(_purpose: 'qr' | 'torch' | 'photo'): () => void {
  if (cameraOwner) {
    throw new Error('Camera is already in use');
  }
  const owner = Symbol('camera');
  cameraOwner = owner;
  return () => {
    if (cameraOwner === owner) {
      cameraOwner = undefined;
    }
  };
}

type TorchSession = {
  on: boolean;
  ready(): void;
  fail(): void;
};
let session: TorchSession | null = null;
let hostMounted = false;
const listeners = new Set<() => void>();
function publish(value: TorchSession | null) {
  session = value;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => session;

/** Mount once at the application root; no camera is opened until a command. */
export function TorchCameraHost() {
  const current = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    hostMounted = true;
    return () => {
      hostMounted = false;
      session?.fail();
    };
  }, []);
  if (!current) {
    return null;
  }
  return React.createElement(CameraView, {
    facing: 'back',
    enableTorch: current.on,
    mute: true,
    onCameraReady: current.ready,
    onMountError: current.fail,
    style: {position: 'absolute', width: 1, height: 1, left: 0, top: 0},
    pointerEvents: 'none',
    accessible: false,
  });
}

export async function playTorch(
  repeats: number,
  duration: number,
  interval: number,
) {
  if (
    !Number.isInteger(repeats) ||
    repeats < 1 ||
    repeats > 100 ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 60 ||
    !Number.isFinite(interval) ||
    interval < 0 ||
    interval > 60
  ) {
    throw new Error('Invalid torch timing');
  }
  if (
    !hostMounted ||
    AppState.currentState !== 'active' ||
    !(await hasTorch())
  ) {
    throw new Error('Torch unavailable');
  }
  const release = acquireCamera('torch');
  try {
    let permission = await Camera.getCameraPermissionsAsync();
    if (permission && !permission.granted && permission.canAskAgain) {
      permission = await Camera.requestCameraPermissionsAsync();
    }
    if (!permission?.granted) {
      throw new Error('Camera permission denied');
    }
    if (!hostMounted || AppState.currentState !== 'active') {
      throw new Error('Torch unavailable');
    }
    let rejectFailure: (error: Error) => void = () => {};
    const failed = new Promise<never>((_resolve, reject) => {
      rejectFailure = reject;
    });
    const fail = () =>
      rejectFailure(new Error('Torch interrupted or unavailable'));
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        publish(null);
        fail();
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = (milliseconds: number) =>
      Promise.race([
        failed,
        new Promise<void>(resolve => {
          timer = setTimeout(resolve, milliseconds);
        }),
      ]);
    try {
      const ready = new Promise<void>(resolve => {
        publish({on: false, ready: resolve, fail});
      });
      await Promise.race([
        ready,
        failed,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Camera startup timed out')),
            10000,
          );
        }),
      ]);
      clearTimeout(timer);
      for (let count = 0; count < repeats; count++) {
        publish({on: true, ready() {}, fail});
        await wait(duration * 1000);
        publish({on: false, ready() {}, fail});
        if (count + 1 < repeats) {
          await wait(interval * 1000);
        }
      }
    } finally {
      clearTimeout(timer);
      appState.remove();
      publish(null);
      // Let React unmount the camera before another owner opens a preview.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  } finally {
    release();
  }
}
