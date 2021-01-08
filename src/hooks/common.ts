import {useNavigation} from '@react-navigation/native';
import {defaults} from 'contexts/defaults';
import {useContext, useState, useEffect, useRef} from 'react';
import {Platform} from 'react-native';
import {IconProps} from 'react-native-elements';
import {
  AVAILABLE_SENSORS,
  AVAILABLE_HEALTH,
  HealthMap,
  ISensor,
  SensorMap,
} from 'sensors';
import {DATA_AVAILABLE_EVENT, SENSOR_UNAVAILABLE_EVENT} from 'types';
import {LogsContext} from '../contexts/logs';

export type IIcon = {
  name: string;
  type: string;
};

export function useScreenIcon(icon: IIcon): void {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setParams({icon});
  }, [navigation, icon]);
}

export function useLogger() {
  const {logs, append} = useContext(LogsContext);
  return [logs, append];
}

export function usePrevious<T>(value: T) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef<T>();

  // Store current value in ref
  useEffect(() => {
    ref.current = value;
  }, [value]); // Only re-run if value changes

  // Return previous value (happens before update in useEffect above)
  return ref.current;
}

export interface IUseBooleanCallbacks {
  /** Set the value to true. Always has the same identity. */
  setTrue: () => void;
  /** Set the value to false. Always has the same identity. */
  setFalse: () => void;
  /** Toggle the value. Always has the same identity. */
  toggle: () => void;
}

type ISetBooleanFunctions = {
  True: () => void;
  False: () => void;
  Toggle: () => void;
};
export function useBoolean(
  initialState: boolean,
): [boolean, ISetBooleanFunctions] {
  const [value, setValue] = useState(initialState);

  const setTrue = useRef(() => {
    setValue(true);
  });
  const setFalse = useRef(() => {
    setValue(false);
  });
  const setToggle = useRef(() => {
    setValue((cur) => !cur);
  });

  return [
    value,
    {True: setTrue.current, False: setFalse.current, Toggle: setToggle.current},
  ];
}

