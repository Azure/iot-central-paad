import {StorageContext, ThemeContext} from 'contexts';
import {useState, useEffect, useCallback, useContext, useMemo} from 'react';
import {Appearance, Dimensions, ScaledSize} from 'react-native';
import {ThemeMode} from 'types';

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
  const {themeMode} = useContext(StorageContext);

  // if storage changes thememode, let apply to themecontext
  useEffect(() => {
    if (themeMode !== mode) {
      set(themeMode);
    }
  }, [themeMode, mode, set]);

  const strMode = useMemo(() => {
    switch (mode) {
      case ThemeMode.DARK:
        return 'dark';
      case ThemeMode.LIGHT:
        return 'light';
      default:
        const str = Appearance.getColorScheme() as string;
        console.log(str);
        return str;
    }
  }, [mode]);
  return strMode;
}
