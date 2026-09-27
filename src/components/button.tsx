// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useContext} from 'react';
import {
  Animated,
  GestureResponderEvent,
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import {Button as ElButton, ButtonProps} from '@rneui/themed';
import {useTheme} from '../hooks';
import {usePressSettle} from '../hooks/press';
import {palette} from '../theme/palette';
import {SurfacePaintProps, surfaceColor} from './surface';

type Props = Omit<ButtonProps, 'children'> & {children?: React.ReactNode};

const RADIUS = 14;

type Decoration = {
  scale: ReturnType<typeof usePressSettle>['scale'];
};

const DecorationContext = React.createContext<Decoration | null>(null);

function ButtonBody({style, children, ...props}: ViewProps) {
  const decoration = useContext(DecorationContext);
  if (!decoration) {
    return (
      <View {...props} style={style}>
        {children}
      </View>
    );
  }
  // The visual body settles under a press; the touch target around it does not
  // move, so the reach of the control is exactly what it looks like.
  return (
    <Animated.View
      {...props}
      style={[style, {transform: [{scale: decoration.scale}]}]}>
      {children}
    </Animated.View>
  );
}

/** The default body slot; a class keeps the library's `typeof Component` prop honest. */
class ButtonSurface extends React.Component<ViewProps> {
  render() {
    return <ButtonBody {...this.props} />;
  }
}

const Button = React.memo<Props>(
  ({
    containerStyle,
    buttonStyle,
    titleStyle,
    disabledStyle,
    disabledTitleStyle,
    style,
    type = 'solid',
    disabled = false,
    loading = false,
    color,
    loadingProps,
    ViewComponent,
    TouchableComponent,
    onPressIn,
    onPressOut,
    ...props
  }) => {
    const {dark} = useTheme();
    const colors = palette(dark);
    const inactive = disabled || loading;
    const callerStyle = StyleSheet.flatten(buttonStyle);
    // A caller that brings its own body or its own colour owns the paint;
    // the shared decoration steps aside rather than covering it.
    const custom =
      ViewComponent !== undefined ||
      color !== undefined ||
      callerStyle?.backgroundColor !== undefined ||
      callerStyle?.transform !== undefined;
    const {
      pressed,
      scale,
      onPressIn: settleIn,
      onPressOut: settleOut,
    } = usePressSettle('compact', inactive || custom);
    const solid = type === 'solid';
    const quiet = type === 'clear';
    const paint: SurfacePaintProps | null =
      inactive || quiet || custom
        ? null
        : {tone: solid ? 'primary' : 'secondary', radius: RADIUS, pressed};
    const background = inactive
      ? colors.inset
      : paint
      ? surfaceColor(dark, paint)
      : pressed
      ? colors.inset
      : 'transparent';
    const press = useCallback(
      (event: GestureResponderEvent) => {
        settleIn();
        onPressIn?.(event);
      },
      [onPressIn, settleIn],
    );
    const release = useCallback(
      (event: GestureResponderEvent) => {
        settleOut();
        onPressOut?.(event);
      },
      [onPressOut, settleOut],
    );
    return (
      <DecorationContext.Provider value={custom ? null : {scale}}>
        <ElButton
          {...props}
          type={type}
          color={color}
          disabled={disabled}
          loading={loading}
          loadingProps={{color: colors.muted, ...loadingProps}}
          TouchableComponent={TouchableComponent}
          ViewComponent={ViewComponent ?? ButtonSurface}
          // The library's own style prop is a fade callback; a plain style
          // replaces it, while a caller's style is forwarded untouched so its
          // own callback still sees the real pressed state.
          style={style ?? styles.touch}
          onPressIn={press}
          onPressOut={release}
          containerStyle={[styles.container, containerStyle]}
          buttonStyle={[
            styles.body,
            solid ? styles.primaryBody : styles.compactBody,
            solid || quiet ? styles.borderless : styles.edged,
            {borderColor: colors.controlBorder},
            !custom && {backgroundColor: background},
            buttonStyle,
          ]}
          titleStyle={[
            styles.title,
            {color: solid ? colors.onPrimary : colors.primary},
            titleStyle,
          ]}
          disabledStyle={[
            styles.edged,
            {backgroundColor: colors.inset, borderColor: colors.controlBorder},
            disabledStyle,
          ]}
          disabledTitleStyle={[{color: colors.muted}, disabledTitleStyle]}
        />
      </DecorationContext.Provider>
    );
  },
);

const styles = StyleSheet.create({
  container: {width: '100%', borderRadius: RADIUS},
  body: {borderRadius: RADIUS, paddingHorizontal: 16},
  primaryBody: {minHeight: 52},
  compactBody: {minHeight: 48},
  borderless: {borderWidth: 0},
  edged: {borderWidth: StyleSheet.hairlineWidth},
  title: {fontSize: 15, lineHeight: 20, fontWeight: '600'},
  touch: {opacity: 1},
});

export default Button;
