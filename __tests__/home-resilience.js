import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  DeviceRuntimeProvider as Home,
  executeCommand,
} from '../src/runtime/DeviceRuntime';
import {playTorch} from '../src/tools/Torch';
import {IIoTCCommandResponse, IOTC_EVENTS} from '../src/connection';
import {
  ENABLE_DISABLE_COMMAND,
  SET_FREQUENCY_COMMAND,
  LIGHT_TOGGLE_COMMAND,
} from '../src/types';
import * as hooks from '../src/hooks';

jest.mock('../src/hooks', () => ({
  useLogger: jest.fn(),
  useSensors: jest.fn(),
  useProperties: jest.fn(),
  useDeliveryInterval: () => [5],
  useIoTCentralClient: jest.fn(),
}));
jest.mock('../src/tools/Torch', () => ({playTorch: jest.fn()}));
jest.mock('../src/components/connectionSummary', () => 'ConnectionSummary');
jest.mock('../src/components', () => ({Loader: 'Loader'}));
jest.mock('../src/CardView', () => 'CardView');
jest.mock('../src/FileUpload', () => 'FileUpload');
jest.mock('../src/Logs', () => 'Logs');
jest.mock('../src/bluetooth/Bluetooth', () => ({BluetoothPage: 'Bluetooth'}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({Navigator: 'Navigator', Screen: 'Screen'}),
}));

const sensor = () => ({
  id: 'accelerometer',
  enabled: true,
  enable: jest.fn(),
  sendInterval: jest.fn(),
});
const command = (name, data) => ({
  name,
  requestPayload: JSON.stringify(data),
  reply: jest.fn(async () => ({delivery: 'submitted'})),
});
beforeEach(() => jest.clearAllMocks());

it('only replies success after torch completion and preserves a zero delay', async () => {
  let finish;
  playTorch.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const request = command(LIGHT_TOGGLE_COMMAND, {
    pulses: 1,
    duration: 1,
    delay: 0,
  });
  const observed = jest.fn();
  const pending = executeCommand(request, [], jest.fn(), observed);
  expect(playTorch).toHaveBeenCalledWith(1, 1, 0);
  expect(request.reply).not.toHaveBeenCalled();
  expect(observed).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(request.reply).toHaveBeenCalledWith(
    IIoTCCommandResponse.SUCCESS,
    '{"execution":"completed"}',
  );
  expect(observed).toHaveBeenCalledWith('completed');
});

it('handles hardware failure and reply failure without leaking errors or payload', async () => {
  playTorch.mockRejectedValueOnce(new Error('deviceKey=private-fixture'));
  const request = command(LIGHT_TOGGLE_COMMAND, {
    pulses: 1,
    duration: 1,
    secret: 'private-fixture',
  });
  request.reply.mockRejectedValueOnce(new Error('private-fixture'));
  const append = jest.fn();
  const observed = jest.fn();
  await expect(
    executeCommand(request, [], append, observed),
  ).resolves.toBeUndefined();
  expect(request.reply.mock.calls[0][0]).toBe(IIoTCCommandResponse.ERROR);
  expect(observed).toHaveBeenCalledWith('rejected');
  expect(
    JSON.stringify([request.reply.mock.calls, append.mock.calls]),
  ).not.toContain('private-fixture');
});

it('records requested sensor intent separately from a failed response submission', async () => {
  const item = sensor();
  const request = command(SET_FREQUENCY_COMMAND, {
    sensor: item.id,
    interval: 2,
  });
  request.reply.mockRejectedValueOnce(new Error('private-fixture'));
  const observed = jest.fn();
  const append = jest.fn();
  await executeCommand(request, [item], append, observed);
  expect(item.sendInterval).toHaveBeenCalledWith(2000);
  expect(observed).toHaveBeenCalledWith('requested');
  expect(append).toHaveBeenCalledWith({
    eventName: 'ERROR',
    eventData: 'Command response could not be submitted.',
  });
});

it.each([
  [LIGHT_TOGGLE_COMMAND, {pulses: '1', duration: 1}],
  [LIGHT_TOGGLE_COMMAND, {pulses: 1, duration: 0}],
  [ENABLE_DISABLE_COMMAND, {sensor: 'accelerometer'}],
  [ENABLE_DISABLE_COMMAND, {sensor: 'accelerometer', enable: 'true'}],
  [ENABLE_DISABLE_COMMAND, {sensor: 'unknown', enable: true}],
  [SET_FREQUENCY_COMMAND, {sensor: 'accelerometer'}],
  [SET_FREQUENCY_COMMAND, {sensor: 'accelerometer', interval: 0}],
  [SET_FREQUENCY_COMMAND, {sensor: 'accelerometer', interval: 3601}],
  ['unknown', {sensor: 'accelerometer'}],
  [LIGHT_TOGGLE_COMMAND, null],
  [LIGHT_TOGGLE_COMMAND, []],
])('rejects invalid %s payload %#', async (name, data) => {
  const item = sensor();
  const request = command(name, data);
  await executeCommand(request, [item], jest.fn());
  expect(request.reply.mock.calls[0][0]).toBe(IIoTCCommandResponse.ERROR);
  expect(item.enable).not.toHaveBeenCalled();
  expect(item.sendInterval).not.toHaveBeenCalled();
  expect(playTorch).not.toHaveBeenCalled();
});

