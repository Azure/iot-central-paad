import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Home from '../src/Home';
import {IoTCContext} from '../src/contexts/iotc';
import {StorageContext} from '../src/contexts/storage';
import {LogsProvider, ThemeProvider} from '../src/contexts';
import {PHONE_MODEL_ID} from '../src/connection';
import {palette} from '../src/theme/palette';

const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockInterval = jest.fn();
const mockEnable = jest.fn();
const mockSensors = [
  {
    id: 'accelerometer',
    name: 'Accelerometer',
    enabled: true,
    availability: 'available',
    value: {x: 1, y: 2, z: 3},
    simulated: false,
    enable: mockEnable,
    sendInterval: mockInterval,
  },
];
const mockProperties = [
  {
    id: 'readOnlyProp',
    name: 'Sample property',
    enabled: true,
    editable: true,
    simulated: false,
    dataType: 'string',
    enable: jest.fn(),
    sendInterval: jest.fn(),
  },
];
const mockUpdate = jest.fn();
jest.mock('../src/hooks', () => ({
  ...jest.requireActual('../src/hooks'),
  useSensors: () => [mockSensors, mockAdd, mockRemove],
  useProperties: () => ({
    loading: false,
    properties: mockProperties,
    updateProperty: mockUpdate,
  }),
}));
jest.mock('../src/FileUpload', () => 'ImageTool');
jest.mock('../src/bluetooth/Bluetooth', () => ({
  BluetoothPage: 'BluetoothTool',
}));

const Stack = createStackNavigator();
const identity = {
  deviceId: 'phone-fixture',
  assignedHub: 'fixture.azure-devices.net',
  modelId: PHONE_MODEL_ID,
};
const credentials = {
  registrationId: 'phone-fixture',
  deviceId: 'phone-fixture',
  scopeId: '0ne00000000',
  deviceKey: 'NOT-A-REAL-KEY',
  provisioningHost: 'global.azure-devices-provisioning.net',
};
const client = {
  identity,
  isConnected: () => true,
  fetchTwin: jest.fn(async () => ({delivery: 'submitted'})),
  sendProperty: jest.fn(async () => ({delivery: 'submitted'})),
  on: jest.fn(() => jest.fn()),
  cancel: jest.fn(),
};
const state = {
  client,
  stage: 'connected',
  error: null,
  connecting: false,
  setError: jest.fn(),
  setClient: jest.fn(),
  setConnecting: jest.fn(),
  setStage: jest.fn(),
  request: {current: null},
};
let view;
const find = id =>
  view.root
    .findAllByProps({testID: id})
    .find(node => typeof node.props.onPress === 'function');
async function press(id) {
  await act(async () => {
    const control = find(id);
    expect(control).toBeDefined();
    control.props.onPress();
    await jest.advanceTimersByTimeAsync(400);
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    view?.unmount();
    await jest.runOnlyPendingTimersAsync();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('keeps one runtime through real tabs, tool navigation, draft edits, and return paths', async () => {
  await act(async () => {
    view = renderer.create(
      <ThemeProvider>
        <SafeAreaProvider>
          <IoTCContext.Provider value={state}>
            <StorageContext.Provider
              value={{
                credentials,
                simulated: false,
                deliveryInterval: 5,
                save: jest.fn(),
              }}>
              <LogsProvider>
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{animation: 'none'}}>
                    <Stack.Screen name="Root" component={Home} />
                    <Stack.Screen name="Insight">
                      {() => <View testID="chart-fixture" />}
                    </Stack.Screen>
                  </Stack.Navigator>
                </NavigationContainer>
              </LogsProvider>
            </StorageContext.Provider>
          </IoTCContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>,
    );
  });
  expect(client.fetchTwin).toHaveBeenCalledTimes(1);
  expect(client.on).toHaveBeenCalledTimes(2);
  expect(mockAdd).toHaveBeenCalledTimes(1);
  expect(mockInterval).toHaveBeenCalledTimes(1);
  // The tab bar is separated by its own tone and a hairline, never by a shadow.
  const edges = [palette(false).border, palette(true).border];
  const bars = view.root
    .findAll(node => typeof node.type === 'string')
    .map(node => StyleSheet.flatten(node.props.style))
    .filter(style => edges.includes(style?.borderTopColor));
  expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) {
    expect(bar.elevation).toBe(0);
    expect(bar.shadowOpacity ?? 0).toBe(0);
    expect(bar.shadowRadius ?? 0).toBe(0);
  }
  await press('tab-explore');
  for (const id of ['telemetry', 'properties', 'image', 'bluetooth']) {
    expect(find(`explore-tool-${id}`)).toBeDefined();
  }
  await press('explore-tool-properties');
  const input = () =>
    view.root
      .findAllByType(TextInput)
      .find(node => node.props.testID === 'property-input-readOnlyProp');
  expect(input()).toBeDefined();
  await act(async () => input().props.onChangeText('unsent draft'));
  await press('tab-activity');
  await press('activity-filter-issues');
  await press('activity-filter-all');
  await press('activity-diagnostics');
  expect(find('logs-filter-issues')).toBeDefined();
  await press('activity-observations');
  await press('tab-home');
  await press('home-node-dps');
  expect(
    view.root.findAllByProps({testID: 'home-panel-dps'}).length,
  ).toBeGreaterThan(0);
  await press('home-panel-close');
  await press('tab-explore');
  expect(input().props.value).toBe('unsent draft');
  await press('explore-back');
  for (const tool of ['telemetry', 'image', 'bluetooth']) {
    await press(`explore-tool-${tool}`);
    await press('explore-back');
  }
  await press('explore-tool-properties');
  expect(input().props.value).toBe('unsent draft');
  // The refresh hook intentionally preserves the old second twin request.
  expect(client.fetchTwin).toHaveBeenCalledTimes(2);
  expect(client.sendProperty).toHaveBeenCalledTimes(1);
  expect(client.on).toHaveBeenCalledTimes(2);
  expect(mockAdd).toHaveBeenCalledTimes(1);
  expect(mockInterval).toHaveBeenCalledTimes(1);
  expect(mockEnable).not.toHaveBeenCalled();
  const displayed = view.root
    .findAllByType(Text)
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        child => typeof child === 'string',
      ),
    )
    .join('\n');
  expect(displayed).not.toContain('NOT-A-REAL-KEY');
});
