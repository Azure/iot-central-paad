import React, {useReducer} from 'react';
import {IoTCClient} from 'react-native-azure-iotcentral-client';

type ICentralState = {
  client: IoTCClient | null;
  connecting: boolean;
};
type ICentralAction =
  | {type: 'UPDATE_CLIENT'; value: IoTCClient | null}
  | {type: 'SET_CONNECTING'; value: boolean};

export type IIoTCContext = ICentralState & {
  setClient: (client: IoTCClient | null) => void;
  setConnecting: (connecting: boolean) => void;
};

const IoTCContext = React.createContext({} as IIoTCContext);
const {Provider} = IoTCContext;

const IoTCProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [state, dispatch] = useReducer(
    (state: ICentralState, action: ICentralAction) => {
      switch (action.type) {
        case 'UPDATE_CLIENT':
          return {client: action.value, connecting: false};
        case 'SET_CONNECTING':
          return {...state, connecting: action.value};
        default:
          return {...state};
      }
    },
    {client: null, connecting: false},
  );

  const setClient = (client: IoTCClient | null) => {
    dispatch({type: 'UPDATE_CLIENT', value: client});
  };
  const setConnecting = (value: boolean) => {
    dispatch({type: 'SET_CONNECTING', value});
  };
  const value = {
    client: state.client,
    setClient,
    connecting: state.connecting,
    setConnecting,
  };
  return <Provider value={value}>{children}</Provider>;
};

export {IoTCProvider as default, IoTCContext};
