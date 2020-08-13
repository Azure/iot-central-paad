import React from 'react';
import { Text as ELText } from 'react-native-elements';
import { TextProperties, Dimensions, Platform, PixelRatio } from 'react-native';
import { useTheme } from '@react-navigation/native';


const {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
} = Dimensions.get('window');

// based on iphone 5s's scale
const scale = SCREEN_WIDTH / 350;

interface Props extends TextProperties {
    children?: any,
    theme?: any
}

function normalize(size: number) {
    const newSize = size * scale
    if (Platform.OS === 'ios') {
        return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1
    } else {
        return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2
    }
}

export function Headline(props: Props) {
    const { children, style, ...textProps } = props;
    const { colors } = useTheme();
    return (<ELText style={[{ fontSize: normalize(20), fontWeight: 'bold', color: colors.text }, style]}>{props.children}</ELText>)
}

export function Text(props: Props) {
    const { children, style, ...textProps } = props;
    const { colors } = useTheme();

    return (<ELText style={[{ fontSize: normalize(14), fontStyle: 'normal', color: colors.text }, style]}>{props.children}</ELText>)
}


export function Name(props: Props) {
    const { children, style, ...textProps } = props;
    const { colors } = useTheme();

    return (<ELText style={[{ fontSize: normalize(14), fontWeight: 'bold', color: colors.text, fontStyle: 'normal', letterSpacing: 1.15 }, style]}>{props.children}</ELText>)
}
