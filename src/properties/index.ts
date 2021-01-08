import {AVAILABLE_PROPERTIES, PropertiesProps} from './internal';

export const PROPERTY_CHANGED = 'PROPERTY_CHANGED';

export const Properties: PropertiesProps[] = [
  {
    id: AVAILABLE_PROPERTIES.WRITEABLE_PROP,
    name: 'WriteableProp',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.READONLY_PROP,
    name: 'ReadOnlyProp',
    value: 'readonly',
    editable: true,
  },
  {
    id: AVAILABLE_PROPERTIES.MANUFACTURER,
    name: 'Manufacturer',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.MODEL,
    name: 'Device Model',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.SW_VERSION,
    name: 'Software Version',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.OS_NAME,
    name: 'OS Name',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.PROCESSOR_ARCHITECTURE,
    name: 'Processor Architecture',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.PROCESSOR_MANUFACTURER,
    name: 'Processor Manufacturer',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.TOTAL_STORAGE,
    name: 'Total Storage',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.TOTAL_MEMORY,
    name: 'Total Memory',
    editable: false,
  },
];

export * from './deviceInfo';
