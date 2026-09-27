import {Buffer} from 'buffer';
import {
  computeKey as vendorComputeKey,
  DecryptCredentials as vendorDecrypt,
} from 'react-native-azure-iotcentral-client';
import {ConnectionError} from './errors';
import {DeviceCredentials, PHONE_MODEL_ID} from './types';

export type CredentialQrV1 = {
  schema: 'paad.connection';
  version: 1;
} & (
  | {
      mode: 'dps';
      credentials: {
        registrationId: string;
        scopeId: string;
        deviceKey: string;
        provisioningHost?: string;
      };
    }
  | {mode: 'hub'; credentials: {connectionString: string}}
);

const fields = new Set([
  'connectionString',
  'deviceId',
  'registrationId',
  'scopeId',
  'deviceKey',
  'authKey',
  'keyType',
  'modelId',
  'provisioningHost',
]);
const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const hubPattern = new RegExp(
  `^${label}\\.(?:device\\.)?azure-devices\\.(?:net|cn|us)$`,
);
const blobPattern = new RegExp(
  `^${label}\\.blob\\.(?:core\\.windows\\.net|core\\.usgovcloudapi\\.net|core\\.chinacloudapi\\.cn)$`,
);
const dpsHosts = new Set([
  'global.azure-devices-provisioning.net',
  'global-canary.azure-devices-provisioning.net',
  'global.azure-devices-provisioning.cn',
  'global.azure-devices-provisioning.us',
]);

export function validateHost(
  value: unknown,
  kind: 'hub' | 'dps' | 'blob',
): string {
  if (typeof value !== 'string' || value.length > 253) {
    throw new ConnectionError('UNSAFE_ENDPOINT');
  }
  const host = value.toLowerCase();
  if (
    !(kind === 'hub'
      ? hubPattern.test(host)
      : kind === 'blob'
      ? blobPattern.test(host)
      : dpsHosts.has(host))
  ) {
    throw new ConnectionError('UNSAFE_ENDPOINT');
  }
  return host;
}

export function record(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new ConnectionError('INVALID_RESPONSE');
  }
  if (
    Object.values(Object.getOwnPropertyDescriptors(value)).some(
      d => d.get || d.set,
    )
  ) {
    throw new ConnectionError('INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
}

export function validateDeviceId(value: unknown, registration = false): string {
  const pattern = registration
    ? /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/
    : /^[A-Za-z0-9._:-]{1,128}$/;
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  return value;
}

function validateKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 512 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    ) ||
    Buffer.from(value, 'base64').length < 16 ||
    Buffer.from(value, 'base64').toString('base64') !== value
  ) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  return value;
}

