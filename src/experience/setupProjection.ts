import {
  parseConnectionString,
  validateDeviceId,
  validateHost,
} from '../connection/credentials';
import {ConnectionError} from '../connection/errors';
import {DeviceCredentials, DeviceIdentity} from '../connection/types';

export type SetupProjection = Readonly<{
  mode: 'dps' | 'hub' | 'unconfigured';
  credentialKind: 'device' | 'group' | 'connectionString';
  credentialPresent: boolean;
  provisioningHost?: string;
  scopeId?: string;
  registrationId?: string;
  configuredHub?: string;
  configuredDeviceId?: string;
  assignment: Readonly<{
    hub: string;
    deviceId: string;
    source: 'dps' | 'setup';
  }> | null;
  invalidSetup: boolean;
  invalidIdentity: boolean;
}>;

/** Keep credentials at the context boundary; only these nonsecret fields reach views. */
export function projectSetup(
  credentials: DeviceCredentials | null,
  identity: DeviceIdentity | null,
  simulated: boolean,
): SetupProjection {
  const mode = !credentials
    ? 'unconfigured'
    : credentials.connectionString !== undefined
    ? 'hub'
    : 'dps';
  const credentialKind =
    mode === 'hub'
      ? 'connectionString'
      : credentials?.keyType === 'group'
      ? 'group'
      : 'device';
  const base: SetupProjection = {
    mode,
    credentialKind,
    credentialPresent: Boolean(
      credentialKind === 'connectionString'
        ? credentials?.connectionString
        : credentialKind === 'group'
        ? credentials?.authKey
        : credentials?.deviceKey || credentials?.authKey,
    ),
    assignment: null,
    invalidSetup: false,
    invalidIdentity: false,
  };
  let setup = base;
  if (credentials) {
    try {
      if (credentials.connectionString !== undefined) {
        // Reuse the strict device-only parser, but never return its key.
        const parsed = parseConnectionString(credentials.connectionString);
        setup = {
          ...base,
          configuredHub: parsed.assignedHub,
          configuredDeviceId: parsed.deviceId,
        };
      } else {
        const provisioningHost =
          credentials.provisioningHost === undefined
            ? undefined
            : validateHost(credentials.provisioningHost, 'dps');
        const registrationId = validateDeviceId(
          credentials.registrationId ?? credentials.deviceId,
          true,
        );
        if (
          !credentials.scopeId ||
          !/^[A-Za-z0-9]{1,64}$/.test(credentials.scopeId)
        ) {
          throw new ConnectionError('INVALID_CREDENTIALS');
        }
        setup = {
          ...base,
          provisioningHost,
          registrationId,
          scopeId: credentials.scopeId,
        };
      }
    } catch (error) {
      if (!(error instanceof ConnectionError)) throw error;
      setup = {...base, invalidSetup: true};
    }
  }
  if (identity && !simulated) {
    try {
      return {
        ...setup,
        assignment: {
          hub: validateHost(identity.assignedHub, 'hub'),
          deviceId: validateDeviceId(identity.deviceId),
          source: mode === 'dps' ? 'dps' : 'setup',
        },
      };
    } catch (error) {
      if (!(error instanceof ConnectionError)) throw error;
      return {...setup, invalidIdentity: true};
    }
  }
  return setup;
}
