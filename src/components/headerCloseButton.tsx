// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useTheme} from 'hooks';
import {HeaderTitle} from '@react-navigation/stack';
import React from 'react';
import {Platform, View} from 'react-native';
import {Icon} from 'react-native-elements';

const HeaderCloseButton = React.memo((props: {goBack: any; title: string}) => {
  const {colors} = useTheme();
  const {goBack, title} = props;
  return (
    <View style={{flexDirection: 'row', marginLeft: 10, alignItems: 'center'}}>
      <Icon name="close" color={colors.text} onPress={goBack} />
      {Platform.OS === 'android' && (
        <HeaderTitle style={{marginLeft: 20}}>{title}</HeaderTitle>
      )}
    </View>
  );
});

export default HeaderCloseButton;
