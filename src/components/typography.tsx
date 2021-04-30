import React from 'react';
import { Text as ELText, TextProps } from 'react-native-elements';
import { Dimensions, Platform, PixelRatio } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// based on iphone 5s's scale
const scale = SCREEN_WIDTH / 350;
interface Props extends TextProps {
  children?: any;
  theme?: any;
}

export function normalize(size: number) {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
}

export function Headline(props: Props) {
  const { children, style } = props;
  const { colors } = useTheme();
  return (
    <ELText
      style={[
        { fontSize: normalize(20), fontWeight: 'bold', color: colors.text },
        style,
      ]}>
      {children}
    </ELText>
  );
}

export function Detail(props: Props) {
  const { children, style } = props;
  const { colors } = useTheme();

  return (
    <ELText
      style={[
        { fontSize: normalize(12), fontStyle: 'normal', color: colors.text },
        style,
      ]}>
      {children}
    </ELText>
  );
}

export function Text(props: Props) {
  const { children, style, ...otherProps } = props;
  const { colors } = useTheme();

  return (
    <ELText
      style={[
        { fontSize: normalize(14), fontStyle: 'normal', color: colors.text },
        style,
      ]} {...otherProps}>
      {children}
    </ELText>
  );
}

export function Link(props: Props) {
  const { children, style, ...otherProps } = props;
  const { colors } = useTheme();

  return (
    <Text style={[{ color: colors.primary }, style]} {...otherProps}>{children}</Text>
  );
}

export function Name(props: Props) {
  const { children, style } = props;
  const { colors } = useTheme();

  return (
    <ELText
      style={[
        {
          fontSize: normalize(14),
          fontWeight: 'bold',
          color: colors.text,
          fontStyle: 'normal',
          letterSpacing: 1.15,
        },
        style,
      ]}>
      {children}
    </ELText>
  );
}

export function camelToName(text: string): string {
  return (
    text
      // insert a space before all caps
      .replace(/([A-Z])/g, ' $1')
      // uppercase the first character
      .replace(/^./, str => {
        return str.toUpperCase();
      })
  );
}

export function bytesToSize(bytes: number): string {
  const sizes: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return 'n/a';
  const i: number = parseInt(
    Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
  );
  if (i === 0) return `${bytes} ${sizes[i]}`;
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function getRandomColor(): string {
  return `rgb(${Math.floor(Math.random() * 256)},${Math.floor(
    Math.random() * 256,
  )},${Math.floor(Math.random() * 256)})`;
}

export function getNegativeColor(color: string): string {
  const colors = color
    .substr(0, color.length)
    .split('rgb(')[1]
    .split(',')
    .map(c => +c);

  let R = +colors[0];
  let G = Math.floor(+colors[1] * 1.8);
  let B = Math.floor(+colors[2] * 1.8);

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  return `rgb(${R},${G},${B})`;
}

export function LightenDarkenColor(
  colorCode: string,
  amount: number,
  usePound: boolean = false,
) {
  if (colorCode[0] === '#') {
    colorCode = colorCode.slice(1);
    usePound = true;
  }

  if (colorCode.startsWith('rgb(')) {
    colorCode = colorCode
      .substr(0, colorCode.length)
      .split('rgb(')[1]
      .split(',')
      .map(c => {
        c = parseInt(c, 16).toString(16);
        return c.length === 1 ? `0${c}` : c;
      })
      .join('');
  }

  const num = parseInt(colorCode, 16);
  /* tslint:disable:no-bitwise */
  let r = (num >> 16) + amount;

  if (r > 255) {
    r = 255;
  } else if (r < 0) {
    r = 0;
  }

  let b = ((num >> 8) & 0x00ff) + amount;

  if (b > 255) {
    b = 255;
  } else if (b < 0) {
    b = 0;
  }

  let g = (num & 0x0000ff) + amount;

  if (g > 255) {
    g = 255;
  } else if (g < 0) {
    g = 0;
  }

  return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
}
/* tslint:enable:no-bitwise */
