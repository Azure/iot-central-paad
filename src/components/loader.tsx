// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useMemo} from 'react';
import {
  View,
  ActivityIndicator,
  ViewStyle,
  ScaledSize,
  TextStyle,
} from 'react-native';
import {Text} from './typography';
import {Theme} from '@react-navigation/native';
import {Button, Overlay} from 'react-native-elements';
import {useScreenDimensions, useTheme} from 'hooks';
import {Literal} from 'types';

type ILoaderButton = {
  text: string;
  onPress: () => void | Promise<void>;
};

interface ILoaderProps {
  message: string;
  buttons?: ILoaderButton[];
  visible: boolean;
  modal?: boolean;
  style?: ViewStyle;
}
export function Loader(props: ILoaderProps) {
  const {colors, dark} = useTheme();
  const {screen} = useScreenDimensions();

  const {visible, modal, style} = props;
  const overlayStyle = [
    ...[style],
    {
      padding: 0,
      borderRadius: 20,
      backgroundColor: colors.card,
      width: screen.width / 1.5,
    },
  ];

  const backdropStyle = {backgroundColor: colors.background};

  if (!visible) {
    return null;
  }
  if (modal) {
    return (
      <Overlay
        isVisible={visible}
        overlayStyle={overlayStyle}
        backdropStyle={backdropStyle}>
        <InnerLoader colors={colors} dark={dark} {...props} {...screen} />
      </Overlay>
    );
  }
  return <InnerLoader colors={colors} dark={dark} {...props} {...screen} />;
}

const InnerLoader = React.memo<ILoaderProps & Theme & ScaledSize>(
  ({message, buttons, height, colors, style}) => {
    const styles = useMemo<Literal<ViewStyle | TextStyle>>(
      () => ({
        body: {height: height / 4, padding: 0},
        box: {flex: 2, justifyContent: 'center', alignItems: 'center'},
        message: {marginTop: 20},
        buttonsBox: {flex: 1, justifyContent: 'flex-end', margin: 0},
      }),
      [height],
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
                style={{paddingVertical: 10}}
              />
            ))}
          </View>
        )}
      </View>
    );
  },
);
