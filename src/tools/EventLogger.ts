import {EventEmitter} from 'events';
import {IIoTCLogger, IOTC_LOGGING} from 'react-native-azure-iotcentral-client';

export default class EventLogger extends EventEmitter implements IIoTCLogger {
  constructor(
    private eventName: string,
    private logLevel: IOTC_LOGGING = IOTC_LOGGING.API_ONLY,
  ) {
    super();
  }

  setLogLevel(logLevel: string | IOTC_LOGGING) {
    if (typeof logLevel === 'string') {
      this.logLevel =
        IOTC_LOGGING[logLevel.toUpperCase() as keyof typeof IOTC_LOGGING];
      if (!this.logLevel) {
        console.error(
          `LoggingLevel ${logLevel} is unsupported.\nSupported levels: ${Object.keys(
            IOTC_LOGGING,
          ).join(',')}`,
        );
        throw new Error();
      }
    } else {
      this.logLevel = logLevel;
    }
  }

  async debug(message: string, tag?: string) {
    if (this.logLevel === IOTC_LOGGING.ALL) {
      this.emit(this.eventName, {
        eventName: `[IOTC_CLIENT] - (DEBUG)${
          tag ? ` - ${tag.toUpperCase()}` : ''
        }`,
        eventData: message,
      });
    }
  }
  async log(message: string, tag?: string) {
    if (this.logLevel !== IOTC_LOGGING.DISABLED)
      this.emit(this.eventName, {
        eventName: `[IOTC_CLIENT] - (INFO)${
          tag ? ` - ${tag.toUpperCase()}` : ''
        }`,
        eventData: message,
      });
  }
}
