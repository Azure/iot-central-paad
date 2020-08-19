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