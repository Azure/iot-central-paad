import React, {useContext, useMemo, useRef, useState} from 'react';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {useIsFocused} from '@react-navigation/native';
import {Text} from '../components/typography';
import AppBackground from '../components/appBackground';
import DetailsAction from '../components/detailsAction';
import FluidDisclosure from '../components/fluidDisclosure';
import SelectionControl from '../components/selectionControl';
import Logs from '../Logs';
import {useTheme} from '../hooks';
import {StorageContext} from '../contexts/storage';
import {useDeviceRuntime} from '../runtime/DeviceRuntime';
import {
  useObservationSnapshot,
  Observation,
  ObservationSnapshot,
} from '../observation';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {ActivityStrings as text} from './activityStrings';

export function observationTitle(event: Observation): string {
  const action =
    event.kind === 'desired-property' && event.source === 'twin'
      ? text.TwinValue
      : event.kind === 'desired-property' && event.source === 'patch'
      ? text.DesiredUpdate
      : text.Channels[event.kind];
  return `${action} ${text.Outcomes[event.outcome]}`;
}

export function isObservationIssue(event: Observation): boolean {
  return (
    event.outcome === 'failed' ||
    event.outcome === 'rejected' ||
    (event.kind === 'command-reply' && event.response === 'error')
  );
}

function newest(events: (Observation | undefined)[]): Observation | undefined {
  return events.reduce<Observation | undefined>(
    (latest, event) =>
      event && (!latest || event.id > latest.id) ? event : latest,
    undefined,
  );
}

/** Deliberate interactions take precedence over periodic telemetry and twin reads. */
export function communicationObservations(snapshot: ObservationSnapshot) {
  if (!snapshot.active) return {outbound: undefined, inbound: undefined};
  const latest = snapshot.latest;
  return {
    outbound:
      newest([
        latest['reported-property'],
        latest['property-ack'],
        latest['command-reply'],
        latest.upload,
      ]) ?? newest([latest.telemetry, latest['twin-request']]),
    inbound: newest([latest.command, latest['desired-property']]),
  };
}

export function CommunicationSummary() {
  const {client} = useDeviceRuntime();
  const snapshot = useObservationSnapshot(client);
  const {simulated} = useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const summary = communicationObservations(snapshot);
  return (
    <View style={styles.communication}>
      {simulated && (
        <Text style={[detailStyles.status, {color: colors.primary}]}>
          {text.Simulated}
        </Text>
      )}
      {(['outbound', 'inbound'] as const).map(direction => {
        const event = summary[direction];
        return (
          <View
            key={direction}
            testID={`communication-${direction}`}
            style={[styles.summary, {backgroundColor: colors.inset}]}>
            <View accessible={false}>
              <Icon
                name={direction === 'outbound' ? 'arrow-up' : 'arrow-down'}
                type="material-community"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.body}>
              <Text style={[detailStyles.label, {color: colors.muted}]}>
                {direction === 'outbound' ? text.Outbound : text.Inbound}
              </Text>
              <Text style={detailStyles.value}>
                {event
                  ? observationTitle(event)
                  : direction === 'outbound'
                  ? text.NoOutbound
                  : text.NoInbound}
              </Text>
              {event && (
                <Text
                  accessibilityLabel={`${text.Local}: ${new Date(
                    event.observedAt,
                  ).toLocaleTimeString()}`}
                  style={[detailStyles.supporting, {color: colors.muted}]}>
                  {new Date(event.observedAt).toLocaleTimeString()}
                </Text>
              )}
            </View>
          </View>
        );
      })}
      <Text style={[detailStyles.supporting, {color: colors.muted}]}>
        {text.NotReceipt}
      </Text>
    </View>
  );
}

