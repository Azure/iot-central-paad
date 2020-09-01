import React, { useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { GeoCoordinates } from '../types';


export default function Map(props: { location: GeoCoordinates, style?: StyleProp<ViewStyle> }) {
    const { location, style } = props;
    const [region, setRegion] = useState({
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: location.latD ? location.latD : 0.0922,
        longitudeDelta: location.lonD ? location.lonD : 0.0421
    });
    return (<MapView
        provider={PROVIDER_DEFAULT}
        style={style ? style : { width: '100%', height: '100%' }}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
        region={region}
        onRegionChange={setRegion}
    >
        <Marker coordinate={{ latitude: location.lat, longitude: location.lon }}
            title='Current location'
            description={`${location.lat.toString().substring(0, 6)}... - ${location.lon.toString().substring(0, 6)}...`} />
    </MapView>)
}