import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from './typography'
import { useTheme } from '@react-navigation/native';
export function Loader() {
    const { colors } = useTheme();
    return (
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator animating={true} size={30} />
            <Text>Loading...</Text>
        </View>)
}