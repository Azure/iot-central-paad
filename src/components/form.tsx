import { useTheme } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Input } from 'react-native-elements';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { StyleDefinition } from 'types';
import ButtonGroup from './buttonGroup';
import { Name, normalize } from './typography';

export type FormItem = {
  id: string;
  label: string;
  multiline: boolean;
  placeHolder?: string;
  choices?: {
    label: string,
    id: string,
    default?: boolean
  }[],
  value?: string;
};

type FormProps = {
  title?: string;
  items: FormItem[];
  onSubmitting: (values: { [itemId: string]: string }) => void | Promise<void>;
  submit: boolean;
};

const Form = React.memo<FormProps>(({ title, items, submit, onSubmitting }) => {
  const [values, setValues] = React.useState<{ [itemId: string]: string }>(items.reduce((obj, i) => ({ ...obj, [i.id]: i.value }), {}));
  const { dark, colors } = useTheme();


  React.useEffect(() => {
    if (submit) {
      onSubmitting(values);
    }
  }, [submit, onSubmitting, values]);

  return (
    <View>
      {title && <Name style={{ marginBottom: 20 }}>{title}</Name>}
      {items.map((item, index) => {
        if (item.choices && item.choices.length > 0) {
          return (<ButtonGroup key={`formitem-${index}`} items={item.choices} onCheckedChange={(choiceId) => setValues(current => ({ ...current, [item.id]: choiceId }))} defaultCheckedId={item.choices.find(i => i.default === true)?.id} />)
        }
        return (
          <Input
            key={`formitem-${index}`}
            multiline={item.multiline}
            value={values[item.id]}
            label={item.label}
            inputStyle={{ fontSize: normalize(14), color: colors.text }}
            placeholderTextColor={dark ? '#444' : '#BBB'}
            onChangeText={text =>
              setValues(current => ({ ...current, [item.id]: text }))
            }
            placeholder={item.placeHolder}
          />)
      })}
    </View>
  );
});

export default Form;
