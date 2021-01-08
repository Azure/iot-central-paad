import React, {useState, useEffect, useRef, useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import Logo from './assets/IotcLogo.svg';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import {defaults} from './contexts/defaults';
import DeviceInfo from 'react-native-device-info';
import {StateUpdater} from './types';
import ProgressCircleSnail from 'react-native-progress/CircleSnail';
import {useScreenDimensions} from './hooks/layout';
import {Text} from 'react-native-elements';

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

export function Welcome(props: {setInitialized: StateUpdater<boolean>}) {
  const {setInitialized} = props;
  const [animationStarted, setAnimationStarted] = useState(false);
  const [animationEnded, setAnimationEnded] = useState(false);
  const {screen} = useScreenDimensions();

  const animation = useRef<any>();

  const initDefaults = useCallback(
    async (animationHasEnded: boolean) => {
      defaults.emulator = await DeviceInfo.isEmulator();
      defaults.dev = __DEV__;
      while (!animationHasEnded) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      setInitialized(true);
    },
    [setInitialized],
  );
  // init authentication
  useEffect(() => {
    initDefaults(animationEnded);
  }, [animationEnded, initDefaults]);

  return (
    <LinearGradient colors={['#041b5c', '#136BFB']} style={style.container}>
      <View style={{flexDirection: 'row', marginBottom: 80}}>
        <Animatable.View
          ref={animation}
          animation="slideOutLogo"
          delay={1000}
          onAnimationBegin={() => setAnimationStarted(true)}
          style={style.logo}>
          <Logo width={100} height={100} fill={'#1881e0'} />
        </Animatable.View>
        {animationStarted ? (
          <Animatable.View
            animation="slideInName"
            style={style.name}
            onAnimationEnd={() => {
              setTimeout(() => {
                setAnimationEnded(true);
              }, 1000);
            }}>
            <Text
              style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: 20,
                letterSpacing: 0.1,
              }}>
              Azure IoT Central
            </Text>
          </Animatable.View>
        ) : null}
      </View>
      <View style={{alignItems: 'center'}}>
        <ProgressCircleSnail
          size={Math.floor(screen.width / 8)}
          indeterminate={true}
          color="white"
          thickness={3}
          spinDuration={1000}
          duration={1000}
        />
      </View>
      {/* <Button title='Animate' onPress={() => {
                animation.current?.animate();
            }} /> */}
    </LinearGradient>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    top: '50%',
    transform: [{translateX: -50}, {translateY: -50}],
  },
  name: {
    position: 'absolute',
    top: '50%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{translateX: -80}, {translateY: -20}],
  },
});
