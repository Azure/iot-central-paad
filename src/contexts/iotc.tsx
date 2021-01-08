import React, {useState} from 'react';
import {IoTCClient} from 'react-native-azure-iotcentral-client';

type ICentralState = {
  client: IoTCClient | null;
};

export type IIoTCContext = ICentralState & {
  setClient: (client: IoTCClient | null) => void;
};

let IoTCContext: React.Context<IIoTCContext>;

const IoTCProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [client, setClient] = useState<IoTCClient | null>(null);
  const contextObj = React.useMemo(
    () => ({
      client,
      setClient,
    }),
    [client],
  );
  IoTCContext = React.createContext<IIoTCContext>(contextObj);
  const {Provider} = IoTCContext;
  return <Provider value={contextObj}>{children}</Provider>;
};

export {IoTCProvider as default, IoTCContext};
