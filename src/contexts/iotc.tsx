// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useCallback, useReducer} from 'react';
import {IIoTCClient} from 'react-native-azure-iotcentral-client';

type ICentralState = {
  client: IIoTCClient | null;
  connecting: boolean;
  registeringNew: boolean; // device is connected but user is registering a new one
};
type ICentralAction =
  | {type: 'UPDATE_CLIENT'; value: IIoTCClient | null}
  | {type: 'SET_CONNECTING'; value: boolean}
  | {type: 'SET_REGISTERING'; value: boolean};

export type IIoTCContext = ICentralState & {
  setClient: (client: IIoTCClient | null) => void;
  setConnecting: (connecting: boolean) => void;
  setRegisteringNew: (registeringNew: boolean) => void;
};

const IoTCContext = React.createContext({} as IIoTCContext);
const {Provider} = IoTCContext;

const IoTCProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, dispatch] = useReducer(
    (centralState: ICentralState, action: ICentralAction) => {
      switch (action.type) {
        case 'UPDATE_CLIENT':
          return {
            client: action.value,
            connecting: false,
            registeringNew: false,
          };
        case 'SET_CONNECTING':
          return {...centralState, connecting: action.value};
        case 'SET_REGISTERING':
          return {...centralState, registeringNew: action.value};
        default:
          return {...centralState};
      }
    },
    {client: null, connecting: false, registeringNew: false},
  );

  const setClient = useCallback((client: IIoTCClient | null) => {
    dispatch({type: 'UPDATE_CLIENT', value: client});
  }, []);
  const setConnecting = useCallback((value: boolean) => {
    dispatch({type: 'SET_CONNECTING', value});
  }, []);
  const setRegisteringNew = useCallback((value: boolean) => {
    dispatch({type: 'SET_REGISTERING', value});
  }, []);

  const value = {
    client: state.client,
    setClient,
    connecting: state.connecting,
    registeringNew: state.registeringNew,
    setConnecting,
    setRegisteringNew,
  };
  return <Provider value={value}>{children}</Provider>;
};

export {IoTCProvider as default, IoTCContext};
