import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Platform} from 'react-native';
import Constants from 'expo-constants';
import Map from '../src/components/map';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {extra: {androidMapsConfigured: false}}},
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'NativeMap',
  Marker: 'Marker',
  PROVIDER_DEFAULT: undefined,
}));
jest.mock('../src/components/typography', () => ({
  Text: require('react-native').Text,
}));

let app;
const originalOS = Platform.OS;
afterEach(async () => {
  await act(async () => app?.unmount());
  Platform.OS = originalOS;
  Constants.expoConfig.extra.androidMapsConfigured = false;
});

test.each([
  ['android', false, false],
  ['android', true, true],
  ['ios', false, true],
])('%s map configuration %s renders native map: %s', async (os, configured, native) => {
  Platform.OS = os;
  Constants.expoConfig.extra.androidMapsConfigured = configured;
  await act(async () => {
    app = renderer.create(<Map location={{lat: 1.25, lon: -2.5}} />);
  });
  expect(app.root.findAllByType('NativeMap')).toHaveLength(native ? 1 : 0);
  if (!native) {
    expect(app.root.findByProps({testID: 'map-not-configured'})).toBeDefined();
    expect(JSON.stringify(app.toJSON())).toContain('1.25000');
  }
});
