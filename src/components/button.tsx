import React from 'react';
import {Platform} from 'react-native';
import {Button as ElButton, ButtonProps} from 'react-native-elements';

const Button = React.memo<ButtonProps>(({containerStyle, ...props}) => {
  return (
    <ElButton
      type={Platform.OS === 'ios' ? 'clear' : 'solid'}
      containerStyle={[{maxWidth: 200, width: '100%'}, containerStyle]}
      {...props}
    />
  );
});

export default Button;
