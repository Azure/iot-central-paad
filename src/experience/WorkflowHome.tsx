import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  findNodeHandle,
  I18nManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {Icon} from '@rneui/themed';
import AppBackground from '../components/appBackground';
import Surface, {surfaceColor} from '../components/surface';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {IoTCContext} from '../contexts/iotc';
import {StorageContext} from '../contexts/storage';
import {useTheme} from '../hooks';
import {ItemProps} from '../types';
import {PHONE_MODEL_ID} from '../connection/types';
import {matchesAzureContext} from '../onboarding/azureContext';
import {Text} from '../components/typography';
import DetailsAction from '../components/detailsAction';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {projectSetup} from './setupProjection';
import {ExperienceStrings} from './strings';
import ChannelFlow, {Channel, ChannelId} from './ChannelFlow';
import ConnectionMapIcon from './ConnectionMapIcon';
import {useDecorativeLoop, useGentleTransition} from '../hooks/motion';
import {usePressSettle} from '../hooks/press';

export type WorkflowHomeProps = {
  sensors: ItemProps[];
  onDetails(): void;
  onTelemetry(): void;
  onActivity(): void;
  communication?: React.ReactNode;
  /** Home sets this false while a native modal covers it; focus alone cannot see that. */
  motionVisible?: boolean;
};

type Node = 'phone' | 'dps' | 'hub' | 'adr';
const text = ExperienceStrings.Home;
const MAP_BORDER = 1;
const MAP_PADDING = 18;
const SERVICE_GAP = 16;
const PHONE_WIDTH_PERCENT = 62;
const STACKED_PATH_PADDING = 4;
/** Room for a lane's own caret, so each end reads as a head and not a stub. */
const LANE_EDGE = 10;
/** Below this there is no honest route to draw, only invalid coordinates. */
const MIN_ROUTE_WIDTH = 2 * LANE_EDGE + 8;
const drawable = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= MIN_ROUTE_WIDTH;

function focus(target: View | null | undefined) {
  const handle = target ? findNodeHandle(target) : null;
  if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
}

