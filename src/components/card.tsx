import React, {useRef, useState, useEffect} from 'react';
import {
  CardProps,
  IconProps,
  Icon,
  CheckBox,
  Input,
  Button,
} from 'react-native-elements';
import {useTheme} from '@react-navigation/native';
import {
  View,
  ColorValue,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import {Text, Name, Headline, getRandomColor, bytesToSize} from './typography';
import {DataType} from 'types';

type EditCallback = (value: any) => void | Promise<void>;

export function Card(
  props: CardProps &
    TouchableOpacityProps & {
      title?: string;
      onToggle?: () => void;
      enabled: boolean;
      value?: any | React.FC;
      dataType?: DataType;
      unit?: string;
      icon?: IconProps;
      editable?: boolean;
      onEdit?: EditCallback;
    },
) {
  const {
    containerStyle,
    enabled,
    onToggle,
    editable,
    onEdit,
    value,
    unit,
    icon,
    onPress,
    dataType,
    ...otherProps
  } = props;
  const {dark, colors} = useTheme();

  const textColor = enabled ? colors.text : '#9490a9';
  const barColor = useRef(getRandomColor() as ColorValue);
  const checkboxStyle: ViewStyle = {position: 'absolute', top: -25, right: -40};
  const iconStyle: ViewStyle = {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  };

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: colors.card,
          flex: 1,
          height: 200,
          padding: 25,
          margin: 10,
          borderRadius: 20,
          ...(!dark
            ? {
                shadowColor: "'rgba(0, 0, 0, 0.14)'",
                shadowOffset: {
                  width: 0,
                  height: 3,
                },
                shadowOpacity: 0.8,
                shadowRadius: 3.84,
                elevation: 5,
              }
            : {}),
        },
        containerStyle,
      ]}
      {...otherProps}
      disabled={!onPress}
      onPress={onPress}>
      <View style={{flex: 1, position: 'relative'}}>
        {enabled && (
          <View
            style={{
              backgroundColor: enabled ? barColor.current : 'white',
              width: `60%`,
              height: 5,
              marginBottom: 20,
              borderRadius: 5,
            }}></View>
        )}
        {onToggle && (
          <CheckBox
            center
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checked={enabled}
            containerStyle={checkboxStyle}
            onPress={onToggle}
          />
        )}

        <View style={{flex: 2}}>
          <Name style={{color: textColor}}>{otherProps.title}</Name>
          {typeof value === 'function' ? (
            value()
          ) : (
            <View style={{flexDirection: 'row', paddingVertical: 10}}>
              <Value
                value={value}
                enabled
                type={dataType}
                editable={editable}
                onEdit={onEdit}
                textColor={textColor}
              />
              {unit && enabled && (
                <Headline style={{color: '#9490a9', alignSelf: 'flex-end'}}>
                  {unit}
                </Headline>
              )}
            </View>
          )}
        </View>
        {icon && (
          <Icon
            name={icon.name}
            type={icon.type}
            style={iconStyle}
            color="#9490a9"
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const Value = React.memo<{
  value: any;
  enabled: boolean;
  editable: boolean | undefined;
  onEdit: EditCallback | undefined;
  textColor: string;
  type?: DataType;
}>(({value, enabled, editable, onEdit, textColor, type}) => {
  const [edited, setEdited] = useState(value);

  useEffect(() => {
    setEdited(value);
  }, [value]);

  if (!enabled) {
    return null;
  }
  if (value === undefined || edited === null || edited === undefined) {
    return <Text>N/A</Text>;
  }

  if (type === 'object') {
    return (
      <View>
        {Object.keys(value).map((v, i) => {
          let strVal: string = value[v].toString();
          if (typeof value[v] === 'number') {
            strVal = (value[v] as number).toLocaleString(undefined, {
              maximumFractionDigits: 3,
            });
          }
          return (
            <Text key={`data-${i}`}>
              {v}: {strVal}
            </Text>
          );
        })}
      </View>
    );
  } else {
    let strVal = value.toString();
    switch (type) {
      case 'bytes':
        strVal = bytesToSize(value as number);
        break;
      case 'number':
        strVal = (value as number).toLocaleString(undefined, {
          maximumFractionDigits: 3,
        });
        break;
    }

    if (editable && onEdit) {
      return (
        <View style={{flex: 1}}>
          <Input
            value={edited.toString()}
            onChangeText={setEdited}
            inputStyle={{color: textColor}}
            keyboardType={typeof value === 'number' ? 'numeric' : 'default'}
          />
          <Button title="Send" onPress={e => onEdit(edited)} type="clear" />
        </View>
      );
    } else {
      return (
        <Headline style={{fontSize: 24, marginEnd: 5, color: textColor}}>
          {/* {strVal.length > 6 ? `${strVal.substring(0, 6)}...` : strVal} */}
          {strVal}
        </Headline>
      );
    }
  }
});
