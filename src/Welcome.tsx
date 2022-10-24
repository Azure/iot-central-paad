// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useCallback, useContext, useMemo} from 'react';
import {Alert, Linking, Platform, View} from 'react-native';
import LogoLight from './assets/IoT-Plug-And-Play_Dark.svg';
import LogoDark from './assets/IoT-Plug-And-Play_Light.svg';
import * as Animatable from 'react-native-animatable';
import {defaults} from './contexts/defaults';
import DeviceInfo from 'react-native-device-info';
import {StateUpdater, StyleDefinition, ThemeMode} from './types';
import {CircleSnail} from 'react-native-progress';
import {useScreenDimensions} from './hooks/layout';
import {StorageContext, ThemeContext} from 'contexts';
import {Name} from 'components/typography';
import VersionCheck from 'react-native-version-check';
import Strings, {resolveString} from 'strings';

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
  const {read, save, initialized} = useContext(StorageContext);
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
    const storage = await read();
    // try {
    //   const minorOrPatchUpdateDetails = await VersionCheck.needUpdate({
    //     packageName: Platform.select({
    //       ios: defaults.packageNameIOS,
    //       android: defaults.packageNameAndroid,
    //     }),
    //   });
    //   if (minorOrPatchUpdateDetails.isNeeded) {
    //     await handleUpdate(
    //       false,
    //       storage.skipVersion,
    //       minorOrPatchUpdateDetails.latestVersion,
    //       minorOrPatchUpdateDetails.storeUrl,
    //       save,
    //     );
    //   }
    //   const breakingUpdateDetails = await VersionCheck.needUpdate({
    //     depth: 1,
    //     packageName: Platform.select({
    //       ios: defaults.packageNameIOS,
    //       android: defaults.packageNameAndroid,
    //     }),
    //   });
    //   if (breakingUpdateDetails.isNeeded) {
    //     await handleUpdate(
    //       true,
    //       storage.skipVersion,
    //       breakingUpdateDetails.latestVersion,
    //       breakingUpdateDetails.storeUrl,
    //       save,
    //     );
    //   }
    // } catch (e) {}
  }, [read, save]);

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
      <CircleSnail
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

function handleUpdate(
  mandatory: boolean,
  skipVersion: string | null,
  availableVersion: string,
  url: string,
  save: any,
) {
  return new Promise<boolean>(resolve => {
    if (skipVersion && skipVersion === availableVersion) {
      return resolve(true);
    }
    if (mandatory) {
      Alert.alert(
        Strings.Update.Mandatory.Title,
        resolveString(Strings.Update.Mandatory.Text, Strings.Title),
        [
          {
            text: Strings.Update.Mandatory.Confirm,
            onPress: async () => {
              await Linking.openURL(url);
            },
          },
        ],
        {cancelable: false},
      );
    } else {
      Alert.alert(
        Strings.Update.Optional.Title,
        resolveString(Strings.Update.Optional.Text, Strings.Title),
        [
          {
            text: Strings.Update.Optional.Skip,
            onPress: async () => {
              await save({skipVersion: availableVersion});
              resolve(true);
            },
          },
          {
            text: Strings.Update.Optional.Cancel,
            onPress: () => resolve(false),
          },
          {
            text: Strings.Update.Optional.Confirm,
            onPress: async () => {
              await Linking.openURL(url);
              resolve(true);
            },
          },
        ],
        {cancelable: false},
      );
    }
  });
}
