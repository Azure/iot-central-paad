export const PHONE_MODEL_ID = 'dtmi:azureiot:PhoneAsADevice;2';

export type DeviceCredentials = {
  connectionString?: string;
  deviceId?: string;
  registrationId?: string;
  scopeId?: string;
  deviceKey?: string;
  authKey?: string;
  keyType?: 'device' | 'group';
  modelId?: string;
  provisioningHost?: string;
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {[key: string]: JsonValue};
export type JsonObject = {[key: string]: JsonValue};
export type ConnectionStage =
  | 'validating'
  | 'provisioning'
  | 'connecting'
  | 'connected'
  | 'error';
export type ConnectionSessionStage = ConnectionStage | 'idle' | 'disconnected';
export type DeviceIdentity = Readonly<{
  assignedHub: string;
  deviceId: string;
  registrationId?: string;
  operationId?: string;
  modelId: string;
}>;

/** Legacy MQTT publishes resolve on local submission, not a broker/cloud ACK. */
export type SubmissionResult = {delivery: 'submitted' | 'simulated'};
export type FileUploadResult = {status: number; delivery: 'acknowledged'};
export enum IOTC_EVENTS {
  Properties = 1,
  Commands = 2,
}
export enum IIoTCCommandResponse {
  SUCCESS,
  ERROR,
}
export interface IIoTCCommand {
  name: string;
  requestPayload: string;
  requestId?: string;
  reply(
    status: IIoTCCommandResponse,
    message: string,
  ): Promise<SubmissionResult>;
}
export interface IIoTCProperty {
  name: string;
  value: JsonValue;
  version: number;
  source?: 'twin' | 'patch';
  ack(message?: string): Promise<SubmissionResult>;
}
export type CommandCallback = (command: IIoTCCommand) => void | Promise<void>;
export type PropertyCallback = (
  property: IIoTCProperty,
) => void | Promise<void>;
export type ConnectOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  cleanSession?: boolean;
};
export interface DeviceClient {
  /** Registration ID until provisioned, actual assigned device ID thereafter. */
  readonly id: string;
  readonly identity: DeviceIdentity | null;
  isConnected(): boolean;
  connect(options?: ConnectOptions): Promise<DeviceIdentity>;
  cancel(): void;
  disconnect(): Promise<void>;
  sendTelemetry(
    payload: JsonValue,
    properties?: Record<string, string>,
  ): Promise<SubmissionResult>;
  sendProperty(payload: JsonObject): Promise<SubmissionResult>;
  fetchTwin(): Promise<SubmissionResult>;
  uploadFile(
    fileName: string,
    contentType: string,
    fileData: string | Uint8Array,
    encoding?: 'base64',
  ): Promise<FileUploadResult>;
  on(event: IOTC_EVENTS.Commands | 'Commands', cb: CommandCallback): () => void;
  on(
    event: IOTC_EVENTS.Properties | 'Properties',
    cb: PropertyCallback,
  ): () => void;
}
export type IIoTCClient = DeviceClient;
export type IoTCCredentials = DeviceCredentials;

export type HttpRequest = {
  method: 'PUT' | 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string | Uint8Array;
  signal: AbortSignal;
  redirect: 'error';
};
export type HttpResponse = {
  status: number;
  headers: {get(name: string): string | null};
  redirected?: boolean;
  url?: string;
  json(): Promise<unknown>;
};
/** Inject only an HTTP implementation which refuses redirects before following. */
export type HttpTransport = (
  url: string,
  request: HttpRequest,
) => Promise<HttpResponse>;

export type ClientOptions = {
  encryptionKey?: string;
  timeoutMs?: number;
  onStage?: (
    stage: ConnectionStage,
    error?: import('./errors').ConnectionError,
  ) => void;
  http?: HttpTransport;
  /** A native WebSocket implementation configured to reject HTTP redirects. */
  secureWebSocket?: {implementation: typeof WebSocket; rejectsRedirects: true};
};
