import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, processColor } from 'react-native';
import { LineChart, LineDatasetConfig } from 'react-native-charts-wrapper';
import { getRandomColor, Text } from './components/typography';
import { ExtendedLineData, ItemData } from './types';
import { useTelemetry } from './hooks/iotc';
import { DATA_AVAILABLE_EVENT } from './sensors';
import { useTheme } from '@react-navigation/native';



const title = 'Health insights';
const summary = 'Your average body temperature is less than yesterday and your heart rate is nearly the same.';
const footer = 'This view is showing real-time data from the paired device or Google Fit data. To restart this sample walkthrough, exit and relaunch the app. To get started with building your own app, visit our GitHub repository.';




export default function Insight({ route, navigation }) {
    const { telemetryData, addListener, removeListener } = useTelemetry();
    const { colors } = useTheme();
    const [start, setStart] = useState<number>(Date.now());
    const [data, setData] = useState<ExtendedLineData>({
        dataSets: []
    });
    const timestamp = Date.now() - start;
    const { telemetryId } = route.params;
    /**
 * 
 * @param itemdata Current sample for the item
 * @param startTime Start time of the sampling. Must be the same value used as "since" param in the chart
 * @param setData Dispatch to update dataset with current sample
 */
    function updateData(id: string, value: any) {
        let item = { id, value };
        if (id !== telemetryId) {
            return;
        }
        let itemToProcess: ItemData[] = [item];
        if ((typeof item.value) !== 'string' && (typeof item.value) !== 'number') {
            // data is composite
            itemToProcess = Object.keys(item.value).map(i => ({
                id: `${item.id}.${i}`,
                value: item.value[i]
            }));
        }
        itemToProcess.forEach(itemdata => {

            setData(currentDataSet => {
                let currentItemData = currentDataSet.dataSets.find(d => d.itemId === itemdata.id);

                // Current sample time (x-axis) is the difference between current timestamp e the start time of sampling
                const newSample = { x: Date.now() - start, y: itemdata.value };

                if (!currentItemData) {
                    // current item is not in the dataset yet
                    return { ...currentDataSet, dataSets: [...currentDataSet.dataSets, ...[{ itemId: itemdata.id, values: [newSample], label: itemdata.id, config: { color: getRandomColor() } as LineDatasetConfig }]] };
                }
                return {
                    ...currentDataSet,
                    dataSets: currentDataSet.dataSets.map(({ ...item }) => {
                        if (item.itemId === itemdata.id && item.values) {
                            item.values = [...item.values, ...[newSample]];
                        }
                        return item;
                    })
                }
            });
        });

    }

    useEffect(() => {
        setStart(Date.now());
        addListener(DATA_AVAILABLE_EVENT, updateData);

        return () => removeListener(DATA_AVAILABLE_EVENT, updateData);
    }, []);

    return (
        <View style={style.container}>
            <View style={style.chart}>
                <LineChart style={style.chartBox} chartDescription={{ text: '' }}
                    touchEnabled={true}
                    dragEnabled={true}
                    scaleEnabled={true}
                    pinchZoom={true}
                    extraOffsets={{ bottom: 20 }}
                    legend={{
                        wordWrapEnabled: true,
                        textColor: processColor(colors.text)
                    }}
                    xAxis={{
                        position: 'BOTTOM',
                        axisMaximum: timestamp + 500,
                        axisMinimum: timestamp - 10000,
                        valueFormatter: 'date',
                        since: start,
                        valueFormatterPattern: 'HH:mm:ss',
                        timeUnit: 'MILLISECONDS',
                        axisLineColor: processColor(colors.text),
                        textColor: processColor(colors.text)
                    }}
                    yAxis={{
                        right: {
                            axisLineColor: processColor(colors.text),
                            textColor: processColor(colors.text)
                        },
                        left: { enabled: false }
                    }}
                    data={data} />
                <View style={style.summary}>
                    <View style={{ flexDirection: 'row' }}>

                    </View>
                </View>
            </View>
        </View>)
}

const style = StyleSheet.create({
    container: {
        flex: 1
    },
    chart: {
        flex: 1,
        marginTop: 30,
        marginHorizontal: 30
    },
    chartBox: {
        flex: 2
    },
    summary: {
        flex: 1,
        padding: 20
    }

})