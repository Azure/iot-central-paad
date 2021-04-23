import React from 'react';
import { View } from 'react-native';
import { CheckBox } from 'react-native-elements';

export type ButtonGroupItem = {
    id: string;
    label: string;
}

const ButtonGroup = React.memo<{ items: ButtonGroupItem[], onCheckedChange: (id: string) => void | Promise<void>, defaultCheckedId?: string }>(({ items, onCheckedChange, defaultCheckedId }) => {
    const ids = items.map(i => i.id);
    const [checked, setChecked] = React.useState<typeof ids[number]>(defaultCheckedId ?? ids[0]);

    return (
        <View style={{ flex: 1, marginVertical: 20 }} key={`btnGroup-${Math.random()}`}>
            {items.map((item, index) => (
                <CheckBox
                    key={`chkb-${index}-${Math.random()}`}
                    containerStyle={{
                        marginStart: 0,
                        paddingVertical: 0,
                        backgroundColor: undefined,
                        borderWidth: 0,
                    }}
                    checkedIcon="dot-circle-o"
                    uncheckedIcon="circle-o"
                    checked={checked === item.id}
                    title={item.label}
                    onPress={() => {
                        console.log(item.id);
                        setChecked(item.id);
                        onCheckedChange(item.id);
                    }}
                />
            ))}
        </View>
    )
});

export default ButtonGroup;