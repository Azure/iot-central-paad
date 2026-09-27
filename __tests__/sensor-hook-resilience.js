import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {AppState} from 'react-native';
import {useSensors} from '../src/hooks/common';
import {StorageContext} from '../src/contexts/storage';
import {SensorMap} from '../src/sensors';
import {DATA_AVAILABLE_EVENT, SENSOR_UNAVAILABLE_EVENT} from '../src/types';

jest.mock('../src/contexts/storage', () => ({
  StorageContext: require('react').createContext({simulated: false}),
}));
jest.mock('../src/properties', () => ({
  Properties: [],
  getDeviceInfo: jest.fn(async () => ({})),
}));
jest.mock('../src/sensors', () => {
  const EventEmitter = require('events');
  const {AVAILABLE_SENSORS} = jest.requireActual('../src/sensors/internal');
  return {
    AVAILABLE_SENSORS,
    SensorMap: Object.fromEntries(
      Object.values(AVAILABLE_SENSORS).map(id => [
        id,
        Object.assign(new EventEmitter(), {
          enable: jest.fn(),
          simulate: jest.fn(),
          sendInterval: jest.fn(),
        }),
      ]),
    ),
  };
});

let current;
let view;
let foreground;
const removeAppListener = jest.fn();
function Probe() {
  [current] = useSensors();
  return null;
}
const tree = simulated => (
  <StorageContext.Provider value={{simulated}}>
    <Probe />
  </StorageContext.Provider>
);
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      foreground = handler;
      return {remove: removeAppListener};
    });
});
afterEach(() => {
  if (view) {
    act(() => view.unmount());
    view = undefined;
  }
  Object.values(SensorMap).forEach(sensor => {
    expect(sensor.listenerCount(DATA_AVAILABLE_EVENT)).toBe(0);
    expect(sensor.listenerCount(SENSOR_UNAVAILABLE_EVENT)).toBe(0);
  });
  jest.restoreAllMocks();
});

it('keeps unavailable sensors visible, preserves enable intent, and supports recovery', () => {
  act(() => {
    view = renderer.create(tree(false));
  });
  const before = current;
  act(() =>
    SensorMap.accelerometer.emit(SENSOR_UNAVAILABLE_EVENT, 'accelerometer'),
  );
  expect(current).toHaveLength(6);
  expect(current).not.toBe(before);
  expect(current.find(s => s.id === 'accelerometer')).toMatchObject({
    enabled: true,
    availability: 'unavailable',
  });
  expect(before.find(s => s.id === 'accelerometer').availability).toBe(
    'checking',
  );
  act(() => foreground('active'));
  expect(current.find(s => s.id === 'accelerometer').availability).toBe(
    'checking',
  );
  expect(SensorMap.accelerometer.enable).toHaveBeenLastCalledWith(true);
  act(() =>
    SensorMap.accelerometer.emit(DATA_AVAILABLE_EVENT, 'accelerometer', {x: 1}),
  );
  expect(current.find(s => s.id === 'accelerometer')).toMatchObject({
    availability: 'available',
    value: {x: 1},
    unit: 'm/s²',
  });
});

it('changes adapters only on explicit mode changes and never reenables a user-disabled sensor', () => {
  act(() => {
    view = renderer.create(tree(false));
  });
  expect(
    Object.values(SensorMap).every(sensor =>
      sensor.simulate.mock.calls.every(([value]) => value === false),
    ),
  ).toBe(true);
  act(() => current.find(s => s.id === 'battery').enable(false));
  expect(SensorMap.battery.enable).toHaveBeenLastCalledWith(false);
  act(() => {
    view.update(tree(true));
  });
  expect(current.every(sensor => sensor.simulated)).toBe(true);
  expect(SensorMap.battery.enable).toHaveBeenLastCalledWith(false);
  expect(current.find(s => s.id === 'battery').enabled).toBe(false);
  expect(SensorMap.accelerometer.simulate).toHaveBeenLastCalledWith(true);
  expect(SensorMap.accelerometer.unit).toBe('m/s²');
  for (let index = 0; index < 25; index++) {
    act(() =>
      SensorMap.accelerometer.emit(
        DATA_AVAILABLE_EVENT,
        'accelerometer',
        index,
      ),
    );
  }
  expect(SensorMap.accelerometer.listenerCount(DATA_AVAILABLE_EVENT)).toBe(1);
  expect(SensorMap.accelerometer.listenerCount(SENSOR_UNAVAILABLE_EVENT)).toBe(
    1,
  );
  expect(SensorMap.accelerometer.simulate).toHaveBeenCalledTimes(2);
  act(() => {
    view.update(tree(false));
  });
  expect(
    current.every(sensor => !sensor.simulated && sensor.value === undefined),
  ).toBe(true);
  act(() => view.unmount());
  view = undefined;
  expect(removeAppListener).toHaveBeenCalledTimes(1);
  expect(
    Object.values(SensorMap).every(
      sensor => sensor.enable.mock.calls.at(-1)[0] === false,
    ),
  ).toBe(true);
});
