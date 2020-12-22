import {IIoTCLogger, IOTC_LOGGING} from 'react-native-azure-iotcentral-client';

export default class WebhookLogger implements IIoTCLogger {
  constructor(
    private url: string,
    private logLevel: IOTC_LOGGING = IOTC_LOGGING.API_ONLY,
  ) {}

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
      await fetch(this.url, {
        method: 'POST',
        body: `DEBUG${tag ? ` - ${tag.toUpperCase()}` : ''}: ${message}`,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
  }
  async log(message: string, tag?: string) {
    if (this.logLevel !== IOTC_LOGGING.DISABLED)
      await fetch(this.url, {
        method: 'POST',
        body: `INFO${tag ? ` - ${tag.toUpperCase()}` : ''}: ${message}`,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
  }
}
