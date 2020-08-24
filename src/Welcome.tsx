import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from "react-native";
import Logo from './assets/IotcLogo.svg';
import * as Animatable from "react-native-animatable";
import LinearGradient from 'react-native-linear-gradient';
import { defaults } from './contexts/defaults';
import DeviceInfo from 'react-native-device-info';
import { StateUpdater } from './types';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { useScreenDimensions } from './hooks/layout';
import { Text } from 'react-native-elements';

const animations = {
    slideOutLogo: {
        from: {
            left: '50%'
        },
        to: {
            left: '35%',
        }
    },
    slideInName: {
        from: {
            left: '100%'
        },
        to: {
            left: '65%'
        }
    }
}

Animatable.initializeRegistryWithDefinitions(animations);



export function Welcome(props: { setInitialized: StateUpdater<boolean> }) {

    const { setInitialized } = props;
    const [animationStarted, setAnimationStarted] = useState(false);
    const [animationEnded, setAnimationEnded] = useState(false);
    const { screen } = useScreenDimensions();


    const initDefaults = async (animationEnded: boolean) => {
        defaults.emulator = await DeviceInfo.isEmulator();
        defaults.dev = __DEV__;
        while (!animationEnded) {
            await new Promise(r => setTimeout(r, 500));
        }
        setInitialized(true);
    }
    // init authentication
    useEffect(() => {
        initDefaults(animationEnded);
    }, [animationEnded]);

    return (
        <LinearGradient colors={['#041b5c', '#136BFB']} style={style.container}>
            <View style={{ flexDirection: 'row' }}>
                <Animatable.View animation="slideOutLogo" delay={1000} onAnimationBegin={() => setAnimationStarted(true)} style={style.logo}>
                    <Logo width={400} height={400} fill={'#1881e0'} />
                </Animatable.View>
                {animationStarted ? <Animatable.View animation="slideInName" style={style.name} onAnimationEnd={() => {
                    setTimeout(() => {
                        setAnimationEnded(true);
                    }, 1000);
                }}>
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.1 }}>Azure IoT Central</Text>
                </Animatable.View> : null}
            </View>
            <AnimatedCircularProgress
                size={screen.width / 5}
                width={5}
                tintColor={'white'}
                onAnimationComplete={() => console.log('onAnimationComplete')}
                backgroundColor={'gray'}
                rotation={360} />
            <ActivityIndicator animating={animationStarted} color='white' style={{ top: 100 }} />
        </LinearGradient>
    )
}

const style = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center'
    },
    logo: {
        position: 'absolute',
        top: '50%',
        transform: [{ translateX: -50 }, { translateY: -50 }]
    },
    name: {
        position: 'absolute',
        top: '50%',
        transform: [{ translateX: -50 }, { translateY: -50 }]
    }
});