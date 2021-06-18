// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useCallback, useContext, useMemo } from 'react';
import { ThemeContext } from './contexts/theme';
import React from 'react';
import { View, Switch, ScrollView, Platform, Alert } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { Icon, ListItem } from 'react-native-elements';
import { useDeliveryInterval, useSimulation } from './hooks/iotc';
import { defaults } from './contexts/defaults';
import Strings from 'strings';
import { camelToName, Text } from 'components/typography';
import { useBoolean, useTheme } from 'hooks';
import { Pages, PagesNavigator, ThemeMode } from 'types';
import { Loader } from 'components/loader';
import { StorageContext } from 'contexts/storage';

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
  const { mode } = useContext(ThemeContext);
  const { colors, dark } = useTheme();
  const [deliveryInterval] = useDeliveryInterval();
  const { clear } = useContext(StorageContext);
  const [loading] = useBoolean(false);

  const clearStorage = useCallback(() => {
    Alert.alert(
      Strings.Settings.Clear.Alert.Title,
      Strings.Settings.Clear.Alert.Text,
      [
        {
          text: 'Proceed',
          onPress: async () => {
            // IMPORTANT!: clear stored credentials before cleaning client, otherwise device will continue to re-connect
            await clear();
            Alert.alert(
              Strings.Settings.Clear.Success.Title,
              Strings.Settings.Clear.Success.Text,
            );
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => { },
        },
      ],
      {
        cancelable: false,
      },
    );
  }, [clear]);

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
            navigation.navigate('Theme', { previousScreen: 'root' });
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
            navigation.navigate('Interval', { previousScreen: 'root' });
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
                const navState = nav.dangerouslyGetState();
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
            }
          } as ProfileItem
        ]
        : []),
      {
        title: 'Version',
        value: pkg.version,
      },
    ],
    [deliveryInterval, mode, centralSimulated, dark, simulate],
  );
  return (
    <View style={{ flex: 1, marginVertical: 10 }}>
      <Root items={items} colors={colors} dark={dark} />
      <Loader visible={loading} message={Strings.Core.Loading} modal={true} />
    </View>
  );
}

const RightElement = React.memo<{
  item: ProfileItem;
  colors: any;
  dark: boolean;
}>(({ item, colors, dark }) => {
  const [enabled, setEnabled] = useBoolean(item.value as boolean);
  const nav = useNavigation<PagesNavigator>();
  if (item.action && item.action.type === 'switch') {
    return (
      <Switch
        value={enabled}
        onValueChange={val => {
          item.action?.fn(val, nav);
          setEnabled.Toggle();
        }}
        {...(Platform.OS === 'android' && {
          thumbColor: item.value
            ? colors.primary
            : dark
              ? colors.text
              : colors.background,
          trackColor: { true: colors.border, false: colors.border },
        })}
      />
    );
  }
  return null;
});

const Root = React.memo<{ items: ProfileItem[]; colors: any; dark: boolean }>(
  ({ items, colors, dark }) => {
    const nav = useNavigation<PagesNavigator>();

    const styles = React.useMemo(
      () => ({
        subtitle: {
          color: colors.secondary,
        },
        title: {
          color: colors.text,
        },
      }),
      [colors],
    );

    return (
      <ScrollView style={{ flex: 1 }}>
        {items.map((item, index) => (
          <ListItem
            key={`setting-${index}`}
            bottomDivider
            containerStyle={{ backgroundColor: colors.card }}
            onPress={
              item.action && item.action.type !== 'switch'
                ? item.action.fn.bind(null, nav)
                : undefined
            }>
            {item.icon && (
              <Icon name={item.icon} type="ionicon" color={colors.text} />
            )}
            <ListItem.Content>
              <ListItem.Title style={styles.title}>{item.title}</ListItem.Title>
              {item.subtitle && (
                <ListItem.Subtitle style={styles.subtitle}>
                  {item.subtitle}
                </ListItem.Subtitle>
              )}
            </ListItem.Content>
            {item.action && (
              <>
                <RightElement item={item} colors={colors} dark={dark} />
                {item.action.type === 'expand' && <ListItem.Chevron />}
              </>
            )}
            {item.value && typeof item.value === 'string' && (
              <Text>{item.value}</Text>
            )}
          </ListItem>
        ))}
      </ScrollView>
    );
  },
);
