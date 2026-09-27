import React from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {Icon} from '@rneui/themed';
import {Text} from '../components/typography';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import ToolStrings from './toolStrings';
import AppBackground from '../components/appBackground';
import {surfaceColor, surfaceEdge} from '../components/surface';
import {usePressSettle} from '../hooks/press';

export type ExploreTool =
  | 'Telemetry'
  | 'Properties'
  | 'Image Upload'
  | 'Bluetooth';

const text = ToolStrings.Explore;
const tools: {
  route: ExploreTool;
  id: string;
  title: string;
  detail: string;
  icon: string;
}[] = [
  {
    route: 'Telemetry',
    id: 'telemetry',
    title: text.Telemetry,
    detail: text.TelemetryDetail,
    icon: 'chart-line',
  },
  {
    route: 'Properties',
    id: 'properties',
    title: text.Properties,
    detail: text.PropertiesDetail,
    icon: 'tune-variant',
  },
  {
    route: 'Image Upload',
    id: 'image',
    title: text.Image,
    detail: text.ImageDetail,
    icon: 'image-outline',
  },
  {
    route: 'Bluetooth',
    id: 'bluetooth',
    title: text.Bluetooth,
    detail: text.BluetoothDetail,
    icon: 'bluetooth',
  },
];

type Tool = (typeof tools)[number];

/** One porcelain tile: the accent lives in the plate, not in the field. */
function Tile({
  tool,
  index,
  stacked,
  onOpen,
}: {
  tool: Tool;
  index: number;
  stacked: boolean;
  onOpen(route: ExploreTool): void;
}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const accent = colors.toolAccents[index];
  const press = usePressSettle('card');
  const paint = {tone: 'raised' as const, accent, pressed: press.pressed};
  return (
    <Animated.View
      style={[
        styles.frame,
        stacked && styles.stackedFrame,
        {transform: [{scale: press.scale}]},
      ]}>
      <Pressable
        testID={`explore-tool-${tool.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${tool.title}. ${tool.detail}`}
        onPress={() => onOpen(tool.route)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={2}
        style={[
          detailStyles.card,
          styles.tool,
          stacked && styles.stackedTool,
          {
            backgroundColor: surfaceColor(dark, paint),
            borderColor: colors.surfaceBorder,
          },
          surfaceEdge(dark, 'raised'),
        ]}>
        <View
          testID={`explore-plate-${tool.id}`}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.icon, {backgroundColor: accent}]}>
          <Icon
            name={tool.icon}
            type="material-community"
            color={colors.toolOnAccent}
            size={23}
          />
        </View>
        <View style={styles.body}>
          <Text style={[detailStyles.sectionTitle, {color: colors.text}]}>
            {tool.title}
          </Text>
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {tool.detail}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Explore({onOpen}: {onOpen(tool: ExploreTool): void}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const {width, fontScale} = useWindowDimensions();
  const stacked = width < 340 || fontScale > 1.3;
  return (
    <AppBackground>
      <ScrollView
        testID="explore-directory"
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[detailStyles.displayTitle, {color: colors.text}]}>
            {text.Title}
          </Text>
          <Text style={[detailStyles.supporting, {color: colors.muted}]}>
            {text.Description}
          </Text>
        </View>
        <View
          testID="explore-tools-grid"
          style={[styles.tools, stacked && styles.stackedTools]}>
          {tools.map((tool, index) => (
            <Tile
              key={tool.route}
              tool={tool}
              index={index}
              stacked={stacked}
              onOpen={onOpen}
            />
          ))}
        </View>
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {text.Availability}
        </Text>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {padding: 20, gap: 12},
  scroll: {flex: 1},
  heading: {gap: 6, marginBottom: 4},
  tools: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  stackedTools: {flexDirection: 'column'},
  frame: {flexBasis: '47%', flexGrow: 1, minWidth: 0},
  stackedFrame: {flexBasis: 'auto', width: '100%'},
  tool: {
    // Grow into the row height the frame already claims, so faces align.
    flexGrow: 1,
    minHeight: 180,
    alignItems: 'flex-start',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stackedTool: {
    flexGrow: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 104,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 6},
});
