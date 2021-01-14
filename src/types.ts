import {StackNavigationProp} from '@react-navigation/stack';
import {GestureResponderEvent} from 'react-native';
import {
  LineData,
  LineValue,
  LineDatasetConfig,
} from 'react-native-charts-wrapper';
import {IconProps} from 'react-native-elements';

export const Screens = {
  TELEMETRY_SCREEN: 'Telemetry',
  PROPERTIES_SCREEN: 'Properties',
  LOGS_SCREEN: 'Logs',
  HEALTH_SCREEN: 'Health',
  FILE_UPLOAD_SCREEN: 'Image Upload',
} as const;

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
};

// Type for getting the values of an object (lookup)
export type valueof<T> = T[keyof T];

/**
 * Ref type
 */
export type Ref<T> = React.RefObject<T>;

export type ScreenNames = typeof Screens[keyof typeof Screens];
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

/**
 *  Utils
 */
export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;

export type LogItem = {eventName: string; eventData: string};
export type TimedLog = {timestamp: number | string; logItem: LogItem}[];

/**
 * Chart typings
 */

export type CustomLineDatasetConfig = LineDatasetConfig & {rgbcolor: string};
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
  icon?: IconProps;
  enabled: boolean;
  simulated: boolean;
  enable(value?: boolean): void;
  sendInterval(value: number): void;
  unit?: string;
};

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

/**
 * IOTC COMPONENT NAME
 */
export const TELEMETRY = 'sensors';
export const HEALTH = 'health';
export const PROPERTY = 'device_info';
