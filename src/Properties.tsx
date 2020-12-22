import React, {useState, useEffect} from 'react';
import {View, FlatList, Alert} from 'react-native';
import {CentralClient} from './contexts/iotc';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card} from './components/card';
import {useSimulation, useIoTCentralClient} from './hooks/iotc';
import {Loader} from './components/loader';
import Registration from './Registration';
import {IOTC_EVENTS, IIoTCProperty} from 'react-native-azure-iotcentral-client';
import {StateUpdater, valueof} from './types';
import {getDeviceInfo, DeviceInfo} from './properties/deviceInfo';
import {Headline, Text} from './components/typography';
import {Overlay} from 'react-native-elements';

const PROPERTY_COMPONENT = 'device_info';
export const PROPERTY_CHANGED = 'PROPERTY_CHANGED';

type PropertiesProps = {
  id: string;
  name: string;
  editable: boolean;
  value?: any;
};

const AVAILABLE_PROPERTIES = {
  WRITEABLE_PROP: 'writeableProp',
  READONLY_PROP: 'readOnlyProp',
  MANUFACTURER: 'manufacturer',
  MODEL: 'model',
  SW_VERSION: 'swVersion',
  OS_NAME: 'osName',
  PROCESSOR_ARCHITECTURE: 'processorArchitecture',
  PROCESSOR_MANUFACTURER: 'processorManufacturer',
  TOTAL_STORAGE: 'totalStorage',
  TOTAL_MEMORY: 'totalMemory',
};

const propsMap: {
  [id in valueof<typeof AVAILABLE_PROPERTIES>]: PropertiesProps;
} = {
  [AVAILABLE_PROPERTIES.WRITEABLE_PROP]: {
    id: AVAILABLE_PROPERTIES.WRITEABLE_PROP,
    name: 'WriteableProp',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.READONLY_PROP]: {
    id: AVAILABLE_PROPERTIES.READONLY_PROP,
    name: 'ReadOnlyProp',
    value: 'readonly',
    editable: true,
  },
  [AVAILABLE_PROPERTIES.MANUFACTURER]: {
    id: AVAILABLE_PROPERTIES.MANUFACTURER,
    name: 'Manufacturer',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.MODEL]: {
    id: AVAILABLE_PROPERTIES.MODEL,
    name: 'Device Model',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.SW_VERSION]: {
    id: AVAILABLE_PROPERTIES.SW_VERSION,
    name: 'Software Version',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.OS_NAME]: {
    id: AVAILABLE_PROPERTIES.OS_NAME,
    name: 'OS Name',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.PROCESSOR_ARCHITECTURE]: {
    id: AVAILABLE_PROPERTIES.PROCESSOR_ARCHITECTURE,
    name: 'Processor Architecture',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.PROCESSOR_MANUFACTURER]: {
    id: AVAILABLE_PROPERTIES.PROCESSOR_MANUFACTURER,
    name: 'Processor Manufacturer',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.TOTAL_STORAGE]: {
    id: AVAILABLE_PROPERTIES.TOTAL_STORAGE,
    name: 'Total Storage',
    editable: false,
  },
  [AVAILABLE_PROPERTIES.TOTAL_MEMORY]: {
    id: AVAILABLE_PROPERTIES.TOTAL_MEMORY,
    name: 'Total Memory',
    editable: false,
  },
};

async function onPropUpdate(
  update: StateUpdater<PropertiesProps[]>,
  prop: IIoTCProperty,
) {
  let {name, value} = prop;
  if (value.__t === 'c') {
    // inside a component: TODO: change sdk
    name = Object.keys(value).filter((v) => v !== '__t')[0];
    value = value[name];
  }
  update((current) =>
    current.map(({...property}) => {
      if (property.id === name) {
        property.value = value;
      }
      return property;
    }),
  );
  await prop.ack();
}

async function initProps(
  client: CentralClient,
  properties: PropertiesProps[],
  setProperties: StateUpdater<PropertiesProps[]>,
) {
  if (client && client.isConnected()) {
    const devInfo = await getDeviceInfo();
    Object.keys(devInfo).forEach((dInfo) => {
      const prop = properties.find((p) => p.id === dInfo);
      if (prop) {
        prop.value = devInfo[dInfo as keyof DeviceInfo];
      }
    });
    await client.sendProperty({
      [PROPERTY_COMPONENT]: {__t: 'c', ...(await getDeviceInfo())},
    });
    properties.forEach(async (prop) => {
      if (prop.value) {
        await client.sendProperty({
          [PROPERTY_COMPONENT]: {__t: 'c', [prop.id]: prop.value},
        });
      }
    });
    setProperties(properties);
  }
}

export default function Properties() {
  const {client} = useIoTCentralClient();
  const insets = useSafeAreaInsets();
  const [simulated] = useSimulation();
  const [data, setData] = useState<PropertiesProps[]>(Object.values(propsMap));
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg] = useState('');

  useEffect(() => {
    if (client && client.isConnected()) {
      client.on(IOTC_EVENTS.Properties, onPropUpdate.bind(null, setData));
      initProps(client, data, setData);
      client.fetchTwin();
    }
  }, [client]);

  if (simulated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 30,
        }}>
        <Headline style={{textAlign: 'center'}}>
          Simulation mode is enabled
        </Headline>
        <Text style={{textAlign: 'center'}}>
          {' '}
          Properties are not available. Disable simulation mode and connect to
          IoT Central to work with properties.
        </Text>
      </View>
    );
  }
  if (client === null) {
    return <Registration />;
  }

  if (client === undefined) {
    return (
      <Loader
        message={'Connecting to IoT Central ...'}
        visible={true}
        style={{flex: 1, justifyContent: 'center'}}
      />
    );
  }

  return (
    <View
      style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom}}>
      <FlatList
        numColumns={2}
        data={data}
        renderItem={(item) => {
          return (
            <Card
              title={item.item.name}
              value={item.item.value}
              enabled
              editable={item.item.editable}
              onEdit={async (value) => {
                try {
                  await client.sendProperty({
                    [PROPERTY_COMPONENT]: {__t: 'c', [item.item.id]: value},
                  });
                  Alert.alert(
                    'Property',
                    `Property ${item.item.name} successfully sent to IoT Central`,
                    [{text: 'OK'}],
                  );
                } catch (e) {
                  Alert.alert(
                    'Property',
                    `Property ${item.item.name} not sent to IoT Central`,
                    [{text: 'OK'}],
                  );
                }
              }}
            />
          );
        }}
        keyExtractor={(item, index) => `prop-${index}`}
      />
      <Overlay
        isVisible={showAlert}
        onBackdropPress={() => setShowAlert(false)}>
        <Text>{alertMsg}</Text>
      </Overlay>
    </View>
  );
  // return (<View></View>)
}
