import React, {useState} from 'react';
import {Appearance} from 'react-native';
import {valueof} from '../types';

export enum ThemeMode {
  LIGHT = 0,
  DARK = 1,
}

interface IThemeContext {
  mode: ThemeMode;
  theme: ITheme;
  toggle: () => void;
}

export interface ITheme {
  backgroundColor: string;
}

const theme: {[x in valueof<typeof ThemeMode>]: ITheme} = {
  // light
  0: {
    backgroundColor: '#FFFFFF',
  },
  // dark
  1: {
    backgroundColor: '#121212',
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
  const contextObj = React.useMemo(
    () => ({
      ...state,
      toggle: () => {
        setState(current => ({
          ...current,
          mode: +!current.mode,
          theme: theme[+!current.mode as valueof<typeof ThemeMode>],
        }));
      },
    }),
    [state, setState],
  );
  return <Provider value={contextObj}>{children}</Provider>;
};
export {ThemeProvider as default, ThemeContext};