export default function Activity() {
  const {client} = useDeviceRuntime();
  const snapshot = useObservationSnapshot(client);
  const {simulated} = useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const [diagnostics, setDiagnostics] = useState(false);
  const focused = useIsFocused();
  const [diagnosticsVisited, visitDiagnostics] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const list = useRef<FlatList<Observation>>(null);
  const entries = useMemo(
    () =>
      issuesOnly
        ? snapshot.history.filter(isObservationIssue)
        : snapshot.history,
    [issuesOnly, snapshot.history],
  );
  const telemetry = snapshot.latest.telemetry;
  const latestTelemetry =
    telemetry &&
    (!issuesOnly || isObservationIssue(telemetry)) &&
    !entries.some(event => event.id === telemetry.id)
      ? telemetry
      : undefined;
  const observing = focused && !diagnostics;
  return (
    <AppBackground style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.toolbar}>
          <Text
            accessibilityRole="header"
            style={[
              detailStyles.displayTitle,
              styles.body,
              {color: colors.text},
            ]}>
            {text.Title}
          </Text>
          {!diagnostics && (
            <DetailsAction
              id="activity-latest"
              label={text.Latest}
              variant="quiet"
              icon="arrow-down"
              disabled={!entries.length && !latestTelemetry}
              onPress={() => list.current?.scrollToEnd({animated: false})}
            />
          )}
        </View>
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {`${text.Description} ${text.NotReceipt}`}
        </Text>
        {simulated && (
          <Text style={[detailStyles.status, {color: colors.primary}]}>
            {text.Simulated}
          </Text>
        )}
        <SelectionControl
          label={text.Title}
          focused={focused}
          options={[
            {id: 'activity-observations', label: text.Observations},
            {id: 'activity-diagnostics', label: text.Diagnostics},
          ]}
          selected={diagnostics ? 1 : 0}
          onSelect={index => {
            if (index === 1) visitDiagnostics(true);
            setDiagnostics(index === 1);
          }}
        />
      </View>
      <View
        style={[styles.container, diagnostics && styles.hidden]}
        accessibilityElementsHidden={diagnostics}
        importantForAccessibility={
          diagnostics ? 'no-hide-descendants' : 'auto'
        }>
        <View style={styles.filters}>
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {text.Filter}
          </Text>
          <SelectionControl
            variant="filter"
            label={text.Filter}
            focused={observing}
            options={[
              {id: 'activity-filter-all', label: text.All},
              {id: 'activity-filter-issues', label: text.Issues},
            ]}
            selected={issuesOnly ? 1 : 0}
            onSelect={index => setIssuesOnly(index === 1)}
          />
        </View>
        <FlatList
          ref={list}
          testID="activity-list"
          data={entries}
          keyExtractor={event => `${event.generation}-${event.id}`}
          renderItem={({item, index}) => (
            <ObservationRow
              event={item}
              visible={observing}
              last={index === entries.length - 1}
            />
          )}
          contentContainerStyle={styles.feed}
          ListHeaderComponent={
            <>
              {!snapshot.active && snapshot.generation > 0 && (
                <Text
                  style={[
                    styles.sessionNotice,
                    detailStyles.supporting,
                    {color: colors.muted},
                  ]}>
                  {text.Interrupted}
                </Text>
              )}
              {latestTelemetry && (
                <ObservationRow
                  event={latestTelemetry}
                  visible={observing}
                  last={!entries.length}
                  latest
                />
              )}
            </>
          }
          ListEmptyComponent={
            latestTelemetry ? null : (
              <View
                style={[
                  detailStyles.card,
                  detailStyles.bordered,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}>
                <Text style={detailStyles.sectionTitle}>
                  {issuesOnly ? text.NoIssues : text.Empty}
                </Text>
                <Text style={[detailStyles.value, {color: colors.muted}]}>
                  {issuesOnly ? text.NoIssuesDetail : text.EmptyDetail}
                </Text>
              </View>
            )
          }
        />
      </View>
      {diagnosticsVisited && (
        <View
          style={[styles.container, !diagnostics && styles.hidden]}
          accessibilityElementsHidden={!diagnostics}
          importantForAccessibility={
            !diagnostics ? 'no-hide-descendants' : 'auto'
          }>
          <Logs visible={focused && diagnostics} />
        </View>
      )}
    </AppBackground>
  );
}

