// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useMemo, useState} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {
  DefaultTheme,
  DarkTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import {createTheme, ThemeProvider as UIThemeProvider} from '@rneui/themed';
import {ThemeMode} from 'types';
import {palette} from '../theme/palette';

export interface ITheme {
  backgroundColor: string;
  textColor: string;
}
interface IThemeContext {
  mode: ThemeMode;
  theme: ITheme;
  set(mode: ThemeMode): void;
}
const ThemeContext = React.createContext({} as IThemeContext);

const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [mode, setMode] = useState(ThemeMode.DEVICE);
  const system = useColorScheme();
  const dark =
    mode === ThemeMode.DARK || (mode === ThemeMode.DEVICE && system === 'dark');
  const navigationTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    const colors = palette(dark);
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [dark]);
  const uiTheme = useMemo(
    () =>
      createTheme({
        mode: dark ? 'dark' : 'light',
        lightColors: {
          primary: palette(false).primary,
          background: palette(false).surface,
          grey3: palette(false).muted,
        },
        darkColors: {
          primary: palette(true).primary,
          background: palette(true).surface,
          grey3: palette(true).muted,
        },
      }),
    [dark],
  );
  const set = useCallback((value: ThemeMode) => setMode(value), []);
  const value = {
    mode,
    set,
    theme: {
      backgroundColor: navigationTheme.colors.background,
      textColor: navigationTheme.colors.text,
    },
  };
  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>
        <UIThemeProvider theme={uiTheme}>
          <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
          {children}
        </UIThemeProvider>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
};
export {ThemeProvider as default, ThemeContext};
