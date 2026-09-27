// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useState} from 'react';
import {Platform, StyleProp, View, ViewStyle} from 'react-native';
import Constants from 'expo-constants';
import {
  Marker,
  default as MapView,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';
import {GeoCoordinates} from '../types';
import {Text} from './typography';
import Strings from '../strings';

const Map = React.memo<{
  location: GeoCoordinates;
  style?: StyleProp<ViewStyle>;
}>(({location, style}) => {
  const [region, setRegion] = useState<Region>({
    latitude: location.lat,
    longitude: location.lon,
    latitudeDelta: location.latD ? location.latD : 0.0922,
    longitudeDelta: location.lonD ? location.lonD : 0.0421,
  });
  if (
    Platform.OS === 'android' &&
    Constants.expoConfig?.extra?.androidMapsConfigured !== true
  ) {
    return (
      <View style={style} testID="map-not-configured">
        <Text>{Strings.Map.NotConfigured}</Text>
        <Text selectable>
          {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
        </Text>
      </View>
    );
  }
  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      // eslint-disable-next-line react-native/no-inline-styles
      style={style ? style : {width: '100%', height: '100%'}}
      scrollEnabled={true}
      zoomEnabled={true}
      rotateEnabled={true}
      region={region}
      onRegionChangeComplete={setRegion}>
      <Marker
        coordinate={{latitude: location.lat, longitude: location.lon}}
        title={Strings.Map.CurrentLocation}
        description={`${location.lat
          .toString()
          .substring(0, 6)}... - ${location.lon.toString().substring(0, 6)}...`}
      />
    </MapView>
  );
});

export default Map;
