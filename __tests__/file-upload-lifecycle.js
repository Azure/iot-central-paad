import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import * as picker from 'expo-image-picker';
import FileUpload from '../src/FileUpload';
import {LogsContext} from '../src/contexts/logs';
import * as hooks from '../src/hooks';
import {acquireCamera} from '../src/tools/Torch';
import {observeClient, getObservationStore} from '../src/observation';

jest.mock('react-native-animatable', () => ({
  View: require('react-native').View,
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('../src/tools/Torch', () => ({acquireCamera: jest.fn()}));
jest.mock('../src/components/bottomPopup', () => 'BottomPopup');
jest.mock('../src/components', () => require('../src/components/typography'));
jest.mock('react-native-progress', () => ({CircleSnail: 'CircleSnail'}));
jest.mock('../src/hooks', () => {
  const React = require('react');
  return {
    useIoTCentralClient: jest.fn(),
    useSimulation: jest.fn(),
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
  return {Icon: 'Icon', Text: 'Text', ListItem};
});

const selected = {
  canceled: false,
  assets: [{base64: 'AQID', fileName: 'private-image.png'}],
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
};
let tree;
let raw;
let client;
let simulated;
const append = jest.fn();
const Surface = () => (
  <LogsContext.Provider value={{append}}>
    <FileUpload />
  </LogsContext.Provider>
);
const render = () =>
  act(() => {
    if (tree) {
      tree.update(<Surface />);
    } else {
      tree = renderer.create(<Surface />);
    }
  });
const start = async (index = 0) => {
  await act(async () => {
    tree.root.findAllByType('ListItem')[index].props.onPress();
  });
};
const card = () =>
  tree.root
    .findAllByProps({testID: 'image-upload-card'})
    .find(node => node.props.onPress);
const change = reason => {
  if (reason === 'client') {
    client = {
      isConnected: () => true,
      uploadFile: jest.fn(async () => ({
        status: 201,
        delivery: 'acknowledged',
      })),
    };
    render();
  } else if (reason === 'simulation') {
    simulated = true;
    render();
  } else {
    act(() => tree.unmount());
    tree = undefined;
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  raw = {
    isConnected: () => true,
    uploadFile: jest.fn(async () => ({status: 201, delivery: 'acknowledged'})),
  };
  client = raw;
  simulated = false;
  hooks.useIoTCentralClient.mockImplementation(() => [client]);
  hooks.useSimulation.mockImplementation(() => [simulated]);
  picker.launchImageLibraryAsync.mockResolvedValue(selected);
  picker.launchCameraAsync.mockResolvedValue(selected);
  picker.getCameraPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  picker.requestCameraPermissionsAsync.mockResolvedValue({granted: true});
  acquireCamera.mockReturnValue(jest.fn());
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test.each(['client', 'simulation', 'unmount'])(
  'selection resolving after %s changes cannot start an upload',
  async reason => {
    const selection = deferred();
    picker.launchImageLibraryAsync.mockReturnValueOnce(selection.promise);
    render();
    await start();
    change(reason);
    await act(async () => selection.resolve(selected));
    expect(raw.uploadFile).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  },
);

test.each(['client', 'simulation', 'unmount'])(
  'permission resolving after %s changes cannot request another permission or open camera',
  async reason => {
    const permission = deferred();
    const release = jest.fn();
    acquireCamera.mockReturnValueOnce(release);
    picker.getCameraPermissionsAsync.mockReturnValueOnce(permission.promise);
    render();
    await start(1);
    change(reason);
    await act(async () =>
      permission.resolve({granted: false, canAskAgain: true}),
    );
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(raw.uploadFile).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  },
);

test.each(['resolve', 'reject'])(
  'an old upload %s cannot report status or unlock the new session operation',
  async settlement => {
    const first = deferred();
    const second = deferred();
    raw.uploadFile.mockReturnValueOnce(first.promise);
    render();
    await start();
    expect(raw.uploadFile).toHaveBeenCalledWith(
      'private-image.jpg',
      'image/jpeg',
      'AQID',
      'base64',
    );
    expect(card().props.disabled).toBe(true);
    const newer = {
      isConnected: () => true,
      uploadFile: jest.fn(() => second.promise),
    };
    client = newer;
    render();
    expect(card().props.disabled).toBe(false);
    await start();
    expect(newer.uploadFile).toHaveBeenCalledTimes(1);
    expect(card().props.disabled).toBe(true);
    append.mockClear();
    await act(async () => {
      first[settlement](
        settlement === 'resolve'
          ? {status: 201, delivery: 'acknowledged'}
          : new Error('private failure'),
      );
    });
    expect(append).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    await start();
    expect(newer.uploadFile).toHaveBeenCalledTimes(1);
    await act(async () =>
      second.resolve({status: 201, delivery: 'acknowledged'}),
    );
    expect(append).toHaveBeenLastCalledWith({
      eventName: 'FILE UPLOAD',
      eventData: 'Image upload completed',
    });
  },
);

test('switching simulation on and back still invalidates an old picker', async () => {
  const selection = deferred();
  picker.launchImageLibraryAsync.mockReturnValueOnce(selection.promise);
  render();
  await start();
  simulated = true;
  render();
  simulated = false;
  render();
  await act(async () => selection.resolve(selected));
  expect(raw.uploadFile).not.toHaveBeenCalled();
  expect(card().props.disabled).toBe(false);
});

test.each(['simulation', 'unmount'])(
  'upload result after %s cannot append a stale success',
  async reason => {
    const upload = deferred();
    raw.uploadFile.mockReturnValueOnce(upload.promise);
    render();
    await start();
    change(reason);
    append.mockClear();
    await act(async () =>
      upload.resolve({status: 201, delivery: 'acknowledged'}),
    );
    expect(append).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  },
);

test('a wrapped-client generation change during selection is stale even with the same client object', async () => {
  let connected = false;
  Object.assign(raw, {
    identity: null,
    isConnected: () => connected,
    connect: async () => {
      connected = true;
      return null;
    },
    cancel: () => {
      connected = false;
    },
  });
  client = observeClient(raw, false);
  await client.connect();
  const selection = deferred();
  picker.launchImageLibraryAsync.mockReturnValueOnce(selection.promise);
  render();
  await start();
  act(() => client.cancel());
  await client.connect();
  await act(async () => selection.resolve(selected));
  expect(raw.uploadFile).not.toHaveBeenCalled();
  expect(getObservationStore(client).getSnapshot().history).toEqual([]);
});

test.each([0, 1])(
  'a new upload attempt after connection loss explains recovery before source %i opens',
  async source => {
    let connected = true;
    Object.assign(raw, {
      identity: null,
      isConnected: () => connected,
      connect: async () => null,
      cancel: () => {
        connected = false;
      },
    });
    client = observeClient(raw, false);
    await client.connect();
    render();
    connected = false;
    client.isConnected();
    await start(source);
    expect(Alert.alert).toHaveBeenCalledWith(
      'File upload is not available.',
      'Reconnect in Connection details before selecting an image.',
    );
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(acquireCamera).not.toHaveBeenCalled();
    expect(raw.uploadFile).not.toHaveBeenCalled();
    expect(card().props.disabled).toBe(false);
  },
);

test('connection loss ends stale local progress instead of leaving an upload spinner', async () => {
  let connected = true;
  Object.assign(raw, {
    identity: null,
    isConnected: () => connected,
    connect: async () => null,
    cancel: () => {
      connected = false;
    },
  });
  client = observeClient(raw, false);
  await client.connect();
  const upload = deferred();
  raw.uploadFile.mockReturnValueOnce(upload.promise);
  render();
  await start();
  expect(card().props.disabled).toBe(true);
  connected = false;
  append.mockClear();
  await act(async () => upload.reject(new Error('private loss')));
  expect(card().props.disabled).toBe(false);
  expect(append).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('unmount ignores a picker failure and still releases camera ownership', async () => {
  const selection = deferred();
  const release = jest.fn();
  acquireCamera.mockReturnValueOnce(release);
  picker.launchCameraAsync.mockReturnValueOnce(selection.promise);
  render();
  await start(1);
  change('unmount');
  await act(async () => selection.reject(new Error('private picker failure')));
  expect(release).toHaveBeenCalledTimes(1);
  expect(append).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});
