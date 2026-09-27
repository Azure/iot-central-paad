// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useContext, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  CommonActions,
  RouteProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import {
  createStackNavigator,
  StackNavigationProp,
} from '@react-navigation/stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useConnectIoTCentralClient, useScreenDimensions, useTheme} from 'hooks';
import {
  NavigationParams,
  Pages,
  PagesNavigator,
  RegistrationScreens,
} from './types';
import Strings from 'strings';
import {
  QRCodeScanner,
  Event,
  Button,
  Link,
  Name,
  Text,
  ConnectionNotice,
} from 'components';
import {IoTCContext, StorageContext} from 'contexts';
import {CredentialForm} from './onboarding/manual';
import {DeviceCredentials} from './connection';
import RegistrationActions from './components/registrationActions';
import DetailsAction from './components/detailsAction';
import {palette} from './theme/palette';

const screens = RegistrationScreens;
type RegistrationRoutes = Record<
  (typeof screens)[keyof typeof screens],
  undefined
>;
const Stack = createStackNavigator<RegistrationRoutes>();

export const Registration = React.memo<{
  route?: RouteProp<Record<string, NavigationParams>, 'Registration'>;
  navigation?: PagesNavigator;
}>(({navigation: parentNavigator, route}) => {
  const {colors} = useTheme();
  const [, , , {client}] = useConnectIoTCentralClient();
  const {registeringNew, setRegisteringNew} = useContext(IoTCContext);
  // A restored client can arrive without an observable intermediate loading render.
  // A credentials page opened from Settings while already connected must stay open.
  const initiallyConnected = useRef(!!client?.isConnected());
  const rootEntry = !route?.params?.previousScreen && !route?.params?.screen;
  const landed = useRef(false);
  const goHome = useCallback(() => {
    if (landed.current) {
      return;
    }
    landed.current = true;
    setRegisteringNew(false);
    parentNavigator?.dispatch(
      CommonActions.reset({index: 0, routes: [{name: Pages.ROOT}]}),
    );
  }, [parentNavigator, setRegisteringNew]);
  useEffect(() => {
    if (
      (rootEntry || !initiallyConnected.current) &&
      client?.isConnected() &&
      !registeringNew
    ) {
      goHome();
    }
  }, [client, goHome, rootEntry, registeringNew]);
  useEffect(() => {
    return parentNavigator?.addListener('beforeRemove', () =>
      setRegisteringNew(false),
    );
  }, [parentNavigator, setRegisteringNew]);

  return (
    <Stack.Navigator
      initialRouteName={
        initiallyConnected.current ? screens.MANUAL : screens.EMPTY
      }
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerBackAccessibilityLabel: Strings.Core.Back,
        headerBackTestID: 'registration-back',
        headerShadowVisible: false,
        headerMode: 'float',
      }}>
      <Stack.Screen
        name={screens.EMPTY}
        options={{headerShown: false}}
        component={EmptyClient}
      />
      <Stack.Screen
        name={screens.QR}
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: colors.text,
        }}>
        {() => <QRCodeScreen onConnected={goHome} />}
      </Stack.Screen>
      <Stack.Screen
        name={screens.MANUAL}
        options={{
          headerTitle: Strings.Registration.Manual.Title,
          headerShown: registeringNew || !client?.isConnected(),
        }}>
        {() => <ManualConnect onConnected={goHome} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
});

function QRCodeScreen({onConnected}: {onConnected(): void}) {
  const {screen, orientation} = useScreenDimensions();
  const navigation = useNavigation<StackNavigationProp<RegistrationRoutes>>();
  const [connect, cancel, , {loading, error}] = useConnectIoTCentralClient();
  const scanner = useRef<QRCodeScanner>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (busy.current) {
        cancelRef.current();
      }
    };
  }, []);
  const onRead = useCallback(
    async (event: Event) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      try {
        const result = await connect(event.data);
        if (!mounted.current) {
          return;
        }
        if (result.ok) {
          onConnected();
        }
        // Failed scans stay paused until an explicit retry; never flood the banner.
      } finally {
        busy.current = false;
      }
    },
    [connect, onConnected],
  );
  return (
    <QRCodeScanner
      ref={scanner}
      onRead={onRead}
      onClose={() => navigation.goBack()}
      width={screen.width}
      height={screen.height}
      markerSize={Math.floor(
        (orientation === 'portrait' ? screen.width : screen.height) / 1.5,
      )}
      bottomContent={
        <View style={styles.scannerFooter}>
          {error && (
            <ConnectionNotice
              error={error}
              diagnostics
              action={
                loading
                  ? undefined
                  : {
                      label: Strings.Core.Retry,
                      onPress: () => scanner.current?.reactivate(),
                      testID: 'connection-error-retry',
                    }
              }
            />
          )}
          <DetailsAction
            id="registration-manual"
            label={Strings.Registration.QRCode.Manually}
            icon="keyboard-outline"
            block
            onPress={async () => {
              await cancel();
              navigation.replace(screens.MANUAL);
            }}
          />
        </View>
      }
    />
  );
}

