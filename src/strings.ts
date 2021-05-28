const Strings = {
  Title: 'IoT Plug and Play',
  Core: {
    Close: 'Close',
    Cancel: 'Cancel',
    Loading: 'Loading...',
    DisableSensor: 'Disable sensor',
    EnableSensor: 'Enable sensor',
  },
  Settings: {
    Title: 'Settings',
    Theme: {
      Title: 'Theme',
      Dark: {
        Name: 'Dark',
        Detail: 'Always use dark theme',
      },
      Light: {
        Name: 'Light',
        Detail: 'Always use light theme',
      },
      Device: {
        Name: 'Your device',
        Detail: "Use system's setting",
      },
    },
    DeliveryInterval: {
      Title: 'Delivery interval',
      2: '2 seconds',
      5: '5 seconds (default)',
      10: '10 seconds',
      30: '30 seconds',
      45: '45 seconds',
    },
    Clear: {
      Title: 'Clear Data',
      Alert: {
        Title: 'Do you really want to clear all data?',
        Text:
          'Proceeding will clear all stored device credentials and user preferences like theme mode and telemetry delivery interval.',
      },
      Success: {
        Title: 'Success',
        Text: 'Successfully cleared data!',
      },
    },
  },
  Registration: {
    Header: {
      Welcome: 'Welcome! ',
      Text:
        'Connect your phone to the Azure IoT cloud and experience the simplicity of IoT Plug and Play in just a few steps.',
    },
    Footer: 'Need help getting started? ',
    StartHere: {
      Title: 'Start here',
      Url: 'https://aka.ms/iot-paad-getstarted',
    },
    QRCode: {
      Manually: 'Connect manually',
    },
    Manual: {
      Title: 'Manually connect',
      Header: 'Need help locating this information? ',
      DeviceId: {
        Label: 'Device ID',
        PlaceHolder: 'Enter a unique ID to identify this device',
      },
      ScopeId: {
        Label: 'ID scope',
        PlaceHolder: 'Enter your DPS ID scope',
      },
      SASKey: {
        Label: 'Shared access signature (SAS) key',
        PlaceHolder: 'Enter or paste your SAS key',
      },
      Registered: 'Registered using:',
      RegisterNew: {
        Title: 'Register as a new device',
        Alert: {
          Title: 'Register as new device?',
          Text:
            "Once you register as a new device, your old connection will be disconnected and you'll be able to connect as a new device. Current device credentials will not be cleared until the new device actually connects. Data previously sent will remain in the cloud until you delete it.",
        },
      },
      Clear: {
        Title: 'Clear registration',
        Alert: {
          Title: 'Clear device registration info?',
          Text:
            'Are you sure to clear registration info? If proceed, device will disconnect and credentials will be wiped out. This means you need to register as a new device next time.',
        },
      },
      Footer: {
        Connect: 'Connect',
      },
      StartHere: {
        Title: 'Start here',
        Url: 'https://aka.ms/iot-paad-connect',
      },
      Body: {
        ConnectionType: {
          Title: 'How would you like to connect?',
          Dps: 'Enrollment group information',
          CString: 'IoT Hub device connection string',
        },
        ConnectionInfo: 'Connection info',
      },
      KeyTypes: {
        Label: 'Authentication',
        Group: 'Group key',
        Device: 'Device key',
      },
    },
    Connection: {
      Loading: 'Connecting to Azure IoT...',
      Cancel: 'Cancel',
    },
  },
  Client: {
    Properties: {
      Send: 'Send',
      Delivery: {
        Success: 'Property "{{0}}" successfully sent to Azure IoT.',
        Failure: 'Failed to send property "{{0}}" to Azure IoT.',
      },
      Loading: 'Waiting for properties...',
    },
    Commands: {
      Alert: {
        Title: 'Command received',
        Message:
          'The device received command "{{0}}" from Azure IoT. Starting executing now.',
      },
    },
  },
  FileUpload: {
    Start: 'Select an image to upload to Azure Storage',
    Footer:
      "You'll need to configure file upload in your IoT solution before using this feature.",
    LearnMore: {
      Title: 'Learn more',
      Url: 'https://aka.ms/iot-paad-fileupload',
    },
    NotAvailable: 'File upload is not available.',
    Modes: {
      Library: 'Take from image gallery',
      Camera: 'Capture photo with camera',
    },
  },
  LogScreen: {
    Header:
      'Connection information between your device and Azure IoT will show up below.',
  },
  Simulation: {
    Enabled: 'Simulation mode is enabled.',
    Disable:
      'Disable simulation mode and connect to Azure IoT to work with file uploads.',
  },
};

export function resolveString(data: string, ...values: string[]) {
  values.forEach(val => (data = data.replace(/\{\{[\S]\}\}/, val)));
  return data;
}

export default Strings;
