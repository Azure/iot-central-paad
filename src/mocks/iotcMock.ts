// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  CancellationToken,
  CommandCallback,
  FileUploadResult,
  HubCredentials,
  IIoTCClient,
  IIoTCLogger,
  IOTC_CONNECT,
  IOTC_EVENTS,
  IOTC_LOGGING,
  parseConnectionString,
  PropertyCallback,
  X509,
} from 'react-native-azure-iotcentral-client';
import {TimeOut} from 'tools';

export class IoTCMock implements IIoTCClient {
  private _connected: boolean;

  static getFromConnectionString(
    connectionString: string,
    logger: IIoTCLogger,
  ): IIoTCClient {
    const creds = parseConnectionString(connectionString);
    return new IoTCMock(
      creds.deviceId,
      '',
      IOTC_CONNECT.CONN_STRING,
      creds,
      logger,
    );
  }

  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly authenticationType: IOTC_CONNECT | string,
    readonly options: X509 | string | HubCredentials,
    readonly logger: IIoTCLogger,
  ) {
    this._connected = false;
  }

  setModelId(_modelId: string): void {
    //no-op
  }
  setGlobalEndpoint(_endpoint: string): void {
    //no-op
  }
  async disconnect(): Promise<void> {
    await TimeOut(5); // simualate delay
    this._connected = false;
  }
  async connect(_copts?: {
    cleanSession?: boolean | undefined;
    timeout?: number | undefined;
    cancellationToken?: CancellationToken | undefined;
  }): Promise<void> {
    await TimeOut(5); // simualate delay
    this._connected = true;
  }
  async sendTelemetry(payload: any, _properties?: any): Promise<void> {
    await TimeOut(1);
    this.logger.debug(`Sending telemetry ${JSON.stringify(payload)}`);
  }
  async sendProperty(payload: any): Promise<void> {
    await TimeOut(1);
    this.logger.debug(`Sending property ${JSON.stringify(payload)}`);
  }
  on(
    ..._args:
      | [eventName: string | IOTC_EVENTS.Properties, callback: PropertyCallback]
      | [eventName: string | IOTC_EVENTS.Commands, callback: CommandCallback]
  ) {
    //no-op
  }
  setLogging(logLevel: string | IOTC_LOGGING): void {
    this.logger.setLogLevel(logLevel);
  }
  isConnected(): boolean {
    return this._connected;
  }
  async fetchTwin(): Promise<void> {
    await TimeOut(2);
    this.logger.debug('Fetching twin.');
  }
  async uploadFile(
    _fileName: string,
    _contentType: string,
    _fileData: any,
    _encoding?: string,
  ): Promise<FileUploadResult> {
    return Promise.resolve({status: 200});
  }
}
