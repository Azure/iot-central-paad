import React, {useContext} from 'react';
import renderer, {act} from 'react-test-renderer';
import {StatusBar} from 'react-native';
import ThemeProvider, {ThemeContext} from '../src/contexts/theme';
import {ThemeMode} from '../src/types';

jest.mock('@rneui/themed', () => ({
  createTheme: config => config,
  ThemeProvider: ({children}) => children,
}));

function Probe() {
  return React.createElement('ThemeProbe', {value: useContext(ThemeContext)});
}

let tree;
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

test.each(['light', 'dark'])(
  'status icons follow app theme, including overrides of %s',
  system => {
    jest
      .spyOn(require('react-native'), 'useColorScheme')
      .mockReturnValue(system);
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });
    const style = () => tree.root.findByType(StatusBar).props.barStyle;
    const select = mode =>
      act(() => tree.root.findByType('ThemeProbe').props.value.set(mode));
    expect(style()).toBe(system === 'dark' ? 'light-content' : 'dark-content');
    select(ThemeMode.DARK);
    expect(style()).toBe('light-content');
    select(ThemeMode.LIGHT);
    expect(style()).toBe('dark-content');
    select(ThemeMode.DEVICE);
    expect(style()).toBe(system === 'dark' ? 'light-content' : 'dark-content');
  },
);
