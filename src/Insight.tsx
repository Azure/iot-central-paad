import React, {useEffect, useState} from 'react';
import {View, StyleSheet, processColor} from 'react-native';
import {LineChart} from 'react-native-charts-wrapper';
import {
  getRandomColor,
  Text,
  LightenDarkenColor,
  Name,
} from './components/typography';
import {
  ExtendedLineData,
  ItemData,
  CustomLineDatasetConfig,
  NavigationParams,
} from './types';
import {useTelemetry} from './hooks/iotc';
import {DATA_AVAILABLE_EVENT} from './sensors';
import {useTheme, RouteProp} from '@react-navigation/native';
import {AnimatedCircularProgress} from 'react-native-circular-progress';
import {useScreenDimensions} from './hooks/layout';
import {Loader} from './components/loader';
import Map from './components/map';

export default function Insight({
  route,
}: {
  route: RouteProp<
    Record<string, NavigationParams & {telemetryId: string; currentValue: any}>,
    'Insight'
  >;
}) {
  const {telemetryData, addListener, removeListener} = useTelemetry();
  const {screen} = useScreenDimensions();
  const {colors, dark} = useTheme();
  const [start, setStart] = useState<number>(Date.now());
  const [data, setData] = useState<ExtendedLineData>({
    dataSets: [],
  });
  const timestamp = Date.now() - start;
  const {telemetryId, currentValue} = route.params;
  /**
   *
   * @param itemdata Current sample for the item
   * @param startTime Start time of the sampling. Must be the same value used as "since" param in the chart
   * @param setData Dispatch to update dataset with current sample
   */
  function updateData(id: string, value: any) {
    const item = {id, value};
    if (id !== telemetryId) {
      return;
    }
    let itemToProcess: ItemData[] = [item];
    if (typeof item.value !== 'string' && typeof item.value !== 'number') {
      // data is composite
      itemToProcess = Object.keys(item.value).map((i) => ({
        id: `${item.id}.${i}`,
        value: item.value[i],
      }));
    }
    itemToProcess.forEach((itemdata) => {
      setData((currentDataSet) => {
        const currentItemData = currentDataSet.dataSets.find(
          (d) => d.itemId === itemdata.id,
        );

        // Current sample time (x-axis) is the difference between current timestamp e the start time of sampling
        const newSample = {x: Date.now() - start, y: itemdata.value};

        if (!currentItemData) {
          // current item is not in the dataset yet
          const rgbcolor = getRandomColor();
          return {
            ...currentDataSet,
            dataSets: [
              ...currentDataSet.dataSets,
              ...[
                {
                  itemId: itemdata.id,
                  values: [newSample],
                  label: itemdata.id,
                  config: {
                    color: processColor(rgbcolor),
                    rgbcolor,
                  } as CustomLineDatasetConfig,
                },
              ],
            ],
          };
        }
        return {
          ...currentDataSet,
          dataSets: currentDataSet.dataSets.map(({...currentItem}) => {
            if (currentItem.itemId === itemdata.id && currentItem.values) {
              currentItem.values = [...currentItem.values, ...[newSample]];
            }
            return currentItem;
          }),
        };
      });
    });
  }

  useEffect(() => {
    setStart(Date.now());
    addListener(DATA_AVAILABLE_EVENT, updateData);
    // init chart with current value
    if (currentValue !== undefined) {
      updateData(telemetryId, currentValue);
    }
    return () => removeListener(DATA_AVAILABLE_EVENT, updateData);
  }, [telemetryId, currentValue]);

  const geolocation = telemetryData.find(
    (t) => t.id === telemetryId && t.unit && t.unit === '°',
  );
  if (geolocation) {
    return (
      <View style={style.container}>
        <Map
          style={{
            flex: 3,
            margin: 20,
            borderRadius: 20,
            ...(!dark
              ? {
                  shadowColor: "'rgba(0, 0, 0, 0.14)'",
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                  shadowOpacity: 0.8,
                  shadowRadius: 3.84,
                  elevation: 5,
                }
              : {}),
          }}
          location={geolocation.value}
        />
        <View style={style.summary}>
          <Text>
            <Name>Latitude:</Name> {geolocation.value.lat}
          </Text>
          <Text>
            <Name>Longitude:</Name> {geolocation.value.lon}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      {data.dataSets.length === 0 ? (
        <Loader message="" visible={true} />
      ) : (
        <View style={style.container}>
          <View style={style.chart}>
            <LineChart
              style={style.chartBox}
              chartDescription={{text: ''}}
              touchEnabled={true}
              dragEnabled={true}
              scaleEnabled={true}
              pinchZoom={true}
              extraOffsets={{bottom: 20}}
              legend={{
                wordWrapEnabled: true,
                textColor: processColor(colors.text),
                textSize: 16,
              }}
              xAxis={{
                position: 'BOTTOM',
                axisMaximum: timestamp + 500,
                axisMinimum: timestamp - 10000,
                valueFormatter: 'date',
                since: start,
                valueFormatterPattern: 'HH:mm:ss',
                timeUnit: 'MILLISECONDS',
                drawAxisLines: false,
                drawGridLines: false,
                textColor: processColor(colors.text),
              }}
              yAxis={{
                right: {
                  drawAxisLines: false,
                  textColor: processColor(colors.text),
                },
                left: {
                  drawAxisLines: false,
                  textColor: processColor(colors.text),
                },
              }}
              data={data}
            />
            <View style={style.summary}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  marginTop: 40,
                }}>
                {data.dataSets.map((d, i) => {
                  if (!d.values) {
                    return null;
                  }
                  const val = (d.values[d.values.length - 1] as {
                    x: any;
                    y: any;
                  }).y;
                  const fill = val > 1 || val < -1 ? val : Math.abs(val * 1000);
                  return (
                    <AnimatedCircularProgress
                      key={`circle-${i}`}
                      size={screen.width / 5}
                      width={5}
                      fill={fill}
                      tintColor={
                        d.config ? d.config.rgbcolor : getRandomColor()
                      }
                      backgroundColor={
                        d.config
                          ? LightenDarkenColor(d.config.rgbcolor, 90, true)
                          : getRandomColor()
                      }
                      rotation={360}>
                      {() => {
                        const strVal = `${val}`;
                        return (
                          <Text>
                            {strVal.length > 6
                              ? `${strVal.substring(0, 6)}...`
                              : strVal}
                          </Text>
                        );
                      }}
                    </AnimatedCircularProgress>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
  },
  chart: {
    flex: 1,
    marginTop: 30,
    marginHorizontal: 10,
  },
  chartBox: {
    flex: 2,
  },
  summary: {
    flex: 1,
    padding: 20,
  },
});
