// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useRef, useState, useEffect, useMemo} from 'react';
import {CardProps, IconProps, Icon, Input} from '@rneui/themed';
import {
  View,
  ColorValue,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import {Button} from 'components';
import {
  Text,
  Name,
  Headline,
  getRandomColor,
  bytesToSize,
  normalize,
} from './typography';
import {DataType, StyleDefinition} from 'types';
import {useTheme} from 'hooks';
import Strings from 'strings';

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
    editable,
    onEdit,
    value,
    unit,
    icon,
    onPress,
    onLongPress,
    dataType,
    ...otherProps
  } = props;
  const {dark, colors} = useTheme();

  const textColor = enabled ? colors.text : '#9490a9';
  const barColor = useRef(getRandomColor() as ColorValue);
  const iconStyle: ViewStyle = {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  };
  const styles = useMemo<StyleDefinition>(
    () => ({
      container: {
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
      content: {flex: 1, position: 'relative'},
      enabled: {
        backgroundColor: enabled ? barColor.current : 'white',
        width: '60%',
        height: 5,
        marginBottom: 20,
        borderRadius: 5,
      },
      cardBody: {flex: 2},
      cardValues: {flexDirection: 'row', paddingVertical: 10},
      unit: {color: '#9490a9', alignSelf: 'flex-end'},
    }),
    [colors.card, dark, enabled],
  );

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      {...otherProps}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}>
      <View style={styles.content}>
        {enabled && <View style={styles.enabled} />}
        {/* round checkbox for enable/disable */}
        {/* {onToggle && (
          <CheckBox
            center
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checked={enabled}
            containerStyle={checkboxStyle}
            onPress={onToggle}
          />
        )} */}

        <View style={styles.cardBody}>
          <Name style={{color: textColor}}>{otherProps.title}</Name>
          {typeof value === 'function' ? (
            value()
          ) : (
            <View style={styles.cardValues}>
              <Value
                value={value}
                enabled
                type={dataType}
                editable={editable}
                onEdit={onEdit}
                textColor={textColor}
              />
              {unit && enabled && (
                <Headline style={styles.unit}>{unit}</Headline>
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
  const styles: StyleDefinition = {
    container: {flex: 1, alignItems: 'center'},
    editInput: {maxHeight: 50, marginBottom: 5},
    stringVal: {fontSize: normalize(20), marginEnd: 5, color: textColor},
  };

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
            <Text key={`data-${i}`} style={{color: textColor}}>
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
        <View style={styles.container}>
          <Input
            shake={() => null}
            value={edited.toString()}
            onChangeText={setEdited}
            inputStyle={{color: textColor}}
            containerStyle={styles.editInput}
            keyboardType={typeof value === 'number' ? 'numeric' : 'default'}
          />
          <Button
            title={Strings.Client.Properties.Send}
            onPress={() => onEdit(edited)}
            type="clear"
          />
        </View>
      );
    } else {
      return (
        <Headline style={styles.stringVal}>
          {/* {strVal.length > 6 ? `${strVal.substring(0, 6)}...` : strVal} */}
          {strVal}
        </Headline>
      );
    }
  }
});
