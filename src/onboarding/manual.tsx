import React, {useRef, useState} from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {DeviceCredentials, PHONE_MODEL_ID} from '../connection';
import {useTheme} from '../hooks';
import {Text, Name} from '../components/typography';
import DetailsAction from '../components/detailsAction';
import Strings from '../strings';
import {palette} from '../theme/palette';

export type ManualMode = 'individual' | 'hub' | 'legacy';
export type ManualValues = {
  registrationId: string;
  scopeId: string;
  deviceKey: string;
  provisioningHost: string;
  connectionString: string;
};

export function manualCredentials(
  mode: ManualMode,
  values: ManualValues,
): DeviceCredentials {
  if (mode === 'hub') {
    return {
      connectionString: values.connectionString.trim(),
      modelId: PHONE_MODEL_ID,
    };
  }
  return {
    registrationId: values.registrationId.trim(),
    scopeId: values.scopeId.trim(),
    provisioningHost: values.provisioningHost.trim(),
    ...(mode === 'legacy'
      ? {authKey: values.deviceKey.trim(), keyType: 'group' as const}
      : {deviceKey: values.deviceKey.trim(), keyType: 'device' as const}),
    modelId: PHONE_MODEL_ID,
  };
}

export function CredentialForm({
  credentials,
  readonly,
  loading,
  submit,
}: {
  credentials: DeviceCredentials | null;
  readonly: boolean;
  loading: boolean;
  submit(values: DeviceCredentials): Promise<void>;
}) {
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [mode, setMode] = useState<ManualMode>(
    credentials?.connectionString
      ? 'hub'
      : credentials?.keyType === 'group'
      ? 'legacy'
      : 'individual',
  );
  const [values, setValues] = useState<ManualValues>(() => ({
    registrationId: credentials?.registrationId ?? credentials?.deviceId ?? '',
    scopeId: credentials?.scopeId ?? '',
    deviceKey: credentials?.authKey ?? credentials?.deviceKey ?? '',
    provisioningHost:
      credentials?.provisioningHost ?? 'global.azure-devices-provisioning.net',
    connectionString: credentials?.connectionString ?? '',
  }));
  const [revealed, setRevealed] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const busy = useRef(false);
  const manual = Strings.Registration.Manual;
  const fields: {key: keyof ManualValues; label: string; secure?: boolean}[] =
    mode === 'hub'
      ? [
          {
            key: 'connectionString',
            label: manual.Body.ConnectionType.CString,
            secure: true,
          },
        ]
      : [
          {key: 'registrationId', label: manual.DeviceId.Label},
          {key: 'scopeId', label: manual.ScopeId.Label},
          {
            key: 'deviceKey',
            label:
              mode === 'legacy' ? manual.KeyTypes.Group : manual.SASKey.Label,
            secure: true,
          },
          {key: 'provisioningHost', label: manual.ProvisioningHost},
        ];
  const choices: {mode: ManualMode; label: string}[] = [
    {mode: 'individual', label: manual.Body.ConnectionType.Dps},
    {mode: 'hub', label: manual.Body.ConnectionType.CString},
    {mode: 'legacy', label: manual.KeyTypes.Group},
  ];
  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View style={styles.form}>
        <Name>{choices.find(choice => choice.mode === mode)?.label}</Name>
        {!readonly && (
          <DetailsAction
            id="connection-methods"
            label={manual.ChangeMethod}
            accessibilityLabel={manual.ChangeMethod}
            variant="quiet"
            expanded={showMethods}
            disabled={loading}
            onPress={() => setShowMethods(value => !value)}
          />
        )}
        {showMethods &&
          choices.map(choice => {
            const selected = mode === choice.mode;
            const inactive = readonly || loading;
            return (
              <Pressable
                key={choice.mode}
                testID={`connection-mode-${choice.mode}`}
                accessibilityRole="radio"
                accessibilityLabel={choice.label}
                accessibilityState={{
                  selected,
                  disabled: inactive,
                }}
                disabled={inactive}
                onPress={() => {
                  setMode(choice.mode);
                  setRevealed(false);
                  setShowMethods(false);
                }}
                style={({pressed}) => [
                  styles.choice,
                  {
                    borderColor: selected
                      ? colors.primary
                      : appearance.surfaceBorder,
                    backgroundColor:
                      pressed && !inactive
                        ? appearance.inset
                        : selected
                        ? appearance.inset
                        : appearance.surface,
                  },
                  inactive && styles.inactiveChoice,
                ]}>
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.radio,
                    {
                      borderColor: selected
                        ? colors.primary
                        : appearance.controlBorder,
                    },
                  ]}>
                  {selected && (
                    <View
                      style={[
                        styles.radioDot,
                        {backgroundColor: colors.primary},
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.choiceLabel,
                    selected && {color: colors.primary},
                  ]}>
                  {choice.label}
                </Text>
              </Pressable>
            );
          })}
        {mode === 'legacy' && (
          <Text style={{color: appearance.danger}}>{manual.LegacyWarning}</Text>
        )}
        <Name style={styles.sectionTitle}>{manual.Body.ConnectionInfo}</Name>
        {fields.map(field => (
          <View key={field.key} style={styles.field}>
            <Text style={[styles.label, {color: appearance.muted}]}>
              {field.label}
            </Text>
            <TextInput
              testID={`connection-${field.key}`}
              accessibilityLabel={field.label}
              value={values[field.key]}
              onChangeText={value =>
                setValues(current => ({...current, [field.key]: value}))
              }
              editable={!readonly && !loading}
              secureTextEntry={!!field.secure && !revealed}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              selectTextOnFocus={field.key === 'provisioningHost'}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={Keyboard.dismiss}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: appearance.controlBorder,
                  backgroundColor: appearance.inset,
                },
              ]}
            />
          </View>
        ))}
        <DetailsAction
          label={
            revealed ? Strings.Core.HideCredential : Strings.Core.ShowCredential
          }
          accessibilityLabel={
            revealed ? Strings.Core.HideCredential : Strings.Core.ShowCredential
          }
          icon={revealed ? 'eye-off-outline' : 'eye-outline'}
          variant="quiet"
          onPress={() => setRevealed(value => !value)}
        />
        {!readonly && (
          <DetailsAction
            id="connection-submit"
            label={manual.Footer.Connect}
            accessibilityLabel={manual.Footer.Connect}
            variant="primary"
            block
            disabled={loading}
            style={styles.submit}
            onPress={async () => {
              if (busy.current) {
                return;
              }
              busy.current = true;
              Keyboard.dismiss();
              try {
                await submit(manualCredentials(mode, values));
              } finally {
                busy.current = false;
              }
            }}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  form: {paddingTop: 8},
  sectionTitle: {marginTop: 16, marginBottom: 18},
  field: {marginBottom: 12},
  label: {fontSize: 13, lineHeight: 19, fontWeight: '500'},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginTop: 7,
  },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  inactiveChoice: {opacity: 0.5},
  choiceLabel: {flexShrink: 1},
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {width: 10, height: 10, borderRadius: 5},
  submit: {marginTop: 8, marginBottom: 16},
});
