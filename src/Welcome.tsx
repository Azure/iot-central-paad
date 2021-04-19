import React, {
  useState,
  useEffect,
  // useRef,
  useCallback,
  useContext,
} from 'react';
import {StyleSheet, View} from 'react-native';
import LogoLight from './assets/IoT-Plug-And-Play_Dark.svg';
import LogoDark from './assets/IoT-Plug-And-Play_Light.svg';
import * as Animatable from 'react-native-animatable';
// import LinearGradient from 'react-native-linear-gradient';
import {defaults} from './contexts/defaults';
import DeviceInfo from 'react-native-device-info';
import {StateUpdater} from './types';
import ProgressCircleSnail from 'react-native-progress/CircleSnail';
import {useScreenDimensions} from './hooks/layout';
// import {Text} from 'react-native-elements';
import {ThemeContext, ThemeMode} from 'contexts';
import {Name} from 'components/typography';

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
  // const [animationStarted, setAnimationStarted] = useState(false);
  const [animationEnded] = useState(false);
  const {screen} = useScreenDimensions();
  const {mode, theme} = useContext(ThemeContext);
  // const animation = useRef<any>();

  const initDefaults = useCallback(
    async (animationHasEnded: boolean) => {
      defaults.emulator = await DeviceInfo.isEmulator();
      defaults.dev = __DEV__;
      // while (!animationHasEnded) {
      //   await new Promise(r => setTimeout(r, 2000));
      // }
      await new Promise(r => setTimeout(r, 5000));
      setInitialized(true);
    },
    [setInitialized],
  );
  // init authentication
  useEffect(() => {
    initDefaults(animationEnded);
  }, [animationEnded, initDefaults]);
  // return (
  //   <LinearGradient colors={['#041b5c', '#136BFB']} style={style.container}>
  //     <View style={{ flexDirection: 'row', marginBottom: 80 }}>
  //       <Animatable.View
  //         ref={animation}
  //         animation="slideOutLogo"
  //         delay={1000}
  //         onAnimationBegin={() => setAnimationStarted(true)}
  //         style={style.logo}>
  //         {mode === ThemeMode.DARK ? <LogoDark width={100} height={100} /> : <LogoLight width={100} height={100} />}
  //       </Animatable.View>
  //       {animationStarted ? (
  //         <Animatable.View
  //           animation="slideInName"
  //           style={style.name}
  //           onAnimationEnd={() => {
  //             setTimeout(() => {
  //               setAnimationEnded(true);
  //             }, 1000);
  //           }}>
  //           <Text
  //             style={{
  //               color: 'white',
  //               fontWeight: 'bold',
  //               fontSize: 20,
  //               letterSpacing: 0.1,
  //             }}>
  //             {title}
  //           </Text>
  //         </Animatable.View>
  //       ) : null}
  //     </View>
  //     <View style={{ alignItems: 'center' }}>
  //       <ProgressCircleSnail
  //         size={Math.floor(screen.width / 8)}
  //         indeterminate={true}
  //         color="white"
  //         thickness={3}
  //         spinDuration={1000}
  //         duration={1000}
  //       />
  //     </View>
  //     {/* <Button title='Animate' onPress={() => {
  //               animation.current?.animate();
  //           }} /> */}
  //   </LinearGradient>
  // );
  return (
    <View style={style.container}>
      {mode === ThemeMode.DARK ? (
        <LogoDark width={100} height={100} />
      ) : (
        <LogoLight width={100} height={100} />
      )}
      <Name style={{color: theme.textColor}}>{title}</Name>
      <ProgressCircleSnail
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

const style = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
