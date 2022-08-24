// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

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
import {Icon, ListItem} from '@rneui/themed';
import {Headline, Link, Text} from './components';
import {
  useIoTCentralClient,
  useSimulation,
  ISetBooleanFunctions,
  useBoolean,
  useTheme,
} from 'hooks';
import {Platform, Linking, ViewStyle, TextStyle} from 'react-native';
import {LogsContext} from './contexts/logs';
import Strings from 'strings';
import BottomPopup from 'components/bottomPopup';
import {CircleSnail} from 'react-native-progress';
import {Literal, StyleDefinition} from 'types';

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

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');

  const styles = useMemo<Literal<ViewStyle | TextStyle>>(
    () => ({
      flex1: {flex: 1},
      container: {
        flex: 0,
        marginBottom: 40,
        alignItems: 'center',
        marginHorizontal: 40,
      },
      simulatedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 30,
      },
      centerText: {
        textAlign: 'center',
      },
      listItem: {
        backgroundColor: colors.card,
      },
      listItemText: {
        color: colors.text,
      },
      closeItemText: {
        color: 'gray',
      },
      card: {
        flex: 0,
        height: screen.height / 2,
        width: screen.width - 100,
      },
      cardWrapper: {flex: 2, alignItems: 'center', justifyContent: 'center'},
    }),
    [colors, screen],
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

            const rawFileType = response.assets?.[0].type;
            let fileType = 'image/jpeg';

            // There is a bug with the image picker (at least on iOS) that causes the type for .jpg images to come back as 'image/jpg'
            // which is invalid and will cause any mime type parsing to misidentify the file type
            // Bug: https://github.com/react-native-image-picker/react-native-image-picker/issues/1856
            if (rawFileType && rawFileType !== 'image/jpg') {
              fileType = rawFileType;
            }

            let curfileName = response.assets?.[0].fileName;
            if (!curfileName && Platform.OS === 'ios') {
              curfileName = response.assets?.[0].uri?.split('/').pop();
            }
            console.log(`Current file name: ${curfileName}`);
            try {
              append({
                eventName: 'FILE UPLOAD',
                eventData: `Starting upload of file ${curfileName}`,
              });
              setFileName(curfileName!);
              setFileSize(formatBytes(response.assets?.[0].fileSize!));
              setUploading.True();
              // await new Promise(r => setTimeout(r, 6000));
              const res = await client?.uploadFile(
                curfileName as string,
                fileType,
                response.assets?.[0].base64,
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
      <View style={styles.simulatedContainer}>
        <Headline style={styles.centerText}>
          {Strings.Simulation.Enabled}
        </Headline>
        <Text style={styles.centerText}>
          {' '}
          {Strings.FileUpload.NotAvailable} {Strings.Simulation.Disable}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.flex1}>
      <View style={styles.cardWrapper}>
        <Card
          containerStyle={styles.card}
          enabled={false}
          title=""
          onPress={setShowSelector.True}
          value={
            uploading
              ? () => (
                  <UploadProgress
                    fileSize={fileSize}
                    filename={fileName}
                    uploadStatus={uploadStatus}
                    setUploading={setUploading}
                  />
                )
              : () => <UploadIcon />
          }
        />
      </View>

      <View style={styles.container}>
        <Text>
          {Strings.FileUpload.Footer}
          <Link
            onPress={() => Linking.openURL(Strings.FileUpload.LearnMore.Url)}>
            {Strings.FileUpload.LearnMore.Title}
          </Link>
        </Text>
      </View>
      <BottomPopup
        isVisible={showSelector}
        onDismiss={() => setShowSelector.False()}>
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
      </BottomPopup>
    </View>
  );
}

function UploadIcon() {
  const {colors} = useTheme();
  const {screen} = useScreenDimensions();

  const styles: Literal<ViewStyle | TextStyle> = {
    container: {flex: 1, alignItems: 'center'},
    wrapper: {flex: 4, justifyContent: 'center'},
    startContainer: {flex: 1, justifyContent: 'flex-end'},
    start: {marginTop: 30},
  };
  return (
    <View style={styles.container}>
      <View style={styles.wrapper}>
        <Icon
          size={Math.floor(screen.width) / 3}
          name="cloud-upload-outline"
          type={Platform.select({
            ios: 'ionicon',
            android: 'material-community',
          })}
          color={colors.text}
        />
      </View>
      <View style={styles.startContainer}>
        <Text style={styles.start}>{Strings.FileUpload.Start}</Text>
      </View>
    </View>
  );
}

function UploadProgress(props: {
  filename: string;
  fileSize: string;
  uploadStatus: boolean | undefined;
  setUploading: ISetBooleanFunctions;
}) {
  const {colors: themeColors} = useTheme();
  const {uploadStatus, filename, setUploading} = props;
  const {screen} = useScreenDimensions();
  const [showResult, setShowResult] = useState(false);

  const intid = useRef<number>();

  const style = useMemo<StyleDefinition>(
    () => ({
      spinner: {
        flex: 2,
        justifyContent: 'center',
      },
      details: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      cancel: {
        color: 'red',
      },
      spinnerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      container: {flex: 1, alignItems: 'center'},
    }),
    [],
  );

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
      <View style={style.container}>
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
    <View style={style.spinnerContainer}>
      <View style={style.spinner}>
        <CircleSnail
          size={Math.floor(screen.width / 3)}
          indeterminate={true}
          thickness={3}
          color={themeColors.text}
          spinDuration={1000}
          duration={1000}
        />
      </View>
      <View style={style.details}>
        <Text style={style.cancel} onPress={setUploading.False}>
          {Strings.Core.Cancel}
        </Text>
        <Text style={{}}>{filename}</Text>
      </View>
    </View>
  );
}

function formatBytes(a: number, b = 2) {
  if (a === 0) {
    return '0 Bytes';
  }
  const c = b < 0 ? 0 : b;
  const d = Math.floor(Math.log(a) / Math.log(1024));
  return (
    parseFloat((a / Math.pow(1024, d)).toFixed(c)) +
    ' ' +
    ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][d]
  );
}
