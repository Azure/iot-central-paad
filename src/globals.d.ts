// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

declare module '*.svg' {
  import {SvgProps} from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
