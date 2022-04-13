// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {Platform} from 'react-native';
import {Button as ElButton, ButtonProps} from '@rneui/themed';

const Button = React.memo<ButtonProps>(({containerStyle, ...props}) => {
  return (
    <ElButton
      type={Platform.OS === 'ios' ? 'clear' : 'solid'}
      containerStyle={[
        // eslint-disable-next-line react-native/no-inline-styles
        {width: '100%'},
        Platform.select({android: {maxWidth: 200}}),
        containerStyle,
      ]}
      {...props}
    />
  );
});

export default Button;
