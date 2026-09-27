// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useState, useMemo} from 'react';
import {CardProps, IconProps, Icon, Input} from '@rneui/themed';
import {
  Animated,
  View,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  Pressable,
} from 'react-native';
import {Button} from 'components';
import {Text, Headline, bytesToSize} from './typography';
import {DataType, ItemProps, StyleDefinition} from 'types';
import {useTheme} from 'hooks';
import {usePressSettle} from '../hooks/press';
import Strings from 'strings';
import {cardTint, palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import DetailsAction from './detailsAction';
import ToolStrings from '../experience/toolStrings';
import {usePropertyDraft} from '../runtime/propertyDrafts';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type EditCallback = (value: any) => void | Promise<void>;

export function Card(
  props: CardProps &
    TouchableOpacityProps & {
      title?: string;
      onToggle?: () => void | Promise<void>;
      enabled: boolean;
      value?: any | React.FC;
      dataType?: DataType;
      unit?: string;
      icon?: IconProps;
      editable?: boolean;
      onEdit?: EditCallback;
      availability?: ItemProps['availability'];
      simulated?: boolean;
      accentKey?: string;
      presentation?: ItemProps['presentation'];
      technicalName?: string;
    },
) {
  const {
    containerStyle,
    enabled,
    editable,
    onEdit,
    value,
    unit,
    icon,
    onPress,
    onLongPress,
    dataType,
    availability,
    simulated,
    accentKey,
    presentation,
    technicalName,
    onToggle,
    ...otherProps
  } = props;
  const [technicalVisible, setTechnicalVisible] = useState(false);
  const toggleSettle = usePressSettle('compact');
  const {dark} = useTheme();
  const colors = palette(dark);
  const textColor = enabled ? colors.text : colors.muted;
  const tint = cardTint(accentKey ?? props.title ?? '', dark);
  const sensor = availability !== undefined || onToggle !== undefined;
  const sensorText = ToolStrings.Sensors;
  const hasReading = value !== undefined && value !== null && value !== '';
  const content = (
    <View style={stylesForContent.content}>
      {icon && (
        <View
          style={[stylesForContent.icon, {backgroundColor: colors.surface}]}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Icon name={icon.name} type={icon.type} size={22} color={textColor} />
        </View>
      )}
      <View style={stylesForContent.body}>
        <Text
          testID="card-label"
          accessibilityRole="header"
          style={[stylesForContent.label, {color: colors.muted}]}>
          {otherProps.title}
        </Text>
        {simulated && (
          <Text style={[detailStyles.status, {color: colors.primary}]}>
            {Strings.Sensors.Simulated}
          </Text>
        )}
        {sensor && (
          <View style={stylesForContent.statuses}>
            <Text
              testID={`sensor-enabled-${accentKey}`}
              style={[detailStyles.supporting, {color: colors.muted}]}>
              {enabled ? sensorText.Enabled : Strings.Sensors.Disabled}
            </Text>
            <Text
              testID={`sensor-availability-${accentKey}`}
              style={[detailStyles.supporting, {color: colors.muted}]}>
              {enabled ? sensorText.Availability : sensorText.LastAvailability}:{' '}
              {availability === 'available'
                ? sensorText.Available
                : availability === 'checking'
                ? sensorText.Checking
                : availability === 'unavailable'
                ? sensorText.Unavailable
                : sensorText.NotChecked}
            </Text>
            <Text
              testID={`sensor-reading-${accentKey}`}
              style={[detailStyles.supporting, {color: colors.muted}]}>
              {sensorText.Reading}:{' '}
              {!enabled
                ? sensorText.Paused
                : availability === 'unavailable'
                ? sensorText.ReadingUnavailable
                : availability === 'checking' || !hasReading
                ? sensorText.NoReading
                : simulated
                ? sensorText.SimulatedReading
                : sensorText.LocalReading}
            </Text>
            {enabled && availability === 'unavailable' && (
              <Text style={[detailStyles.supporting, {color: colors.muted}]}>
                {sensorText.UnavailableDetail}
              </Text>
            )}
          </View>
        )}
        {!enabled ? (
          !sensor && (
            <Text style={[detailStyles.supporting, {color: colors.muted}]}>
              {Strings.Sensors.Disabled}
            </Text>
          )
        ) : availability === 'unavailable' ||
          availability === 'checking' ? null : typeof value === 'function' ? (
          value()
        ) : sensor && !hasReading ? null : (
          <View style={stylesForContent.values}>
            <Value
              value={value}
              enabled
              type={dataType}
              editable={editable}
              onEdit={onEdit}
              textColor={textColor}
              presentation={presentation}
              label={otherProps.title}
              id={accentKey}
            />
            {unit && (
              <Text style={[detailStyles.supporting, {color: colors.muted}]}>
                {unit}
              </Text>
            )}
          </View>
        )}
        {presentation?.description && (
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {presentation.description}
          </Text>
        )}
      </View>
      {onPress && (
        <Icon
          name="chevron-forward"
          type="ionicon"
          size={18}
          color={colors.muted}
          accessible={false}
        />
      )}
    </View>
  );
  const styles = useMemo<StyleDefinition>(
    () => ({
      container: {
        backgroundColor: enabled ? tint : colors.surface,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        minHeight: 140,
        padding: 20,
        marginBottom: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: enabled ? tint : colors.border,
      },
    }),
    [colors, enabled, tint],
  );

  return (
    <View
      testID={accentKey ? `card-${accentKey}` : undefined}
      style={[styles.container, containerStyle]}
      accessible={false}>
      {onPress || onLongPress ? (
        <TouchableOpacity
          {...otherProps}
          accessibilityRole="button"
          accessibilityHint={onLongPress ? sensorText.Shortcut : undefined}
          onPress={onPress}
          onLongPress={onLongPress}>
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
      {(onToggle || technicalName) && (
        <View
          style={[stylesForContent.footer, {borderTopColor: colors.border}]}>
          {onToggle && (
            <AnimatedPressable
              testID={`sensor-toggle-${accentKey}`}
              accessibilityRole="switch"
              accessibilityLabel={`${
                enabled ? Strings.Core.DisableSensor : Strings.Core.EnableSensor
              }: ${otherProps.title}`}
              accessibilityState={{checked: enabled}}
              onPress={onToggle}
              onPressIn={toggleSettle.onPressIn}
              onPressOut={toggleSettle.onPressOut}
              hitSlop={2}
              style={[
                stylesForContent.toggle,
                toggleSettle.pressed && {backgroundColor: colors.inset},
                {transform: [{scale: toggleSettle.scale}]},
              ]}>
              <Icon
                name={enabled ? 'toggle-switch' : 'toggle-switch-off-outline'}
                type="material-community"
                color={enabled ? colors.primary : colors.muted}
                size={20}
                accessible={false}
              />
              <Text
                style={[stylesForContent.actionLabel, {color: colors.primary}]}>
                {enabled
                  ? Strings.Core.DisableSensor
                  : Strings.Core.EnableSensor}
              </Text>
            </AnimatedPressable>
          )}
          {technicalName && (
            <DetailsAction
              id={`property-technical-${accentKey}`}
              label={
                technicalVisible
                  ? ToolStrings.Properties.TechnicalHide
                  : ToolStrings.Properties.TechnicalShow
              }
              expanded={technicalVisible}
              variant="quiet"
              onPress={() => setTechnicalVisible(current => !current)}
            />
          )}
        </View>
      )}
      {technicalName && technicalVisible && (
        <View
          style={[stylesForContent.technical, {backgroundColor: colors.inset}]}>
          <Text
            testID={`property-name-${accentKey}`}
            selectable
            style={[
              detailStyles.monospace,
              stylesForContent.identifier,
              {color: colors.text},
            ]}>
            {technicalName}
          </Text>
        </View>
      )}
    </View>
  );
}

const stylesForContent = StyleSheet.create({
  content: {flexDirection: 'row', alignItems: 'flex-start', gap: 16},
  icon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {flex: 1, minWidth: 0, gap: 8},
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
  statuses: {gap: 2},
  label: {fontSize: 14, fontWeight: '600'},
  actionLabel: {fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1},
  footer: {
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 20,
    rowGap: 4,
  },
  toggle: {
    minHeight: 48,
    minWidth: 48,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginLeft: -10,
    borderRadius: 14,
    gap: 6,
  },
  technical: {marginTop: 4, padding: 10, borderRadius: 12},
  identifier: {fontSize: 13, lineHeight: 20},
});

const Value = React.memo<{
  value: any;
  enabled: boolean;
  editable: boolean | undefined;
  onEdit: EditCallback | undefined;
  textColor: string;
  type?: DataType;
  presentation?: ItemProps['presentation'];
  label?: string;
  id?: string;
}>(
  ({
    value,
    enabled,
    editable,
    onEdit,
    textColor,
    type,
    presentation,
    label,
    id,
  }) => {
    const [edited, setEdited] = usePropertyDraft(id, value);
    const {dark} = useTheme();
    const colors = palette(dark);
    const styles: StyleDefinition = {
      container: {flex: 1, minWidth: 0},
      editInput: {paddingHorizontal: 0, marginBottom: 4},
      inputFrame: {
        backgroundColor: colors.surface,
        borderColor: colors.controlBorder,
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 52,
        paddingHorizontal: 12,
      },
      stringVal: {
        fontSize: 23,
        fontWeight: '600',
        color: textColor,
        fontVariant: ['tabular-nums'],
      },
    };

    if (!enabled) {
      return null;
    }
    if (editable && onEdit) {
      const draft = edited == null ? '' : String(edited);
      return (
        <View style={styles.container}>
          <Input
            testID={id ? `property-input-${id}` : undefined}
            accessibilityLabel={label}
            placeholder={presentation?.placeholder}
            placeholderTextColor={colors.muted}
            shake={() => null}
            value={draft}
            onChangeText={setEdited}
            inputStyle={{color: textColor, fontSize: 17, minHeight: 48}}
            inputContainerStyle={styles.inputFrame}
            containerStyle={styles.editInput}
            renderErrorMessage={false}
            keyboardType={
              type === 'number' || typeof value === 'number'
                ? 'numeric'
                : 'default'
            }
          />
          <Button
            testID={id ? `property-submit-${id}` : undefined}
            title={presentation?.actionLabel ?? Strings.Client.Properties.Send}
            disabled={draft === String(value ?? '')}
            onPress={() => onEdit(edited)}
          />
        </View>
      );
    }
    if (value === null || value === undefined || value === '') {
      return (
        <Text testID="card-empty" style={{fontSize: 16, color: colors.muted}}>
          {presentation?.emptyLabel ?? Strings.Sensors.Unavailable}
        </Text>
      );
    }

    if (type === 'object') {
      return (
        <View style={valueStyles.measurements}>
          {Object.keys(value).map(v => {
            let strVal: string = value[v] == null ? 'N/A' : String(value[v]);
            if (typeof value[v] === 'number') {
              strVal = (value[v] as number).toLocaleString(undefined, {
                maximumFractionDigits: 3,
              });
            }
            return (
              <View key={v} style={valueStyles.measurement}>
                <Text
                  style={[valueStyles.measurementLabel, {color: textColor}]}>
                  {v}
                </Text>
                <Text
                  style={[valueStyles.measurementValue, {color: textColor}]}>
                  {strVal}
                </Text>
              </View>
            );
          })}
        </View>
      );
    } else {
      let strVal = value.toString();
      switch (type) {
        case 'bytes':
          strVal = bytesToSize(value as number);
          break;
        case 'number':
          strVal = (value as number).toLocaleString(undefined, {
            maximumFractionDigits: 3,
          });
          break;
      }

      return (
        <Headline testID="card-value" style={styles.stringVal}>
          {strVal}
        </Headline>
      );
    }
  },
);

const valueStyles = StyleSheet.create({
  measurements: {flexDirection: 'row', flexWrap: 'wrap', gap: 14},
  measurement: {minWidth: 54, maxWidth: '100%', gap: 2},
  measurementLabel: {fontSize: 12, lineHeight: 17},
  measurementValue: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
