import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Platform, View } from 'react-native';
import { Input } from 'react-native-elements';
import ButtonGroup from './buttonGroup';
import { Text, Name, normalize } from './typography';

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
};

function initValues(items: FormItem[]): { [itemId: string]: string } {
  return items.reduce((obj, i) => {
    // if multiple choices, set default as value for the item
    if (i.choices) {
      return { ...obj, [i.id]: i.choices.find(c => c.default)?.id };
    }
    return { ...obj, [i.id]: i.value };
  }, {});
}

export type FormValues = { [itemId: string]: string };

type FormProps = {
  title?: string;
  items: FormItem[];
  submitAction: (values: FormValues) => void | Promise<void>;
  submit: boolean;
  // setValidForm: (valid: boolean) => void;
  onSubmit?: () => void;
};

const Form = React.memo<FormProps>(
  ({ title, items, submit, submitAction, onSubmit }) => {
    const [values, setValues] = React.useState<{ [itemId: string]: string }>({});
    const { dark, colors } = useTheme();

    // fire if initial items change
    React.useEffect(() => {
      setValues(initValues(items));
    }, [items, setValues]);

    React.useEffect(() => {
      if (submit) {
        submitAction(values);
        onSubmit?.();
      }
    }, [submit, submitAction, onSubmit, values]);


    return (
      <View>
        {title && <Name style={{ marginBottom: 20 }}>{title}</Name>}
        {items.map((item, index) => {
          if (item.choices && item.choices.length > 0) {
            return (
              <View key={`formitem-${index}`}>
                <Text style={{ fontSize: normalize(17), fontWeight: 'bold', color: colors.text, paddingLeft: 10 }}>{item.label}</Text>
                <ButtonGroup
                  readonly={item.readonly}
                  containerStyle={{ marginBottom: 10 }}
                  items={item.choices}
                  onCheckedChange={choiceId =>
                    setValues(current => ({ ...current, [item.id]: choiceId }))
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
              key={`formitem-${index}`}
              multiline={item.multiline}
              value={values[item.id]}
              label={item.label}
              labelStyle={{ color: colors.text, paddingBottom: 10 }}
              disabled={item.readonly}
              numberOfLines={item.multiline ? 6 : 1}
              inputContainerStyle={Platform.OS === 'android' && { borderWidth: 0.5, borderColor: colors.border }}
              inputStyle={{ fontSize: normalize(14), color: colors.text, paddingTop: 0, paddingBottom: 0, textAlignVertical: item.multiline ? 'top' : 'center' }}
              placeholderTextColor={dark ? '#444' : '#BBB'}
              onChangeText={text =>
                setValues(current => ({ ...current, [item.id]: text }))
              }
              placeholder={item.placeHolder}
            />
          );
        })}
      </View>
    );
  },
);

export default Form;
