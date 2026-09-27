import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, StyleSheet, Switch} from 'react-native';
import Settings from '../src/Settings';
import {StorageContext} from '../src/contexts/storage';
import {IoTCContext} from '../src/contexts/iotc';
import {ThemeContext} from '../src/contexts/theme';
import {ThemeMode} from '../src/types';
import {defaults} from '../src/contexts/defaults';
import {palette} from '../src/theme/palette';
import {
  useConnectIoTCentralClient,
  useSimulation,
} from '../src/hooks/iotc';

jest.mock('../src/hooks/iotc', () => ({
  useDeliveryInterval: () => [5],
  useSimulation: jest.fn(),
  useConnectIoTCentralClient: jest.fn(),
}));
jest.mock('../src/hooks', () => ({
  useBoolean: initial => {
    const React = require('react');
    const [value, setValue] = React.useState(initial);
    const actions = React.useMemo(
      () => ({
        True: () => setValue(true),
        False: () => setValue(false),
        Toggle: () => setValue(previous => !previous),
      }),
      [],
    );
    return [value, actions];
  },
  useTheme: () => ({colors: {text: '#000'}, dark: false}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    getState: () => ({routes: []}),
    dispatch: jest.fn(),
  }),
  StackActions: {replace: name => ({name})},
}));
jest.mock('@rneui/themed', () => ({
  Icon: 'Icon',
  ListItem: Object.assign(
    props => require('react').createElement('ListItem', props, props.children),
    {
      Content: 'Content',
      Chevron: 'Chevron',
      Title: 'Title',
      Subtitle: 'Subtitle',
    },
  ),
}));
jest.mock('../src/components/loader', () => ({Loader: 'Loader'}));
jest.mock('../src/components/typography', () => ({
  Text: require('react-native').Text,
  camelToName: value => value,
}));

let app;
let clear;
let disconnect;
let setError;
let simulate;
let alert;
const oldDev = defaults.dev;
const tree = () => (
  <ThemeContext.Provider value={{mode: ThemeMode.DEVICE}}>
    <StorageContext.Provider value={{clear}}>
      <IoTCContext.Provider value={{setError}}>
        <Settings />
      </IoTCContext.Provider>
    </StorageContext.Provider>
  </ThemeContext.Provider>
);
beforeEach(async () => {
  defaults.dev = true;
  clear = jest.fn(async () => {});
  disconnect = jest.fn();
  setError = jest.fn();
  simulate = jest.fn(async () => {});
  useSimulation.mockReturnValue([false, simulate]);
  useConnectIoTCentralClient.mockReturnValue([null, null, disconnect]);
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    app = renderer.create(tree());
  });
});
afterEach(async () => {
  await act(async () => app.unmount());
  defaults.dev = oldDev;
  jest.restoreAllMocks();
});

const confirmWipe = async () => {
  const wipe = app.root
    .findAllByType('ListItem')
    .find(item => item.findAllByProps({children: 'Wipe data'}).length > 0);
  await act(async () => wipe.props.onPress());
  return alert.mock.calls[0][2][0].onPress;
};

test('wiping local state disconnects before clearing storage', async () => {
  const proceed = await confirmWipe();
  await act(async () => proceed());
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(1);
  expect(disconnect.mock.invocationCallOrder[0]).toBeLessThan(
    clear.mock.invocationCallOrder[0],
  );
  expect(alert).toHaveBeenCalledTimes(2);
});

test('failed clearing stays disconnected and surfaces only a safe error', async () => {
  clear.mockRejectedValueOnce(new Error('private-native-fixture'));
  const proceed = await confirmWipe();
  await act(async () => proceed());
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(setError).toHaveBeenCalledWith(
    expect.objectContaining({code: 'STORAGE_FAILED'}),
  );
  expect(JSON.stringify(setError.mock.calls)).not.toContain('private-native');
  expect(alert).toHaveBeenCalledTimes(1);
});

test('simulation switch waits for persistence and follows the saved value', async () => {
  let finish;
  simulate.mockImplementationOnce(
    () => new Promise(resolve => { finish = resolve; }),
  );
  let pending;
  await act(async () => {
    pending = app.root.findByType(Switch).props.onValueChange(true);
  });
  expect(app.root.findByType(Switch).props.disabled).toBe(true);
  expect(app.root.findByType(Switch).props.value).toBe(false);
  await act(async () => {
    finish();
    await pending;
    useSimulation.mockReturnValue([true, simulate]);
    app.update(tree());
  });
  expect(app.root.findByType(Switch).props.disabled).toBe(false);
  expect(app.root.findByType(Switch).props.value).toBe(true);
});

test('failed simulation persistence does not optimistically flip the switch', async () => {
  const report = jest.spyOn(console, 'warn').mockImplementation(() => {});
  simulate.mockRejectedValueOnce(new Error('private-native-fixture'));
  await act(async () => {
    await app.root.findByType(Switch).props.onValueChange(true);
  });
  expect(app.root.findByType(Switch).props.value).toBe(false);
  expect(app.root.findByType(Switch).props.disabled).toBe(false);
  expect(JSON.stringify(report.mock.calls)).not.toContain('private-native');
});

test('settings rows keep their row semantics with a gentle pressed fill', () => {
  const colors = palette(false);
  const rows = app.root.findAllByType('ListItem');
  const navigable = rows.filter(row => row.props.onPress);
  expect(navigable.length).toBeGreaterThan(0);
  for (const row of navigable) {
    const container = StyleSheet.flatten(row.props.containerStyle);
    expect(container.minHeight).toBeGreaterThanOrEqual(48);
    expect(container.backgroundColor).toBe('transparent');
    expect(row.props.style({pressed: false})).toBeNull();
    expect(
      StyleSheet.flatten(row.props.style({pressed: true})).backgroundColor,
    ).toBe(colors.inset);
    expect(
      StyleSheet.flatten(row.props.style({pressed: true})).opacity,
    ).toBeUndefined();
  }
  // A row without an action never advertises a press style.
  const version = rows.find(row => !row.props.onPress);
  expect(version.props.style).toBeUndefined();
});
