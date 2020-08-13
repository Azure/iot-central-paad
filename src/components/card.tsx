import React, { useRef } from 'react';
import { Card as ElementsCard, CardProps, PricingCard, IconProps, Icon, CheckBox } from 'react-native-elements'
import { useTheme } from '@react-navigation/native';
import { View, processColor, ColorValue, TouchableOpacityProperties, TouchableOpacity } from 'react-native';
import { useScreenDimensions } from '../hooks/layout';
import { Text, Name, Headline } from './typography';

export function getRandomColor() {
    return processColor(`rgb(${(Math.floor(Math.random() * 256))},${(Math.floor(Math.random() * 256))},${(Math.floor(Math.random() * 256))})`);
}

export function Card(props: CardProps & TouchableOpacityProperties & { onToggle: () => void, enabled: boolean, value?: any, unit?: string, icon?: IconProps }) {
    const { containerStyle, enabled, onToggle, value, unit, icon, ...otherProps } = props;
    const { dark, colors } = useTheme();
    const { screen } = useScreenDimensions();

    const textColor = enabled ? colors.text : '#9490a9';
    const barColor = useRef(getRandomColor() as ColorValue);

    console.log(`Color: ${barColor.current.toString()}`);
    return (<TouchableOpacity style={{
        backgroundColor: colors.card,
        width: (screen.width / 2) - 20,
        height: 200,
        padding: 25,
        margin: 10,
        borderRadius: 20
    }}
        {...otherProps}
    ><View style={{ flex: 1, position: 'relative' }}>
            {enabled && <View style={{ backgroundColor: enabled ? barColor.current : 'white', width: `60%`, height: 5, marginBottom: 20, borderRadius: 5 }}></View>}
            <CheckBox
                center
                checkedIcon='dot-circle-o'
                uncheckedIcon='circle-o'
                checked={enabled}
                containerStyle={{ position: 'absolute', top: -25, right: -40 }}
                onPress={onToggle}
            />

            <View style={{ flex: 2 }}>
                <Name style={{ color: textColor }}>{otherProps.title}</Name>
                <View style={{ flexDirection: 'row', paddingVertical: 10 }}>
                    {value && enabled && <Headline style={{ fontSize: 30, marginEnd: 5, color: textColor }}>{value}</Headline>}
                    {unit && enabled && <Headline style={{ color: '#9490a9', alignSelf: 'flex-end' }}>{unit}</Headline>}
                </View>
            </View>
            {icon && <Icon name={icon.name} type={icon.type} style={{ alignSelf: 'flex-end', justifyContent: 'flex-end' }} color='#9490a9' />}
        </View>
    </TouchableOpacity>)
    // return (<PricingCard title={props.title ? props.title as string : ''} price='20' button={{ title: 'Read', icon: 'hammer-outline' }} containerStyle={{
    //     backgroundColor: colors.card,
    //     borderRadius: 20,
    //     width: (screen.width / 3) + 30
    // }} pricingStyle={{ color: colors.text }} titleStyle={{ color: colors.text, fontSize: 16 }} />)
}