export function ObservationRow({
  event,
  visible = true,
  last = true,
  latest = false,
}: {
  event: Observation;
  visible?: boolean;
  last?: boolean;
  /** The retained telemetry outcome, shown as a marker on its own row. */
  latest?: boolean;
}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const [expanded, setExpanded] = useState(false);
  const issue = isObservationIssue(event);
  const names =
    'names' in event
      ? event.names.join(', ')
      : 'name' in event
      ? event.name
      : null;
  return (
    <View testID={`activity-event-${event.id}`} style={styles.event}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.stem}>
        <View
          style={[
            styles.mark,
            expanded && styles.markOpen,
            {backgroundColor: issue ? colors.danger : colors.controlBorder},
          ]}
        />
        {!last && (
          <View style={[styles.stemLine, {backgroundColor: colors.border}]} />
        )}
      </View>
      <View style={[styles.body, styles.trail]}>
        <View style={styles.eventHeader}>
          <View style={[styles.body, styles.eventCopy]}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  detailStyles.entryTitle,
                  styles.eventTitle,
                  {color: issue ? colors.danger : colors.text},
                ]}>
                {observationTitle(event)}
              </Text>
              {latest && (
                <Text
                  testID={`activity-latest-${event.id}`}
                  accessibilityLabel={`${text.Latest}: ${text.TelemetryHistory}`}
                  style={[
                    detailStyles.label,
                    styles.latestMark,
                    {
                      color: colors.muted,
                      backgroundColor: colors.inset,
                      borderColor: colors.border,
                    },
                  ]}>
                  {text.Latest}
                </Text>
              )}
            </View>
            <Text
              accessibilityLabel={`${text.Local}: ${new Date(
                event.observedAt,
              ).toLocaleString()}`}
              style={[detailStyles.supporting, {color: colors.muted}]}>
              {new Date(event.observedAt).toLocaleString()}
            </Text>
            {event.simulated && (
              <Text style={[detailStyles.label, {color: colors.primary}]}>
                {text.Simulated}
              </Text>
            )}
          </View>
          <Pressable
            testID={`activity-toggle-${event.id}`}
            accessibilityRole="button"
            accessibilityState={{expanded}}
            accessibilityLabel={`${
              expanded ? text.HideDetails : text.Details
            }: ${observationTitle(event)}`}
            onPress={() => setExpanded(value => !value)}
            style={styles.disclosure}>
            {({pressed}) => (
              <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.chevron,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.inset : 'transparent',
                  },
                ]}>
                <Icon
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  type="material-community"
                  size={16}
                  color={colors.muted}
                />
              </View>
            )}
          </Pressable>
        </View>
        <FluidDisclosure expanded={expanded} visible={visible}>
          <View
            testID={`activity-details-${event.id}`}
            style={[
              styles.branch,
              {backgroundColor: colors.surface, borderColor: colors.border},
            ]}>
            <Fact label={text.Channel} value={event.kind} />
            <Fact label={text.Session} value={String(event.generation)} />
            {names && <Fact label={text.Capability} value={names} />}
            {'correlation' in event && event.correlation && (
              <Fact label={text.Request} value={event.correlation.value} />
            )}
            {'version' in event && event.version !== null && (
              <Fact label={text.Version} value={String(event.version)} />
            )}
            {'source' in event && (
              <Fact label={text.Source} value={event.source} />
            )}
            {event.kind === 'command-reply' && (
              <Fact label={text.Reply} value={event.response} />
            )}
            {event.outcome === 'failed' && (
              <Fact label={text.Error} value={event.errorCode} />
            )}
            {event.kind === 'upload' &&
              event.outcome === 'acknowledged' &&
              event.status !== null && (
                <Fact label={text.Http} value={String(event.status)} />
              )}
            {event.identity?.deviceId && (
              <Fact label={text.Device} value={event.identity.deviceId} />
            )}
            {event.identity?.assignedHub && (
              <Fact label={text.Hub} value={event.identity.assignedHub} />
            )}
            {event.identity?.modelId && (
              <Fact label={text.Model} value={event.identity.modelId} />
            )}
            <Text
              style={[
                detailStyles.supporting,
                styles.branchNote,
                {color: colors.muted},
              ]}>
              {event.kind === 'command-execution'
                ? text.PhysicalLimit
                : event.kind === 'upload'
                ? text.UploadChannel
                : text.NotReceipt}
            </Text>
          </View>
        </FluidDisclosure>
      </View>
    </View>
  );
}

function Fact({label, value}: {label: string; value: string}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View style={detailStyles.row}>
      <Text style={[detailStyles.label, {color: colors.muted}]}>{label}</Text>
      <Text selectable style={detailStyles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  hidden: {display: 'none'},
  body: {flex: 1, minWidth: 0},
  heading: {paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10},
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  filters: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  feed: {paddingHorizontal: 20, paddingBottom: 24},
  event: {flexDirection: 'row', gap: 12},
  stem: {width: 12, alignItems: 'center'},
  mark: {width: 10, height: 10, borderRadius: 5, marginTop: 9},
  markOpen: {width: 12, height: 12, borderRadius: 6, marginTop: 8},
  stemLine: {width: 2, flex: 1, borderRadius: 1, marginTop: 6},
  trail: {paddingBottom: 18},
  eventHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  eventCopy: {gap: 4},
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {flexShrink: 1},
  latestMark: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  branch: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  branchNote: {paddingBottom: 14, paddingTop: 4},
  disclosure: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginEnd: -8,
  },
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionNotice: {marginBottom: 12},
  communication: {gap: 8},
  summary: {
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
