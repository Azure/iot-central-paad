// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useCallback, useContext, useMemo, useState} from 'react';
import {ThemeContext} from './contexts/theme';
import React from 'react';
import {
  View,
  Switch,
  ScrollView,
  Platform,
  Alert,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {StackActions, useNavigation} from '@react-navigation/native';
import {Icon, ListItem} from '@rneui/themed';
import {
  useConnectIoTCentralClient,
  useDeliveryInterval,
  useSimulation,
} from './hooks/iotc';
import {defaults} from './contexts/defaults';
import Strings from 'strings';
import {camelToName, Text} from 'components/typography';
import {useBoolean, useTheme} from 'hooks';
import {Literal, Pages, PagesNavigator, ThemeMode} from 'types';
import {Loader} from 'components/loader';
import {StorageContext} from 'contexts/storage';
import {IoTCContext} from 'contexts/iotc';
import {reportDiagnostic, safeError} from './connection/errors';
import {cardTint, palette} from './theme/palette';
import FontCredits, {ConnectionMapCredits} from './components/fontCredits';

const pkg = require('../package.json');

type ProfileItem = {
  title: string;
  subtitle?: string;
  icon?: string;
  value?: boolean | string;
  action?: {
    type: 'switch' | 'expand' | 'select';
    fn: (...args: any) => void;
  };
};

export default function Settings() {
  const [centralSimulated, simulate] = useSimulation();
  const {mode} = useContext(ThemeContext);
  const {colors, dark} = useTheme();
  const [deliveryInterval] = useDeliveryInterval();
  const [, , disconnect] = useConnectIoTCentralClient();
  const {setError} = useContext(IoTCContext);
  const {clear} = useContext(StorageContext);
  const [loading, setLoading] = useBoolean(false);
  const styles: Literal<ViewStyle | TextStyle> = {
    container: {flex: 1, backgroundColor: colors.background},
  };

  const clearStorage = useCallback(() => {
    Alert.alert(
      Strings.Settings.Clear.Alert.Title,
      Strings.Settings.Clear.Alert.Text,
      [
        {
          text: 'Proceed',
          onPress: async () => {
            setLoading.True();
            try {
              disconnect();
              await clear();
              Alert.alert(
                Strings.Settings.Clear.Success.Title,
                Strings.Settings.Clear.Success.Text,
              );
            } catch (failure) {
              setError(safeError(failure, 'STORAGE_FAILED'));
            } finally {
              setLoading.False();
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
      ],
      {
        cancelable: false,
      },
    );
  }, [clear, disconnect, setLoading, setError]);

  const items = useMemo<ProfileItem[]>(
    () => [
      {
        title: 'Registration',
        icon: 'hammer-outline',
        action: {
          type: 'expand',
          fn: (navigation: PagesNavigator) => {
            // TIPS: use push as we may already have a registration screen stacked.
            // this happens when a device is not registered and user goes on Registration through settings instead of from home screen
            navigation.push('Registration', {
              previousScreen: Pages.SETTINGS,
            });
          },
        },
      },
      // {
      //   title: Strings.Settings.Clear.Title,
      //   icon: 'trash-outline',
      //   action: {
      //     type: 'select',
      //     fn: clearStorage,
      //   },
      // },
      {
        title: Strings.Settings.Theme.Title,
        icon: 'moon-outline',
        subtitle: camelToName(ThemeMode[mode].toLowerCase()),
        action: {
          type: 'expand',
          fn: navigation => {
            navigation.navigate('Theme', {previousScreen: 'root'});
          },
        },
      },
      {
        title: Strings.Settings.DeliveryInterval.Title,
        icon: 'timer-outline',
        subtitle:
          Strings.Settings.DeliveryInterval[
            `${deliveryInterval}` as keyof typeof Strings.Settings.DeliveryInterval
          ],
        action: {
          type: 'expand',
          fn: navigation => {
            navigation.navigate('Interval', {previousScreen: 'root'});
          },
        },
      },
      ...(defaults.dev
        ? [
            {
              title: 'Simulation Mode',
              icon: dark ? 'sync-outline' : 'sync',
              action: {
                type: 'switch',
                fn: async (val, nav: PagesNavigator) => {
                  const navState = nav.getState();
                  await simulate(val);
                  if (val) {
                    // if simulation just applied remove registration route
                    nav.dispatch({
                      ...StackActions.replace(Pages.ROOT),
                      source: navState.routes.find(
                        r => r.name === Pages.REGISTRATION,
                      )?.key,
                      target: navState.key,
                    });
                  } else {
                    // if simulation just applied remove registration route
                    nav.dispatch({
                      ...StackActions.replace(Pages.REGISTRATION),
                      source: navState.routes.find(r => r.name === Pages.ROOT)
                        ?.key,
                      target: navState.key,
                    });
                  }
                },
              },
              value: centralSimulated,
            } as ProfileItem,
            {
              title: 'Wipe data',
              icon: 'trash-outline',
              action: {
                type: 'select',
                fn: clearStorage,
              },
            } as ProfileItem,
          ]
        : []),
      {
        title: 'Version',
        value: pkg.version,
      },
    ],
    [deliveryInterval, mode, centralSimulated, dark, simulate, clearStorage],
  );
  return (
    <View style={styles.container}>
      <Root items={items} colors={colors} dark={dark} />
      <Loader visible={loading} message={Strings.Core.Loading} modal={true} />
    </View>
  );
}

const RightElement = React.memo<{
  item: ProfileItem;
  colors: any;
  dark: boolean;
}>(({item, colors, dark}) => {
  const [pending, setPending] = useState(false);
  const nav = useNavigation<PagesNavigator>();
  if (item.action && item.action.type === 'switch') {
    return (
      <Switch
        value={Boolean(item.value)}
        disabled={pending}
        onValueChange={async val => {
          setPending(true);
          try {
            await item.action?.fn(val, nav);
          } catch (failure) {
            reportDiagnostic(failure);
          } finally {
            setPending(false);
          }
        }}
        {...(Platform.OS === 'android' && {
          thumbColor: item.value
            ? palette(dark).primary
            : dark
            ? colors.text
            : colors.background,
          trackColor: {
            true: palette(dark).positiveSurface,
            false: palette(dark).border,
          },
        })}
      />
    );
  }
  return null;
});

const Root = React.memo<{items: ProfileItem[]; colors: any; dark: boolean}>(
  ({items, colors, dark}) => {
    const nav = useNavigation<PagesNavigator>();
    const appearance = palette(dark);

    const styles = React.useMemo<Literal<ViewStyle | TextStyle>>(
      () => ({
        container: {flex: 1},
        content: {padding: 20, paddingBottom: 32},
        group: {
          borderRadius: 24,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: appearance.surfaceBorder,
          backgroundColor: appearance.surfaceRaised,
        },
        row: {
          backgroundColor: 'transparent',
          minHeight: 76,
          paddingHorizontal: 18,
          borderBottomColor: appearance.surfaceBorder,
        },
        icon: {
          width: 40,
          height: 40,
          borderRadius: 14,
          justifyContent: 'center',
          alignItems: 'center',
        },
        subtitle: {
          color: appearance.muted,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 4,
        },
        title: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '600',
        },
      }),
      [colors, appearance],
    );

    // A pressed row settles onto a gentle tonal fill instead of dimming its text.
    const rowFeedback = ({pressed}: {pressed: boolean}) =>
      pressed ? {backgroundColor: appearance.inset} : null;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}>
        <View style={styles.group}>
          {items.map((item, index) => (
            <ListItem
              key={`setting-${index}`}
              bottomDivider={index < items.length - 1}
              containerStyle={styles.row}
              {...(item.action && item.action.type !== 'switch'
                ? {style: rowFeedback, onPress: item.action.fn.bind(null, nav)}
                : null)}>
              {item.icon && (
                <View
                  style={[
                    styles.icon,
                    {backgroundColor: cardTint(item.title, dark)},
                  ]}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants">
                  <Icon
                    name={item.icon}
                    type="ionicon"
                    size={21}
                    color={colors.text}
                  />
                </View>
              )}
              <ListItem.Content>
                <ListItem.Title style={styles.title}>
                  {item.title}
                </ListItem.Title>
                {item.subtitle && (
                  <ListItem.Subtitle style={styles.subtitle}>
                    {item.subtitle}
                  </ListItem.Subtitle>
                )}
              </ListItem.Content>
              {item.action && (
                <>
                  <RightElement item={item} colors={colors} dark={dark} />
                  {item.action.type === 'expand' && (
                    <ListItem.Chevron color={appearance.muted} />
                  )}
                </>
              )}
              {item.value && typeof item.value === 'string' && (
                <Text style={{fontSize: 13, color: appearance.muted}}>
                  {item.value}
                </Text>
              )}
            </ListItem>
          ))}
        </View>
        <FontCredits />
        <ConnectionMapCredits />
      </ScrollView>
    );
  },
);
