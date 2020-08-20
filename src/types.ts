import { LineData, LineValue, LineDatasetConfig } from "react-native-charts-wrapper";

export const Screens = {
    'HOME_SCREEN': 'Home',
    'TELEMETRY_SCREEN': 'Telemetry',
    'PROPERTIES_SCREEN': 'Properties',
    'COMMANDS_SCREEN': 'Commands'
}

/**
 * Parameters available for all routes
 */
export type NavigationParams = {
    title?: string,
    titleColor?: string,
    headerLeft?: any,
    icon?: {
        name: string,
        type: string
    }
}

// Type for getting the values of an object (lookup)
type valueof<T> = T[keyof T];
/**
 * Defines type of screens
 */
export type NavigationScreens = {
    [k in valueof<typeof Screens>]: NavigationParams | undefined
}

export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;


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