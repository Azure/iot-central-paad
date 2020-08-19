import { useContext, useState, useEffect, useLayoutEffect } from "react";
import { ThemeContext, ThemeMode } from "./contexts/theme";
import React from 'react';
import { View, Text, Button, Switch, ScrollView, Platform } from 'react-native';
import { useTheme, useNavigation, RouteProp, getFocusedRouteNameFromRoute, CommonActions } from "@react-navigation/native";
import { useScreenIcon } from "./hooks/common";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListItem, Icon } from "react-native-elements";
import { createNativeStackNavigator } from 'react-native-screens/native-stack';
import Registration from "./Registration";
import { StackNavigationProp, HeaderTitle } from "@react-navigation/stack";
import { NavigationScreens } from "./types";
import { IoTCContext } from "./contexts/iotc";
import { useSimulation } from "./hooks/iotc";


const Stack = createNativeStackNavigator();

type ProfileItem = {
    title: string,
    icon: string,
    value?: boolean,
    action?: {
        type: 'switch' | 'expand',
        fn: (...args: any) => void
    }
}


export default function Settings({ navigation: parent, route: parentRoute }) {
    const { mode, toggle } = useContext(ThemeContext);
    const [centralSimulated, simulate] = useSimulation();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets()


    const updateUIItems = function (title: string, val: any) {
        setItems(current => (current.map(i => {
            if (i.title === title) {
                i = { ...i, value: val };
            }
            return i;
        })));
    }

    const [items, setItems] = useState<ProfileItem[]>([
        {
            title: 'Registration',
            icon: 'hammer-outline',
            action: {
                type: 'expand',
                fn: (navigation) => {
                    navigation.navigate('Registration');
                }
            }
        },
        {
            title: 'Simulation Mode',
            icon: dark ? 'sync-outline' : 'sync',
            action: {
                type: 'switch',
                fn: async (val) => {
                    updateUIItems('Simulation Mode', val);
                    await simulate(val);
                }
            },
            value: centralSimulated
        },
        {
            title: 'Dark Mode',
            icon: dark ? 'moon-outline' : 'moon',
            action: {
                type: 'switch',
                fn: (val) => {
                    updateUIItems('Dark Mode', val);
                    toggle();
                }
            },
            value: dark
        }]);


    function getRightElement(item: ProfileItem) {
        if (item.action && item.action.type === 'switch') {
            return (<Switch value={item.value} onValueChange={item.action.fn} {...Platform.OS === 'android' && { thumbColor: item.value ? colors.primary : colors.background }} />)
        }
    }

    function BackButton(parent: any, parentRoute: any) {
        const title = getHeaderTitle(parentRoute);
        return (<>
            {title === 'Settings' ?
                <Icon name='close' color={colors.text} onPress={parent.goBack} /> :
                <Icon name='arrow-back' color={colors.text} onPress={parent.dispatch(CommonActions.navigate({ name: 'root' }))} />
            }
            {Platform.OS === 'android' && <HeaderTitle style={{ marginLeft: 20 }}>{title}</HeaderTitle>}
        </>)
    }

    // useLayoutEffect(() => {
    //     let headerShown = true;
    //     if (parentRoute.state) {
    //         if (parentRoute.state.index > 0) {
    //             headerShown = false;
    //         }
    //     }
    //     parent.setOptions({
    //         headerShown
    //     })
    // });
    return (
        <View style={{ flex: 1, marginTop: insets.top, marginBottom: insets.bottom }}>
            <Stack.Navigator screenOptions={({ route }) => ({
                headerShown: false // TODO: fix header
            })}>
                <Stack.Screen name='setting_root'>
                    {
                        () => {
                            const nav = useNavigation<any>();

                            return (<ScrollView style={{ flex: 1 }}>
                                {items.map((item, index) => (
                                    <ListItem key={`setting-${index}`} title={item.title} leftIcon={{ name: item.icon, type: 'ionicon', color: colors.text }} bottomDivider
                                        containerStyle={{ backgroundColor: colors.card }}
                                        titleStyle={{ color: colors.text }} rightElement={item.action ? getRightElement(item) : undefined} chevron={item.action && item.action.type === 'expand' ? true : false}
                                        onPress={item.action && item.action.type === 'expand' ? item.action.fn.bind(null, nav) : undefined}
                                    />
                                ))}
                                {/* <Text style={{ color: colors.text }}>I am {mode === ThemeMode.DARK ? 'dark' : 'light'}</Text>
            <Button onPress={toggle} title='Change' /> */}
                            </ScrollView>)
                        }}
                </Stack.Screen>
                <Stack.Screen name='Registration' component={Registration} />
            </Stack.Navigator>
        </View>
    )
}


// function getHeaderTitle(route) {
//     // If the focused route is not found, we need to assume it's the initial screen
//     // This can happen during if there hasn't been any navigation inside the screen
//     // In our case, it's "Feed" as that's the first screen inside the navigator
//     if (route.state) {
//         return route.state.routeNames[route.state.index];
//     }
//     return route.name;
// }

function getHeaderTitle(route) {
    // If the focused route is not found, we need to assume it's the initial screen
    // This can happen during if there hasn't been any navigation inside the screen
    // In our case, it's "Feed" as that's the first screen inside the navigator
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'root';

    switch (routeName) {
        case 'root':
            return 'Settings';
        case 'Registration':
            return 'Registration';
    }
}
