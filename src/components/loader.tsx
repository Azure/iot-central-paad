import React from 'react';
import {View, ActivityIndicator, ViewStyle, ScaledSize} from 'react-native';
import {Text} from './typography';
import {Theme, useTheme} from '@react-navigation/native';
import {Button, Divider, Overlay} from 'react-native-elements';
import {useScreenDimensions} from '../hooks/layout';

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
        {getLoader({...props, ...screen, colors, dark})}
      </Overlay>
    );
  }
  return getLoader({...props, colors, ...screen, dark});
}

function getLoader(props: ILoaderProps & Theme & ScaledSize) {
  const {message, buttons, colors, style, height} = props;
  return (
    <View style={[...[style], {height: height / 4, padding: 0}]}>
      <View style={{flex: 2, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator animating={true} size={40} color={colors.text} />
        <Text>{message}</Text>
      </View>
      {buttons && buttons.length > 0 && (
        <View style={{flex: 1, justifyContent: 'flex-end', margin: 0}}>
          <Divider />
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
}
