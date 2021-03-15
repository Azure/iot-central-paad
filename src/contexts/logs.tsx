import React, {useCallback, useState} from 'react';
import {LogItem, TimedLog} from '../types';

interface ILogsContext {
  logs: TimedLog;
  append: (logItem: LogItem) => void;
  clear: () => void;
}

const initialState: TimedLog = [];
const LogsContext = React.createContext({} as ILogsContext);
const {Provider} = LogsContext;

const LogsProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [logs, setLogs] = useState<TimedLog>(initialState);
  const append = useCallback(
    (logItem: LogItem) => {
      setLogs(current => [
        ...current,
        {logItem, timestamp: new Date(Date.now()).toLocaleString()},
      ]);
    },
    [setLogs],
  );
  const clear = useCallback(() => {
    setLogs([
      {
        logItem: {
          eventData: 'Application just reset',
          eventName: 'INFO',
        },
        timestamp: new Date(Date.now()).toLocaleString(),
      },
    ]);
  }, [setLogs]);

  return <Provider value={{logs, append, clear}}>{children}</Provider>;
};

export {LogsProvider as default, LogsContext};
