import React, {useState} from 'react';
import {LogItem, TimedLog} from '../types';

interface ILogsContext {
  logs: TimedLog;
  append: (logItem: LogItem) => void;
  clear: () => void;
}

const initialState: TimedLog = [];
let LogsContext: React.Context<ILogsContext>;

const LogsProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [logs, setLogs] = useState<TimedLog>(initialState);
  const contextObj = {
    logs,
    append: (logItem: LogItem) => {
      setLogs((current) => [
        ...current,
        {logItem, timestamp: new Date(Date.now()).toLocaleString()},
      ]);
    },
    clear: () => {
      setLogs([
        {
          logItem: {
            eventData: 'Application just reset',
            eventName: 'INFO',
          },
          timestamp: new Date(Date.now()).toLocaleString(),
        },
      ]);
    },
  };
  LogsContext = React.createContext<ILogsContext>(contextObj);
  const {Provider} = LogsContext;
  return <Provider value={contextObj}>{children}</Provider>;
};

export {LogsProvider as default, LogsContext};
