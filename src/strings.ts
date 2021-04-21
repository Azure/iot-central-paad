const Strings = {
  Title: 'IoT Plug and Play',
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
    },
    Connection: {
      Loading: 'Connecting client...',
    },
  },
};

export default Strings;
