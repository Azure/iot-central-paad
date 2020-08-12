import React from 'react';
import { View, Platform } from 'react-native';
import { useScreenIcon } from './hooks/navigation';

export default function Properties() {
    useScreenIcon(Platform.select({
        ios: {
            name: 'create-outline',
            type: 'ionicon'
        },
        android: {
            name: 'playlist-edit',
            type: 'material-community'
        }
    }));

    return (<View></View>)
}