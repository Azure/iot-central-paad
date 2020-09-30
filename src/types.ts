import { StackNavigationProp } from "@react-navigation/stack";
import { LineData, LineValue, LineDatasetConfig } from "react-native-charts-wrapper";

export const Screens = {
    'HOME_SCREEN': 'Home',
    'TELEMETRY_SCREEN': 'Telemetry',
    'PROPERTIES_SCREEN': 'Properties',
    'LOGS_SCREEN': 'Logs',
    'HEALTH_SCREEN': 'Health',
    'FILE_UPLOAD_SCREEN': 'Image Upload'
}

/**
 * Parameters available for all routes
 */
export type NavigationParams = {
    title?: string,
    backTitle?: string,
    titleColor?: string,
    headerLeft?: any,
    icon?: {
        name: string,
        type: string
    }
}

// Type for getting the values of an object (lookup)
export type valueof<T> = T[keyof T];


/**
 * Ref type
 */
export type Ref<T> = React.RefObject<T>;

/**
 * Defines type of screens
 */
export type NavigationScreens = {
    [k in valueof<typeof Screens>]: NavigationParams | undefined
}

export type NavigationProperty = StackNavigationProp<NavigationScreens, string>;


/**
 *  Utils
 */
export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;

export type LogItem = { eventName: string, eventData: string };
export type TimedLog = { timestamp: number | string, logItem: LogItem }[];

export const LOG_DATA = 'LOG_DATA';

/**
 * Chart typings
 */

export type CustomLineDatasetConfig = LineDatasetConfig & { rgbcolor: string };
export interface ExtendedLineData extends LineData {
    dataSets: {
        itemId: string,
        values?: Array<number | LineValue>,
        label?: string,
        config?: CustomLineDatasetConfig
    }[]
}

export type ItemData = {
    id: string,
    value: any
}

export type ChartUpdateCallback = (itemdata: ItemData) => void;

export type GeoCoordinates = {
    lon: number,
    lat: number,
    latD?: number,
    lonD?: number
}

/**
 * Health typings
 */

export const HealthRealTimeData = {
    Walking: 'Walking',
    StairClimbing: 'StairClimbing',
    Running: 'Running',
    Cycling: 'Cycling',
    Workout: 'Workout'
} as const;

export type GoogleFitStepResult = {
    source: string,
    steps: {
        date: string,
        value: number
    }[]
}