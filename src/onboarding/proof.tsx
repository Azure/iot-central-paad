import React, {useEffect, useRef, useState} from 'react';
import {Keyboard, Platform, TextInput, View} from 'react-native';
import {DeviceClient} from '../connection';
import {Text} from '../components/typography';
import {useTheme} from '../hooks';
import Strings from '../strings';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import DetailsAction from '../components/detailsAction';

export const validProofNonce = (nonce: string): boolean =>
  /^[A-Za-z0-9_-]{16,128}$/.test(nonce);
let counter = 0;
export const newProofNonce = (): string =>
  `paad_${Date.now().toString(36)}_${(++counter).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;

export async function submitProof(
  client: DeviceClient,
  nonce: string,
  platform: string,
  active: () => boolean,
): Promise<boolean> {
  if (!validProofNonce(nonce) || !active() || !client.isConnected()) {
    return false;
  }
  const telemetry = await client.sendTelemetry({
    paadProofNonce: nonce,
    paadProofPlatform: platform,
  });
  if (
    telemetry.delivery !== 'submitted' ||
    !active() ||
    !client.isConnected()
  ) {
    return false;
  }
  const property = await client.sendProperty({paadProof: {nonce, platform}});
  return property.delivery === 'submitted' && active() && client.isConnected();
}

export function ProofActivity({
  client,
  connected,
  simulated,
}: {
  client: DeviceClient | null;
  connected: boolean;
  simulated: boolean;
}) {
  const text = Strings.Connection.Summary;
  const {dark} = useTheme();
  const colors = palette(dark);
  const [nonce, setNonce] = useState(newProofNonce);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const latest = useRef({client, connected, simulated});
  latest.current = {client, connected, simulated};
  useEffect(() => {
    generation.current++;
    setStatus('');
  }, [client, connected, simulated]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const unavailable = !client || !connected || simulated;
  return (
    <View
      style={[
        detailStyles.card,
        detailStyles.bordered,
        {backgroundColor: colors.surface, borderColor: colors.border},
      ]}>
      <Text
        accessibilityRole="header"
        style={[detailStyles.sectionTitle, {color: colors.text}]}>
        {text.ProofTitle}
      </Text>
      <Text style={[detailStyles.supporting, {color: colors.muted}]}>
        {text.ProofExplanation}
      </Text>
      {unavailable && (
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {text.ProofUnavailable}
        </Text>
      )}
      <Text style={[detailStyles.label, {color: colors.muted}]}>
        {text.ProofNonce}
      </Text>
      <TextInput
        testID="proof-nonce"
        accessibilityLabel={text.ProofNonce}
        value={nonce}
        editable={!pending}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        selectTextOnFocus
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={Keyboard.dismiss}
        style={[
          detailStyles.input,
          detailStyles.monospace,
          {
            borderColor: colors.controlBorder,
            color: colors.text,
            backgroundColor: colors.inset,
          },
          pending && detailStyles.disabled,
        ]}
        onChangeText={value => {
          setNonce(value);
          setStatus('');
        }}
      />
      <DetailsAction
        id="proof-send"
        label={text.ProofSend}
        icon="send"
        variant="primary"
        block
        busy={pending}
        disabled={unavailable || pending}
        style={detailStyles.primaryAction}
        onPress={async () => {
          if (lock.current || unavailable || !client) {
            return;
          }
          if (!validProofNonce(nonce)) {
            setStatus(text.ProofInvalid);
            return;
          }
          lock.current = true;
          setPending(true);
          setStatus(text.ProofSending);
          const attempt = generation.current;
          const active = () =>
            mounted.current &&
            generation.current === attempt &&
            latest.current.client === client &&
            latest.current.connected &&
            !latest.current.simulated;
          try {
            const submitted = await submitProof(
              client,
              nonce,
              Platform.OS,
              active,
            );
            if (active()) {
              setStatus(submitted ? text.ProofSubmitted : text.ProofFailed);
            }
          } catch {
            if (active()) {
              setStatus(text.ProofFailed);
            }
          } finally {
            lock.current = false;
            if (mounted.current) {
              setPending(false);
            }
          }
        }}
      />
      <Text
        testID="proof-status"
        style={[
          detailStyles.status,
          {
            color:
              status === text.ProofSubmitted
                ? colors.positive
                : status === text.ProofInvalid || status === text.ProofFailed
                ? colors.danger
                : colors.muted,
          },
        ]}
        accessibilityLiveRegion="polite">
        {status}
      </Text>
    </View>
  );
}
