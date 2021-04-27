const Strings = {
  Title: 'IoT Plug and Play',
  Core: {
    Close: 'Close',
    Cancel: 'Cancel',
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
  },
  Registration: {
    Header:
      'Welcome! Connect your phone to the Azure IoT cloud and experience the simplicity of IoT Plug and Play in just a few steps.​',
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
      Registered: 'Registered using:',
      RegisterNew: {
        Title: 'Register as a new device',
        Alert: {
          Title: 'Register as new device?',
          Text:
            "Once you register as a new device, your old connection will be cleared and you'll be able to connect as a new device. Data previously sent will remain in the cloud until you delete it.",
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
          Dps: 'Enter enrollment group information',
          CString: 'Enter IoT Hub device connection string',
        },
        ConnectionInfo: 'Connection info',
      },
      KeyTypes: {
        Group: 'Application key',
        Device: 'Device key',
      },
    },
    Connection: {
      Loading: 'Connecting client...',
    },
    Clear: 'Clear registration',
  },
  Client: {
    Properties: {
      Delivery: {
        Success: 'Property "{{0}}" successfully sent to Azure IoT.',
        Failure: 'Failed to send property "{{0}}" to Azure IoT.',
      },
      Loading: 'Waiting for properties...',
    },
  },
  FileUpload: {
    Start: 'Select image to be uploaded on Azure Storage',
    Footer: "You'll need to configure file upload in your app.",
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
