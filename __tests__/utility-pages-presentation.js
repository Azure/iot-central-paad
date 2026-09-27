import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  FlatList,
  ScrollView,
  StyleSheet,
} from 'react-native';
import FileUpload from '../src/FileUpload';
import {BluetoothPage} from '../src/bluetooth/Bluetooth';
import {LogsContext} from '../src/contexts/logs';
import {Pages} from '../src/types';
import * as picker from 'expo-image-picker';
import {IotcBleManager} from '../src/bluetooth/BleManager';
import * as hooks from '../src/hooks';
import {palette} from '../src/theme/palette';
import {surfaceColor} from '../src/components/surface';

jest.mock('react-native-animatable', () => ({
  View: require('react-native').View,
}));
jest.mock('expo-image-picker', () => ({launchImageLibraryAsync: jest.fn()}));
jest.mock('../src/tools/Torch', () => ({acquireCamera: jest.fn()}));
jest.mock('../src/components/bottomPopup', () => 'BottomPopup');
jest.mock('../src/CardView', () => 'CardView');
jest.mock('../src/components', () => ({
  ...require('../src/components/typography'),
  Loader: 'Loader',
}));
jest.mock('react-native-progress', () => ({CircleSnail: 'CircleSnail'}));
jest.mock('../src/bluetooth/BleManager', () => ({
  IotcBleManager: {getInstance: jest.fn()},
}));
jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: 'BluetoothNavigator',
    Screen: 'BluetoothScreen',
  }),
}));
jest.mock('../src/hooks', () => {
  const React = require('react');
  return {
    useIoTCentralClient: jest.fn(),
    useSimulation: () => [false],
    useTheme: () => ({
      dark: false,
      colors: {
        text: '#17252A',
        card: '#fff',
        background: '#F5F4F0',
        primary: '#166B72',
      },
    }),
    useBoolean: initial => {
      const [value, setValue] = React.useState(initial);
      const controls = React.useMemo(
        () => ({
          True: () => setValue(true),
          False: () => setValue(false),
          Toggle: () => setValue(current => !current),
        }),
        [],
      );
      return [value, controls];
    },
  };
});
jest.mock('@rneui/themed', () => {
  const React = require('react');
  const ListItem = props =>
    React.createElement('ListItem', props, props.children);
  ListItem.Content = 'ListItemContent';
  ListItem.Title = 'ListItemTitle';
  ListItem.Subtitle = 'ListItemSubtitle';
  return {Icon: 'Icon', Text: 'Text', ListItem};
});

let view;
const visibleText = () =>
  view.root
    .findAllByType('Text')
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        child => typeof child === 'string',
      ),
    )
    .join('\n');
const append = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});

test('upload content scrolls instead of sizing against the entire screen and preserves submission behavior', async () => {
  let finish;
  const uploadFile = jest.fn(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  hooks.useIoTCentralClient.mockReturnValue([
    {isConnected: () => true, uploadFile},
  ]);
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{base64: 'AQID', fileName: 'photo.png'}],
  });
  act(() => {
    view = renderer.create(
      <LogsContext.Provider value={{append}}>
        <FileUpload />
      </LogsContext.Provider>,
    );
  });
  const card = () =>
    view.root
      .findAllByProps({testID: 'image-upload-card'})
      .find(node => node.props.onPress);
  // The card paints itself, so its style is resolved against a press state.
  const cardStyle = (pressed = false) =>
    StyleSheet.flatten(
      typeof card().props.style === 'function'
        ? card().props.style({pressed})
        : card().props.style,
    );
  expect(cardStyle()).toMatchObject({
    width: '100%',
    minHeight: 260,
  });
  expect(cardStyle().height).toBeUndefined();
  // A neutral raised sheet, never a tinted block.
  expect(cardStyle().backgroundColor).toBe(
    surfaceColor(false, {tone: 'raised'}),
  );
  expect(cardStyle().backgroundColor).not.toBe(palette(false).tints[0]);
  // Pressing deepens that same sheet instead of layering a second one.
  expect(cardStyle(true).backgroundColor).toBe(
    surfaceColor(false, {tone: 'raised', pressed: true}),
  );
  expect(view.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  act(() => card().props.onPress());
  await act(async () => {
    view.root.findAllByType('ListItem')[0].props.onPress();
  });
  expect(uploadFile).toHaveBeenCalledWith(
    'photo.jpg',
    'image/jpeg',
    'AQID',
    'base64',
  );
  expect(card().props.disabled).toBe(true);
  await act(async () => {
    finish({status: 201});
  });
  expect(visibleText()).toContain('Successfully uploaded photo.jpg');
  expect(append).toHaveBeenLastCalledWith({
    eventName: 'FILE UPLOAD',
    eventData: 'Image upload completed',
  });
});

