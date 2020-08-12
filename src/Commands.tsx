import React from 'react';
import { View, Platform } from 'react-native';
import { useScreenIcon } from './hooks/navigation';

export default function Commands() {
    useScreenIcon(Platform.select({
        ios: {
            name: 'console',
            type: 'material-community'
        },
        android: {
            name: 'console',
            type: 'material-community'
        }
    }));

    return (<View></View>)
}