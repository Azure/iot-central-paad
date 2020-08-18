import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from './typography'
import { useTheme } from '@react-navigation/native';
export function Loader(props: { message: string }) {
    const { colors } = useTheme();
    const { message } = props;
    return (
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator animating={true} size={30} />
            <Text>{message}</Text>
        </View>)
}