test('Bluetooth does not duplicate the app header and keeps scanning failures explicit', () => {
  const remove = jest.fn();
  const manager = {
    observeAdvertisements: jest.fn(() => ({remove})),
    setResetDeviceListCallback: jest.fn(),
    resetDeviceList: jest.fn(),
  };
  IotcBleManager.getInstance.mockReturnValue(manager);
  act(() => {
    view = renderer.create(<BluetoothPage />);
  });
  const options =
    view.root.findByType('BluetoothNavigator').props.screenOptions;
  expect(options({route: {name: Pages.BLUETOOTH_LIST}}).headerShown).toBe(
    false,
  );
  expect(
    options({
      route: {
        name: Pages.BLUETOOTH_DETAIL,
        params: {deviceName: 'Test device'},
      },
    }),
  ).toMatchObject({headerShown: true, headerTitle: 'Test device'});
  const Component =
    view.root.findAllByType('BluetoothScreen')[0].props.component;
  const unsubscribe = jest.fn();
  const navigation = {
    addListener: jest.fn(() => unsubscribe),
    navigate: jest.fn(),
  };
  act(() => {
    view.update(<Component navigation={navigation} />);
  });
  const titles = view.root
    .findAllByType('Text')
    .filter(node => node.props.testID === 'bluetooth-tool-title');
  expect(titles).toHaveLength(1);
  expect(titles[0].props).toMatchObject({
    accessibilityRole: 'header',
    children: 'Nearby devices',
  });
  expect(visibleText()).toContain('Looking for devices');
  act(() => manager.observeAdvertisements.mock.calls[0][1]());
  expect(visibleText()).toContain('Bluetooth unavailable');
  // The refresh control does not infer progress from an empty list.
  const list = view.root.findByType(FlatList);
  expect(list.props.refreshing).toBeUndefined();
  expect(list.props.onRefresh).toBeUndefined();
  expect(list.props.refreshControl.props.refreshing).toBe(false);
  act(() => list.props.refreshControl.props.onRefresh());
  expect(manager.resetDeviceList).toHaveBeenCalledTimes(1);
  act(() => view.unmount());
  view = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(2);
});

test('Bluetooth scanning control meets the minimum touch target and the detail screen explains unavailability', () => {
  const remove = jest.fn();
  const manager = {
    observeAdvertisements: jest.fn(() => ({remove})),
    setResetDeviceListCallback: jest.fn(),
    resetDeviceList: jest.fn(),
  };
  IotcBleManager.getInstance.mockReturnValue(manager);
  hooks.useIoTCentralClient.mockReturnValue([null]);
  act(() => {
    view = renderer.create(<BluetoothPage />);
  });
  const screens = view.root.findAllByType('BluetoothScreen');
  const List = screens[0].props.component;
  const Detail = screens[1].props.component;
  act(() => {
    view.update(<List navigation={{addListener: jest.fn(() => jest.fn())}} />);
  });
  const scan = view.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Scan again',
    )
    .find(node => node.props.onPress);
  const target = StyleSheet.flatten(
    typeof scan.props.style === 'function'
      ? scan.props.style({pressed: false})
      : scan.props.style,
  );
  expect(target.minWidth).toBeGreaterThanOrEqual(48);
  expect(target.minHeight).toBeGreaterThanOrEqual(48);
  // A settled control keeps its reachable target, never a dimmed label.
  expect(target.opacity).toBeUndefined();
  // Secondary: a painted, hairline-bordered control with forest ink.
  expect(target.backgroundColor).toBe(surfaceColor(false, {tone: 'secondary'}));
  expect(target.borderWidth).toBeLessThanOrEqual(1);
  expect(
    view.root
      .findAllByType('Icon')
      .some(icon => icon.props.color === palette(false).primary),
  ).toBe(true);
  act(() => scan.props.onPress());
  expect(manager.resetDeviceList).toHaveBeenCalledTimes(1);

  act(() => {
    view.update(
      <Detail route={{params: {deviceId: 'abc', deviceName: 'Test device'}}} />,
    );
  });
  // The wait state belongs to the page, not to an overlay above it.
  expect(view.root.findAllByType('Loader')).toHaveLength(0);
  const page = view.root.findByType(ScrollView);
  expect(StyleSheet.flatten(page.props.contentContainerStyle)).toMatchObject({
    flexGrow: 1,
    paddingVertical: 16,
  });
  expect(StyleSheet.flatten(page.props.style).height).toBeUndefined();
  expect(
    view.root.findAllByProps({testID: 'bluetooth-detail-status'}).length,
  ).toBeGreaterThan(0);
  expect(visibleText()).toContain('Waiting for this device');
  expect(visibleText()).toContain('No readings yet');
  expect(visibleText()).toContain(
    'Keep this device nearby and powered on. Readings appear when it advertises.',
  );
  act(() => manager.observeAdvertisements.mock.calls.slice(-1)[0][1]());
  expect(visibleText()).toContain('Bluetooth unavailable');
  expect(visibleText()).toContain(
    'Enable Bluetooth and allow Nearby Devices access in Settings.',
  );
  expect(view.root.findAllByType('Loader')).toHaveLength(0);
  expect(view.root.findAllByType(ScrollView)).toHaveLength(1);
});

