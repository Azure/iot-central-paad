import React from 'react';
import {StyleSheet, View, ViewProps, ViewStyle} from 'react-native';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';

export type SurfaceTone =
  | 'raised'
  | 'secondary'
  | 'primary'
  | 'footer'
  | 'danger'
  | 'inset';
export type SurfaceLevel = 'ground' | 'raised';

export type SurfacePaintProps = {
  tone?: SurfaceTone;
  radius?: number;
  accent?: string;
  pressed?: boolean;
  from?: string;
};

function tint(base: string, accent: string, strength: number): string {
  return `#${[1, 3, 5]
    .map(offset =>
      Math.round(
        parseInt(base.slice(offset, offset + 2), 16) * (1 - strength) +
          parseInt(accent.slice(offset, offset + 2), 16) * strength,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * One flat, opaque colour per control or panel. Gradients belong to the page
 * behind them; a face that carries its own gradient competes with the page and
 * blurs the edge that tells the two apart.
 */
export function surfaceColor(
  dark: boolean,
  {tone = 'raised', accent, pressed = false, from}: SurfacePaintProps = {},
): string {
  const colors = palette(dark);
  let color: string;
  switch (tone) {
    case 'primary':
      color = pressed ? colors.primaryDeep : colors.primary;
      break;
    case 'secondary':
    case 'footer':
      color = colors.surfaceShade;
      break;
    case 'danger':
      color = colors.dangerSurface;
      break;
    case 'inset':
      color = colors.inset;
      break;
    default:
      color = colors.surfaceRaised;
  }
  if (from !== undefined) color = from;
  if (
    ![color, ...(accent === undefined ? [] : [accent])].every(value =>
      /^#[\da-f]{6}$/i.test(value),
    )
  ) {
    throw new Error('Surface colors must be six-digit hex values.');
  }
  if (accent !== undefined) color = tint(color, accent, dark ? 0.04 : 0.09);
  if (pressed && !(tone === 'primary' && from === undefined)) {
    // Pressing deepens the same colour towards the page rather than lighting a
    // new one, so the feedback reads as pressure on the material under the
    // finger. Both themes deepen, so the gesture means one thing everywhere.
    const ink = dark
      ? colors.background
      : tone === 'danger'
      ? colors.danger
      : colors.text;
    color = tint(color, ink, dark ? 0.16 : 0.07);
  }
  return color;
}

/**
 * Hierarchy without float. A raised face is told apart from the page by its
 * own solid tone and by a firmer hairline edge, never by a cast shadow.
 */
export function surfaceEdge(dark: boolean, level: SurfaceLevel): ViewStyle {
  return level === 'ground' ? {} : {borderColor: palette(dark).border};
}

export default function Surface({
  tone = 'raised',
  level = 'ground',
  radius = 14,
  accent,
  pressed,
  from,
  style,
  children,
  ...props
}: ViewProps & SurfacePaintProps & {level?: SurfaceLevel}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View
      {...props}
      style={[
        styles.bordered,
        tone === 'primary' && styles.borderless,
        {
          backgroundColor: surfaceColor(dark, {tone, accent, pressed, from}),
          borderRadius: radius,
          borderColor: colors.surfaceBorder,
        },
        tone === 'danger'
          ? {borderColor: colors.danger}
          : surfaceEdge(dark, level),
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bordered: {borderWidth: StyleSheet.hairlineWidth},
  borderless: {borderWidth: 0},
});
