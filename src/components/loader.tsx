// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useMemo} from 'react';
import {
  View,
  ActivityIndicator,
  ViewStyle,
  ScaledSize,
  StyleSheet,
  BackHandler,
  Platform,
  ScrollView,
} from 'react-native';
import {Text} from './typography';
import {Theme} from '@react-navigation/native';
import {Overlay} from '@rneui/themed';
import Button from './button';
import {useScreenDimensions, useTheme} from 'hooks';
import {StyleDefinition} from 'types';

type ILoaderButton = {
  text: string;
  onPress: () => void | Promise<void>;
};

interface ILoaderProps {
  message: string;
  buttons?: ILoaderButton[];
  visible: boolean;
  modal?: boolean;
  nativeModal?: boolean;
  style?: ViewStyle;
}
export function Loader(props: ILoaderProps) {
  const {colors, dark} = useTheme();
  const {screen} = useScreenDimensions();

  const {visible, modal, style, nativeModal = true} = props;
  const blocking = visible && !!modal && !nativeModal;

  // The previous native modal swallowed the Android back press. Keep that
  // while the busy state is shown, since cancelling has a dedicated button.
  useEffect(() => {
    if (!blocking || Platform.OS !== 'android') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => subscription.remove();
  }, [blocking]);

  if (!visible) {
    return null;
  }
  if (modal) {
    if (nativeModal) {
      return (
        <Overlay
          isVisible
          overlayStyle={[
            style,
            {
              padding: 0,
              borderRadius: 20,
              backgroundColor: colors.card,
              width: screen.width / 1.5,
              // The library floats its overlay on Android; the sheet is told
              // apart by its own fill and the dimmed page behind it instead.
              elevation: 0,
              shadowOpacity: 0,
            },
          ]}
          backdropStyle={{backgroundColor: colors.background}}>
          <InnerLoader colors={colors} dark={dark} {...props} {...screen} />
        </Overlay>
      );
    }
    // The global connection overlay must not compete with the Details sheet
    // while an iOS native-modal dismissal is still in progress.
    return (
      <View
        testID="app-busy-overlay"
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
        style={[
          StyleSheet.absoluteFill,
          overlay.backdrop,
          {backgroundColor: colors.background},
        ]}>
        <ScrollView
          style={overlay.scroll}
          contentContainerStyle={overlay.content}>
          <View style={[overlay.card, {backgroundColor: colors.card}]}>
            <InnerLoader
              colors={colors}
              dark={dark}
              {...props}
              {...screen}
              fluid
              style={style}
            />
          </View>
        </ScrollView>
      </View>
    );
  }
  return <InnerLoader colors={colors} dark={dark} {...props} {...screen} />;
}

const overlay = StyleSheet.create({
  backdrop: {
    zIndex: 10,
    elevation: 10,
  },
  scroll: {flex: 1},
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {width: '100%', maxWidth: 420, borderRadius: 20, overflow: 'hidden'},
});

const InnerLoader = React.memo<
  ILoaderProps & Pick<Theme, 'colors' | 'dark'> & ScaledSize & {fluid?: boolean}
>(({message, buttons, height, colors, style, fluid}) => {
  const styles = useMemo<StyleDefinition>(
    () => ({
      body: {
        ...(fluid ? {padding: 20, gap: 20} : {height: height / 4, padding: 0}),
        backgroundColor: colors.card,
      },
      box: {
        flex: fluid ? undefined : 2,
        justifyContent: 'center',
        alignItems: 'center',
        gap: fluid ? 12 : undefined,
      },
      message: {
        marginTop: fluid ? 0 : 20,
        textAlign: fluid ? 'center' : undefined,
      },
      buttonsBox: {
        flex: fluid ? undefined : 1,
        justifyContent: 'flex-end',
        margin: 0,
      },
      button: {paddingVertical: 10},
    }),
    [height, colors.card, fluid],
  );

  return (
    <View style={[...[style], styles.body]}>
      <View style={styles.box}>
        <ActivityIndicator animating={true} size={40} color={colors.text} />
        <Text style={styles.message}>{message}</Text>
      </View>
      {buttons && buttons.length > 0 && (
        <View style={styles.buttonsBox}>
          {buttons.map(b => (
            <Button
              key={b.text}
              type="clear"
              title={b.text}
              onPress={b.onPress}
              style={styles.button}
            />
          ))}
        </View>
      )}
    </View>
  );
});
