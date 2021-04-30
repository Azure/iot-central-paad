import { StackNavigationProp } from '@react-navigation/stack';
import {
  GestureResponderEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';
import {
  LineData,
  LineValue,
  LineDatasetConfig,
} from 'react-native-charts-wrapper';
import { IconProps } from 'react-native-elements';

export const Screens = {
  TELEMETRY_SCREEN: 'Telemetry',
  PROPERTIES_SCREEN: 'Properties',
  LOGS_SCREEN: 'Logs',
  HEALTH_SCREEN: 'Health',
  FILE_UPLOAD_SCREEN: 'Image Upload',
} as const;

export const Pages = {
  ROOT: 'Root',
  REGISTRATION: 'Registration',
  INSIGHT: 'Insight',
  INTERVAL: 'Interval',
  THEME: 'Theme',
  SETTINGS: 'Settings',
} as const;

/**
 * NAVIGATION
 */

/**
 * Parameters available for all routes
 */
export type NavigationParams = {
  title?: string;
  backTitle?: string;
  titleColor?: string;
  headerLeft?: any;
  icon?: {
    name: string;
    type: string;
  };
  previousScreen?: string;
};


// Type for getting the values of an object (lookup)
export type valueof<T> = T[keyof T];

/**
 * Ref type
 */
export type Ref<T> = React.RefObject<T>;

export type ScreenNames = typeof Screens[keyof typeof Screens];
export type PagesNames = typeof Pages[keyof typeof Pages];
/**
 * Defines type of screens
 */
export type NavigationScreens = {
  [k in valueof<typeof Screens>]: NavigationParams | undefined;
};

export type NavigationProperty = StackNavigationProp<
  NavigationScreens,
  ScreenNames
>;

export type NavigationPages = {
  [k in valueof<typeof Pages>]: NavigationParams | undefined;
};

export type PagesNavigator = StackNavigationProp<NavigationPages, PagesNames>;


/**
 * ------- END NAVIGATION ----------
 */

/**
 *  Utils
 */
export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;

export type LogItem = { eventName: string; eventData: string };
export type TimedLog = { timestamp: number | string; logItem: LogItem }[];

export type StyleDefinition = { [x: string]: StyleProp<ViewStyle | TextStyle> };

/**
 * Chart typings
 */

export type CustomLineDatasetConfig = LineDatasetConfig & { rgbcolor: string };
export interface ExtendedLineData extends LineData {
  dataSets: {
    itemId: string;
    values?: LineValue[];
    label?: string;
    config?: CustomLineDatasetConfig;
  }[];
}

export type ItemProps = {
  id: string;
  name: string;
  value?: any;
  dataType?: DataType;
  icon?: IconProps;
  enabled: boolean;
  simulated: boolean;
  enable(value?: boolean): void;
  sendInterval(value: number): void;
  unit?: string;
};

export type DataType = 'string' | 'number' | 'bytes' | 'object';

export type ItemData = {
  id: string;
  value: any;
};

export type ChartUpdateCallback = (itemdata: ItemData) => void;

export type GeoCoordinates = {
  lon: number;
  lat: number;
  latD?: number;
  lonD?: number;
};

export type ChartSearchSpan = {
  from: string;
  to: string;
  bucketSize: string;
};

export type LineChartOptions = {
  brushContextMenuActions?: any[];
  grid?: boolean;
  includeDots?: boolean;
  includeEnvelope?: boolean;
  brushHandlesVisible?: boolean;
  hideChartControlPanel?: boolean;
  snapBrush?: boolean;
  interpolationFunction?: '' | 'curveLinear' | 'curveMonotoneX';
  legend?: 'shown' | 'compact' | 'hidden';
  noAnimate?: boolean;
  offset?: any;
  spMeasures?: string[];
  isTemporal?: boolean;
  spAxisLabels?: string[];
  stacked?: boolean;
  theme?: 'dark' | 'light';
  timestamp?: string;
  tooltip?: boolean;
  yAxisState?: 'stacked' | 'shared' | 'overlap';
  yExtent?: [number, number];
};

export type ChartDataOptions = {
  color: string;
  alias: string;
  searchSpan?: ChartSearchSpan;
  dataType?: 'numeric' | 'categorical' | 'events';
};
export enum ChartType {
  DEFAULT,
  MAP,
}

/**
 * Health typings
 */

export const HealthRealTimeData = {
  Walking: 'Walking',
  StairClimbing: 'StairClimbing',
  Running: 'Running',
  Cycling: 'Cycling',
  Workout: 'Workout',
} as const;

export type GoogleFitStepResult = {
  source: string;
  steps: {
    date: string;
    value: number;
  }[];
};

// Utils types
export type OnPressCallback = (e: GestureResponderEvent) => void;
export type CommonCallback = (...args: any) => void | Promise<void>;

/**
 * EVENTS
 */

export const DATA_AVAILABLE_EVENT = 'DATA_AVAILABLE_EVENT';
export const SENSOR_UNAVAILABLE_EVENT = 'SENSOR_UNAVAILABLE_EVENT';
export const LOG_DATA = 'LOG_DATA';

/**
 * COMMANDS
 */
export const ENABLE_DISABLE_COMMAND = 'enableSensors';
export const SET_FREQUENCY_COMMAND = 'changeInterval';
export const LIGHT_TOGGLE_COMMAND = 'lightOn';

/**
 * IOTC COMPONENT NAME
 */
export const TELEMETRY = 'sensors';
export const HEALTH = 'health';
export const PROPERTY = 'device_info';

/**
 * THEME
 */
export enum ThemeMode {
  LIGHT,
  DARK,
  DEVICE,
}
