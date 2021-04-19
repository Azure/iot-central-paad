export type PropertiesProps = {
  id: string;
  name: string;
  editable: boolean;
  value?: any;
};

export const AVAILABLE_PROPERTIES = {
  WRITEABLE_PROP: 'writeableProp',
  READONLY_PROP: 'readOnlyProp',
  MANUFACTURER: 'manufacturer',
  MODEL: 'model',
  SW_VERSION: 'swVersion',
  OS_NAME: 'osName',
  // PROCESSOR_ARCHITECTURE: 'processorArchitecture',
  // PROCESSOR_MANUFACTURER: 'processorManufacturer',
  TOTAL_STORAGE: 'totalStorage',
  TOTAL_MEMORY: 'totalMemory',
};

export type PropertyNames = typeof AVAILABLE_PROPERTIES[keyof typeof AVAILABLE_PROPERTIES];
