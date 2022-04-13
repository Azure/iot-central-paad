// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useBoolean} from 'hooks/common';
import {useScreenDimensions} from 'hooks/layout';
import React, {useCallback, useMemo} from 'react';
import {
  ModalProps,
  Platform,
  StyleProp,
  TextStyle,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import {BottomSheet} from '@rneui/themed';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Literal} from 'types';

interface BottomPopupProps {
  containerStyle?: StyleProp<ViewStyle>;
  modalProps?: ModalProps;
  isVisible?: boolean;
  onDismiss?: () => void | Promise<void>;
  children?: any;
}

const BottomPopup = React.memo<BottomPopupProps>(
  ({isVisible, containerStyle, modalProps, onDismiss, children}) => {
    const [popupVisible, setPopupVisible] = useBoolean(false);
    const {screen} = useScreenDimensions();
    const {top, bottom} = useSafeAreaInsets();

    const closePopup = useCallback(() => {
      setPopupVisible.False();
      onDismiss?.();
    }, [setPopupVisible, onDismiss]);

    const height = useMemo(
      () =>
        Platform.select({
          ios: screen.height - top - bottom,
          android: screen.height - 200,
        }),
      [screen, top, bottom],
    );

    const styles = useMemo<Literal<ViewStyle | TextStyle>>(
      () => ({
        containerStyle: {backgroundColor: 'rgba(0.5, 0.25, 0, 0.7)'},
        bottom: {flex: 1, height, justifyContent: 'flex-end'},
      }),
      [height],
    );

    return (
      // @ts-ignore https://github.com/react-native-elements/react-native-elements/issues/3231
      <BottomSheet
        isVisible={isVisible ?? popupVisible}
        containerStyle={containerStyle ?? styles.containerStyle}
        modalProps={modalProps ?? {}}>
        <TouchableWithoutFeedback onPress={closePopup}>
          <View style={styles.bottom}>
            <TouchableWithoutFeedback>
              <View>{children}</View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </BottomSheet>
    );
  },
);

export default BottomPopup;
