// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useTheme} from 'hooks';
import {HeaderTitle} from '@react-navigation/elements';
import React from 'react';
import {Platform, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {StyleDefinition} from 'types';

const styles: StyleDefinition = {
  container: {flexDirection: 'row', marginLeft: 10, alignItems: 'center'},
  title: {marginLeft: 20},
};

const HeaderCloseButton = React.memo((props: {goBack: any; title: string}) => {
  const {colors} = useTheme();
  const {goBack, title} = props;
  return (
    <View style={styles.container}>
      <Icon name="close" color={colors.text} onPress={goBack} />
      {Platform.OS === 'android' && (
        <HeaderTitle style={styles.title}>{title}</HeaderTitle>
      )}
    </View>
  );
});

export default HeaderCloseButton;
