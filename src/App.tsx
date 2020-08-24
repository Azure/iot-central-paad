import React, { useContext, useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import Settings from './Settings';
import ThemeProvider, { ThemeContext, ThemeMode } from './contexts/theme';
import { NavigationContainer, DarkTheme, DefaultTheme, useTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Screens, NavigationScreens, NavigationParams, NavigationProperty } from './types';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LogoIcon from './assets/IotcLogo.svg';
import Telemetry from './Telemetry';
import { Icon, colors } from 'react-native-elements';
import Properties from './Properties';
import Commands from './Commands';
import { createStackNavigator, HeaderTitle } from '@react-navigation/stack';
import { Text } from './components/typography'
import IoTCProvider, { IoTCContext } from './contexts/iotc';
import StorageProvider, { StorageContext } from './contexts/storage';
import Insight from './Insight';
import { defaults } from './contexts/defaults';
import { Welcome } from './Welcome';
import HealthPlatform from './HealthPlatform';

const Tab = createBottomTabNavigator<NavigationScreens>();
const Stack = createStackNavigator();

const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: '#031036',
        card: '#020b24',
        border: '#020b24'
    },
};

export default function App() {

    const [initialized, setInitialized] = useState(false);
    if (initialized) {
        return (
            <ThemeProvider>
                <SafeAreaProvider>
                    <StorageProvider>
                        <IoTCProvider>
                            <Navigation />
                        </IoTCProvider>
                    </StorageProvider>
                </SafeAreaProvider>
            </ThemeProvider>
        )
    }
    return (<Welcome setInitialized={setInitialized} />)
}



function Navigation() {
    const { mode, theme } = useContext(ThemeContext);
    return (<NavigationContainer theme={mode === ThemeMode.DARK ? DarkTheme : DefaultTheme}>
        <Stack.Navigator>
            {/* @ts-ignore */}
            <Stack.Screen name='root' options={({ navigation }: { navigation: NavigationProperty }) => ({
                headerTitle: null, headerLeft: () => (<Logo />), headerRight: () => (<Profile navigate={navigation.navigate} />)
            })} component={Root} />
            <Stack.Screen name='Insight' component={Insight} options={({ route }) => {
                let data = {};
                if (route.params) {
                    let params = route.params as NavigationParams;
                    if (params.title) {
                        data = { ...data, headerTitle: params.title }
                    }
                    if (params.backTitle) {
                        data = { ...data, headerBackTitle: params.backTitle }
                    }
                }
                return data;
            }} />
            <Stack.Screen name='Settings' options={({ navigation }: { navigation: NavigationProperty }) => ({
                stackAnimation: 'flip',
                headerTitle: Platform.select({
                    ios: undefined,
                    android: ''
                }),
                headerLeft: () => (<BackButton goBack={navigation.goBack} title='Settings' />)
            })} component={Settings} />
        </Stack.Navigator>
    </NavigationContainer >
    )
}

function Root() {
    const { credentials, simulated } = useContext(StorageContext);
    const { connect } = useContext(IoTCContext);

    // connect client if credentials are retrieved
    useEffect(() => {
        if (!simulated) {
            connect(credentials);
        }
    }, [credentials, simulated]);


    return ((<Tab.Navigator key='tab' screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
            if (!route.params) {
                return null;
            }
            const icon = (route.params as NavigationParams).icon;
            return <Icon name={icon ? icon.name : 'home'} type={icon ? icon.type : 'ionicon'} size={size} color={color} />
        },
    })} lazy={false} tabBarOptions={Platform.select({
        android: { safeAreaInsets: { bottom: 0 } }
    })}>
        <Tab.Screen name={Screens.TELEMETRY_SCREEN} component={Telemetry} />
        <Tab.Screen name={Screens.HEALTH_SCREEN} component={HealthPlatform} />
        <Tab.Screen name={Screens.PROPERTIES_SCREEN} component={Properties} />
        <Tab.Screen name={Screens.COMMANDS_SCREEN} component={Commands} />
    </Tab.Navigator>))
}

function Logo() {
    const { dark, colors } = useTheme();
    return (<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginHorizontal: 10 }}>
        <LogoIcon width={30} fill={colors.primary} />
        <Text style={{ marginStart: 10, color: colors.text, fontWeight: 'bold', fontSize: 16, letterSpacing: 0.1 }}>Azure IoT Central</Text>
    </View>);
}

function Profile(props: { navigate: any }) {
    const { dark, colors } = useTheme();
    return (
        <View style={{ marginHorizontal: 10 }}>
            <Icon style={{ marginEnd: 20 }} name={Platform.select({ ios: 'settings-outline', android: 'settings' }) as string} type={Platform.select({ ios: 'ionicon', android: 'material' })} color={colors.text} onPress={() => {
                props.navigate('Settings');
            }} />
        </View>);
}

function BackButton(props: { goBack: any, title: string }) {
    const { colors, dark } = useTheme();
    const { goBack, title } = props;
    return (<View style={{ flexDirection: 'row', marginLeft: 10, alignItems: 'center' }}>
        <Icon name='close' color={colors.text} onPress={goBack} />
        {Platform.OS === 'android' && <HeaderTitle style={{ marginLeft: 20 }}>{title}</HeaderTitle>}
    </View>)
}
