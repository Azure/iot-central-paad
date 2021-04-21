import {useTheme} from '@react-navigation/native';
import React from 'react';
import {Keyboard} from 'react-native';
import {Input} from 'react-native-elements';
import {TouchableWithoutFeedback} from 'react-native-gesture-handler';
import {Name, normalize} from './typography';

export type FormItem = {
  id: string;
  label: string;
  multiline: boolean;
  placeHolder?: string;
  value?: string;
};

type FormProps = {
  title?: string;
  items: FormItem[];
  onSubmitting: (values: {[itemId: string]: string}) => void | Promise<void>;
  submit: boolean;
};

const Form = React.memo<FormProps>(({title, items, submit, onSubmitting}) => {
  const [values, setValues] = React.useState<{[itemId: string]: string}>({});
  const {dark} = useTheme();

  React.useEffect(() => {
    if (submit) {
      onSubmitting(values);
    }
  }, [submit, onSubmitting, values]);
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      {title && <Name style={{marginBottom: 20}}>{title}</Name>}
      {items.map((item, index) => (
        <Input
          key={`formitem-${index}`}
          multiline={item.multiline}
          value={values[item.id]}
          label={item.label}
          inputStyle={{fontSize: normalize(14)}}
          placeholderTextColor={dark ? '#444' : '#BBB'}
          onChangeText={text =>
            setValues(current => ({...current, [item.id]: text}))
          }
          placeholder={item.placeHolder}
        />
      ))}
    </TouchableWithoutFeedback>
  );
});

export default Form;
