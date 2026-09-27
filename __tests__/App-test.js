/**
 * @format
 */

import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import React from 'react';
import App from '../src/App';
import {Welcome} from '../src/Welcome';
import Strings from '../src/strings';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import VersionCheck from 'react-native-version-check';
import {IoTCClient} from 'react-native-azure-iotcentral-client';
import renderer, {act} from 'react-test-renderer';
import {surfaceColor} from '../src/components/surface';

describe('App startup', () => {
  let app;
  let connect;

  beforeEach(() => {
    app = undefined;
    jest.useFakeTimers();
    jest.clearAllMocks();
    connect = jest
      .spyOn(IoTCClient.prototype, 'connect')
      .mockImplementation(() => {
        throw new Error(
          'Startup without credentials must not connect to Azure',
        );
      });
  });

  afterEach(async () => {
    try {
      await act(async () => {
        app?.unmount();
      });
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      // RN queues Animated node detachment after React's unmount commit.
      jest.runAllTicks();
      expect(jest.getTimerCount()).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(global.XMLHttpRequest).not.toHaveBeenCalled();
      expect(global.WebSocket).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  });

  const hasText = text =>
    app.root.findAllByType(Text).some(node => node.props.children === text);

  const press = id => {
    const control = app.root
      .findAllByProps({testID: id})
      .find(node => typeof node.props.onPress === 'function');
    expect(control).toBeDefined();
    control.props.onPress();
  };

  it.each([
    ['com.microsoft.iotpnp', 2],
    ['com.microsoft.iotpnp.ci', 0],
    ['com.iot_pnp.ci', 0],
  ])(
    'opens registration without credentials for %s',
    async (bundleId, updateChecks) => {
      jest.spyOn(DeviceInfo, 'getBundleId').mockReturnValue(bundleId);
      await act(async () => {
        app = renderer.create(<App />);
      });

      expect(app.root.findByType(Welcome)).toBeDefined();
      expect(hasText(Strings.Title)).toBe(true);
      expect(hasText('Scan QR code')).toBe(false);
      expect(DeviceInfo.isEmulator).toHaveBeenCalledTimes(1);
      expect(Keychain.getGenericPassword).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1999);
      });
      expect(app.root.findByType(Welcome)).toBeDefined();
      expect(Keychain.getGenericPassword).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(1);
        await jest.runOnlyPendingTimersAsync();
      });

      expect(app.root.findAllByType(Welcome)).toHaveLength(0);
      expect(
        app.root
          .findAllByProps({testID: 'app-header-title'})
          .some(node => node.props.accessibilityLabel === Strings.Header.Title),
      ).toBe(true);
      expect(hasText(Strings.Registration.Header.Welcome)).toBe(true);
      expect(hasText('Scan QR code')).toBe(true);
      expect(hasText(Strings.Registration.QRCode.Manually)).toBe(true);
      expect(hasText(Strings.Registration.StartHere.Title)).toBe(true);
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
      const logo = app.root.findByProps({testID: 'app-header-logo'});
      expect(logo.props.pointerEvents).toBe('none');
      expect(StyleSheet.flatten(logo.props.style)).toMatchObject({
        width: 28,
        height: 28,
        marginLeft: 14,
        marginRight: 8,
      });
      expect(
        StyleSheet.flatten(logo.props.style).backgroundColor,
      ).toBeUndefined();
      const settings = app.root
        .findAllByProps({testID: 'app-settings'})
        .find(node => typeof node.type === 'string');
      expect(settings.props.accessibilityLabel).toBe(Strings.Settings.Title);
      expect(StyleSheet.flatten(settings.props.style)).toMatchObject({
        minWidth: 48,
        minHeight: 48,
      });
      // The header control is a softly shaded plate inside a full target,
      // never a large floating blob painted over the whole 48pt area.
      expect(
        StyleSheet.flatten(settings.props.style).backgroundColor,
      ).toBeUndefined();
      const plate = settings
        .findAll(node => typeof node.type === 'string')
        .map(node => StyleSheet.flatten(node.props.style))
        .find(style => style?.borderRadius === 14);
      expect(plate).toMatchObject({width: 40, height: 40});
      expect(
        [false, true].map(mode => surfaceColor(mode, {tone: 'secondary'})),
      ).toContain(plate.backgroundColor);
      expect(VersionCheck.needUpdate).toHaveBeenCalledTimes(updateChecks);
      if (updateChecks > 0) {
        expect(VersionCheck.needUpdate).toHaveBeenNthCalledWith(2, {
          depth: 1,
          packageName: 'com.microsoft.iotpnp',
        });
      }

      await act(async () => {
        press('registration-manual');
        await jest.runOnlyPendingTimersAsync();
      });
      expect(hasText(Strings.Registration.Manual.Body.ConnectionInfo)).toBe(
        true,
      );
      expect(hasText(Strings.Title)).toBe(false);
      expect(
        app.root.findAllByProps({testID: 'app-header-title'}),
      ).toHaveLength(0);
      const dismissWrappers = app.root
        .findAllByType(TouchableWithoutFeedback)
        .filter(node => node.props.onPress === Keyboard.dismiss);
      expect(dismissWrappers).toHaveLength(1);
      expect(dismissWrappers[0].props.accessible).toBe(false);
      const input = id =>
        app.root
          .findAllByType(TextInput)
          .find(node => node.props.testID === id);
      expect(input('connection-deviceKey').props.secureTextEntry).toBe(true);
      await act(async () => {
        input('connection-registrationId').props.onChangeText('phone');
        input('connection-deviceKey').props.onChangeText(
          'invalid-preserved-key',
        );
      });
      await act(async () => {
        press('connection-submit');
      });
      expect(input('connection-deviceKey').props.value).toBe(
        'invalid-preserved-key',
      );
      expect(
        app.root.findAllByProps({testID: 'connection-error-code'})[0].props
          .children,
      ).toBe('INVALID_CREDENTIALS');
      expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      await act(async () => {
        press('registration-back');
        await jest.runOnlyPendingTimersAsync();
      });
      expect(hasText('Scan QR code')).toBe(true);
    },
  );

  it.each([
    ['-34018', '-34018'],
    ['fixture-sensitive-code', 'unknown code'],
  ])(
    'surfaces initialization failure safely and allows retry (%s)',
    async (code, loggedCode) => {
      const message = 'fixture-sensitive-credential-must-not-be-exposed';
      const report = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest
        .spyOn(Keychain, 'getGenericPassword')
        .mockRejectedValueOnce(Object.assign(new Error(message), {code}));

      await act(async () => {
        app = renderer.create(<App />);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(
        app.root.findAllByProps({testID: 'startup-error'}).length,
      ).toBeGreaterThan(0);
      expect(report).toHaveBeenCalledWith(
        'App initialization failed',
        loggedCode,
      );
      expect(JSON.stringify(app.toJSON())).not.toContain(message);
      expect(JSON.stringify(report.mock.calls)).not.toContain(message);
      if (loggedCode === 'unknown code') {
        expect(JSON.stringify(app.toJSON())).not.toContain(code);
        expect(JSON.stringify(report.mock.calls)).not.toContain(code);
      }
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();

      await act(async () => {
        press('startup-retry');
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
        await jest.runOnlyPendingTimersAsync();
      });

      expect(app.root.findAllByProps({testID: 'startup-error'})).toHaveLength(
        0,
      );
      expect(hasText('Scan QR code')).toBe(true);
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(2);
      expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    },
  );
});
