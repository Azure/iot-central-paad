// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useState} from 'react';
import {Appearance} from 'react-native';
import {ThemeMode} from 'types';

interface IThemeContext {
  mode: ThemeMode;
  theme: ITheme;
  set: (mode: ThemeMode) => void;
}

export interface ITheme {
  backgroundColor: string;
  textColor: string;
}

const theme: {[x in ThemeMode]: ITheme} = {
  // light
  [ThemeMode.LIGHT]: {
    backgroundColor: '#FFFFFF',
    textColor: '#121212',
  },
  // dark
  [ThemeMode.DARK]: {
    backgroundColor: '#121212',
    textColor: '#FFFFFF',
  },
  [ThemeMode.DEVICE]: {
    backgroundColor:
      Appearance.getColorScheme() === 'dark' ? '#121212' : '#FFFFFF',
    textColor: Appearance.getColorScheme() === 'dark' ? '#FFFFFF' : '#121212',
  },
};

const initialState: {mode: ThemeMode; theme: ITheme} = {
  mode:
    Appearance.getColorScheme() === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT,
  theme:
    theme[
      Appearance.getColorScheme() === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT
    ],
};

const ThemeContext = React.createContext({} as IThemeContext);
const {Provider} = ThemeContext;

const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, setState] = useState<{mode: ThemeMode; theme: ITheme}>(
    initialState,
  );

  const set = useCallback(
    (themeMode: ThemeMode) => {
      setState(current => ({
        ...current,
        mode: themeMode,
        theme: theme[themeMode],
      }));
    },
    [setState],
  );

  const value = {
    ...state,
    set,
  };
  return <Provider value={value}>{children}</Provider>;
};
export {ThemeProvider as default, ThemeContext};
