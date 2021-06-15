// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {ItemProps} from 'types';
import {AVAILABLE_PROPERTIES} from './internal';

export const PROPERTY_CHANGED = 'PROPERTY_CHANGED';
type PropertyProps = {editable: boolean} & ItemProps;

export const Properties: PropertyProps[] = [
  {
    id: AVAILABLE_PROPERTIES.WRITEABLE_PROP,
    name: 'Cloud property',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.READONLY_PROP,
    name: 'Editable property',
    value: 'editable',
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
    name: 'Software version',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.OS_NAME,
    name: 'Operating system',
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
    name: 'Total storage',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.TOTAL_MEMORY,
    name: 'Total memory',
    editable: false,
  },
].map(p => ({
  ...p,
  enable: () => {},
  sendInterval: () => {},
  enabled: true,
  simulated: false,
}));

export * from './deviceInfo';
