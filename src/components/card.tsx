import React, { useRef, useState, useEffect } from 'react';
import { Card as ElementsCard, CardProps, PricingCard, IconProps, Icon, CheckBox, Input, Button } from 'react-native-elements'
import { useTheme } from '@react-navigation/native';
import { View, processColor, ColorValue, TouchableOpacityProperties, TouchableOpacity } from 'react-native';
import { useScreenDimensions } from '../hooks/layout';
import { Text, Name, Headline, getRandomColor } from './typography';

type EditCallback = ((value: any) => void | Promise<void>);


export function Card(props: CardProps & TouchableOpacityProperties & { onToggle: () => void, enabled: boolean, value?: any, unit?: string, icon?: IconProps, editable?: boolean, onEdit?: EditCallback }) {
    const { containerStyle, enabled, onToggle, editable, onEdit, value, unit, icon, ...otherProps } = props;
    const { dark, colors } = useTheme();
    const { screen } = useScreenDimensions();

    const textColor = enabled ? colors.text : '#9490a9';
    const barColor = useRef(getRandomColor() as ColorValue);

    return (<TouchableOpacity style={{
        backgroundColor: colors.card,
        flex: 1,
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
                    {getValue(value, enabled, editable, onEdit, textColor)}
                    {unit && enabled && <Headline style={{ color: '#9490a9', alignSelf: 'flex-end' }}>{unit}</Headline>}
                </View>
            </View>
            {icon && <Icon name={icon.name} type={icon.type} style={{ alignSelf: 'flex-end', justifyContent: 'flex-end' }} color='#9490a9' />}
        </View>
    </TouchableOpacity>)
}

function getValue(value: any, enabled: boolean, editable: boolean, onEdit: EditCallback | undefined, textColor: string) {
    const [edited, setEdited] = useState(value);

    useEffect(() => {
        setEdited(value);
    }, [value])

    if (!enabled || edited === null || edited === undefined) {
        return (null);
    }

    if ((typeof value) !== 'string' && (typeof value) !== 'number') {
        return (<View>
            {Object.keys(value).map((v, i) => {
                const strVal: string = value[v].toString();
                return (<Text key={`data-${i}`}>{v}: {strVal.length > 6 ? `${strVal.substring(0, 6)}...` : strVal}</Text>);
            })}
        </View>)
    }
    const strVal: string = value.toString();
    if (editable && onEdit) {
        return <View style={{ flex: 1, flexDirection: 'row' }}>
            <Input value={edited.toString()} onChangeText={setEdited} inputStyle={{ color: textColor }} keyboardType={typeof (value) === 'number' ? 'numeric' : 'default'} containerStyle={{ flex: 1 }} />
            <Button title='Send' onPress={e => onEdit(edited)} type='clear' />
        </View>
    }
    else {
        return <Headline style={{ fontSize: 30, marginEnd: 5, color: textColor }}>{strVal.length > 6 ? `${strVal.substring(0, 6)}...` : strVal}</Headline>
    }
}