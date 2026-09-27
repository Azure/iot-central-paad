export type ConnectionErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'UNSAFE_ENDPOINT'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'PROVISIONING_FAILED'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'CONNECT_FAILED'
  | 'CONNECTION_LOST'
  | 'SECURE_TRANSPORT_REQUIRED'
  | 'NOT_CONNECTED'
  | 'OPERATION_FAILED'
  | 'STORAGE_FAILED'
  | 'BUSY';

const messages: Record<ConnectionErrorCode, string> = {
  INVALID_CREDENTIALS: 'Device credentials are invalid or unsupported.',
  UNSAFE_ENDPOINT: 'The endpoint is not an approved Azure endpoint.',
  CANCELLED: 'Connection cancelled.',
  TIMEOUT: 'The operation deadline was exceeded.',
  AUTHENTICATION_FAILED: 'Azure rejected device authentication.',
  PROVISIONING_FAILED: 'Device provisioning failed.',
  INVALID_RESPONSE: 'Azure returned an invalid protocol response.',
  NETWORK_ERROR: 'The secure network request failed.',
  CONNECT_FAILED: 'The device transport could not connect.',
  CONNECTION_LOST: 'The cloud connection was interrupted.',
  SECURE_TRANSPORT_REQUIRED:
    'A WebSocket implementation that rejects redirects is required.',
  NOT_CONNECTED: 'The device is not connected.',
  OPERATION_FAILED: 'The device operation failed.',
  STORAGE_FAILED: 'Device settings could not be saved securely.',
  BUSY: 'A connection attempt is already in progress.',
};

/** Intentionally contains no raw error, response body, credential, or cause. */
export class ConnectionError extends Error {
  readonly code: ConnectionErrorCode;
  readonly status?: number;
  readonly serviceCode?: number;
  readonly operationId?: string;

  constructor(
    code: ConnectionErrorCode,
    details: {
      status?: unknown;
      serviceCode?: unknown;
      operationId?: unknown;
    } = {},
  ) {
    super(messages[code]);
    this.name = 'ConnectionError';
    this.code = code;
    this.status = safeNumber(details.status);
    this.serviceCode = safeNumber(details.serviceCode);
    this.operationId = safeOperationId(details.operationId);
  }
}

export function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}
export function safeOperationId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9:._-]{1,256}$/.test(value)
    ? value
    : undefined;
}
export function safeError(
  error: unknown,
  fallback: ConnectionErrorCode = 'OPERATION_FAILED',
): ConnectionError {
  return error instanceof ConnectionError
    ? error
    : new ConnectionError(fallback);
}

export function reportDiagnostic(error: unknown): void {
  const safe = safeError(error);
  console.warn(
    'Device operation failed',
    safe.code,
    safe.status,
    safe.serviceCode,
  );
}
