import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {HistoryChart} from '../src/charts/HistoryChart';
import {appendSample, emptyHistory} from '../src/charts/history';

jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: {create: styles => styles},
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('../src/hooks', () => ({
  useTheme: () => ({dark: false, colors: {text: '#111', border: '#ddd'}}),
}));

let chart;
beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  if (chart) {
    act(() => chart.unmount());
    chart = undefined;
  }
});
afterAll(() => {
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

it('draws gaps rather than connecting through invalid readings', () => {
  let history = emptyHistory();
  [1, null, 3, 4].forEach((value, index) => {
    history = appendSample(history, 'test', value, index);
  });
  act(() => {
    chart = renderer.create(<HistoryChart history={history} unit="hPa" />);
  });
  const path = chart.root.findByType('Path').props.d;
  expect(path.match(/M/g)).toHaveLength(2);
  expect(path.match(/L/g)).toHaveLength(1);
  expect(chart.root.findAllByType('Circle')).toHaveLength(3);
  const text = JSON.stringify(chart.toJSON());
  ['Latest:', 'Minimum:', 'Maximum:', 'Average:', 'hPa'].forEach(label => {
    expect(text).toContain(label);
  });
});

it('keeps SVG coordinates finite for constant and extreme values', () => {
  let history = emptyHistory();
  [-Number.MAX_VALUE, Number.MAX_VALUE].forEach((value, index) => {
    history = appendSample(history, 'test', {x: value, y: 0}, index);
  });
  act(() => {
    chart = renderer.create(<HistoryChart history={history} />);
  });
  chart.root.findAllByType('Path').forEach(path => {
    expect(path.props.d).not.toMatch(/NaN|Infinity/);
  });
  chart.root.findAllByType('Circle').forEach(point => {
    expect(Number.isFinite(point.props.cx)).toBe(true);
    expect(Number.isFinite(point.props.cy)).toBe(true);
  });
});

it('shows unavailable summaries with no invented plot for invalid values', () => {
  const history = appendSample(emptyHistory(), 'test', NaN, 1);
  act(() => {
    chart = renderer.create(<HistoryChart history={history} />);
  });
  expect(chart.root.findAllByType('Svg')).toHaveLength(0);
  expect(JSON.stringify(chart.toJSON())).toContain('Unavailable');
});
