import React, { useContext, useEffect } from 'react';
import { View, Platform } from 'react-native';
import Settings from './Settings';
import ThemeProvider, { ThemeContext, ThemeMode } from './contexts/theme';
import { NavigationContainer, DarkTheme, DefaultTheme, useTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Screens, NavigationScreens, NavigationParams } from './types';
import { useScreenIcon } from './hooks/common';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from 'react-native-screens/native-stack';
import LogoIcon from './assets/IotcLogo.svg';
import Telemetry from './Telemetry';
import { Icon, colors } from 'react-native-elements';
import Properties from './Properties';
import Commands from './Commands';
import { HeaderTitle } from '@react-navigation/stack';
import { Text } from './components/typography'
import Registration from './Registration';
import IoTCProvider, { IoTCContext } from './contexts/iotc';
import { Loader } from './components/loader';
import StorageProvider, { StorageContext } from './contexts/storage';
import { useSimulation } from './hooks/iotc';

const Tab = createBottomTabNavigator<NavigationScreens>();
const Stack = createNativeStackNavigator();

export default function App() {
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

function Navigation() {
    const { mode, theme } = useContext(ThemeContext);
    return (<NavigationContainer theme={mode === ThemeMode.DARK ? DarkTheme : DefaultTheme}>
        <Stack.Navigator>
            <Stack.Screen name='root' options={({ navigation }) => ({
                headerTitle: null, headerLeft: Logo, headerRight: Profile.bind(null, navigation.navigate)
            })} component={Root} />
            <Stack.Screen name='Settings' options={({ navigation, route }) => ({
                stackAnimation: 'flip',
                headerLeft: BackButton.bind(null, navigation.goBack, 'Settings')
            })} component={Settings} />
        </Stack.Navigator>
    </NavigationContainer>
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
        }
    })} lazy={false}>
        <Tab.Screen name={Screens.TELEMETRY_SCREEN} component={Telemetry} />
        <Tab.Screen name={Screens.PROPERTIES_SCREEN} component={Properties} />
        <Tab.Screen name={Screens.COMMANDS_SCREEN} component={Commands} />
    </Tab.Navigator>))
}

function Logo() {
    const { dark, colors } = useTheme();
    return (<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
        <LogoIcon width={30} fill={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, letterSpacing: 0.1 }}>Azure IoT Central</Text>
    </View>);
}

function Profile(navigate: any) {
    const { dark, colors } = useTheme();
    return (<Icon name={Platform.select({ ios: 'settings-outline', android: 'settings' })} type={Platform.select({ ios: 'ionicon', android: 'material' })} color={colors.text} onPress={() => {
        navigate('Settings');
    }} />);
}

function BackButton(goBack: any, title: string) {
    const { colors, dark } = useTheme();
    return (<>
        <Icon name='close' color={colors.text} onPress={goBack} />
        {Platform.OS === 'android' && <HeaderTitle style={{ marginLeft: 20 }}>{title}</HeaderTitle>}
    </>)
}
