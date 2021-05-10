import {useContext, useMemo} from 'react';
import {ThemeContext} from './contexts/theme';
import React from 'react';
import {View, Switch, ScrollView, Platform} from 'react-native';
import {useTheme, useNavigation} from '@react-navigation/native';
import {Icon, ListItem} from 'react-native-elements';
import {useDeliveryInterval, useSimulation} from './hooks/iotc';
import {defaults} from './contexts/defaults';
import Strings from 'strings';
import {camelToName, Text} from 'components/typography';
import {useBoolean} from 'hooks/common';
import {Pages, PagesNavigator, ThemeMode} from 'types';
import {Loader} from 'components/loader';

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
  const [loading] = useBoolean(false);

  // TEMP: removed Clear from here
  // const clearStorage = useCallback(() => {
  //   Alert.alert(
  //     Strings.Settings.Clear.Alert.Title,
  //     Strings.Settings.Clear.Alert.Text,
  //     [
  //       {
  //         text: 'Proceed',
  //         onPress: async () => {
  //           // IMPORTANT!: clear stored credentials before cleaning client, otherwise device will continue to re-connect
  //           setLoading.True();
  //           await client?.disconnect();
  //           await clear();
  //           clearLogs();
  //           clearClient();
  //           Alert.alert(
  //             Strings.Settings.Clear.Success.Title,
  //             Strings.Settings.Clear.Success.Text,
  //           );
  //           setLoading.False();
  //         },
  //       },
  //       {
  //         text: 'Cancel',
  //         style: 'cancel',
  //         onPress: () => {},
  //       },
  //     ],
  //     {
  //       cancelable: false,
  //     },
  //   );
  // }, [setLoading, client, clear, clearLogs, clearClient]);

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
        subtitle: camelToName(
          Strings.Settings.DeliveryInterval[
            `${deliveryInterval}` as keyof typeof Strings.Settings.DeliveryInterval
          ],
        ),
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
                fn: async val => {
                  await simulate(val);
                },
              },
              value: centralSimulated,
            } as ProfileItem,
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
    <View style={{flex: 1, marginVertical: 10}}>
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
  const [enabled, setEnabled] = useBoolean(item.value as boolean);
  if (item.action && item.action.type === 'switch') {
    return (
      <Switch
        value={enabled}
        onValueChange={val => {
          item.action?.fn(val);
          setEnabled.Toggle();
        }}
        {...(Platform.OS === 'android' && {
          thumbColor: item.value
            ? colors.primary
            : dark
            ? colors.text
            : colors.background,
          trackColor: {true: colors.border, false: colors.border},
        })}
      />
    );
  }
  return null;
});

const Root = React.memo<{items: ProfileItem[]; colors: any; dark: boolean}>(
  ({items, colors, dark}) => {
    const nav = useNavigation<PagesNavigator>();
    const [simulated] = useSimulation();

    React.useEffect(
      () =>
        nav.addListener('beforeRemove', e => {
          // Prevent default behavior of leaving the screen
          e.preventDefault();
          if (simulated) {
            nav.navigate(Pages.ROOT);
          } else {
            nav.dispatch(e.data.action);
          }
        }),
      [nav, simulated],
    );
    return (
      <ScrollView style={{flex: 1}}>
        {items.map((item, index) => (
          <ListItem
            key={`setting-${index}`}
            bottomDivider
            containerStyle={{backgroundColor: colors.card}}
            onPress={
              item.action && item.action.type !== 'switch'
                ? item.action.fn.bind(null, nav)
                : undefined
            }>
            {item.icon && (
              <Icon name={item.icon} type="ionicon" color={colors.text} />
            )}
            <ListItem.Content>
              <ListItem.Title style={{color: colors.text}}>
                {item.title}
              </ListItem.Title>
              {item.subtitle && (
                <ListItem.Subtitle>{item.subtitle}</ListItem.Subtitle>
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
