import React from 'react';
import {
  accelerometer,
  gyroscope,
  setUpdateIntervalForType,
  SensorTypes
} from "react-native-sensors";
import { map, filter } from "rxjs/operators";
import { useState, useEffect } from "react";
import { View, Text, FlatList } from "react-native";
import { useScreenIcon } from './hooks/navigation';
import { Card } from './components/card';
import { useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const sensors = ['Accelerometer', 'Gyroscope', 'GeoLocation', 'Battery Level'];

export default function Sensors() {
  const [body, setBody] = useState('Hello');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  useScreenIcon('list-outline');

  // useEffect(() => {
  //   setUpdateIntervalForType(SensorTypes.accelerometer, 400); // defaults to 100ms
  //   const subscription = accelerometer
  //     .pipe(map(({ x, y, z }) => (
  //       x + y + z)), filter(speed => {
  //         console.log(speed);
  //         return speed > 2
  //       }))
  //     .subscribe(
  //       speed => setBody(`You moved your phone with ${speed}`),
  //       error => {
  //         setBody("The sensor is not available");
  //       }
  //     );
  //   setTimeout(() => {
  //     // If it's the last subscription to accelerometer it will stop polling in the native API
  //     subscription.unsubscribe();
  //   }, 1000);
  // }, []);



  return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
    {/* <FlatList numColumns={2} data={sensors} renderItem={(item) => {
      return <Card key={item.index} title={item.item} />
    }} contentContainerStyle={{ flex: 1, alignItems: 'center' }} /> */}

  </View>)
}