test('the busy indicator waits for the motion preference and stops once advertisements arrive', async () => {
  const remove = jest.fn();
  const manager = {
    observeAdvertisements: jest.fn(() => ({remove})),
    setResetDeviceListCallback: jest.fn(),
    resetDeviceList: jest.fn(),
  };
  IotcBleManager.getInstance.mockReturnValue(manager);
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({remove: jest.fn()});
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({remove: jest.fn()});
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  try {
    act(() => {
      view = renderer.create(<BluetoothPage />);
    });
    const List = view.root.findAllByType('BluetoothScreen')[0].props.component;
    act(() => {
      view.update(
        <List navigation={{addListener: jest.fn(() => jest.fn())}} />,
      );
    });
    const indicators = () => view.root.findAllByType(ActivityIndicator);
    // Reduce Motion is unknown on the first commit, so the row stays still.
    expect(indicators()).toHaveLength(0);
    expect(visibleText()).toContain('Looking for devices');
    await act(async () => {});
    expect(indicators()).toHaveLength(1);
    act(() =>
      manager.observeAdvertisements.mock.calls.slice(-1)[0][0]({
        id: 'device-1',
        name: 'Observed device',
        rssi: -40,
      }),
    );
    // An observed advertisement ends the wait; scanning continues without a spinner.
    expect(indicators()).toHaveLength(0);
    expect(visibleText()).toContain('Listening for advertisements');
    expect(visibleText()).not.toContain('Looking for devices');
    act(() => manager.observeAdvertisements.mock.calls.slice(-1)[0][1]());
    expect(indicators()).toHaveLength(0);
    expect(visibleText()).toContain('Bluetooth unavailable');
  } finally {
    AppState.currentState = previousState;
  }
});

test('Reduce Motion replaces the busy indicator with a still glyph', async () => {
  const remove = jest.fn();
  const manager = {
    observeAdvertisements: jest.fn(() => ({remove})),
    setResetDeviceListCallback: jest.fn(),
    resetDeviceList: jest.fn(),
  };
  IotcBleManager.getInstance.mockReturnValue(manager);
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({remove: jest.fn()});
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({remove: jest.fn()});
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  try {
    act(() => {
      view = renderer.create(<BluetoothPage />);
    });
    const List = view.root.findAllByType('BluetoothScreen')[0].props.component;
    act(() => {
      view.update(
        <List navigation={{addListener: jest.fn(() => jest.fn())}} />,
      );
    });
    await act(async () => {});
    expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    const status = view.root.findAllByProps({
      testID: 'bluetooth-scan-status',
    })[0];
    expect(status.findAllByType('Icon').length).toBeGreaterThan(0);
    expect(visibleText()).toContain('Looking for devices');
  } finally {
    AppState.currentState = previousState;
  }
});
