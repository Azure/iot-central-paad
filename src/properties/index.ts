// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {ItemProps} from 'types';
import Strings from 'strings';
import ToolStrings from '../experience/toolStrings';
import {AVAILABLE_PROPERTIES} from './internal';

export const PROPERTY_CHANGED = 'PROPERTY_CHANGED';
type PropertyProps = {editable: boolean} & ItemProps;
const text = Strings.Client.Properties.Presentation;

export const Properties: PropertyProps[] = [
  {
    id: AVAILABLE_PROPERTIES.WRITEABLE_PROP,
    name: text.CloudName,
    editable: false,
    icon: {name: 'cloud-outline', type: 'material-community'},
    presentation: {
      emptyLabel: text.CloudEmpty,
      description: text.CloudDescription,
    },
  },
  {
    id: AVAILABLE_PROPERTIES.READONLY_PROP,
    name: text.DeviceName,
    editable: true,
    icon: {name: 'pencil-outline', type: 'material-community'},
    presentation: {
      placeholder: text.Placeholder,
      actionLabel: text.Submit,
      description: text.DeviceDescription,
    },
  },
  {
    id: AVAILABLE_PROPERTIES.MANUFACTURER,
    name: 'Manufacturer',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.MODEL,
    name: 'Device model',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.SW_VERSION,
    name: ToolStrings.Properties.SystemVersion,
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.OS_NAME,
    name: 'Operating system',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.PROCESSOR_ARCHITECTURE,
    name: 'Processor architecture',
    editable: false,
  },
  {
    id: AVAILABLE_PROPERTIES.PROCESSOR_MANUFACTURER,
    name: 'Processor manufacturer',
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
  presentation: {
    emptyLabel: text.NotReported,
    ...p.presentation,
  },
  enable: () => {},
  sendInterval: () => {},
  enabled: true,
  simulated: false,
}));

export * from './deviceInfo';
