import {useContext, useState} from 'react';
import {ThemeContext} from './contexts/theme';
import React from 'react';
import {View, Switch, ScrollView, Platform, Alert} from 'react-native';
import {useTheme, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon, ListItem} from 'react-native-elements';
import {Registration} from './Registration';
import {createStackNavigator} from '@react-navigation/stack';
import {useIoTCentralClient, useSimulation} from './hooks/iotc';
import {defaults} from './contexts/defaults';
import {StorageContext} from './contexts/storage';
import {LogsContext} from './contexts/logs';

const Stack = createStackNavigator();

type ProfileItem = {
  title: string;
  icon: string;
  value?: boolean;
  action?: {
    type: 'switch' | 'expand' | 'select';
    fn: (...args: any) => void;
  };
};

export default function Settings() {
  const {toggle} = useContext(ThemeContext);
  const {clear} = useContext(StorageContext);
  const {clear: clearLogs} = useContext(LogsContext);
  const [client, clearClient] = useIoTCentralClient();
  const [centralSimulated, simulate] = useSimulation();
  const {colors, dark} = useTheme();
  const insets = useSafeAreaInsets();

  const updateUIItems = (title: string, val: any) => {
    setItems(current =>
      current.map(i => {
        if (i.title === title) {
          i = {...i, value: val};
        }
        return i;
      }),
    );
  };

  const [items, setItems] = useState<ProfileItem[]>([
    {
      title: 'Registration',
      icon: 'hammer-outline',
      action: {
        type: 'expand',
        fn: navigation => {
          navigation.navigate('Registration', {previousScreen: 'root'});
        },
      },
    },
    {
      title: 'Clear Data',
      icon: 'trash-outline',
      action: {
        type: 'select',
        fn: async val => {
          await client?.disconnect();
          await clear();
          clearLogs();
          clearClient();
          Alert.alert('Success', 'Successfully clean data');
        },
      },
    },
    {
      title: 'Dark Mode',
      icon: dark ? 'moon-outline' : 'moon',
      action: {
        type: 'switch',
        fn: val => {
          updateUIItems('Dark Mode', val);
          toggle();
        },
      },
      value: dark,
    },
    ...(defaults.dev
      ? [
          {
            title: 'Simulation Mode',
            icon: dark ? 'sync-outline' : 'sync',
            action: {
              type: 'switch',
              fn: async val => {
                updateUIItems('Simulation Mode', val);
                await simulate(val);
              },
            },
            value: centralSimulated,
          } as ProfileItem,
        ]
      : []),
  ]);

  return (
    <View style={{flex: 1, marginTop: insets.top, marginBottom: insets.bottom}}>
      <Stack.Navigator
        screenOptions={({route}) => ({
          headerShown: false, // TODO: fix header
        })}>
        <Stack.Screen name="setting_root">
          {() => <Root items={items} colors={colors} />}
        </Stack.Screen>
        <Stack.Screen name="Registration" component={Registration} />
      </Stack.Navigator>
    </View>
  );
}

const RightElement = React.memo<{item: ProfileItem; colors: any}>(
  ({item, colors}) => {
    if (item.action && item.action.type === 'switch') {
      return (
        <Switch
          value={item.value}
          onValueChange={item.action.fn}
          {...(Platform.OS === 'android' && {
            thumbColor: item.value ? colors.primary : colors.background,
          })}
        />
      );
    }
    return null;
  },
);

const Root = React.memo<{items: ProfileItem[]; colors: any}>(
  ({items, colors}) => {
    const nav = useNavigation<any>();
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
            <Icon name={item.icon} type="ionicon" color={colors.text} />
            <ListItem.Content>
              <ListItem.Title style={{color: colors.text}}>
                {item.title}
              </ListItem.Title>
            </ListItem.Content>
            <RightElement item={item} colors={colors} />
            {item.action && item.action.type === 'expand' && (
              <ListItem.Chevron />
            )}
          </ListItem>
        ))}
      </ScrollView>
    );
  },
);
