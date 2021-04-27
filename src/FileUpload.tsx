import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Callback,
  ImageLibraryOptions,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import {View} from 'react-native-animatable';
import {Card} from './components/card';
import {useScreenDimensions} from './hooks/layout';
import {Icon, BottomSheet, ListItem} from 'react-native-elements';
import {useTheme} from '@react-navigation/native';
import {Headline, Text} from './components/typography';
import {useIoTCentralClient, useSimulation} from './hooks/iotc';
import {AnimatedCircularProgress} from 'react-native-circular-progress';
import {Platform} from 'react-native';
import {LogsContext} from './contexts/logs';
import Strings from 'strings';
import {ISetBooleanFunctions, useBoolean} from 'hooks/common';

export default function FileUpload() {
  const {colors} = useTheme();
  const [client] = useIoTCentralClient();
  const [simulated] = useSimulation();
  const {screen} = useScreenDimensions();
  const {append} = useContext(LogsContext);
  const [uploading, setUploading] = useBoolean(false);
  const [showSelector, setShowSelector] = useBoolean(false);
  const [uploadStatus, setuploadStatus] = useState<boolean | undefined>(
    undefined,
  );

  const fileName = useRef('');
  const fileSize = useRef('');

  const styles = useMemo(
    () => ({
      listItem: {
        backgroundColor: colors.card,
      },
      listItemText: {
        color: colors.text,
      },
      closeItemText: {
        color: 'gray',
      },
    }),
    [colors],
  );

  useEffect(() => {
    setuploadStatus(undefined);
  }, [uploading]);

  const startUpload = useCallback(
    (fn: (options: ImageLibraryOptions, callback: Callback) => void) => {
      fn(
        {
          mediaType: 'photo',
          includeBase64: true, //TODO: remove and use uri
        },
        async response => {
          setShowSelector.False();
          if (response.didCancel) {
            console.log('User cancelled');
          } else if (response.errorMessage) {
            console.log('ImagePicker Error: ', response.errorMessage);
          } else {
            // send response data
            let fileType = 'image/jpg';
            if (response.type) {
              fileType = response.type;
            }

            let curfileName = response.fileName;
            if (!curfileName && Platform.OS === 'ios') {
              curfileName = response.uri?.split('/').pop();
            }
            console.log(`Current file name: ${curfileName}`);
            try {
              setUploading.True();
              append({
                eventName: 'FILE UPLOAD',
                eventData: `Starting upload of file ${curfileName}`,
              });
              fileName.current = curfileName as string;
              fileSize.current = formatBytes(response.fileSize!);
              await new Promise(r => setTimeout(r, 6000));
              const res = await client?.uploadFile(
                curfileName as string,
                fileType,
                response.base64,
                'base64',
              );
              if (res && res.status >= 200 && res.status < 300) {
                append({
                  eventName: 'FILE UPLOAD',
                  eventData: `Successfully uploaded ${curfileName}`,
                });
                setuploadStatus(true);
              } else {
                append({
                  eventName: 'FILE UPLOAD',
                  eventData: `Error uploading ${curfileName}${
                    res?.errorMessage ? `. Reason:${res?.errorMessage}` : '.'
                  }`,
                });
                setuploadStatus(false);
              }
            } catch (e) {
              console.log(e);
            }
          }
        },
      );
    },
    [setShowSelector, setUploading, append, client],
  );

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
          {Strings.Simulation.Enabled}
        </Headline>
        <Text style={{textAlign: 'center'}}>
          {' '}
          {Strings.FileUpload.NotAvailable} {Strings.Simulation.Disable}
        </Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Card
        containerStyle={{
          flex: 0,
          height: screen.height / 3,
          width: screen.width - 100,
        }}
        enabled={false}
        title=""
        onPress={setShowSelector.True}
        value={
          uploading
            ? () => (
                <UploadProgress
                  size={fileSize.current}
                  filename={fileName.current}
                  uploadStatus={uploadStatus}
                  setUploading={setUploading}
                />
              )
            : UploadIcon
        }
      />
      <BottomSheet
        isVisible={showSelector}
        containerStyle={{backgroundColor: 'rgba(0.5, 0.25, 0, 0.2)'}}
        modalProps={{}}>
        <ListItem
          onPress={() => {
            startUpload(launchImageLibrary);
          }}
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.listItemText}>
              {Strings.FileUpload.Modes.Library}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
        <ListItem
          onPress={() => {
            startUpload(launchCamera);
          }}
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.listItemText}>
              {Strings.FileUpload.Modes.Camera}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
        <ListItem
          onPress={setShowSelector.False}
          containerStyle={styles.listItem}>
          <ListItem.Content style={{alignItems: 'center'}}>
            <ListItem.Title style={styles.closeItemText}>
              {Strings.Core.Close}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </BottomSheet>
    </View>
  );
}

