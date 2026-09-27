import React, {useContext, useEffect, useRef, useState} from 'react';
import {Keyboard, Linking, StyleSheet, TextInput, View} from 'react-native';
import {StorageContext} from '../contexts/storage';
import {DeviceIdentity} from '../connection/types';
import {azurePortalUrl, matchesAzureContext} from '../onboarding/azureContext';
import {decodeAzureContextInput} from '../onboarding/azureContextInput';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {Text} from './typography';
import DetailsAction from './detailsAction';
import DetailsRow from './detailsRow';

export default function AzureContextPanel({
  identity,
}: {
  identity: DeviceIdentity | null;
}) {
  const {azureContext, azureContextError, save} = useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const text = Strings.AzureContext;
  const snapshot =
    identity && azureContext && matchesAzureContext(azureContext, identity)
      ? azureContext
      : null;
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [input, setInput] = useState('');
  const [showIds, setShowIds] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setImporting(false);
    setInput('');
    setError('');
    setExpanded(false);
    setShowActivities(false);
  }, [identity?.deviceId, identity?.assignedHub]);

  const importSnapshot = async () => {
    setError('');
    let next;
    try {
      next = decodeAzureContextInput(input);
    } catch {
      setError(text.Invalid);
      return;
    }
    if (!identity || !matchesAzureContext(next, identity)) {
      setError(text.WrongDevice);
      return;
    }
    setBusy(true);
    try {
      await save({azureContext: next});
      if (mounted.current) {
        setInput('');
        setImporting(false);
        setExpanded(true);
        Keyboard.dismiss();
      }
    } catch {
      if (mounted.current) setError(text.SaveFailed);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      await save({azureContext: null});
      if (mounted.current) setExpanded(false);
    } catch {
      if (mounted.current) setError(text.RemoveFailed);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const open = async (resourceId: string) => {
    setError('');
    try {
      await Linking.openURL(azurePortalUrl(resourceId, identity?.assignedHub));
    } catch {
      if (mounted.current) setError(text.OpenFailed);
    }
  };

  // Controls sit on the recessed panel, so they take the raised `onInset`
  // fill. Controls inside a data group keep the recessed fill instead, which
  // leaves the data itself as the brightest surface in the section.
  const action = ({
    label,
    onPress,
    id,
    selected,
    variant = 'secondary',
    icon,
    grouped = false,
  }: {
    label: string;
    onPress: () => void;
    id?: string;
    selected?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
    icon?: string;
    grouped?: boolean;
  }) => (
    <DetailsAction
      key={label}
      id={id}
      label={label}
      icon={icon}
      variant={variant}
      expanded={selected}
      onInset
      disabled={busy}
      onPress={onPress}
      style={grouped ? styles.grouped : undefined}
    />
  );
  const caption = (label: string) => (
    <Text
      accessibilityRole="header"
      style={[detailStyles.label, {color: colors.text}]}>
      {label}
    </Text>
  );
  const group = (children: React.ReactNode) => (
    <View
      style={[
        styles.group,
        detailStyles.bordered,
        {backgroundColor: colors.surface, borderColor: colors.border},
      ]}>
      {children}
    </View>
  );
  const rowStyle = (first: boolean) => [
    detailStyles.row,
    !first && detailStyles.divided,
    {borderTopColor: colors.border},
  ];
  const disclosed = (resourceId: string) =>
    showIds && (
      <Text selectable style={[detailStyles.monospace, {color: colors.muted}]}>
        {resourceId}
      </Text>
    );
  const fact = (
    label: string,
    name: string,
    {
      id,
      first = false,
      resourceId,
    }: {id?: string; first?: boolean; resourceId?: string} = {},
  ) => (
    <View key={label} style={rowStyle(first)}>
      <View style={styles.line}>
        <View style={styles.field}>
          <Text style={[detailStyles.label, {color: colors.muted}]}>
            {label}
          </Text>
          <Text
            testID={id}
            selectable
            style={[detailStyles.value, {color: colors.text}]}>
            {name}
          </Text>
        </View>
        {resourceId !== undefined && (
          <DetailsAction
            label={text.PortalShort}
            accessibilityLabel={`${label}: ${text.Portal}`}
            external
            disabled={busy}
            style={styles.inline}
            onPress={() => {
              void open(resourceId);
            }}
          />
        )}
      </View>
      {resourceId !== undefined && disclosed(resourceId)}
    </View>
  );
  const manage = (
    <View style={styles.manage}>
      {caption(text.Manage)}
      <View style={styles.rows}>
        <DetailsRow
          id="azure-context-import-toggle"
          label={snapshot ? text.Replace : text.Import}
          supporting={snapshot ? text.ReplaceDetail : text.ImportDetail}
          icon={snapshot ? 'pencil-outline' : 'tray-arrow-down'}
          expanded={importing}
          onInset
          disabled={busy}
          onPress={() => {
            setImporting(!importing);
            setInput('');
            setError('');
          }}
        />
        {(azureContext || azureContextError) && (
          <DetailsRow
            id="azure-context-remove"
            label={text.Remove}
            supporting={text.RemoveDetail}
            icon="delete-outline"
            destructive
            onInset
            disabled={busy}
            onPress={() => {
              void remove();
            }}
          />
        )}
      </View>
      {importing && (
        <>
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {text.Hint}
          </Text>
          <TextInput
            testID="azure-context-input"
            accessibilityLabel={text.Input}
            placeholder={text.Placeholder}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            editable={!busy}
            multiline
            maxLength={87384}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
            style={[
              styles.input,
              detailStyles.value,
              {
                color: colors.text,
                backgroundColor: colors.inset,
                borderColor: colors.controlBorder,
              },
              busy && detailStyles.disabled,
            ]}
          />
          <View style={styles.actions}>
            {action({
              label: text.Import,
              onPress: () => {
                void importSnapshot();
              },
              id: 'azure-context-import',
              variant: 'primary',
              icon: 'tray-arrow-down',
              grouped: true,
            })}
            {action({
              label: Strings.Core.Cancel,
              onPress: () => {
                setImporting(false);
                setInput('');
                setError('');
              },
              id: 'azure-context-import-cancel',
              icon: 'close',
              grouped: true,
            })}
          </View>
        </>
      )}
    </View>
  );
  return (
    <View
      testID="azure-context-panel"
      style={[detailStyles.card, {backgroundColor: colors.inset}]}>
      <Text
        accessibilityRole="header"
        style={[detailStyles.sectionTitle, {color: colors.text}]}>
        {text.Title}
      </Text>
      {!identity ? (
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {text.Unavailable}
        </Text>
      ) : (
        <>
          {snapshot ? (
            <>
              <View style={styles.header}>
                <Text
                  testID="azure-context-namespace"
                  selectable
                  style={[
                    detailStyles.value,
                    styles.subject,
                    {color: colors.text},
                  ]}>
                  {snapshot.namespace.name}
                </Text>
                <Text
                  testID="azure-context-captured"
                  style={[detailStyles.supporting, {color: colors.muted}]}>
                  {`${text.Source} · ${text.Captured} ${new Date(
                    snapshot.capturedAt,
                  ).toLocaleString()}`}
                </Text>
                <Text style={[detailStyles.supporting, {color: colors.muted}]}>
                  {text.Explanation}
                </Text>
              </View>
              {action({
                label: expanded ? text.Hide : text.View,
                onPress: () => setExpanded(!expanded),
                id: 'azure-context-toggle',
                selected: expanded,
              })}
              {expanded && (
                <>
                  {caption(text.Scope)}
                  {group(
                    <>
                      {fact(text.Subscription, snapshot.subscription.name, {
                        id: 'azure-context-subscription',
                        first: true,
                        resourceId: `/subscriptions/${snapshot.subscription.id}`,
                      })}
                      {fact(text.ResourceGroup, snapshot.resourceGroup.name, {
                        id: 'azure-context-resource-group',
                        resourceId: `/subscriptions/${snapshot.subscription.id}/resourceGroups/${snapshot.resourceGroup.name}`,
                      })}
                      {fact(text.Region, snapshot.namespace.location, {
                        id: 'azure-context-region',
                      })}
                    </>,
                  )}
                  {caption(text.Resources)}
                  {group(
                    <>
                      {fact(text.Namespace, snapshot.namespace.name, {
                        first: true,
                        resourceId: snapshot.namespace.resourceId,
                      })}
                      {fact(text.Hub, snapshot.hub.name, {
                        resourceId: snapshot.hub.resourceId,
                      })}
                      {snapshot.dps &&
                        fact(text.Dps, snapshot.dps.name, {
                          resourceId: snapshot.dps.resourceId,
                        })}
                      {snapshot.registryDevice ? (
                        fact(text.Registry, snapshot.registryDevice.name, {
                          resourceId: snapshot.registryDevice.resourceId,
                        })
                      ) : (
                        <View style={rowStyle(false)}>
                          <Text
                            style={[detailStyles.label, {color: colors.muted}]}>
                            {text.Registry}
                          </Text>
                          <Text
                            style={[
                              detailStyles.supporting,
                              {color: colors.muted},
                            ]}>
                            {text.RegistryMissing}
                          </Text>
                        </View>
                      )}
                    </>,
                  )}
                  {action({
                    label: showIds ? text.HideIds : text.ShowIds,
                    onPress: () => setShowIds(!showIds),
                    id: 'azure-context-ids',
                    selected: showIds,
                    icon: showIds ? 'eye-off-outline' : 'eye-outline',
                  })}
                  {caption(text.Activities)}
                  <Text
                    style={[detailStyles.supporting, {color: colors.muted}]}>
                    {text.ActivityExplanation}
                  </Text>
                  {action({
                    label: showActivities
                      ? text.HideActivities
                      : text.ShowActivities,
                    onPress: () => setShowActivities(!showActivities),
                    id: 'azure-context-activities',
                    selected: showActivities,
                    icon: 'pulse',
                  })}
                  {showActivities &&
                    (snapshot.activities.length ? (
                      group(
                        snapshot.activities.map((activity, index) => (
                          <View
                            key={`${activity.timestamp}-${index}`}
                            style={rowStyle(index === 0)}>
                            <Text
                              selectable
                              style={[
                                detailStyles.value,
                                {color: colors.text},
                              ]}>
                              {activity.resourceId.split('/').at(-1)}
                            </Text>
                            <Text
                              selectable
                              style={[
                                detailStyles.supporting,
                                {color: colors.muted},
                              ]}>
                              {activity.operation}
                            </Text>
                            <View style={styles.meta}>
                              <Text
                                style={[
                                  detailStyles.label,
                                  {color: colors.muted},
                                ]}>
                                {new Date(activity.timestamp).toLocaleString()}
                              </Text>
                              <Text
                                style={[
                                  detailStyles.status,
                                  {
                                    color:
                                      activity.status === 'Failed'
                                        ? colors.danger
                                        : colors.text,
                                  },
                                ]}>
                                {activity.status}
                              </Text>
                            </View>
                            {disclosed(activity.resourceId)}
                          </View>
                        )),
                      )
                    ) : (
                      <Text
                        style={[
                          detailStyles.supporting,
                          {color: colors.muted},
                        ]}>
                        {text.NoActivities}
                      </Text>
                    ))}
                </>
              )}
            </>
          ) : (
            <Text style={[detailStyles.supporting, {color: colors.muted}]}>
              {azureContext ? text.OtherDevice : text.Empty}
            </Text>
          )}
          {azureContextError && (
            <Text
              accessibilityRole="alert"
              style={[detailStyles.status, {color: colors.danger}]}>
              {text.StoredInvalid}
            </Text>
          )}
          {manage}
        </>
      )}
      {!!error && (
        <Text
          testID="azure-context-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[detailStyles.status, {color: colors.danger}]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {gap: 6},
  subject: {fontWeight: '600'},
  group: {borderRadius: 16, paddingHorizontal: 16},
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  field: {flex: 1, minWidth: 168, gap: 4},
  inline: {alignSelf: 'center'},
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  manage: {gap: 10},
  rows: {gap: 8},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  grouped: {alignSelf: 'stretch'},
  input: {
    ...detailStyles.input,
    minHeight: 144,
    maxHeight: 220,
  },
});
