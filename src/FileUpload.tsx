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

export default function FileUpload() {
    const [title, setTitle] = useState('Upload image');
    const [client] = useIoTCentralClient();
    const [simulated] = useSimulation();
    const insets = useSafeAreaInsets();
    const { screen } = useScreenDimensions();
    const { append } = useContext(LogsContext);
    const [uploading, setUploading] = useState(false);
    const [completed, setCompleted] = useState(false);

    const fileName = useRef('');
    const fileSize = useRef('');

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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: screen.height / 4, padding: 20 }}>
                <Loader message={'Connecting to IoT Central ...'} />
            </View>)
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
            onPress={() => {
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
                            if (res >= 200 && res < 300) {
                                append({
                                    eventName: 'FILE UPLOAD',
                                    eventData: `Successfully uploaded ${curfileName}`
                                });
                            }
                            else {
                                append({
                                    eventName: 'FILE UPLOAD',
                                    eventData: `Error uploading ${curfileName}`
                                });
                            }
                        }
                        catch (e) {
                            console.log(e);
                        }

                    }
                });

            }}
            value={uploading ? () => (<UploadProgress size={fileSize.current} filename={fileName.current} completed={completed} setUploading={setUploading} />) : UploadIcon}
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

function UploadProgress(props: { filename: string, size: string, completed: boolean, setUploading: StateUpdater<boolean> }) {
    const { colors } = useTheme();
    const [fill, setFill] = useState(0);
    const { size, completed, filename, setUploading } = props;

    const intid = useRef<number>();
    console.log(filename);

    useEffect(() => {
        //@ts-ignore
        intid.current = setInterval(() => setFill(cur => {
            if (cur === 100) {
                //@ts-ignore
                clearInterval(intid.current);
                setUploading(false);
            }
            return cur + 5;
        }), 300);
        //@ts-ignore
        return () => clearInterval(intid.current);
    }, []);

    useEffect(() => {
        if (completed) {
            setFill(100);
            setUploading(false);
            //@ts-ignore
            clearInterval(intid.current);
        }
    }, [completed]);

    return (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AnimatedCircularProgress
            size={200}
            width={5}
            fill={fill}
            tintColor={colors.text}
            backgroundColor={colors.card}
            rotation={360}>
            {() => (

                <Text>{size}</Text>
            )}
        </AnimatedCircularProgress>
        <Text style={{ marginTop: 30 }}>{filename}</Text>
    </View>)
}

function formatBytes(a: number, b = 2) { if (0 === a) return "0 Bytes"; const c = 0 > b ? 0 : b, d = Math.floor(Math.log(a) / Math.log(1024)); return parseFloat((a / Math.pow(1024, d)).toFixed(c)) + " " + ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d] }