function UploadIcon() {
  const {colors} = useTheme();
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Icon
        size={50}
        name="upload-outline"
        type="material-community"
        color={colors.text}
      />
      <Text style={{marginTop: 30}}>{Strings.FileUpload.Start}</Text>
    </View>
  );
}

function UploadProgress(props: {
  filename: string;
  size: string;
  uploadStatus: boolean | undefined;
  setUploading: ISetBooleanFunctions;
}) {
  const {colors: themeColors} = useTheme();
  const [fill, setFill] = useState(1);
  const {size, uploadStatus, filename, setUploading} = props;
  const {screen} = useScreenDimensions();
  const [showResult, setShowResult] = useState(false);
  const [rotationStyle] = useState({});
  const [colors, setColors] = useState({
    tint: themeColors.text,
    background: themeColors.card,
  });

  const intid = useRef<number>();

  useEffect(() => {
    // @ts-ignore
    intid.current = setInterval(
      () =>
        setFill(cur => {
          if (cur === 100 || cur === 101) {
            // reset counter
            return 0;
          }
          return cur + 5;
        }),
      300,
    );
    // @ts-ignore
    return () => clearInterval(intid.current);
  }, []);

  useEffect(() => {
    if (fill === 0) {
      // setRotationStyle({ transform: [{ scaleX: -1 }] });
      setColors(cur => ({
        tint:
          cur.tint === themeColors.text ? themeColors.card : themeColors.text,
        background:
          cur.background === themeColors.card
            ? themeColors.text
            : themeColors.card,
      }));
    }
  }, [fill, themeColors.card, themeColors.text]);

  useEffect(() => {
    if (uploadStatus !== undefined) {
      setShowResult(true);
      // wait before go back to standard screen
      setTimeout(() => {
        setUploading.False();
      }, 3000);

      // @ts-ignore
      clearInterval(intid.current);
    }
  }, [uploadStatus, setUploading]);

  if (uploadStatus !== undefined && showResult) {
    return (
      <View style={{flex: 1, alignItems: 'center'}}>
        <Icon
          size={screen.height / 6}
          color={uploadStatus ? 'green' : 'red'}
          name={
            Platform.select({
              ios: uploadStatus
                ? 'checkmark-circle-outline'
                : 'close-circle-outline',
              android: uploadStatus
                ? 'check-circle-outline'
                : 'close-circle-outline',
            }) as string
          }
          type={Platform.select({
            ios: 'ionicon',
            android: 'material-community',
          })}
        />
        <Text>
          {uploadStatus
            ? `Successfully uploaded ${filename}`
            : `Failed to upload ${filename}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <AnimatedCircularProgress
        size={screen.height / 5}
        width={5}
        fill={fill}
        tintColor={colors.tint}
        backgroundColor={colors.background}
        rotation={360}
        style={rotationStyle}>
        {() => <Text style={rotationStyle}>{size}</Text>}
      </AnimatedCircularProgress>
      <Text
        style={{color: 'red', paddingVertical: 10}}
        onPress={setUploading.False}>
        {Strings.Core.Cancel}
      </Text>
      <Text style={{}}>{filename}</Text>
    </View>
  );
}

function formatBytes(a: number, b = 2) {
  if (0 === a) return '0 Bytes';
  const c = 0 > b ? 0 : b;
  const d = Math.floor(Math.log(a) / Math.log(1024));
  return (
    parseFloat((a / Math.pow(1024, d)).toFixed(c)) +
    ' ' +
    ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][d]
  );
}
