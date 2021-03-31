import { RouteProp, useTheme } from '@react-navigation/native';
import React from 'react';
import { WebView } from 'react-native-webview';
import { NavigationParams, DATA_AVAILABLE_EVENT, LineChartOptions, ChartType } from 'types';
import { SensorMap } from 'sensors';
import { StyleSheet, View } from 'react-native';
import {
    Name,
    Text,
    getRandomColor,
    LightenDarkenColor,
} from 'components/typography';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import Map from 'components/map';
import { Loader } from 'components/loader';
import { useScreenDimensions } from 'hooks/layout';

type SeriesData = {
    [date: string]: {
        [field: string]: number;
    };
};

type ChartData = {
    [groupId: string]: {
        [telemetryId: string]: SeriesData;
    };
};

type TelemetryData = {
    [telemetryId: string]: {
        values: {
            timestamp: string;
            value: number;
        }[];
    };
};

type TelemetryMetaData = {
    [telemetryId: string]: {
        displayName: string;
        color: string;
    };
};

const Chart = React.memo<{
    route: RouteProp<
        Record<
            string,
            NavigationParams & {
                chartType: ChartType;
                telemetryId: string;
                currentValue: any;
            }
        >,
        'Insight'
    >;
}>(({ route }) => {
    const { colors, dark } = useTheme();
    const { screen } = useScreenDimensions();
    const { chartType, telemetryId, currentValue } = route.params;
    const [data, setData] = React.useState<TelemetryData>({});
    const [metadata, setMetadata] = React.useState<TelemetryMetaData>({});
    const chartRef = React.useRef<WebView>(null);
    const mapStyle = React.useMemo(
        () => ({
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
        }),
        [dark],
    );
    const chartOptions: LineChartOptions = React.useMemo(
        () => ({
            noAnimate: true,
            brushHandlesVisible: false,
            snapBrush: false,
            interpolationFunction: 'curveMonotoneX',
            theme: dark ? 'dark' : 'light',
            offset: 'Local',
            legend: 'compact',
            includeDots: true,
            hideChartControlPanel: true,
        }),
        [dark],
    );

    const chartDataOptions = React.useMemo(
        () =>
            Object.keys(metadata).map(telemetryId => ({
                alias: metadata[telemetryId].displayName,
                color: metadata[telemetryId].color,
            })),
        [metadata],
    );

    const html = React.useMemo(
        () => `<html>
    <head>
    <script src="https://unpkg.com/tsiclient@latest/tsiclient.js"></script>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/tsiclient@latest/tsiclient.css">
    </link>
    <style>
        body{
            background-color:${colors.background};
        }
        .tsi-seriesName {
            width: 100%;
        }
        .tsi-seriesName span {
            font-size: xx-large;
        }
        .tsi-lineChartSVG {
            height: 110% !important;
        }
        .tsi-legend.compact {
            margin-bottom:60px;
        }
        .tsi-legend.compact .tsi-seriesLabel .tsi-splitByContainer .tsi-splitByLabel {
            display: inline-block;
            margin: 0 4px;
            padding: 0 4px 1px 4px;
            margin-top: 1px;
            height:100%;
        }
        .tsi-legend.compact .tsi-seriesLabel .tsi-splitByContainer .tsi-splitByLabel .tsi-seriesName {
            max-width: fit-content;
        }

        .tsi-legend.compact .tsi-seriesLabel .tsi-splitByContainer .tsi-splitByLabel .tsi-colorKey {
            top: 10px;
            height: 10px;
        }

        .tsi-lineChart .tsi-lineChartSVG text.standardYAxisText {
            font-size: xx-large;
        }

        .tsi-lineChart .tsi-lineChartSVG text {
            font-size: xx-large;
        }
    </style>
    <script>

        window.onload = function () {
            tsiClient = new TsiClient();
            data = [];

            lineChart = new tsiClient.ux.LineChart(document.getElementById('chart1'));
            lineChart.render(data, ${JSON.stringify(
            chartOptions,
        )}, ${JSON.stringify(chartDataOptions)});
        }
    </script>
<body>
    <div id="chart1" style="width: 100%; height: 1000px; margin-top: 40px;"></div>
</body>
</head>
</html>`,
        [colors, chartOptions, chartDataOptions],
    );

    const updateData = React.useCallback(
        (id: string, value: any) => {
            if (id !== telemetryId) {
                return;
            }
            if (typeof value !== 'number') {
                // data is composite
                setData(current => {
                    Object.keys(value).forEach(fieldId => {
                        if (!metadata[fieldId]) {
                            setMetadata(currentMetadata => ({
                                ...currentMetadata,
                                [fieldId]: {
                                    displayName: `${id}/${fieldId}`,
                                    color: getRandomColor(),
                                },
                            }));
                        }
                        current = {
                            ...current,
                            [fieldId]: {
                                ...current[fieldId],
                                values: [
                                    ...(current[fieldId]?.values ?? []),
                                    { timestamp: new Date().toISOString(), value: value[fieldId] },
                                ],
                            },
                        };
                    });
                    return current;
                });
            } else {
                if (!metadata[id]) {
                    setMetadata(currentMetadata => ({
                        ...currentMetadata,
                        [id]: {
                            displayName: id,
                            color: getRandomColor(),
                        },
                    }));
                }
                setData(current => ({
                    ...current,
                    [id]: {
                        ...current[id],
                        values: [
                            ...(current[id]?.values ?? []),
                            { timestamp: new Date().toISOString(), value },
                        ],
                    },
                }));
            }
        },
        [telemetryId, metadata],
    );

    const getChartCompatibleData = React.useCallback(
        (telemetryData: TelemetryData) =>
            Object.keys(telemetryData).reduce<ChartData[]>(
                (data, telemetryId) => [
                    ...data,
                    {
                        [telemetryId]: {
                            [metadata[telemetryId].displayName]: telemetryData[
                                telemetryId
                            ].values.reduce<SeriesData>(
                                (values, value) => ({
                                    ...values,
                                    [value.timestamp]: {
                                        [telemetryId]: value.value,
                                    },
                                }),
                                {},
                            ),
                        },
                    },
                ],
                [],
            ),
        [metadata],
    );

    React.useEffect(() => {
        const sensor = SensorMap[telemetryId]; // || HealthMap[telemetryId];
        sensor?.addListener(DATA_AVAILABLE_EVENT, updateData);
        // init chart with current value
        if (currentValue !== undefined) {
            updateData(telemetryId, currentValue);
        }
        return () => {
            sensor?.removeListener(DATA_AVAILABLE_EVENT, updateData);
        };
    }, [telemetryId, currentValue, updateData]);

    // Init chart or update it with new data
    React.useEffect(() => {
        if (Object.keys(data).length === 0) {
            return;
        }
        const run = `
        if(!tsiClient){
            tsiClient = new TsiClient();
        }
        if(!lineChart){
            lineChart = new tsiClient.ux.LineChart(document.getElementById('chart1'));
        }
        data=${JSON.stringify(getChartCompatibleData(data))};
        lineChart.render(data, ${JSON.stringify(
            chartOptions,
        )}, ${JSON.stringify(chartDataOptions)});
        true;
        `;
        chartRef.current?.injectJavaScript(run);
    }, [data, chartOptions, chartDataOptions, getChartCompatibleData]);

    if (chartType === ChartType.MAP) {
        return (
            <View style={{ flex: 1 }}>
                <Map style={mapStyle} location={currentValue} />
                <View style={style.summary}>
                    <Text>
                        <Name>Latitude:</Name> {currentValue.lat}
                    </Text>
                    <Text>
                        <Name>Longitude:</Name> {currentValue.lon}
                    </Text>
                </View>
            </View>
        );
    }
    return (
        <>
            {Object.keys(data).length === 0 ? (
                <Loader message="" visible={true} />
            ) : (
                <View style={style.container}>
                    <View style={style.chart}>
                        <WebView
                            originWhitelist={['*']}
                            containerStyle={{ flex: 2, justifyContent: 'flex-start' }}
                            ref={chartRef}
                            source={{
                                html,
                            }}
                            startInLoadingState={true}
                            // use theme background color when chart is loading
                            // style allows to cover all webview space as per issue: 
                            // https://github.com/react-native-webview/react-native-webview/issues/1031 
                            renderLoading={() => <View style={{
                                position: 'absolute',
                                height: '100%',
                                width: '100%',
                                backgroundColor: colors.background
                            }} />}
                        />
                        <View style={style.summary}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-around',
                                    marginTop: 40,
                                }}>
                                {Object.keys(data).map((telemetryId, i) => {
                                    const telemetry = data[telemetryId];
                                    if (!telemetry) {
                                        return null;
                                    }
                                    const avg =
                                        telemetry.values.map(v => v.value).reduce((a, b) => a + b) /
                                        telemetry.values.length;
                                    const fill = avg > 1 || avg < -1 ? avg : Math.abs(avg * 1000);
                                    return (
                                        <AnimatedCircularProgress
                                            key={`circle - ${i}`}
                                            size={screen.width / 5}
                                            width={5}
                                            fill={fill}
                                            tintColor={metadata[telemetryId].color}
                                            backgroundColor={LightenDarkenColor(
                                                metadata[telemetryId].color,
                                                90,
                                                true,
                                            )}
                                            rotation={360}>
                                            {() => {
                                                const strVal = `${avg}`;
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
});

const style = StyleSheet.create({
    container: {
        flex: 1,
    },
    chart: {
        flex: 2,
        marginTop: 30,
        marginHorizontal: 10,
    },
    summary: {
        flex: 1,
        padding: 20,
    },
});

export default Chart;
