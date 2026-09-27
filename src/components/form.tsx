// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {useTheme} from 'hooks';
import {palette} from '../theme/palette';
import React, {useMemo} from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import {Input} from '@rneui/themed';
import ButtonGroup from './buttonGroup';
import {Text, Name, normalize} from './typography';
import {StyleDefinition} from 'types';
import Strings from '../strings';

export type FormItem = {
  id: string;
  label: string;
  multiline: boolean;
  placeHolder?: string;
  choices?: {
    label: string;
    id: string;
    default?: boolean;
  }[];
  value?: string;
  readonly?: boolean;
  secure?: boolean;
};

function initValues(items: FormItem[]): {[itemId: string]: string} {
  return items.reduce((obj, i) => {
    // if multiple choices, set default as value for the item
    if (i.choices) {
      return {...obj, [i.id]: i.choices.find(c => c.default)?.id};
    }
    return {...obj, [i.id]: i.value};
  }, {});
}

export type FormValues = {[itemId: string]: string};

type FormProps = {
  title?: string;
  items: FormItem[];
  submitAction: (values: FormValues) => void | Promise<void>;
  submit: boolean;
  // setValidForm: (valid: boolean) => void;
  onSubmit?: () => void;
};

const Form = React.memo<FormProps>(
  ({title, items, submit, submitAction, onSubmit}) => {
    const [values, setValues] = React.useState<{[itemId: string]: string}>({});
    const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
    const {colors, dark} = useTheme();
    const appearance = palette(dark);

    // fire if initial items change
    React.useEffect(() => {
      setValues(initValues(items));
      setRevealed({});
    }, [items, setValues]);

    React.useEffect(() => {
      if (submit) {
        submitAction(values);
        onSubmit?.();
      }
    }, [submit, submitAction, onSubmit, values]);

    const styles = useMemo<StyleDefinition>(
      () => ({
        title: {marginBottom: 20},
        item: {
          fontSize: normalize(17),
          fontWeight: 'bold',
          color: colors.text,
          paddingLeft: 10,
        },
        buttonGroupContainer: {marginBottom: 10},
        label: {color: colors.text, paddingBottom: 10},
      }),
      [colors.text],
    );

    return (
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View>
          {title && <Name style={styles.title}>{title}</Name>}
          {items.map(item => {
            if (item.choices && item.choices.length > 0) {
              return (
                <View key={item.id}>
                  <Text style={styles.item}>{item.label}</Text>
                  <ButtonGroup
                    readonly={item.readonly}
                    containerStyle={styles.buttonGroupContainer as ViewStyle}
                    items={item.choices}
                    onCheckedChange={choiceId =>
                      setValues(current => ({...current, [item.id]: choiceId}))
                    }
                    defaultCheckedId={
                      item.choices.find(i => i.default === true)?.id
                    }
                  />
                </View>
              );
            }
            return (
              <Input
                shake={() => null}
                key={item.id}
                testID={`connection-${item.id}`}
                multiline={item.multiline && !item.secure}
                secureTextEntry={item.secure && !revealed[item.id]}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                value={values[item.id] ?? ''}
                label={item.label}
                labelStyle={styles.label}
                disabled={item.readonly}
                numberOfLines={item.multiline ? 6 : 1}
                inputContainerStyle={
                  // eslint-disable-next-line react-native/no-inline-styles
                  Platform.OS === 'android' && {
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }
                }
                // eslint-disable-next-line react-native/no-inline-styles
                inputStyle={{
                  fontSize: normalize(14),
                  color: colors.text,
                  paddingTop: 0,
                  paddingBottom: 0,
                  textAlignVertical: item.multiline ? 'top' : 'center',
                }}
                placeholderTextColor={colors.secondary}
                rightIcon={
                  item.secure
                    ? {
                        name: revealed[item.id]
                          ? 'eye-off-outline'
                          : 'eye-outline',
                        type: 'ionicon',
                        accessibilityLabel: revealed[item.id]
                          ? Strings.Core.HideCredential
                          : Strings.Core.ShowCredential,
                        accessibilityRole: 'button',
                        color: appearance.primary,
                        size: 20,
                        containerStyle: controlStyles.reveal,
                        pressableProps: {
                          style: ({pressed}) => [
                            controlStyles.reveal,
                            pressed && {backgroundColor: appearance.inset},
                          ],
                        },
                        onPress: () =>
                          setRevealed(current => ({
                            ...current,
                            [item.id]: !current[item.id],
                          })),
                      }
                    : undefined
                }
                onChangeText={text =>
                  setValues(current => ({...current, [item.id]: text}))
                }
                placeholder={item.placeHolder}
              />
            );
          })}
        </View>
      </TouchableWithoutFeedback>
    );
  },
);

export default Form;

const controlStyles = StyleSheet.create({
  reveal: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