export function useSensorEvent(
  eventName: string,
  handler: (...args: any[]) => void,
  sensor: ISensor,
) {
  const handlerRef = useRef<(...args: any[]) => void>(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(
    () => {
      // Make sure sensor supports addEventListener
      // On
      const isSupported = sensor && sensor.addListener;
      if (!isSupported) return;

      // Add event listener
      sensor.addListener(eventName, handlerRef.current);

      // Remove event listener on cleanup
      return () => {
        sensor.removeListener(eventName, handlerRef.current);
      };
    },
    [eventName, sensor], // Re-run if eventName or sensor changes
  );
}

type ItemProps = {
  id: string;
  name: string;
  value?: any;
  icon?: IconProps;
  enabled: boolean;
  simulated: boolean;
  enable(value?: boolean): void;
  unit?: string;
};

export function useSensors() {
  const [sensors, setSensors] = useState<ItemProps[] | undefined>(undefined);
  const dataHandlerRef = useRef<(...args: any[]) => void>(
    (id: string, value: any) => {
      if (sensors) {
        const current = sensors.find((s) => s.id === id);
        if (current) {
          current.value = value;
        }
      }
    },
  );
  const availableHandlerRef = useRef<(...args: any[]) => void>((id: string) => {
    if (sensors) {
      const currentIndex = sensors.findIndex((s) => s.id === id);
      if (currentIndex > -1) {
        setSensors((currentSensors) => {
          currentSensors?.splice(currentIndex, 1);
          return currentSensors;
        });
      }
    }
  });

  useEffect(() => {
    const dataHandler = dataHandlerRef.current;
    const availHandler = availableHandlerRef.current;
    if (!sensors) {
      let ss = [
        {
          id: AVAILABLE_SENSORS.ACCELEROMETER,
          name: 'Accelerometer',
          icon: {
            name: 'rocket-outline',
            type: Platform.select({
              android: 'material-community',
              default: 'ionicon',
            }),
          },
          enabled: true, // TODO: auto-enable based on settings,
          simulated: defaults.emulator,
        },
        {
          id: AVAILABLE_SENSORS.GYROSCOPE,
          name: 'Gyroscope',
          enabled: true, // TODO: auto-enable based on settings
          icon: {
            name: 'compass-outline',
            type: Platform.select({
              android: 'material-community',
              default: 'ionicon',
            }),
          },
          simulated: defaults.emulator,
        },
        {
          id: AVAILABLE_SENSORS.MAGNETOMETER,
          name: 'Magnetometer',
          enabled: true, // TODO: auto-enable based on settings
          icon: {
            name: 'magnet-outline',
            type: 'ionicon',
          },
          simulated: defaults.emulator,
        },
        {
          id: AVAILABLE_SENSORS.BAROMETER,
          name: 'Barometer',
          enabled: true, // TODO: auto-enable based on settings
          icon: {
            name: 'weather-partly-cloudy',
            type: 'material-community',
          },
          simulated: defaults.emulator,
        },
        {
          id: AVAILABLE_SENSORS.GEOLOCATION,
          name: 'Geolocation',
          enabled: true, // TODO: auto-enable based on settings
          icon: {
            name: 'location-outline',
            type: 'ionicon',
          },
          simulated: defaults.emulator,
          unit: '°',
        },
        {
          id: AVAILABLE_SENSORS.BATTERY,
          name: 'Battery Level',
          enabled: true, // TODO: auto-enable based on settings,
          simulated: defaults.emulator,
          icon: {
            name: Platform.select({
              android: 'battery-medium',
              default: 'battery-half-sharp',
            }) as string,
            type: Platform.select({
              android: 'material-community',
              default: 'ionicon',
            }),
          },
        },
      ];
      setSensors(
        ss.map((s) => {
          SensorMap[s.id].addListener(DATA_AVAILABLE_EVENT, dataHandler);
          SensorMap[s.id].addListener(SENSOR_UNAVAILABLE_EVENT, availHandler);
          return {
            ...s,
            enable: (val) => {
              const enabled = val !== undefined ? val : true;
              SensorMap[s.id].enable(enabled);
              s.enabled = enabled;
            },
          };
        }),
      );
    } else {
    }
    return () => {
      if (sensors) {
        sensors.forEach((s) =>
          SensorMap[s.id].removeListener(DATA_AVAILABLE_EVENT, dataHandler),
        );
        sensors.forEach((s) =>
          SensorMap[s.id].removeListener(
            SENSOR_UNAVAILABLE_EVENT,
            availHandler,
          ),
        );
      }
    };
  }, [sensors]);

  return sensors;
}

export function useHealth() {
  const [healthSensors, setHealthSensors] = useState<ItemProps[] | undefined>(
    undefined,
  );
  const dataHandlerRef = useRef<(...args: any[]) => void>(
    (id: string, value: any) => {
      if (healthSensors) {
        const current = healthSensors.find((s) => s.id === id);
        if (current) {
          current.value = value;
        }
      }
    },
  );
  const availableHandlerRef = useRef<(...args: any[]) => void>((id: string) => {
    if (healthSensors) {
      const currentIndex = healthSensors.findIndex((s) => s.id === id);
      if (currentIndex > -1) {
        setHealthSensors((healthSensors) => {
          healthSensors?.splice(currentIndex, 1);
          return healthSensors;
        });
      }
    }
  });

  useEffect(() => {
    const dataHandler = dataHandlerRef.current;
    const availHandler = availableHandlerRef.current;
    if (!healthSensors) {
      let hs = [
        {
          id: AVAILABLE_HEALTH.STEPS,
          name: 'Steps',
          icon: {
            name: 'foot-print',
            type: 'material-community',
          },
          enabled: true, // TODO: auto-enable based on settings
          simulated: defaults.emulator,
        },
        ...Platform.select({
          ios: [
            {
              id: AVAILABLE_HEALTH.FLOORS,
              icon: {
                name: 'stairs',
                type: 'material-community',
              },
              name: 'Floors climbed',
              enabled: true, // TODO: auto-enable based on settings
              simulated: defaults.emulator,
            },
          ],
          default: [],
        }),
      ];
      setHealthSensors(
        hs.map((s) => {
          HealthMap[s.id].addListener(DATA_AVAILABLE_EVENT, dataHandler);
          HealthMap[s.id].addListener(SENSOR_UNAVAILABLE_EVENT, availHandler);
          return {
            ...s,
            enable: (val) => {
              HealthMap[s.id].enable(val !== undefined ? val : true);
            },
          };
        }),
      );
    } else {
    }
    return () => {
      if (healthSensors) {
        healthSensors.forEach((s) =>
          HealthMap[s.id].removeListener(DATA_AVAILABLE_EVENT, dataHandler),
        );
        healthSensors.forEach((s) =>
          HealthMap[s.id].removeListener(
            SENSOR_UNAVAILABLE_EVENT,
            availHandler,
          ),
        );
      }
    };
  }, [healthSensors]);

  return healthSensors;
}

export function useProperties() {}