it('rejects malformed JSON and unavailable sensors, accepts explicit false and interval', async () => {
  const item = sensor();
  for (const request of [
    {...command(LIGHT_TOGGLE_COMMAND, {}), requestPayload: '{'},
    command(ENABLE_DISABLE_COMMAND, {sensor: item.id, enable: true}),
  ]) {
    await executeCommand(
      request,
      [{...item, availability: 'unavailable'}],
      jest.fn(),
    );
    expect(request.reply.mock.calls[0][0]).toBe(IIoTCCommandResponse.ERROR);
  }
  await executeCommand(
    command(ENABLE_DISABLE_COMMAND, {sensor: item.id, enable: false}),
    [item],
    jest.fn(),
  );
  await executeCommand(
    command(SET_FREQUENCY_COMMAND, {sensor: item.id, interval: 2}),
    [item],
    jest.fn(),
  );
  expect(item.enable).toHaveBeenCalledWith(false);
  expect(item.sendInterval).toHaveBeenCalledWith(2000);
});

it('unsubscribes client handlers on replacement/unmount and handles initial twin rejection', async () => {
  const append = jest.fn();
  const add = jest.fn();
  const remove = jest.fn();
  const updateProperty = jest.fn();
  const unsubscribers = [];
  const client = () => ({
    isConnected: () => true,
    on: jest.fn(() => {
      const unsubscribe = jest.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    }),
    fetchTwin: jest.fn(async () => {
      throw new Error('private-fixture');
    }),
  });
  hooks.useLogger.mockReturnValue([[], append]);
  hooks.useSensors.mockReturnValue([[sensor()], add, remove]);
  hooks.useProperties.mockReturnValue({
    loading: false,
    properties: [
      {id: 'model', value: 'phone'},
      {id: 'unavailable', value: undefined},
    ],
    updateProperty,
  });
  const first = client();
  hooks.useIoTCentralClient.mockReturnValue([first]);
  let view;
  await act(async () => {
    view = renderer.create(<Home navigation={{}} />);
  });
  expect(first.on.mock.calls.map(([event]) => event)).toEqual([
    IOTC_EVENTS.Commands,
    IOTC_EVENTS.Properties,
  ]);
  expect(first.fetchTwin).toHaveBeenCalledTimes(1);
  expect(add).toHaveBeenCalledTimes(1);
  await act(async () => {
    view.update(<Home navigation={{route: 'Explore'}} />);
    view.update(<Home navigation={{route: 'Activity'}} />);
  });
  expect(first.fetchTwin).toHaveBeenCalledTimes(1);
  expect(first.on).toHaveBeenCalledTimes(2);
  expect(add).toHaveBeenCalledTimes(1);
  expect(append).toHaveBeenCalledWith({
    eventName: 'ERROR',
    eventData: 'Device twin could not be requested.',
  });
  const refreshed = {
    fetchTwin: jest.fn(async () => ({})),
    sendProperty: jest.fn(async () => ({})),
  };
  await hooks.useIoTCentralClient.mock.calls[0][0](refreshed);
  expect(refreshed.fetchTwin).toHaveBeenCalledTimes(1);
  expect(refreshed.sendProperty).toHaveBeenCalledTimes(1);
  expect(refreshed.sendProperty).toHaveBeenCalledWith({
    device_info: {__t: 'c', model: 'phone'},
  });
  const propertyHandler = first.on.mock.calls[1][1];
  const ack = jest.fn(async () => ({}));
  await act(async () =>
    propertyHandler({
      name: 'device_info',
      value: {__t: 'c', model: 'phone'},
      ack,
    }),
  );
  expect(updateProperty).toHaveBeenCalledWith('model', 'phone');
  expect(updateProperty).not.toHaveBeenCalledWith('__t', 'c');
  expect(ack).toHaveBeenCalledTimes(1);
  hooks.useIoTCentralClient.mockReturnValue([client()]);
  await act(async () => {
    view.update(<Home navigation={{}} />);
  });
  expect(
    unsubscribers
      .slice(0, 2)
      .every(unsubscribe => unsubscribe.mock.calls.length === 1),
  ).toBe(true);
  await act(async () => view.unmount());
  expect(
    unsubscribers.every(unsubscribe => unsubscribe.mock.calls.length === 1),
  ).toBe(true);
  expect(remove).toHaveBeenCalledTimes(add.mock.calls.length);
});