export default function WorkflowHome({
  sensors,
  onDetails,
  onTelemetry,
  onActivity,
  communication,
  motionVisible = true,
}: WorkflowHomeProps) {
  const {client, error, connecting, stage} = useContext(IoTCContext);
  const {credentials, simulated, azureContext, azureContextError} =
    useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const insets = useSafeAreaInsets();
  const {width, fontScale} = useWindowDimensions();
  const [mapWidth, setMapWidth] = useState<number | null>(null);
  const measuredWidth =
    mapWidth ?? Math.min(440, width - insets.left - insets.right - 62);
  const stacked = fontScale > 1.2 || measuredWidth < 320;
  const stackedHeader =
    fontScale > 1.45 || width - insets.left - insets.right < 360;
  // Match the native service row's inset and gap in each SVG's own coordinate space.
  const serviceWidth = measuredWidth - 2 * (MAP_BORDER + MAP_PADDING);
  const dpsLinkX = (serviceWidth - SERVICE_GAP) / 4;
  const hubLinkX = serviceWidth - dpsLinkX;
  const dpsPhoneX = MAP_BORDER + MAP_PADDING + dpsLinkX;
  const hubPhoneX = measuredWidth - dpsPhoneX;
  const phoneLeftX = measuredWidth * (0.5 - PHONE_WIDTH_PERCENT / 400);
  const phoneRightX = measuredWidth * (0.5 + PHONE_WIDTH_PERCENT / 400);
  const [panel, setPanel] = useState<Node | null>(null);
  const openers = useRef<Partial<Record<Node, View | null>>>({});
  const opener = useRef<Node | null>(null);
  const closeControl = useRef<View>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const projection = projectSetup(
    credentials,
    client?.identity ?? null,
    simulated,
  );
  const identity = !simulated ? client?.identity : null;
  const snapshot =
    identity && azureContext && matchesAzureContext(azureContext, identity)
      ? azureContext
      : null;
  const connectionAttention = Boolean(error && !connecting && !simulated);
  // A deliberate disconnect is a state the person chose, not a fault. It is a
  // UI stage the runtime records after clearing the client and the error; no
  // transport ever emits it, so the map still checks the live link before it
  // draws anything as broken.
  const manuallyDisconnected = Boolean(
    !simulated &&
      !connecting &&
      stage === 'disconnected' &&
      !(typeof client?.isConnected === 'function' && client.isConnected()),
  );
  const sensorAttention = sensors.some(
    sensor => sensor.enabled && sensor.availability === 'unavailable',
  );
  const focused = useIsFocused();
  const onStage = focused && panel === null && motionVisible;
  // Decorative light only for a real, current, non-simulated connection.
  const connected = Boolean(
    !simulated &&
      !connecting &&
      !error &&
      typeof client?.isConnected === 'function' &&
      client.isConnected(),
  );
  const flowing = connected && onStage;
  // A dropped, previously established transport is the only interruption the
  // runtime reports explicitly: CONNECTION_LOST arrives after CONNACK, while a
  // pre-CONNACK CONNECT_FAILED, an auth or config failure, a reconnect in
  // flight, a fresh setup and simulation are all something else. Nothing here
  // probes the network to decide that.
  const interrupted = Boolean(
    !simulated &&
      !connecting &&
      error?.code === 'CONNECTION_LOST' &&
      client &&
      typeof client.isConnected === 'function' &&
      !client.isConnected(),
  );
  // Both a dropped link and a deliberate disconnect leave the phone off the
  // cloud, so the map draws the same broken connectors; only the words differ.
  const linkBroken = interrupted || manuallyDisconnected;
  const phonePlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  const flowProgress = useDecorativeLoop(flowing);
  const activityPress = usePressSettle('footer', false, onStage);
  // The caret leads toward the next screen, whichever way reading runs.
  const trailing = I18nManager.isRTL ? -1 : 1;
  const activityNudge = activityPress.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4 * trailing],
  });
  // Stacked services are one full width column, so no fork could touch them.
  // Each stacked pair gets its own captioned lane, measured on its own row.
  const [laneWidth, setLaneWidth] = useState<number | null>(null);
  // Captions lead and stand alone until a real width arrives; no route is
  // ever drawn from a guessed, zero or negative coordinate space.
  const laneReady = drawable(laneWidth);
  const measuredLane = laneReady ? laneWidth : 0;
  const mapReady = drawable(measuredWidth);
  const lane = {from: LANE_EDGE, to: measuredLane - LANE_EDGE};
  const routes: ChannelId[] = [
    ...(projection.mode !== 'hub' ? (['dps'] as const) : []),
    'hub' as const,
  ];
  const channels: Channel[] = routes.map(id => {
    const from = id === 'dps' ? dpsPhoneX : hubPhoneX;
    const to = id === 'dps' ? phoneLeftX : phoneRightX;
    return {
      id,
      from: I18nManager.isRTL ? measuredWidth - from : from,
      to: I18nManager.isRTL ? measuredWidth - to : to,
    };
  });
  // Grey while the phone is not connected, danger while a live link dropped:
  // the route is real, the light is not.
  const routeColor = connected
    ? colors.channel
    : linkBroken
    ? colors.danger
    : colors.controlBorder;
  const mapArrival = useGentleTransition(
    `${stacked}:${projection.mode}`,
    onStage,
  );
  const phoneArrival = useGentleTransition(
    `${stacked}:${projection.mode}:${
      connected ? 'connected' : linkBroken ? 'broken' : 'neutral'
    }`,
    onStage,
  );
  const attentionArrival = useGentleTransition(
    `${connectionAttention || manuallyDisconnected}:${sensorAttention}`,
    onStage && (connectionAttention || manuallyDisconnected || sensorAttention),
  );
  const namespaceLineStyle = {
    opacity: mapArrival.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0.35, 0.85, 0.85],
    }),
    transform: [
      {
        translateY: mapArrival.interpolate({
          inputRange: [0, 0.55, 1],
          outputRange: [-3, 0, 0],
        }),
      },
    ],
  };
  const phoneLineStyle = {
    opacity: phoneArrival.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0.5, 0.6, 1],
    }),
    transform: [
      {
        translateY: phoneArrival.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [-3, -3, 0],
        }),
      },
    ],
  };

  const finishClose = useCallback(() => {
    const action = afterClose.current;
    afterClose.current = null;
    const node = opener.current;
    opener.current = null;
    if (action) action();
    else if (node) focus(openers.current[node]);
  }, []);
  const close = (action?: () => void) => {
    afterClose.current = action ?? null;
    setPanel(null);
  };
  useEffect(() => {
    // Android has no Modal.onDismiss callback. With no animation, restore after commit.
    if (panel !== null || Platform.OS === 'ios') return;
    const frame = requestAnimationFrame(finishClose);
    return () => cancelAnimationFrame(frame);
  }, [panel, finishClose]);

  const node = (key: Node) => {
    const horizontal = stacked || key === 'adr' || key === 'phone';
    return (
      <Pressable
        ref={element => {
          openers.current[key] = element;
        }}
        testID={`home-node-${key}`}
        accessibilityRole="button"
        accessibilityLabel={`${text.Nodes[key].Title}. ${
          key === 'phone' ? `${text.PhonePlatforms[phonePlatform]}. ` : ''
        }${
          key === 'dps' && projection.mode === 'hub'
            ? text.DpsNotUsed
            : text.Nodes[key].Subtitle
        }`}
        accessibilityHint={text.OpenPanel}
        accessibilityState={{expanded: panel === key}}
        onPress={() => {
          opener.current = key;
          setPanel(key);
        }}
        style={({pressed}) => [
          styles.node,
          horizontal && styles.horizontalNode,
          stacked && styles.stackedNode,
          key === 'phone' && styles.phoneNode,
          key === 'adr' && !stacked && styles.namespaceNode,
          {
            backgroundColor: surfaceColor(dark, {pressed}),
            borderColor: colors.border,
          },
        ]}>
        <ConnectionMapIcon
          node={
            key === 'phone'
              ? phonePlatform === 'ios'
                ? 'iphone'
                : 'android'
              : key
          }
          dark={dark}
        />
        <View style={[styles.nodeCopy, horizontal && styles.horizontalCopy]}>
          {key === 'phone' && (
            <Text
              style={[
                detailStyles.label,
                styles.phoneEyebrow,
                I18nManager.isRTL && styles.rtlLabel,
                {color: colors.muted},
              ]}>
              {text.Nodes.phone.Eyebrow}
            </Text>
          )}
          <Text
            style={[
              styles.nodeTitle,
              horizontal && styles.horizontalLabel,
              horizontal && I18nManager.isRTL && styles.rtlLabel,
              {color: colors.text},
            ]}>
            {key === 'phone'
              ? text.PhonePlatforms[phonePlatform]
              : text.Nodes[key].Title}
          </Text>
          <Text
            style={[
              detailStyles.supporting,
              styles.nodeSubtitle,
              horizontal && styles.horizontalLabel,
              horizontal && I18nManager.isRTL && styles.rtlLabel,
              {color: colors.muted},
            ]}>
            {key === 'dps' && projection.mode === 'hub'
              ? text.DpsNotUsed
              : text.Nodes[key].Subtitle}
          </Text>
        </View>
      </Pressable>
    );
  };
  const note = (value: string) => (
    <Text style={[detailStyles.supporting, {color: colors.muted}]}>
      {value}
    </Text>
  );
  const attentionRow = (
    id: string,
    label: string,
    supporting: string,
    onPress: () => void,
  ) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={supporting}
      onPress={onPress}
      style={({pressed}) => [
        styles.attentionRow,
        {
          backgroundColor: surfaceColor(dark, {
            from: colors.tints[2],
            pressed,
          }),
          borderColor: colors.controlBorder,
        },
      ]}>
      <Animated.View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.attentionIcon,
          {
            backgroundColor:
              id === 'home-attention-connection'
                ? colors.dangerSurface
                : colors.tints[3],
            transform: [
              {
                scale: attentionArrival.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              },
            ],
          },
        ]}>
        <Icon
          name="alert-outline"
          type="material-community"
          size={18}
          color={colors.text}
        />
      </Animated.View>
      <View style={styles.attentionBody}>
        <Text style={[detailStyles.actionLabel, {color: colors.text}]}>
          {label}
        </Text>
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {supporting}
        </Text>
      </View>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Icon
          name="chevron-right"
          type="material-community"
          size={22}
          color={colors.muted}
        />
      </View>
    </Pressable>
  );
  const fact = (
    label: string,
    value: string | undefined,
    source: string,
    supporting?: string,
    selectable = true,
  ) => (
    <View
      key={label}
      style={[
        detailStyles.row,
        detailStyles.divided,
        {borderTopColor: colors.border},
      ]}>
      <Text style={[detailStyles.label, {color: colors.muted}]}>{label}</Text>
      <Text
        selectable={selectable}
        style={[detailStyles.value, {color: colors.text}]}>
        {value ?? text.Unknown}
      </Text>
      <Text style={[detailStyles.status, {color: colors.primary}]}>
        {source}
      </Text>
      {supporting && note(supporting)}
    </View>
  );
  const credentialLabel =
    projection.credentialKind === 'connectionString'
      ? text.Fields.ConnectionString
      : projection.credentialKind === 'group'
      ? text.Fields.GroupKey
      : text.Fields.IndividualKey;
  const credential = () =>
    fact(
      credentialLabel,
      projection.credentialPresent ? text.Hidden : text.NotConfigured,
      text.Sources.Setup,
      projection.credentialKind === 'group'
        ? `${text.PresenceOnly} ${text.GroupNote}`
        : text.PresenceOnly,
      false,
    );
  const setupRows = () => (
    <>
      {fact(
        text.Fields.Endpoint,
        projection.provisioningHost,
        text.Sources.Setup,
        text.EndpointNote,
      )}
      {fact(text.Fields.Scope, projection.scopeId, text.Sources.Setup)}
      {fact(
        text.Fields.Registration,
        projection.registrationId,
        text.Sources.Setup,
        text.RegistrationNote,
      )}
    </>
  );
  const assignment = projection.assignment;
  const assignmentSource =
    (assignment?.source ?? (projection.mode === 'dps' ? 'dps' : 'setup')) ===
    'dps'
      ? text.Sources.Dps
      : text.Sources.Setup;
  const panelBody = () => {
    switch (panel) {
      case 'phone':
        return (
          <>
            {projection.mode === 'dps' && setupRows()}
            {projection.mode === 'hub' && (
              <>
                {fact(
                  text.Fields.Hub,
                  projection.configuredHub,
                  text.Sources.Setup,
                  text.DirectIdentity,
                )}
                {fact(
                  text.Fields.Device,
                  projection.configuredDeviceId,
                  text.Sources.Setup,
                )}
              </>
            )}
            {projection.mode !== 'unconfigured' && credential()}
            {fact(
              text.Fields.Model,
              PHONE_MODEL_ID,
              text.Sources.App,
              text.ModelNote,
            )}
            {note(text.CredentialMaintenance)}
          </>
        );
      case 'dps':
        return projection.mode === 'hub' ? (
          <Text style={[detailStyles.value, {color: colors.text}]}>
            {text.DpsNotUsed}
          </Text>
        ) : (
          <>
            {setupRows()}
            {projection.mode !== 'unconfigured' && credential()}
            {fact(
              text.Fields.Authentication,
              projection.credentialKind === 'group'
                ? text.GroupAuthentication
                : text.DpsAuthentication,
              text.Sources.Generated,
              text.AuthenticationNote,
              false,
            )}
            {fact(
              text.Fields.AssignedHub,
              assignment?.source === 'dps' ? assignment.hub : undefined,
              text.Sources.Dps,
            )}
            {fact(
              text.Fields.AssignedDevice,
              assignment?.source === 'dps' ? assignment.deviceId : undefined,
              text.Sources.Dps,
              text.RegistrationNote,
            )}
            {!assignment &&
              note(simulated ? text.SimulationIdentity : text.NoAssignment)}
          </>
        );
      case 'hub':
        return (
          <>
            {fact(
              text.Fields.Hub,
              assignment?.hub ?? projection.configuredHub,
              assignmentSource,
            )}
            {fact(
              text.Fields.Device,
              assignment?.deviceId ?? projection.configuredDeviceId,
              assignmentSource,
            )}
            {!assignment &&
              note(
                simulated
                  ? text.SimulationIdentity
                  : projection.mode === 'hub'
                  ? text.DirectIdentity
                  : text.NoAssignment,
              )}
            {fact(
              text.Fields.Authentication,
              text.HubAuthentication,
              text.Sources.Generated,
              text.AuthenticationNote,
              false,
            )}
            {fact(
              text.PhoneToHub,
              text.Outbound,
              text.Sources.App,
              undefined,
              false,
            )}
            {fact(
              text.HubToPhone,
              text.Inbound,
              text.Sources.App,
              undefined,
              false,
            )}
            {note(text.NoAdminKey)}
          </>
        );
      case 'adr':
        return (
          <>
            {snapshot ? (
              <>
                {fact(
                  text.Fields.Namespace,
                  snapshot.namespace.name,
                  text.Sources.Snapshot,
                  text.SnapshotNote,
                )}
                {fact(
                  text.Fields.Captured,
                  snapshot.capturedAt,
                  text.Sources.Snapshot,
                )}
                {snapshot.registryDevice &&
                  fact(
                    text.Fields.HistoricalInventory,
                    snapshot.registryDevice.name,
                    text.Sources.Snapshot,
                    text.RegistryNote,
                  )}
              </>
            ) : (
              note(
                azureContextError
                  ? text.SnapshotUnavailable
                  : azureContext && identity
                  ? text.SnapshotOtherDevice
                  : text.NoSnapshot,
              )
            )}
            {fact(
              text.Fields.Links,
              text.NotChecked,
              text.Sources.Azure,
              text.ManagedNote,
              false,
            )}
            {fact(
              text.Fields.EligibleHubs,
              text.NotChecked,
              text.Sources.Azure,
              text.RegistryNote,
              false,
            )}
            {fact(
              text.Fields.Inventory,
              text.NotChecked,
              text.Sources.Azure,
              text.RegistryNote,
              false,
            )}
            {fact(
              text.Fields.Access,
              text.ManagedAccess,
              text.Sources.Azure,
              text.ManagedNote,
              false,
            )}
            {note(text.NoManagement)}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <AppBackground style={styles.root}>
      <ScrollView
        testID="workflow-home-content"
        accessibilityElementsHidden={panel !== null}
        importantForAccessibility={
          panel !== null ? 'no-hide-descendants' : 'auto'
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: 16 + insets.left,
            paddingRight: 16 + insets.right,
            paddingBottom: 16 + insets.bottom,
          },
        ]}>
        {simulated && (
          <Text
            testID="home-simulation"
            style={[detailStyles.status, {color: colors.primary}]}>
            {text.Simulation}
          </Text>
        )}
        <Surface
          testID="home-map"
          level="raised"
          radius={20}
          style={styles.card}>
          <Text
            style={[
              detailStyles.supporting,
              styles.kicker,
              {color: colors.primary},
            ]}>
            {text.Capability}
          </Text>
          <Text
            accessibilityRole="header"
            style={[detailStyles.displayTitle, {color: colors.text}]}>
            {text.Map}
          </Text>
          {note(text.MapHint)}
          <View
            testID={stacked ? 'home-map-stacked' : 'home-map-compact'}
            onLayout={event => setMapWidth(event.nativeEvent.layout.width)}
            style={styles.map}>
            <View
              testID="home-map-azure"
              style={[
                styles.azure,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inset,
                },
              ]}>
              <View style={styles.cloudHeading}>
                <Icon
                  name="cloud-outline"
                  type="material-community"
                  size={14}
                  color={colors.muted}
                  accessible={false}
                />
                <Text style={[detailStyles.label, {color: colors.muted}]}>
                  {text.CloudServices}
                </Text>
              </View>
              {node('adr')}
              {stacked || !mapReady ? null : (
                <Animated.View pointerEvents="none" style={namespaceLineStyle}>
                  <Svg
                    testID="home-map-namespace-lines"
                    height={24}
                    width="100%"
                    viewBox={`0 0 ${serviceWidth} 24`}
                    preserveAspectRatio="none"
                    accessible={false}
                    importantForAccessibility="no-hide-descendants">
                    <Path
                      testID="home-map-namespace-path"
                      d={`M${
                        serviceWidth / 2
                      } 0V12M${dpsLinkX} 24V12H${hubLinkX}V24`}
                      stroke={colors.controlBorder}
                      strokeDasharray="4 3"
                      fill="none"
                      strokeWidth={1.5}
                    />
                  </Svg>
                </Animated.View>
              )}
              <View
                testID="home-map-services"
                style={[
                  styles.services,
                  stacked && styles.stackedServices,
                  !stacked && !mapReady && styles.spacedServices,
                ]}>
                {node('dps')}
                {node('hub')}
              </View>
            </View>
            {stacked ? (
              <View testID="home-map-stacked-paths" style={styles.stackedPaths}>
                {routes.map(id => (
                  <View
                    key={id}
                    testID={`home-map-lane-${id}`}
                    onLayout={event =>
                      setLaneWidth(event.nativeEvent.layout.width)
                    }
                    style={styles.lane}>
                    {note(id === 'dps' ? text.PhoneDpsPath : text.PhoneHubPath)}
                    {laneReady && (
                      <ChannelFlow
                        width={measuredLane}
                        channels={[{id, ...lane}]}
                        layout="lane"
                        linesTestID={`home-map-lane-${id}-lines`}
                        color={routeColor}
                        glow={colors.channelGlow}
                        peak={dark ? 0.7 : 0.85}
                        connected={connected}
                        flowing={flowing}
                        interrupted={linkBroken}
                        progress={flowProgress}
                        style={phoneLineStyle}
                      />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              mapReady && (
                <ChannelFlow
                  width={measuredWidth}
                  channels={channels}
                  color={routeColor}
                  glow={colors.channelGlow}
                  peak={dark ? 0.7 : 0.85}
                  connected={connected}
                  flowing={flowing}
                  interrupted={linkBroken}
                  progress={flowProgress}
                  style={phoneLineStyle}
                  labels={{
                    text: text.PathLabels,
                    background: colors.surfaceRaised,
                  }}
                />
              )
            )}
            <View
              testID="home-map-phone"
              style={[styles.phone, stacked && styles.stackedPhone]}>
              {node('phone')}
            </View>
          </View>
          {linkBroken && (
            <Text
              testID="home-map-interrupted"
              accessibilityLiveRegion="polite"
              // The visible line is a legend key; assistive output states the
              // condition itself, never the colour.
              accessibilityLabel={
                manuallyDisconnected
                  ? text.DisconnectedAlert
                  : text.InterruptedAlert
              }
              style={[detailStyles.supporting, {color: colors.danger}]}>
              {manuallyDisconnected ? text.Disconnected : text.Interrupted}
            </Text>
          )}
          <Text
            accessibilityLabel={`${text.NamespaceLinks}. ${
              projection.mode === 'hub' ? text.DpsNotUsed : text.PhoneDpsPath
            }. ${text.PhoneHubPath}. ${text.FlowNote}. ${text.MapAuthority}`}
            style={[detailStyles.supporting, {color: colors.muted}]}>
            {`${text.MapLegend} ${text.FlowHint}`}
          </Text>
        </Surface>
        {(connectionAttention || manuallyDisconnected || sensorAttention) && (
          <View testID="home-attention" style={styles.attention}>
            <Text
              accessibilityRole="header"
              style={[detailStyles.sectionTitle, {color: colors.text}]}>
              {text.Attention}
            </Text>
            {(connectionAttention || manuallyDisconnected) &&
              attentionRow(
                'home-attention-connection',
                manuallyDisconnected
                  ? text.DisconnectedAttention
                  : text.ConnectionAttention,
                manuallyDisconnected
                  ? text.DisconnectedAttentionHint
                  : text.ConnectionAttentionHint,
                onDetails,
              )}
            {sensorAttention &&
              attentionRow(
                'home-attention-sensors',
                text.SensorAttention,
                text.SensorAttentionHint,
                onTelemetry,
              )}
          </View>
        )}
        <Surface
          testID="home-communication"
          level="raised"
          radius={20}
          style={styles.card}>
          <Text
            accessibilityRole="header"
            style={[detailStyles.sectionTitle, {color: colors.text}]}>
            {text.Communication}
          </Text>
          {communication ?? note(text.CommunicationEmpty)}
          <Pressable
            testID="home-activity"
            accessibilityRole="button"
            accessibilityLabel={text.Activity}
            accessibilityHint={text.ActivityHint}
            onPress={onActivity}
            onPressIn={activityPress.onPressIn}
            onPressOut={activityPress.onPressOut}
            hitSlop={2}
            style={[
              styles.footer,
              {
                borderColor: colors.surfaceBorder,
                backgroundColor: surfaceColor(dark, {
                  tone: 'footer',
                  pressed: activityPress.pressed,
                }),
              },
            ]}>
            <View
              testID="home-activity-plate"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.footerPlate,
                {backgroundColor: colors.positiveSurface},
              ]}>
              <Icon
                name="pulse"
                type="material-community"
                size={20}
                color={colors.primary}
              />
            </View>
            <Text
              style={[
                detailStyles.actionLabel,
                styles.footerLabel,
                {color: colors.primary},
              ]}>
              {text.Activity}
            </Text>
            <Animated.View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{transform: [{translateX: activityNudge}]}}>
              <Icon
                name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'}
                type="material-community"
                size={18}
                color={colors.muted}
              />
            </Animated.View>
          </Pressable>
        </Surface>
      </ScrollView>
      <Modal
        visible={panel !== null}
        animationType="none"
        presentationStyle="pageSheet"
        allowSwipeDismissal={Platform.OS === 'ios'}
        onRequestClose={() => close()}
        onShow={() => focus(closeControl.current)}
        onDismiss={finishClose}>
        <View
          testID={panel ? `home-panel-${panel}` : undefined}
          accessibilityViewIsModal
          onAccessibilityEscape={() => close()}
          style={[
            styles.root,
            {
              backgroundColor: colors.surface,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}>
          <View
            testID="home-panel-header"
            style={[
              styles.panelHeader,
              stackedHeader && styles.stackedHeader,
              {borderColor: colors.border},
            ]}>
            {panel && (
              <View
                style={[
                  styles.panelHeading,
                  stackedHeader && styles.stackedHeading,
                ]}>
                <Text style={[detailStyles.label, {color: colors.primary}]}>
                  {panel === 'dps' && projection.mode === 'hub'
                    ? text.DpsNotUsed
                    : text.Nodes[panel].Eyebrow}
                </Text>
                <Text
                  testID="home-panel-title"
                  accessibilityRole="header"
                  style={[detailStyles.sectionTitle, {color: colors.text}]}>
                  {text.Nodes[panel].Panel}
                </Text>
                {simulated && (
                  <Text
                    testID="home-panel-simulation"
                    style={[detailStyles.supporting, {color: colors.primary}]}>
                    {text.Simulation}
                  </Text>
                )}
              </View>
            )}
            <Pressable
              ref={closeControl}
              testID="home-panel-close"
              accessibilityRole="button"
              accessibilityLabel={text.Close}
              onPress={() => close()}
              style={({pressed}) => [
                detailStyles.action,
                styles.close,
                stackedHeader && styles.stackedClose,
                {
                  borderColor: colors.controlBorder,
                  backgroundColor: surfaceColor(dark, {tone: 'inset', pressed}),
                },
              ]}>
              <Text style={[detailStyles.actionLabel, {color: colors.primary}]}>
                {text.Close}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            testID="home-panel-body"
            contentContainerStyle={styles.panelContent}>
            {panel && (
              <>
                <Text style={[detailStyles.value, {color: colors.text}]}>
                  {panel === 'dps' && projection.mode === 'hub'
                    ? text.DirectRole
                    : text.Nodes[panel].Role}
                </Text>
                {panel !== 'adr' && (
                  <>
                    {projection.mode === 'unconfigured' && note(text.NoSetup)}
                    {projection.invalidSetup && note(text.InvalidSetup)}
                    {projection.invalidIdentity && note(text.InvalidIdentity)}
                  </>
                )}
                {panelBody()}
                {note(text.MapAuthority)}
                <DetailsAction
                  id="home-panel-details"
                  label={text.Details}
                  icon="information-outline"
                  onPress={() => close(onDetails)}
                />
                {note(text.DetailsHint)}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {paddingTop: 16, gap: 12},
  kicker: {textTransform: 'none', letterSpacing: 0.6, marginBottom: -4},
  card: {padding: 14, gap: 10},
  footer: {
    minHeight: 56,
    borderRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  footerPlate: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {flexGrow: 1, flexShrink: 1, minWidth: 0},
  map: {width: '100%', maxWidth: 440, alignSelf: 'center'},
  azure: {
    borderWidth: MAP_BORDER,
    borderRadius: 18,
    padding: MAP_PADDING,
    gap: 0,
  },
  node: {
    minHeight: 80,
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalNode: {flexDirection: 'row', gap: 8},
  nodeCopy: {gap: 2, alignSelf: 'stretch'},
  horizontalCopy: {flex: 1, minWidth: 0, alignSelf: 'center'},
  horizontalLabel: {textAlign: 'left'},
  rtlLabel: {textAlign: 'right'},
  phoneEyebrow: {fontSize: 10, lineHeight: 14},
  cloudHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  stackedNode: {flex: 0},
  nodeTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  nodeSubtitle: {textAlign: 'center', lineHeight: 18},
  namespaceNode: {width: '94%', alignSelf: 'center', flex: 0},
  phoneNode: {flex: 0},
  services: {flexDirection: 'row', gap: SERVICE_GAP},
  // Until a width is measured there is no drawn lane, so the row keeps the
  // same air the lane would have held.
  spacedServices: {marginTop: 16},
  stackedServices: {flexDirection: 'column', gap: 16, marginTop: 16},
  phone: {width: `${PHONE_WIDTH_PERCENT}%`, alignSelf: 'center'},
  stackedPhone: {width: '100%'},
  stackedPaths: {
    paddingHorizontal: STACKED_PATH_PADDING,
    paddingTop: 12,
    gap: 14,
  },
  lane: {gap: 2},
  attention: {gap: 8},
  attentionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  attentionBody: {flex: 1, minWidth: 0, gap: 3},
  attentionIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stackedHeader: {flexDirection: 'column', alignItems: 'stretch'},
  panelHeading: {flex: 1, minWidth: 0, gap: 3},
  stackedHeading: {flex: 0},
  close: {
    alignSelf: 'center',
    flexShrink: 0,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  stackedClose: {alignSelf: 'flex-end'},
  panelContent: {padding: 20, gap: 12},
});
