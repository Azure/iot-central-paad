// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {StorageContext, ThemeContext} from 'contexts';
import {useState, useEffect, useCallback, useContext, useMemo} from 'react';
import {Appearance, Dimensions, ScaledSize} from 'react-native';
import {Debug} from 'tools/CustomLogger';
import {ThemeMode} from 'types';
import {useTheme as useNavigationTheme} from '@react-navigation/native';

type Orientation = 'portrait' | 'landscape';
function getOrientation(width: number, height: number): Orientation {
  if (width > height) {
    return 'landscape';
  }
  return 'portrait';
}

export function useScreenDimensions() {
  const [screenData, setScreenData] = useState(Dimensions.get('screen'));
  const [orientation, setOrientation] = useState<Orientation>(
    getOrientation(screenData.width, screenData.height),
  );

  const onChange = useCallback(
    (result: {window: ScaledSize; screen: ScaledSize}) => {
      setScreenData(result.window);
      const currentOrientation = getOrientation(
        result.window.width,
        result.window.height,
      );
      if (orientation !== currentOrientation) {
        setOrientation(currentOrientation);
      }
    },
    [setOrientation, setScreenData, orientation],
  );

  useEffect(() => {
    Dimensions.addEventListener('change', onChange);
    return () => {
      Dimensions.removeEventListener('change', onChange);
    };
  }, [orientation, onChange]);
  return {screen: screenData, orientation};
}

export function useThemeMode() {
  const {mode, set} = useContext(ThemeContext);
  const {themeMode, save} = useContext(StorageContext);

  // if storage changes thememode, let apply to themecontext
  useEffect(() => {
    Debug(
      `Theme changed in storage. Now ${ThemeMode[themeMode]}.`,
      'useThemeMode Hook',
      'layout.ts:50',
    );
    set(themeMode);
  }, [themeMode, set]);

  const setThemeMode = useCallback(
    async (modeStr: string) => {
      const theme = ThemeMode[modeStr as keyof typeof ThemeMode];
      set(theme);
      await save({themeMode: theme});
    },
    [set, save],
  );

  const strMode = useMemo(() => {
    switch (mode) {
      case ThemeMode.DARK:
        return 'dark';
      case ThemeMode.LIGHT:
        return 'light';
      default:
        const str = Appearance.getColorScheme() as string;
        return str;
    }
  }, [mode]);
  return {mode: strMode, type: ThemeMode[mode].toString(), setThemeMode};
}

export function useTheme() {
  const {colors: navColors, dark} = useNavigationTheme();

  return {
    colors: {...navColors, secondary: '#969696'},
    dark,
  };
}
