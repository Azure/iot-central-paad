import React, {useEffect, useCallback, useContext, useMemo} from 'react';
import {View} from 'react-native';
import LogoLight from './assets/IoT-Plug-And-Play_Dark.svg';
import LogoDark from './assets/IoT-Plug-And-Play_Light.svg';
import * as Animatable from 'react-native-animatable';
import {defaults} from './contexts/defaults';
import DeviceInfo from 'react-native-device-info';
import {StateUpdater, StyleDefinition, ThemeMode} from './types';
import ProgressCircleSnail from 'react-native-progress/CircleSnail';
import {useScreenDimensions} from './hooks/layout';
import {StorageContext, ThemeContext} from 'contexts';
import {Name} from 'components/typography';

const animations = {
  slideOutLogo: {
    from: {
      left: '50%',
    },
    to: {
      left: '25%',
    },
  },
  slideInName: {
    from: {
      left: '100%',
    },
    to: {
      left: '65%',
    },
  },
};

Animatable.initializeRegistryWithDefinitions(animations);

export function Welcome(props: {
  title: string;
  setInitialized: StateUpdater<boolean>;
}) {
  const {setInitialized, title} = props;
  const {read, initialized} = useContext(StorageContext);
  const {screen} = useScreenDimensions();
  const {mode, theme} = useContext(ThemeContext);

  const style = useMemo<StyleDefinition>(
    () => ({
      container: {
        flex: 1,
        backgroundColor: theme.backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
      },
      logo: {
        paddingVertical: 100,
      },
      name: {
        color: theme.textColor,
        fontSize: 20,
      },
      spinner: {
        marginTop: 50,
      },
    }),
    [theme.backgroundColor, theme.textColor],
  );

  const initDefaults = useCallback(async () => {
    defaults.emulator = await DeviceInfo.isEmulator();
    defaults.dev = __DEV__;

    await new Promise(r => setTimeout(r, 2000));
    await read();
  }, [read]);

  useEffect(() => {
    setInitialized(initialized);
  }, [initialized, setInitialized]);
  // init authentication
  useEffect(() => {
    initDefaults();
  }, [initDefaults]);

  return (
    <View style={style.container}>
      {mode === ThemeMode.DARK ? (
        <LogoDark width={100} height={100} style={style.logo} />
      ) : (
        <LogoLight width={100} height={100} style={style.logo} />
      )}
      <Name style={style.name}>{title}</Name>
      <ProgressCircleSnail
        style={style.spinner}
        size={Math.floor(screen.width / 8)}
        indeterminate={true}
        thickness={3}
        color={theme.textColor}
        spinDuration={1000}
        duration={1000}
      />
    </View>
  );
}
