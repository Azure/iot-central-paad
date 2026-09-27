// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const Strings = {
  Title: 'IoT Plug and Play',
  Header: {
    Title: 'Phone as a Device',
    Brand: 'Phone',
    Descriptor: 'as a Device',
  },
  AzureContext: {
    Title: 'Azure environment',
    Source: 'Operator-provided snapshot',
    Explanation:
      'Saved Azure context, not a live registry check. Refresh by importing a new operator export.',
    Empty:
      'Import Azure context to see this device’s namespace, subscription and resource group.',
    Unavailable: 'Connect a real device before importing its Azure context.',
    OtherDevice:
      'The saved snapshot belongs to another device. Import a snapshot for this device.',
    StoredInvalid:
      'The saved Azure snapshot could not be read. Device credentials are unchanged; import it again.',
    View: 'View Azure details',
    Hide: 'Hide Azure details',
    Import: 'Import snapshot',
    ImportDetail:
      'Paste an operator export to show the namespace, subscription and resource group saved for this device.',
    Replace: 'Replace snapshot',
    ReplaceDetail:
      'Paste a newer operator export to update the snapshot saved for this device.',
    Input: 'Azure context JSON or Base64',
    Placeholder: 'Paste exported JSON or Base64',
    Hint: 'Use the operator’s Azure context export. Never paste device keys, connection strings or access tokens here.',
    Invalid:
      'This is not a supported Azure context snapshot. Check the export and try again.',
    WrongDevice: 'This snapshot does not match the assigned device and Hub.',
    SaveFailed: 'The Azure snapshot could not be saved. Try again.',
    RemoveFailed: 'The saved snapshot could not be removed. Try again.',
    OpenFailed: 'Azure Portal could not be opened.',
    Remove: 'Remove snapshot',
    RemoveDetail:
      'Clears the saved snapshot from this phone only. No Azure resource, device or registry record is changed.',
    Captured: 'Snapshot captured',
    Scope: 'Scope',
    Resources: 'Resources',
    Manage: 'Manage snapshot',
    Namespace: 'ADR namespace',
    Subscription: 'Subscription',
    ResourceGroup: 'Resource group',
    Region: 'Region',
    Hub: 'IoT Hub',
    Dps: 'Device Provisioning Service',
    Registry: 'Registry record in snapshot',
    RegistryMissing:
      'No matching registry record was included in this snapshot.',
    Portal: 'Open in Azure Portal',
    PortalShort: 'Portal',
    ShowIds: 'Show resource IDs',
    HideIds: 'Hide resource IDs',
    Activities: 'Namespace activity',
    ActivityExplanation:
      'Up to 20 resource-management events from the export’s 24-hour window, including other devices in this namespace. This is not telemetry history.',
    NoActivities: 'No management events were included in this export window.',
    ShowActivities: 'Show activity snapshot',
    HideActivities: 'Hide activity snapshot',
  },
  Core: {
    Back: 'Back',
    Retry: 'Retry',
    Close: 'Close',
    Cancel: 'Cancel',
    Loading: 'Loading...',
    DisableSensor: 'Disable sensor',
    EnableSensor: 'Enable sensor',
    HideCredential: 'Hide credential',
    ShowCredential: 'Show credential',
  },
  Startup: {
    Failed:
      'Could not initialize the app. Your saved data has not been reset. Please retry.',
    ErrorCode: 'Error code: {{0}}',
  },
  Map: {
    CurrentLocation: 'Current location',
    NotConfigured:
      'Map preview is not configured in this Android build. Location coordinates remain available.',
  },
  Connection: {
    Summary: {
      Title: 'Cloud connection',
      OpenDetails: 'Details',
      Connected: 'Connected',
      Disconnected: 'Disconnected',
      Simulated: 'Offline simulation — no cloud connection',
      Device: 'Assigned device',
      Hub: 'Assigned Hub',
      Disconnect: 'Disconnect',
      DisconnectDetail:
        'Stops the cloud connection on this phone. The saved credentials are kept, so you can reconnect.',
      Reconnect: 'Reconnect',
      ReconnectDetail:
        'Connects again with the credentials already saved on this phone.',
      Manual: 'Connect manually',
      ManualDetail:
        'Enter connection details to connect this phone to Azure IoT.',
      Manage: 'Manage connection',
      Details: 'Connection details',
      Forget: 'Forget credentials',
      ForgetDetail:
        'Clears the saved credentials from this phone only. No Azure device, enrollment or registry record is deleted.',
      ForgetTitle: 'Forget saved device credentials?',
      ForgetMessage:
        'Disconnect and remove credentials from this phone only. No Azure device, enrollment or registry record will be deleted.',
      Model: 'Model',
      Registration: 'Registration ID',
      Operation: 'Operation ID',
      Stage: 'Connection stage',
      ErrorCode: 'Error code',
      HttpStatus: 'HTTP status',
      ServiceCode: 'Service code',
      Registry: 'Registry status',
      NotChecked: 'Not checked',
      RegistryExplanation:
        'An authorized operator must independently check Azure Device Registry and the matching device activity. DPS assignment and Hub connection do not confirm a registry record. Namespace links are configured server-side.',
      Utilities: 'Diagnostics and credentials',
      Share: 'Share nonsecret diagnostics',
      ShareDetail:
        'Shares a redacted connection report without device keys, tokens or connection strings.',
      ShareFailed:
        'Diagnostics could not be shared. You can select the values instead.',
      ProofTitle: 'Device activity proof',
      ProofNonce: 'Proof nonce',
      ProofSend: 'Submit proof activity',
      ProofSending: 'Submitting…',
      ProofSubmitted: 'Submitted locally',
      ProofInvalid: 'Use 16–128 letters, numbers, underscores or hyphens.',
      ProofUnavailable:
        'Connect a real device to submit proof. Offline simulation cannot provide cloud proof.',
      ProofFailed:
        'Proof was not fully submitted. Retry with a new nonce if needed.',
      ProofExplanation:
        'Sends telemetry and a reported property through the connected client. Local submission is not a broker acknowledgement, downstream receipt or registry confirmation.',
    },
    Notice: {
      Disconnected: {
        Title: 'Disconnected on this phone',
        Message:
          'Your saved connection is kept. Reconnect to resume sending data.',
      },
      Titles: {
        Default: 'Connection needs attention',
        CONNECTION_LOST: 'Connection interrupted',
        CONNECT_FAILED: 'Could not connect',
        INVALID_CREDENTIALS: 'Check connection details',
        UNSAFE_ENDPOINT: 'Endpoint not approved',
        AUTHENTICATION_FAILED: 'Authentication rejected',
        PROVISIONING_FAILED: 'Provisioning did not complete',
        INVALID_RESPONSE: 'Unexpected response',
        NETWORK_ERROR: 'Network request failed',
        SECURE_TRANSPORT_REQUIRED: 'Secure transport required',
        TIMEOUT: 'Timed out',
        CANCELLED: 'Connection cancelled',
        NOT_CONNECTED: 'Not connected',
        OPERATION_FAILED: 'Operation failed',
        STORAGE_FAILED: 'Settings were not saved',
        BUSY: 'Already connecting',
      },
      Guidance: {
        CONNECTION_LOST: 'Reconnect to resume sending data.',
        CONNECT_FAILED:
          'Try connecting again. Check the connection details if it keeps failing.',
        NETWORK_ERROR: 'Check your network, then try again.',
        TIMEOUT:
          'Try again. Review the connection details if it keeps timing out.',
        INVALID_CREDENTIALS: 'Review the connection details and try again.',
        AUTHENTICATION_FAILED:
          'Confirm the enrollment is enabled for this device.',
      },
      Review: 'Review details',
    },
    Stages: {
      idle: 'Not connected',
      disconnected: 'Disconnected on this phone',
      validating: 'Checking connection details...',
      provisioning: 'Requesting a device assignment...',
      connecting: 'Connecting to the assigned IoT Hub...',
      connected: 'Connected',
      error: 'Connection needs attention',
    },
  },
  Settings: {
    Title: 'Settings',
    Font: {
      Title: 'Fraunces font license',
      Unavailable: 'The bundled font license is unavailable in this build.',
    },
    ConnectionMapArt: {
      Title: 'Connection map artwork licenses',
      Unavailable:
        'The bundled artwork licenses are unavailable in this build.',
    },
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
        Text: 'Proceeding will clear all stored device credentials and user preferences like theme mode and telemetry delivery interval.',
      },
      Success: {
        Title: 'Success',
        Text: 'Saved credentials and local settings were cleared. Azure devices were not deleted.',
      },
    },
  },
  Registration: {
    Header: {
      Welcome: 'Welcome! ',
      Text: 'Connect your phone to the Azure IoT cloud and experience the simplicity of IoT Plug and Play in just a few steps.',
    },
    Footer: 'Need help getting started? ',
    StartHere: {
      Title: 'Start here',
      Url: 'https://aka.ms/iot-paad-getstarted',
    },
    QRCode: {
      Manually: 'Connect manually',
      Scan: 'Scan QR code',
    },
    Manual: {
      Title: 'Manually connect',
      Header: 'Use the individual device key supplied by your operator.',
      ChangeMethod: 'Change connection method',
      DeviceId: {
        Label: 'Registration ID',
        PlaceHolder: 'Enter your enrollment registration ID',
      },
      ScopeId: {
        Label: 'ID scope',
        PlaceHolder: 'Enter your DPS ID scope',
      },
      SASKey: {
        Label: 'Device key',
        PlaceHolder: 'Enter or paste your individual device key',
      },
      ProvisioningHost: 'Provisioning hostname',
      LegacyWarning:
        'Legacy compatibility only. A group key can derive credentials for other devices. Prefer an individual device key.',
      ConnectionStringPlaceholder: 'Enter or paste device connection string',
      Registered: 'Registered using:',
      RegisterNew: {
        Title: 'Register as a new device',
        ShortTitle: 'New device',
        Alert: {
          Title: 'Register as new device?',
          Text: "Once you register as a new device, your old connection will be disconnected and you'll be able to connect as a new device. Current device credentials will not be cleared until the new device actually connects. Data previously sent will remain in the cloud until you delete it.",
        },
      },
      Clear: {
        Title: 'Clear registration',
        Alert: {
          Title: 'Clear device registration info?',
          Text: 'Are you sure to clear registration info? If proceed, device will disconnect and credentials will be wiped out. This means you need to register as a new device next time.',
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
          Dps: 'DPS individual enrollment',
          CString: 'IoT Hub device connection string',
        },
        ConnectionInfo: 'Connection info',
      },
      KeyTypes: {
        Label: 'Authentication',
        Group: 'LEGACY group key',
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
        Simulated:
          'Property "{{0}}" was simulated locally. Nothing was sent to the cloud.',
        Success:
          'Property "{{0}}" was submitted to the device transport. Cloud receipt has not been independently checked.',
        Failure: 'Failed to send property "{{0}}" to Azure IoT.',
      },
      Loading: 'Waiting for properties...',
      Presentation: {
        CloudName: 'Cloud property',
        DeviceName: 'Device property',
        CloudEmpty: 'Waiting for a cloud update',
        CloudDescription: 'Values set in your IoT application appear here.',
        Placeholder: 'Enter a value to share',
        Submit: 'Submit value',
        DeviceDescription: 'Edit on this device and submit to the cloud.',
        NotReported: 'Not reported by this device',
      },
    },
    Commands: {
      Alert: {
        Title: 'Command received',
        Message:
          'The device received command "{{0}}" from Azure IoT. Starting execution now.',
      },
    },
  },
  FileUpload: {
    Title: 'Upload a photo',
    Description: 'Choose an image from your library or take a photo.',
    Start: 'Select an image to upload to Azure Storage',
    Footer:
      "You'll need to configure file upload in your IoT solution before using this feature. ",
    LearnMore: {
      Title: 'Learn more',
      Url: 'https://aka.ms/iot-paad-fileupload',
    },
    NotAvailable: 'File upload is not available.',
    Reconnect: 'Reconnect in Connection details before selecting an image.',
    Uploaded: 'Successfully uploaded {{0}}',
    UploadFailed: 'Failed to upload {{0}}',
    Modes: {
      Library: 'Take from image gallery',
      Camera: 'Capture photo with camera',
    },
  },
  LogScreen: {
    Title: 'Activity log',
    Header: 'Connection, uploads and device events, in one place.',
    All: 'All events',
    Issues: 'Warnings & errors',
    Count: '{{0}} events',
    Latest: 'Jump to latest',
    Empty: 'No activity yet',
    EmptyDetail: 'Events will appear here as you use your device.',
    NoIssues: 'No warning or error events',
    NoIssuesDetail: 'Choose All events to see the rest of this session.',
    Details: 'View details',
    HideDetails: 'Hide details',
    Levels: {info: 'Info', warning: 'Warning', error: 'Error'},
  },
  Bluetooth: {
    Title: 'Nearby devices',
    Description: 'Discover Bluetooth devices around your phone.',
    Refresh: 'Scan again',
    Scanning: 'Looking for devices',
    ScanningDetail: 'Keep a supported Bluetooth device nearby and powered on.',
    Observing: 'Listening for advertisements',
    Empty: 'No devices yet',
    Waiting: 'Waiting for this device',
    NoReadings: 'No readings yet',
    WaitingDetail:
      'Keep this device nearby and powered on. Readings appear when it advertises.',
    Unavailable: 'Bluetooth unavailable',
    UnavailableDetail:
      'Enable Bluetooth and allow Nearby Devices access in Settings.',
    SignalUnavailable: 'Signal unavailable',
  },
  Simulation: {
    Enabled: 'Simulation mode is enabled.',
    Disable:
      'Disable simulation mode and connect to Azure IoT to work with file uploads.',
  },
  Sensors: {
    Unavailable: 'Unavailable — check hardware and permissions',
    Checking: 'Waiting for sensor',
    Simulated: 'Simulated data',
    Disabled: 'Disabled',
    Retry: 'Retry sensor',
  },
  Update: {
    Mandatory: {
      Title: 'Update Required',
      Text: 'An update to {{0}} is required to continue',
      Confirm: 'Update',
    },
    Optional: {
      Title: 'Update Available',
      Text: 'An update to {{0}} is available. Would you like to update?',
      Confirm: 'Update',
      Cancel: 'Not now',
      Skip: 'Skip this version',
    },
  },
};

export function resolveString(data: string, ...values: string[]) {
  values.forEach(val => (data = data.replace(/\{\{[\S]\}\}/, val)));
  return data;
}

export default Strings;
