const ToolStrings = {
  Explore: {
    Title: 'Explore',
    Description: 'Tools for this phone and your cloud solution.',
    Telemetry: 'Telemetry',
    TelemetryDetail: 'Inspect sensor readings, charts and the location map.',
    Properties: 'Properties',
    PropertiesDetail:
      'Share a phone value and inspect cloud requests and device information.',
    Image: 'Image upload',
    ImageDetail: 'Select an image to start uploading it to storage.',
    Bluetooth: 'Bluetooth',
    BluetoothDetail:
      'Observe nearby Bluetooth advertisements with supported decoders.',
    Availability:
      'Open any tool to inspect its state. Hardware, permissions or a cloud connection may be required.',
  },
  Sensors: {
    Enabled: 'Enabled',
    Availability: 'Availability',
    LastAvailability: 'Last checked availability',
    Available: 'Available',
    Checking: 'Checking',
    Unavailable: 'Unavailable',
    NotChecked: 'Not checked',
    UnavailableDetail:
      'This source is unavailable. The app has not determined the cause.',
    Reading: 'Reading',
    Paused: 'Paused while disabled',
    NoReading: 'No reading observed yet',
    ReadingUnavailable: 'No current reading',
    LocalReading: 'Observed by this phone',
    SimulatedReading: 'Simulated reading',
    Shortcut: 'Long press for sensor controls.',
  },
  Properties: {
    Phone: 'Phone-reported sample',
    PhoneDetail:
      'Edit on this phone, then submit the value. Read-only to the cloud.',
    Cloud: 'Cloud-requested value',
    CloudDetail:
      'Requested by your IoT application. This phone displays the received value.',
    Device: 'Device information',
    DeviceDetail: 'Read-only information reported by this phone.',
    TechnicalShow: 'Show technical name',
    TechnicalHide: 'Hide technical name',
    SystemVersion: 'OS system version',
    SystemVersionDetail: 'Operating system version, not the app build.',
    StorageDetail: 'Total storage capacity, not free or used storage.',
    MemoryDetail: 'Total memory capacity, not free or used memory.',
  },
};

export default ToolStrings;
