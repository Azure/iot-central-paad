// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {StackNavigationProp} from '@react-navigation/stack';
import {GestureResponderEvent, TextStyle, ViewStyle} from 'react-native';
import {IconProps} from '@rneui/themed';

export const Screens = {
  TELEMETRY_SCREEN: 'Telemetry',
  PROPERTIES_SCREEN: 'Properties',
  LOGS_SCREEN: 'Logs',
  HEALTH_SCREEN: 'Health',
  FILE_UPLOAD_SCREEN: 'Image Upload',
  BLUETOOTH_STACK: 'Bluetooth',
} as const;

export const Pages = {
  ROOT: 'Root',
  REGISTRATION: 'Registration',
  INSIGHT: 'Insight',
  INTERVAL: 'Interval',
  THEME: 'Theme',
  SETTINGS: 'Settings',
  BLUETOOTH_LIST: 'Bluetooth List',
  BLUETOOTH_DETAIL: 'Bluetooth Detail',
} as const;

export const RegistrationScreens = {
  EMPTY: 'EMPTY',
  QR: 'QR',
  MANUAL: 'MANUAL',
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
  screen?: string;
  telemetryId?: string;
  currentValue?: any;
  chartType?: ChartType;
  unit?: string;
  simulated?: boolean;
};

// Type for getting the values of an object (lookup)
export type valueof<T> = T[keyof T];

/**
 * Ref type
 */
export type Ref<T> = React.RefObject<T>;

export type ScreenNames = (typeof Screens)[keyof typeof Screens];
export type PagesNames = (typeof Pages)[keyof typeof Pages];
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

export type LogItem = {eventName: string; eventData: string};
export type TimedLog = {
  id: number;
  timestamp: number | string;
  logItem: LogItem;
}[];

export type StyleDefinition = Literal<ViewStyle | TextStyle>;

/**
 * Chart typings
 */

export type ItemProps = {
  id: string;
  name: string;
  value?: any;
  dataType?: DataType;
  icon?: IconProps;
  enabled: boolean;
  simulated: boolean;
  availability?: 'checking' | 'available' | 'unavailable';
  editable?: boolean;
  presentation?: {
    description?: string;
    emptyLabel?: string;
    placeholder?: string;
    actionLabel?: string;
  };
  retry?(): void;
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
export type Literal<T> = {[x: string]: T};

/**
 * EVENTS
 */

export const DATA_AVAILABLE_EVENT = 'DATA_AVAILABLE_EVENT';
export const SENSOR_UNAVAILABLE_EVENT = 'SENSOR_UNAVAILABLE_EVENT';
export const LOG_DATA = 'LOG_DATA';

/**
 * COMMANDS
 */
export const ENABLE_DISABLE_COMMAND = 'sensors*enableSensors';
export const SET_FREQUENCY_COMMAND = 'sensors*changeInterval';
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
