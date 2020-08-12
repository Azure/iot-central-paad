import React from 'react';
import { Card as ElementsCard, CardProps, PricingCard } from 'react-native-elements'
import { useTheme } from '@react-navigation/native';
import { View, Text } from 'react-native';
import { useScreenDimensions } from '../hooks/layout';

export function Card(props: CardProps) {
    const { containerStyle, ...otherProps } = props;
    const { dark, colors } = useTheme();
    const { screen } = useScreenDimensions();
    return (<View style={{
        backgroundColor: colors.card,
        width: (screen.width / 3) + 20,
        height: screen.height / 4,
        padding: 10,
        alignItems: 'center',
        margin: 10,
        borderRadius: 20
    }}>
        <View></View>
    </View>)
    // return (<PricingCard title={props.title ? props.title as string : ''} price='20' button={{ title: 'Read', icon: 'hammer-outline' }} containerStyle={{
    //     backgroundColor: colors.card,
    //     borderRadius: 20,
    //     width: (screen.width / 3) + 30
    // }} pricingStyle={{ color: colors.text }} titleStyle={{ color: colors.text, fontSize: 16 }} />)
}