/** Compatible HMAC derivation, using only the declared vendor export. */
export function computeKey(key: string, data: string): string {
  validateKey(key);
  if (typeof data !== 'string' || data.length > 4096) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  try {
    return vendorComputeKey(key, data);
  } catch {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
}

export function parseConnectionString(value: string): {
  assignedHub: string;
  deviceId: string;
  deviceKey: string;
} {
  const parts: Record<string, string> = Object.create(null);
  for (const field of value.split(';')) {
    const split = field.indexOf('=');
    const name = field.slice(0, split);
    if (
      split < 1 ||
      !['HostName', 'DeviceId', 'SharedAccessKey'].includes(name) ||
      parts[name] !== undefined
    ) {
      throw new ConnectionError('INVALID_CREDENTIALS');
    }
    parts[name] = field.slice(split + 1);
  }
  return {
    assignedHub: validateHost(parts.HostName, 'hub'),
    deviceId: validateDeviceId(parts.DeviceId),
    deviceKey: validateKey(parts.SharedAccessKey),
  };
}

export function validateCredentials(input: unknown): DeviceCredentials {
  try {
    const data = record(input);
    if (Object.keys(data).some(k => !fields.has(k))) {
      throw new ConnectionError('INVALID_CREDENTIALS');
    }
    for (const value of Object.values(data)) {
      if (typeof value !== 'string' || !value.length || value.length > 8192) {
        throw new ConnectionError('INVALID_CREDENTIALS');
      }
    }
    const credentials = {...data} as DeviceCredentials;
    credentials.modelId ??= PHONE_MODEL_ID;
    if (
      !/^dtmi:[A-Za-z][A-Za-z0-9_]*(?::[A-Za-z][A-Za-z0-9_]*)*;[1-9][0-9]{0,8}$/.test(
        credentials.modelId,
      ) ||
      credentials.modelId.length > 512 ||
      (credentials.keyType !== undefined &&
        !['device', 'group'].includes(credentials.keyType))
    ) {
      throw new ConnectionError('INVALID_CREDENTIALS');
    }
    if (credentials.connectionString) {
      const direct = parseConnectionString(credentials.connectionString);
      if (
        credentials.scopeId ||
        credentials.provisioningHost ||
        credentials.deviceKey ||
        credentials.authKey ||
        credentials.keyType ||
        credentials.registrationId ||
        (credentials.deviceId && credentials.deviceId !== direct.deviceId)
      ) {
        throw new ConnectionError('INVALID_CREDENTIALS');
      }
      credentials.deviceId = direct.deviceId;
    } else {
      const registrationId = validateDeviceId(
        credentials.registrationId ?? credentials.deviceId,
        true,
      );
      if (
        credentials.deviceId &&
        credentials.registrationId &&
        credentials.deviceId !== credentials.registrationId
      ) {
        throw new ConnectionError('INVALID_CREDENTIALS');
      }
      if (
        !credentials.scopeId ||
        !/^[A-Za-z0-9]{1,64}$/.test(credentials.scopeId)
      ) {
        throw new ConnectionError('INVALID_CREDENTIALS');
      }
      credentials.registrationId = registrationId;
      credentials.deviceId = registrationId;
      credentials.keyType ??= 'device';
      if (credentials.authKey) {
        validateKey(credentials.authKey);
      }
      if (credentials.deviceKey) {
        validateKey(credentials.deviceKey);
      }
      const derived = credentials.authKey
        ? credentials.keyType === 'group'
          ? computeKey(credentials.authKey, registrationId)
          : credentials.authKey
        : undefined;
      if (
        (derived &&
          credentials.deviceKey &&
          derived !== credentials.deviceKey) ||
        (!derived && !credentials.deviceKey) ||
        (credentials.keyType === 'group' && !credentials.authKey)
      ) {
        throw new ConnectionError('INVALID_CREDENTIALS');
      }
      credentials.deviceKey = credentials.deviceKey ?? derived;
      credentials.provisioningHost = validateHost(
        credentials.provisioningHost ?? 'global.azure-devices-provisioning.net',
        'dps',
      );
    }
    return credentials;
  } catch (error) {
    if (error instanceof ConnectionError && error.code === 'UNSAFE_ENDPOINT') {
      throw error;
    }
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
}

/** Accept restored objects, direct strings, JSON, and legacy base64/encrypted QR. */
export function decodeCredentials(
  input: unknown,
  encryptionKey?: string,
): DeviceCredentials {
  if (typeof input !== 'string') {
    return validateCredentials(unwrapQr(input));
  }
  if (
    !input.length ||
    input.length > 16384 ||
    (encryptionKey !== undefined &&
      (typeof encryptionKey !== 'string' ||
        !encryptionKey.length ||
        encryptionKey.length > 1024))
  ) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  let decoded: unknown;
  try {
    if (input.startsWith('HostName=')) {
      decoded = {connectionString: input};
    } else if (input.startsWith('{')) {
      decoded = JSON.parse(input);
    } else {
      if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          input,
        ) ||
        Buffer.from(input, 'base64').toString('base64') !== input
      ) {
        throw new ConnectionError('INVALID_CREDENTIALS');
      }
      decoded = vendorDecrypt(input, encryptionKey);
    }
  } catch {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  return validateCredentials(unwrapQr(decoded));
}

/** v1 deliberately distributes individual device keys, never group/admin keys. */
function unwrapQr(input: unknown): unknown {
  const data = record(input);
  if (!('schema' in data) && !('version' in data)) {
    return data;
  }
  if (
    data.schema !== 'paad.connection' ||
    data.version !== 1 ||
    Object.keys(data).some(
      key => !['schema', 'version', 'mode', 'credentials'].includes(key),
    )
  ) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  const credentials = record(data.credentials);
  const allowed =
    data.mode === 'dps'
      ? ['registrationId', 'scopeId', 'deviceKey', 'provisioningHost']
      : data.mode === 'hub'
      ? ['connectionString']
      : [];
  if (
    !allowed.length ||
    Object.keys(credentials).some(key => !allowed.includes(key)) ||
    (data.mode === 'dps' &&
      (!credentials.registrationId ||
        !credentials.scopeId ||
        !credentials.deviceKey)) ||
    (data.mode === 'hub' && !credentials.connectionString)
  ) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  return {...credentials, modelId: PHONE_MODEL_ID};
}
export const DecryptCredentials = decodeCredentials;
