import React, { useContext, useEffect, useRef, useState } from 'react';
import ImagePicker from 'react-native-image-picker';
import { View } from 'react-native-animatable';
import { Card } from './components/card';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenDimensions } from './hooks/layout';
import { Icon } from 'react-native-elements';
import { useTheme } from '@react-navigation/native';
import { Headline, Text } from './components/typography';
import { useIoTCentralClient, useSimulation } from './hooks/iotc';
import Registration from './Registration';
import { Loader } from './components/loader';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { Platform } from 'react-native';
import { StateUpdater } from './types';
import { LogsContext } from './contexts/logs';
import { Screen } from 'react-native-screens';

export default function FileUpload() {
    const { client } = useIoTCentralClient();
    const [simulated] = useSimulation();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const { append } = useContext(LogsContext);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setuploadStatus] = useState<boolean | undefined>(undefined);

    const fileName = useRef('');
    const fileSize = useRef('');

    useEffect(() => {
        setuploadStatus(undefined);
    }, [uploading]);

    if (simulated) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginHorizontal: 30 }}>
                <Headline style={{ textAlign: 'center' }}>Simulation mode is enabled</Headline>
                <Text style={{ textAlign: 'center' }}> File upload is not available.
                Disable simulation mode and connect to IoT Central to work with file uploads.
                </Text>
            </View>
        )
    }
    if (client === null) {
        return <Registration />
    }

    if (client === undefined) {
        return (
            <Loader message={'Connecting to IoT Central ...'} visible={true} />
        );
    }


    return (<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, justifyContent: 'center', alignItems: 'center' }}>
        <Card
            containerStyle={{
                flex: 0,
                height: screen.height / 3,
                width: screen.width - 100
            }}
            enabled={false}
            title=''
            onPress={uploading ? undefined : () => {
                ImagePicker.showImagePicker({
                    title: 'Select Image'
                }, async (response) => {
                    if (response.didCancel) {
                        console.log('User cancelled');
                    }
                    else if (response.error) {
                        console.log('ImagePicker Error: ', response.error);
                    } else if (response.customButton) {
                        console.log('User tapped custom button: ', response.customButton);
                    } else {
                        // send response data
                        let fileType = 'image/jpg';
                        if (response.type) {
                            fileType = response.type;
                        }

                        let curfileName = response.fileName;
                        if (!curfileName && Platform.OS === 'ios') {
                            curfileName = response.uri.split('/').pop();
                        }
                        try {
                            setUploading(true);
                            append({
                                eventName: 'FILE UPLOAD',
                                eventData: `Starting upload of file ${curfileName}`
                            });
                            fileName.current = curfileName as string;
                            fileSize.current = formatBytes(response.fileSize);
                            await new Promise(r => setTimeout(r, 6000));
                            const res = await client.uploadFile(curfileName as string, fileType, response.data, 'base64');
                            if (res.status >= 200 && res.status < 300) {
                                console.log('here');
                                append({
                                    eventName: 'FILE UPLOAD',
                                    eventData: `Successfully uploaded ${curfileName}`
                                });
                                setuploadStatus(true);
                            }
                            else {
                                append({
                                    eventName: 'FILE UPLOAD',
                                    eventData: `Error uploading ${curfileName}${res.errorMessage ? `. Reason:${res.errorMessage}` : '.'}`
                                });
                                setuploadStatus(false);
                            }
                        }
                        catch (e) {
                            console.log(e);
                        }

                    }
                });

            }}
            value={uploading ? () => (<UploadProgress size={fileSize.current} filename={fileName.current} uploadStatus={uploadStatus} setUploading={setUploading} />) : UploadIcon}

        />
    </View>)
}




function UploadIcon() {
    const { colors } = useTheme();
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Icon size={50} name='upload-outline' type='material-community' color={colors.text} />
            <Text style={{ marginTop: 30 }}>Select image to upload on Azure Storage</Text>
        </View>)
}

function UploadProgress(props: { filename: string, size: string, uploadStatus: boolean | undefined, setUploading: StateUpdater<boolean> }) {
    const { colors: themeColors } = useTheme();
    const [fill, setFill] = useState(1);
    const { size, uploadStatus, filename, setUploading } = props;
    const { screen } = useScreenDimensions();
    const [showResult, setShowResult] = useState(false);
    const [rotationStyle, setRotationStyle] = useState({});
    const [colors, setColors] = useState({ tint: themeColors.text, background: themeColors.card });

    const intid = useRef<number>();

    useEffect(() => {
        //@ts-ignore
        intid.current = setInterval(() => setFill(cur => {
            if (cur === 100 || cur === 101) {
                // reset counter
                return 0;
            }
            return cur + 5;
        }), 300);
        //@ts-ignore
        return () => clearInterval(intid.current);
    }, []);

    useEffect(() => {
        if (fill === 0) {
            // setRotationStyle({ transform: [{ scaleX: -1 }] });
            setColors(cur => ({
                tint: cur.tint === themeColors.text ? themeColors.card : themeColors.text,
                background: cur.background === themeColors.card ? themeColors.text : themeColors.card
            }));
        }
    }, [fill]);

    useEffect(() => {
        if (uploadStatus !== undefined) {
            setShowResult(true);
            // wait before go back to standard screen
            setTimeout(() => {
                setUploading(false);
            }, 3000);

            //@ts-ignore
            clearInterval(intid.current);
        }
    }, [uploadStatus]);

    if (uploadStatus !== undefined && showResult) {
        return (<View style={{ flex: 1, alignItems: 'center' }}>
            <Icon
                size={screen.height / 6}
                color={uploadStatus ? 'green' : 'red'}
                name={Platform.select({
                    ios: uploadStatus ? 'checkmark-circle-outline' : 'close-circle-outline',
                    android: uploadStatus ? 'check-circle-outline' : 'close-circle-outline'
                }) as string}
                type={Platform.select({
                    ios: 'ionicon',
                    android: 'material-community'
                })}
            />
            <Text>{uploadStatus ? `Successfully uploaded ${filename}` : `Failed to upload ${filename}`}</Text>
        </View>)
    }

    return (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AnimatedCircularProgress
            size={screen.height / 5}
            width={5}
            fill={fill}
            tintColor={colors.tint}
            backgroundColor={colors.background}
            rotation={360}
            style={rotationStyle}
        >
            {() => (

                <Text style={rotationStyle}>{size}</Text>
            )}
        </AnimatedCircularProgress>
        <Text style={{ marginTop: 30 }}>{filename}</Text>
    </View>)
}

function formatBytes(a: number, b = 2) { if (0 === a) return "0 Bytes"; const c = 0 > b ? 0 : b, d = Math.floor(Math.log(a) / Math.log(1024)); return parseFloat((a / Math.pow(1024, d)).toFixed(c)) + " " + ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d] }