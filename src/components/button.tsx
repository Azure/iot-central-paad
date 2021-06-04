// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {Platform} from 'react-native';
import {Button as ElButton, ButtonProps} from 'react-native-elements';

const Button = React.memo<ButtonProps>(({containerStyle, ...props}) => {
  return (
    <ElButton
      type={Platform.OS === 'ios' ? 'clear' : 'solid'}
      containerStyle={[
        {width: '100%'},
        Platform.select({android: {maxWidth: 200}}),
        containerStyle,
      ]}
      {...props}
    />
  );
});

export default Button;
