import React from 'react';
import renderer, {act} from 'react-test-renderer';
import Chart from '../src/Chart';
import {SensorMap} from '../src/sensors';
import {
  ChartType,
  DATA_AVAILABLE_EVENT,
  SENSOR_UNAVAILABLE_EVENT,
} from '../src/types';

jest.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: {create: styles => styles},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, left: 0, right: 0, bottom: 0}),
}));
jest.mock('../src/hooks', () => ({
  useTheme: () => ({dark: false, colors: {background: '#fff', text: '#111'}}),
}));
jest.mock('../src/components/typography', () => ({
  Text: 'Text',
  camelToName: value => value,
}));
jest.mock('../src/components/map', () => 'Map');
jest.mock('../src/charts/HistoryChart', () => ({HistoryChart: 'HistoryChart'}));
jest.mock('../src/sensors', () => {
  const EventEmitter = require('events');
  return {
    SensorMap: {
      test: Object.assign(new EventEmitter(), {unit: 'm/s²', simulated: true}),
      other: new EventEmitter(),
    },
  };
});

let screen;
const route = (params = {}) => ({
  params: {
    telemetryId: 'test',
    chartType: ChartType.DEFAULT,
    currentValue: 2,
    ...params,
  },
});
const history = () => screen.root.findByType('HistoryChart').props.history;

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
    screen = undefined;
  }
  Object.values(SensorMap).forEach(sensor => sensor.removeAllListeners());
});
afterAll(() => {
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

it('seeds once, subscribes once, and removes both handlers on unmount', () => {
  act(() => {
    screen = renderer.create(<Chart route={route()} />);
  });
  expect(history().series[0].samples).toHaveLength(1);
  expect(SensorMap.test.listenerCount(DATA_AVAILABLE_EVENT)).toBe(1);
  act(() => SensorMap.test.emit(DATA_AVAILABLE_EVENT, 'test', 3));
  act(() => screen.update(<Chart route={route({currentValue: 99})} />));
  expect(history().series[0].samples.map(sample => sample.value)).toEqual([
    2, 3,
  ]);
  expect(SensorMap.test.listenerCount(DATA_AVAILABLE_EVENT)).toBe(1);
  act(() => SensorMap.test.emit(DATA_AVAILABLE_EVENT, 'other', 7));
  expect(history().series[0].samples).toHaveLength(2);
  act(() => screen.unmount());
  screen = undefined;
  expect(SensorMap.test.listenerCount(DATA_AVAILABLE_EVENT)).toBe(0);
  expect(SensorMap.test.listenerCount(SENSOR_UNAVAILABLE_EVENT)).toBe(0);
});

it('resets history and cleans the old subscription when telemetry changes', () => {
  act(() => {
    screen = renderer.create(<Chart route={route()} />);
  });
  act(() =>
    screen.update(
      <Chart
        route={route({
          telemetryId: 'other',
          currentValue: 8,
        })}
      />,
    ),
  );
  expect(SensorMap.test.listenerCount(DATA_AVAILABLE_EVENT)).toBe(0);
  expect(SensorMap.other.listenerCount(DATA_AVAILABLE_EVENT)).toBe(1);
  expect(history().series[0].samples.map(sample => sample.value)).toEqual([8]);
});

it('shows unavailable readings explicitly and uses supplied metadata', () => {
  act(() => {
    screen = renderer.create(<Chart route={route()} />);
  });
  expect(screen.root.findByType('HistoryChart').props.unit).toBe('m/s²');
  expect(JSON.stringify(screen.toJSON())).toContain('Simulated sensor data');
  act(() => SensorMap.test.emit(SENSOR_UNAVAILABLE_EVENT, 'test'));
  expect(history().unavailable).toBe(true);
  expect(history().series[0].samples[1].value).toBeNull();
  expect(JSON.stringify(screen.toJSON())).toContain(
    'Latest reading unavailable',
  );
});

it('keeps the existing map local component and updates validated coordinates', () => {
  act(() => {
    screen = renderer.create(
      <Chart
        route={route({
          chartType: ChartType.MAP,
          currentValue: undefined,
        })}
      />,
    );
  });
  expect(screen.root.findAllByType('Map')).toHaveLength(0);
  expect(JSON.stringify(screen.toJSON())).toContain('Location unavailable');
  act(() =>
    SensorMap.test.emit(DATA_AVAILABLE_EVENT, 'test', {lat: 0, lon: 0}),
  );
  expect(screen.root.findByType('Map').props.location).toEqual({
    lat: 0,
    lon: 0,
  });
  act(() => SensorMap.test.emit(DATA_AVAILABLE_EVENT, 'test', null));
  expect(screen.root.findAllByType('Map')).toHaveLength(0);
});
