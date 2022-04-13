// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {View} from 'react-native';

export default function ScreenView() {
  const insets = useSafeAreaInsets();

  return <View style={{marginTop: insets.top}} />;
}
