import { useNavigation } from '@react-navigation/native';
import { defaults } from 'contexts/defaults';
import {
  Properties as PropertiesData,
  getDeviceInfo,
  DeviceInfoName,
} from 'properties';
import {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Platform } from 'react-native';
import {
  AVAILABLE_SENSORS,
  AVAILABLE_HEALTH,
  HealthMap,
  SensorMap,
} from 'sensors';
import {
  DATA_AVAILABLE_EVENT,
  ItemProps,
  LogItem,
  SENSOR_UNAVAILABLE_EVENT,
  TimedLog,
} from '../types';
import { LogsContext } from '../contexts/logs';

export type IIcon = {
  name: string;
  type: string;
};

export function useScreenIcon(icon: IIcon): void {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setParams({ icon });
  }, [navigation, icon]);
}

export function useLogger(): [TimedLog, (logItem: LogItem) => void] {
  const { logs, append } = useContext(LogsContext);
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

  const setBoolFns = useMemo(
    () => ({
      True: setTrue.current,
      False: setFalse.current,
      Toggle: setToggle.current,
    }),
    [],
  );

  return [value, setBoolFns];
}

type EventManagementFN = (
  id: string,
  eventName: string,
  handler: (...args: any) => void,
) => void;

export function useSensors(): [
  ItemProps[],
  EventManagementFN,
  EventManagementFN,
] {
  const [sensors, setSensors] = useState<ItemProps[]>(
    [
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
    ].map((s) => ({
      ...s,
      enable: (val?: boolean) => {
        const enabled = val !== undefined ? val : true;
        SensorMap[s.id].enable(enabled);
        setSensors((currentSensors) => {
          return currentSensors.map((sensor) => {
            if (sensor.id === s.id) {
              return {
                ...sensor,
                enabled,
              };
            }
            return sensor;
          });
        });
      },
      sendInterval: (value: number) => {
        SensorMap[s.id].sendInterval(value);
      },
    })),
  );

  const dataHandler = (id: string, value: any) => {
    setSensors((currentSensors) => {
      return currentSensors.map((sensor) => {
        if (sensor.id === id) {
          return {
            ...sensor,
            value,
          };
        }
        return sensor;
      });
    });
  };
  const availableHandler = (id: string) => {
    setSensors((currentSensors) => {
      const currentIndex = currentSensors.findIndex((s) => s.id === id);
      if (currentIndex > -1) {
        currentSensors.splice(currentIndex, 1);
      }
      return currentSensors;
    });
  };

  const addListener = useCallback(
    (id: string, event: string, handler: (...args: any) => void) => {
      SensorMap[id].addListener.bind(SensorMap[id])(event, handler);
    },
    [],
  );

  const removeListener = useCallback(
    (id: string, event: string, handler: (...args: any) => void) => {
      SensorMap[id].removeListener.bind(SensorMap[id])(event, handler);
    },
    [],
  );

  useEffect(() => {
    sensors.forEach((s) => {
      addListener(s.id, DATA_AVAILABLE_EVENT, dataHandler);
      addListener(s.id, SENSOR_UNAVAILABLE_EVENT, availableHandler);
      SensorMap[s.id].simulate(defaults.emulator);
      SensorMap[s.id].enable(true);
    });
    return () => {
      sensors.forEach((s) => {
        removeListener(s.id, DATA_AVAILABLE_EVENT, dataHandler);
        removeListener(s.id, SENSOR_UNAVAILABLE_EVENT, availableHandler);
        SensorMap[s.id].simulate(!defaults.emulator);
        SensorMap[s.id].enable(false);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [sensors, addListener, removeListener];
}

export function useHealth(): [
  ItemProps[],
  EventManagementFN,
  EventManagementFN,
] {
  const [health, setHealth] = useState<ItemProps[]>(
    [
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
    ].map((h) => ({
      ...h,
      enable: (val?: boolean) => {
        const enabled = val !== undefined ? val : true;
        HealthMap[h.id].enable(enabled);
        h.enabled = enabled;
      },
      sendInterval: (value: number) => {
        HealthMap[h.id].sendInterval(value);
      },
    })),
  );

  const dataHandler = (id: string, value: any) => {
    setHealth((currentHealth) => {
      return currentHealth.map((healthItem) => {
        if (healthItem.id === id) {
          return {
            ...healthItem,
            value,
          };
        }
        return healthItem;
      });
    });
  };
  const availableHandler = (id: string) => {
    setHealth((currentHealth) => {
      const currentIndex = currentHealth.findIndex(
        (healthItem) => healthItem.id === id,
      );
      if (currentIndex > -1) {
        currentHealth.splice(currentIndex, 1);
      }
      return currentHealth;
    });
  };

  const addListener = useCallback(
    (id: string, event: string, handler: (...args: any) => void) => {
      HealthMap[id].addListener.bind(HealthMap[id])(event, handler);
    },
    [],
  );

  const removeListener = useCallback(
    (id: string, event: string, handler: (...args: any) => void) => {
      HealthMap[id].removeListener.bind(HealthMap[id])(event, handler);
    },
    [],
  );

  useEffect(() => {
    health.forEach((h) => {
      addListener(h.id, DATA_AVAILABLE_EVENT, dataHandler);
      addListener(h.id, SENSOR_UNAVAILABLE_EVENT, availableHandler);
      HealthMap[h.id].simulate(defaults.emulator);
      HealthMap[h.id].enable(true);
    });
    return () => {
      health.forEach((h) => {
        removeListener(h.id, DATA_AVAILABLE_EVENT, dataHandler);
        removeListener(h.id, SENSOR_UNAVAILABLE_EVENT, availableHandler);
        HealthMap[h.id].simulate(!defaults.emulator);
        HealthMap[h.id].enable(false);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [health, addListener, removeListener];
}

export function useProperties() {
  const [properties, setProperties] = useState(PropertiesData);
  const [loading, setLoading] = useBoolean(false);
  const [, append] = useLogger();

  const loadDeviceInfo = useCallback(async () => {
    setLoading.True();
    const devInfo = await getDeviceInfo();
    setProperties((currentProps) => {
      return currentProps.map((prop) => {
        if (prop.id in devInfo) {
          return {
            ...prop,
            value: devInfo[prop.id as DeviceInfoName],
          };
        }
        return prop;
      });
    });
    append({
      eventName: 'INFO',
      eventData: 'Properties initialized.',
    });
    setLoading.False();
  }, [setLoading, append]);

  const updateProperty = useCallback(
    (id: string, value: any) => {
      setProperties((currentProps) => {
        return currentProps.map((prop) => {
          if (prop.id === id) {
            return {
              ...prop,
              value,
            };
          }
          return prop;
        });
      });
    },
    [setProperties],
  );

  useEffect(() => {
    loadDeviceInfo();
  }, [loadDeviceInfo]);

  return { loading, properties, updateProperty };
}
