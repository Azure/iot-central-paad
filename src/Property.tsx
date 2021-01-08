import React, {useState, useEffect, useCallback} from 'react';
import {View, FlatList, Alert} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card} from './components/card';
import {useSimulation, useIoTCentralClient} from 'hooks';
import {Loader} from './components/loader';
import Registration from './Registration';
import {IOTC_EVENTS, IIoTCProperty} from 'react-native-azure-iotcentral-client';
import {
  getDeviceInfo,
  DeviceInfo,
  Properties as PropertiesData,
} from 'properties';
import {Overlay} from 'react-native-elements';
import {Text} from 'components/typography';

const PROPERTY_COMPONENT = 'device_info';

export default function Property() {
  const [simulated] = useSimulation();
  const iotcentralClient = useIoTCentralClient();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState(PropertiesData);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg] = useState('');

  const onPropUpdate = async (prop: IIoTCProperty) => {
    let {name, value} = prop;
    if (value.__t === 'c') {
      // inside a component: TODO: change sdk
      name = Object.keys(value).filter((v) => v !== '__t')[0];
      value = value[name];
    }
    setProperties((currentProps) =>
      currentProps.map(({...property}) => {
        if (property.id === name) {
          property.value = value;
        }
        return property;
      }),
    );
    await prop.ack();
  };

  const initProps = useCallback(async () => {
    if (iotcentralClient && iotcentralClient.isConnected()) {
      const devInfo = await getDeviceInfo();
      setProperties((currentProps) => {
        Object.keys(devInfo).forEach((dInfo) => {
          const prop = currentProps.find((p) => p.id === dInfo);
          if (prop) {
            prop.value = devInfo[dInfo as keyof DeviceInfo];
          }
        });
        iotcentralClient.sendProperty({
          [PROPERTY_COMPONENT]: {__t: 'c', ...devInfo},
        });
        currentProps.forEach(async (prop) => {
          if (prop.value) {
            iotcentralClient.sendProperty({
              [PROPERTY_COMPONENT]: {__t: 'c', [prop.id]: prop.value},
            });
          }
        });
        return currentProps;
      });
    }
  }, [iotcentralClient]);

  useEffect(() => {
    if (iotcentralClient) {
      iotcentralClient.on(IOTC_EVENTS.Properties, onPropUpdate);
      initProps();
      iotcentralClient.fetchTwin();
    }
  }, [iotcentralClient, initProps]);

  if (!simulated) {
    if (iotcentralClient === null) {
      return <Registration />;
    }

    if (iotcentralClient === undefined) {
      return (
        <Loader
          message={'Connecting to IoT Central ...'}
          visible={true}
          style={{flex: 1, justifyContent: 'center'}}
        />
      );
    }
  }

  return (
    <View
      style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom}}>
      <FlatList
        numColumns={2}
        data={properties}
        renderItem={({item: property, index}) => {
          return (
            <Card
              key={`property-${index}`}
              title={property.name}
              value={property.value}
              enabled
              editable={property.editable}
              onEdit={async (value) => {
                try {
                  await iotcentralClient?.sendProperty({
                    [PROPERTY_COMPONENT]: {__t: 'c', [property.id]: value},
                  });
                  Alert.alert(
                    'Property',
                    `Property ${property.name} successfully sent to IoT Central`,
                    [{text: 'OK'}],
                  );
                } catch (e) {
                  Alert.alert(
                    'Property',
                    `Property ${property.name} not sent to IoT Central`,
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
}
