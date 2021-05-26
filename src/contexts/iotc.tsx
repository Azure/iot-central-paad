import React, {useCallback, useReducer} from 'react';
import {IIoTCClient} from 'react-native-azure-iotcentral-client';

type ICentralState = {
  client: IIoTCClient | null;
  connecting: boolean;
};
type ICentralAction =
  | {type: 'UPDATE_CLIENT'; value: IIoTCClient | null}
  | {type: 'SET_CONNECTING'; value: boolean};

export type IIoTCContext = ICentralState & {
  setClient: (client: IIoTCClient | null) => void;
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

  const setClient = useCallback((client: IIoTCClient | null) => {
    dispatch({type: 'UPDATE_CLIENT', value: client});
  }, []);
  const setConnecting = useCallback((value: boolean) => {
    dispatch({type: 'SET_CONNECTING', value});
  }, []);
  const value = {
    client: state.client,
    setClient,
    connecting: state.connecting,
    setConnecting,
  };
  return <Provider value={value}>{children}</Provider>;
};

export {IoTCProvider as default, IoTCContext};