export function ManualConnect({onConnected}: {onConnected(): void}) {
  const {credentials} = useContext(StorageContext);
  const {registeringNew, setRegisteringNew} = useContext(IoTCContext);
  const [connect, cancel, , {client, loading, error, stage}] =
    useConnectIoTCentralClient();
  const navigation = useNavigation<StackNavigationProp<RegistrationRoutes>>();
  const readonly = !registeringNew && !!client?.isConnected();
  const mounted = useRef(true);
  const busy = useRef(false);
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (busy.current) {
        cancelRef.current();
      }
    };
  }, []);
  const submit = useCallback(
    async (values: DeviceCredentials) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      try {
        const result = await connect(values);
        if (result.ok && mounted.current) {
          onConnected();
        }
      } finally {
        busy.current = false;
      }
    },
    [connect, onConnected],
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.manual}>
        {!readonly && (
          <Text style={styles.intro}>{Strings.Registration.Manual.Header}</Text>
        )}
        <CredentialForm
          credentials={registeringNew ? null : credentials}
          readonly={readonly}
          loading={loading}
          submit={submit}
        />
        {loading && (
          <>
            <Text accessibilityLiveRegion="polite">
              {Strings.Connection.Stages[stage]}
            </Text>
            <Button title={Strings.Core.Cancel} onPress={() => cancel()} />
          </>
        )}
        {error && <ConnectionNotice error={error} diagnostics />}
        {readonly && (
          <RegistrationActions
            onClose={onConnected}
            onRegisterNew={() => {
              setRegisteringNew(true);
              navigation.replace(screens.EMPTY);
            }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EmptyClient() {
  const navigation = useNavigation<StackNavigationProp<RegistrationRoutes>>();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {credentials} = useContext(StorageContext);
  const [connect, , , {error, loading}] = useConnectIoTCentralClient();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: 20 + insets.bottom,
          paddingLeft: 20 + insets.left,
          paddingRight: 20 + insets.right,
        },
      ]}>
      <Text>
        <Name>{Strings.Registration.Header.Welcome}</Name>
        {Strings.Registration.Header.Text}
      </Text>
      {focused && error && !loading && (
        <ConnectionNotice
          error={error}
          diagnostics
          action={
            credentials
              ? {
                  label: Strings.Connection.Summary.Reconnect,
                  onPress: () => void connect(credentials),
                  testID: 'connection-error-reconnect',
                }
              : undefined
          }
        />
      )}
      <ConnectionChoices
        onScan={() => navigation.navigate(screens.QR)}
        onManual={() => navigation.navigate(screens.MANUAL)}
      />
      <Text>
        {Strings.Registration.Footer}
        <Link
          onPress={() => Linking.openURL(Strings.Registration.StartHere.Url)}>
          {Strings.Registration.StartHere.Title}
        </Link>
      </Text>
    </ScrollView>
  );
}

/** One restrained scan action grouped with a quiet manual entry of equal reach. */
function ConnectionChoices({
  onScan,
  onManual,
}: {
  onScan(): void;
  onManual(): void;
}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View
      testID="registration-choices"
      style={[
        styles.choices,
        {backgroundColor: colors.surface, borderColor: colors.surfaceBorder},
      ]}>
      <DetailsAction
        id="registration-scan"
        label={Strings.Registration.QRCode.Scan}
        icon="qrcode-scan"
        variant="primary"
        block
        onPress={onScan}
      />
      <DetailsAction
        id="registration-manual"
        label={Strings.Registration.QRCode.Manually}
        variant="quiet"
        block
        onPress={onManual}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 20,
    gap: 20,
  },
  choices: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  manual: {padding: 20, paddingBottom: 40},
  scannerFooter: {padding: 16, gap: 12, alignSelf: 'stretch'},
  intro: {marginBottom: 20},
});
