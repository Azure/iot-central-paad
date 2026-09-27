export type AzureActivityStatus =
  | 'Accepted'
  | 'Active'
  | 'Canceled'
  | 'Cancelled'
  | 'Failed'
  | 'In Progress'
  | 'Resolved'
  | 'Started'
  | 'Succeeded';

export interface AzureContextSnapshot {
  schema: 'paad.azure-context';
  version: 1;
  capturedAt: string;
  binding: {
    deviceId: string;
    assignedHub: string;
    registrationId?: string;
  };
  subscription: {
    id: string;
    name: string;
  };
  resourceGroup: {
    name: string;
  };
  namespace: {
    resourceId: string;
    name: string;
    location: string;
  };
  hub: {
    resourceId: string;
    name: string;
  };
  dps?: {
    resourceId: string;
    name: string;
  };
  registryDevice?: {
    resourceId: string;
    name: string;
    externalDeviceId: string;
  };
  activities: Array<{
    timestamp: string;
    operation: string;
    status: AzureActivityStatus;
    resourceId: string;
  }>;
}

const ERROR_MESSAGE = 'Invalid Azure context snapshot';
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_RESOURCE_ID_LENGTH = 2048;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESOURCE_GROUP = /^[A-Za-z0-9._()-]{1,90}$/;
const NAMESPACE_NAME = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;
const SERVICE_NAME = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;
const DEVICE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;
const REGISTRATION_ID = /^[a-z0-9](?:[a-z0-9._-]{0,127})$/;
const ARM_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._()~-]{0,127})$/;
const LOCATION = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const OPERATION = /^[A-Za-z0-9](?:[A-Za-z0-9._/:-]{0,255})$/;
const SENSITIVE_KEY =
  /(?:connectionstring|credential|devicekey|password|primarykey|privatekey|sastoken|secondarykey|secret|symmetrickey|token)/i;
const ACTIVITY_STATUSES = new Set<string>([
  'Accepted',
  'Active',
  'Canceled',
  'Cancelled',
  'Failed',
  'In Progress',
  'Resolved',
  'Started',
  'Succeeded',
]);

interface ArmResource {
  resourceId: string;
  subscriptionId: string;
  resourceGroup: string;
  provider: string;
  type: string;
  name: string;
  namespaceName?: string;
  childType?: string;
  childName?: string;
  descendant: boolean;
}

function fail(): never {
  throw new Error(ERROR_MESSAGE);
}

function utf8Length(value: string): number {
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      length += 1;
    } else if (code <= 0x7ff) {
      length += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) fail();
      length += 4;
      index += 1;
    } else {
      if (code >= 0xdc00 && code <= 0xdfff) fail();
      length += 3;
    }
    if (length > MAX_INPUT_BYTES) fail();
  }
  return length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function shape(
  value: unknown,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string> = [],
): Record<string, unknown> {
  if (!isRecord(value)) fail();
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (
    keys.some(key => {
      if (typeof key !== 'string' || !allowed.has(key)) return true;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      );
    }) ||
    required.some(key => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    fail();
  }
  return value;
}

function rejectSensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) rejectSensitiveKeys(item);
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEY.test(key)) fail();
    rejectSensitiveKeys(value[key]);
  }
}

function validUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff)
        return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function text(
  value: unknown,
  maximum: number,
  pattern?: RegExp,
  allowUnicode = false,
): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f\u2028\u2029]/.test(value) ||
    !validUnicode(value) ||
    (!allowUnicode && !/^[\x20-\x7e]+$/.test(value)) ||
    (pattern !== undefined && !pattern.test(value))
  ) {
    fail();
  }
  return value;
}

function timestamp(value: unknown): string {
  const result = text(value, 40);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(
      result,
    );
  if (!match) fail();
  const milliseconds = (match[7] ?? '').slice(0, 3).padEnd(3, '0');
  const date = new Date(`${result.slice(0, 19)}.${milliseconds}Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6])
  ) {
    fail();
  }
  return date.toISOString();
}

function azureDeviceHost(
  value: unknown,
  requireCanonical = true,
): {host: string; hubName: string} {
  const suppliedHost = text(value, 253);
  const host = suppliedHost.toLowerCase();
  if (requireCanonical && suppliedHost !== host) fail();
  const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
  const match = new RegExp(
    `^(${label})(?:\\.device)?\\.azure-devices\\.(?:net|cn|us)$`,
  ).exec(host);
  if (!match) fail();
  return {host, hubName: match[1]};
}

function parseArmResource(value: unknown): ArmResource {
  const resourceId = text(value, MAX_RESOURCE_ID_LENGTH);
  if (
    !resourceId.startsWith('/') ||
    resourceId.endsWith('/') ||
    resourceId.includes('//') ||
    /[\\?#%]/.test(resourceId)
  ) {
    fail();
  }
  const segments = resourceId.slice(1).split('/');
  if (
    segments.length < 8 ||
    segments[0].toLowerCase() !== 'subscriptions' ||
    !GUID.test(segments[1]) ||
    segments[2].toLowerCase() !== 'resourcegroups' ||
    !RESOURCE_GROUP.test(segments[3]) ||
    segments[4].toLowerCase() !== 'providers' ||
    !segments.slice(5).every(segment => ARM_SEGMENT.test(segment))
  ) {
    fail();
  }

  const provider = segments[5].toLowerCase();
  const type = segments[6].toLowerCase();
  const name = segments[7];
  let namespaceName: string | undefined;
  let childType: string | undefined;
  let childName: string | undefined;
  let descendant = false;
  if (provider === 'microsoft.deviceregistry' && type === 'namespaces') {
    if (!NAMESPACE_NAME.test(name) || segments.length % 2 !== 0) fail();
    descendant = segments.length > 8;
    namespaceName = name;
    childType = segments[8]?.toLowerCase();
    childName = segments[9];
  } else if (
    provider === 'microsoft.devices' &&
    (type === 'iothubs' || type === 'provisioningservices')
  ) {
    if (!SERVICE_NAME.test(name) || segments.length !== 8) fail();
  } else {
    fail();
  }

  return {
    resourceId,
    subscriptionId: segments[1],
    resourceGroup: segments[3],
    provider,
    type,
    name,
    namespaceName,
    childType,
    childName,
    descendant,
  };
}

function same(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function requireResource(
  value: unknown,
  provider: string,
  type: string,
  subscriptionId: string,
  resourceGroup: string,
  name: string,
): ArmResource {
  const resource = parseArmResource(value);
  if (
    resource.provider !== provider ||
    resource.type !== type ||
    resource.descendant ||
    !same(resource.subscriptionId, subscriptionId) ||
    !same(resource.resourceGroup, resourceGroup) ||
    !same(resource.name, name)
  ) {
    fail();
  }
  return resource;
}

function isActivityStatus(value: string): value is AzureActivityStatus {
  return ACTIVITY_STATUSES.has(value);
}

export function parseAzureContext(input: string): AzureContextSnapshot {
  try {
    if (typeof input !== 'string') fail();
    utf8Length(input);
    const source: unknown = JSON.parse(input);
    rejectSensitiveKeys(source);
    const root = shape(
      source,
      [
        'schema',
        'version',
        'capturedAt',
        'binding',
        'subscription',
        'resourceGroup',
        'namespace',
        'hub',
        'activities',
      ],
      ['dps', 'registryDevice'],
    );
    if (root.schema !== 'paad.azure-context' || root.version !== 1) fail();

    const bindingSource = shape(
      root.binding,
      ['deviceId', 'assignedHub'],
      ['registrationId'],
    );
    const deviceId = text(bindingSource.deviceId, 128, DEVICE_ID);
    const assignedHub = azureDeviceHost(bindingSource.assignedHub);
    const registrationId =
      bindingSource.registrationId === undefined
        ? undefined
        : text(bindingSource.registrationId, 128, REGISTRATION_ID);

    const subscriptionSource = shape(root.subscription, ['id', 'name']);
    const subscriptionId = text(subscriptionSource.id, 36, GUID).toLowerCase();
    const subscriptionName = text(
      subscriptionSource.name,
      256,
      undefined,
      true,
    );

    const resourceGroupSource = shape(root.resourceGroup, ['name']);
    const resourceGroupName = text(
      resourceGroupSource.name,
      90,
      RESOURCE_GROUP,
    );

    const namespaceSource = shape(root.namespace, [
      'resourceId',
      'name',
      'location',
    ]);
    const namespaceName = text(namespaceSource.name, 64, NAMESPACE_NAME);
    const namespaceResource = requireResource(
      namespaceSource.resourceId,
      'microsoft.deviceregistry',
      'namespaces',
      subscriptionId,
      resourceGroupName,
      namespaceName,
    );
    const location = text(namespaceSource.location, 64, LOCATION);

    const hubSource = shape(root.hub, ['resourceId', 'name']);
    const hubName = text(hubSource.name, 64, SERVICE_NAME);
    const hubResource = requireResource(
      hubSource.resourceId,
      'microsoft.devices',
      'iothubs',
      subscriptionId,
      resourceGroupName,
      hubName,
    );
    if (!same(hubName, assignedHub.hubName)) fail();

    let dps: AzureContextSnapshot['dps'];
    if (root.dps !== undefined) {
      const dpsSource = shape(root.dps, ['resourceId', 'name']);
      const dpsName = text(dpsSource.name, 64, SERVICE_NAME);
      const dpsResource = requireResource(
        dpsSource.resourceId,
        'microsoft.devices',
        'provisioningservices',
        subscriptionId,
        resourceGroupName,
        dpsName,
      );
      dps = {resourceId: dpsResource.resourceId, name: dpsName};
    }

    let registryDevice: AzureContextSnapshot['registryDevice'];
    if (root.registryDevice !== undefined) {
      const registrySource = shape(root.registryDevice, [
        'resourceId',
        'name',
        'externalDeviceId',
      ]);
      const registryName = text(registrySource.name, 128, ARM_SEGMENT);
      const externalDeviceId = text(
        registrySource.externalDeviceId,
        128,
        DEVICE_ID,
      );
      const registryResource = parseArmResource(registrySource.resourceId);
      if (
        registryResource.provider !== 'microsoft.deviceregistry' ||
        registryResource.type !== 'namespaces' ||
        !registryResource.descendant ||
        !same(registryResource.subscriptionId, subscriptionId) ||
        !same(registryResource.resourceGroup, resourceGroupName) ||
        !same(registryResource.namespaceName ?? '', namespaceName) ||
        registryResource.childType !== 'registrydevices' ||
        registryResource.childName === undefined ||
        !same(registryResource.childName, registryName) ||
        registryResource.resourceId.split('/').length !== 11 ||
        externalDeviceId !== deviceId
      ) {
        fail();
      }
      registryDevice = {
        resourceId: registryResource.resourceId,
        name: registryName,
        externalDeviceId,
      };
    }

    if (!Array.isArray(root.activities) || root.activities.length > 20) fail();
    const namespacePrefix = namespaceResource.resourceId.toLowerCase();
    const activities: AzureContextSnapshot['activities'] = [];
    for (const value of root.activities) {
      const activitySource = shape(value, [
        'timestamp',
        'operation',
        'status',
        'resourceId',
      ]);
      const status = text(activitySource.status, 32);
      if (!isActivityStatus(status)) fail();
      const activityResource = parseArmResource(activitySource.resourceId);
      const normalizedActivityId = activityResource.resourceId.toLowerCase();
      if (
        normalizedActivityId !== namespacePrefix &&
        !normalizedActivityId.startsWith(`${namespacePrefix}/`)
      ) {
        fail();
      }
      activities.push({
        timestamp: timestamp(activitySource.timestamp),
        operation: text(activitySource.operation, 256, OPERATION),
        status,
        resourceId: activityResource.resourceId,
      });
    }

    const result: AzureContextSnapshot = {
      schema: 'paad.azure-context',
      version: 1,
      capturedAt: timestamp(root.capturedAt),
      binding:
        registrationId === undefined
          ? {deviceId, assignedHub: assignedHub.host}
          : {deviceId, assignedHub: assignedHub.host, registrationId},
      subscription: {id: subscriptionId, name: subscriptionName},
      resourceGroup: {name: resourceGroupName},
      namespace: {
        resourceId: namespaceResource.resourceId,
        name: namespaceName,
        location,
      },
      hub: {resourceId: hubResource.resourceId, name: hubName},
      activities,
    };
    if (dps !== undefined) result.dps = dps;
    if (registryDevice !== undefined) result.registryDevice = registryDevice;
    return result;
  } catch {
    return fail();
  }
}

export function matchesAzureContext(
  snapshot: AzureContextSnapshot,
  identity: {deviceId: string; assignedHub: string; registrationId?: string},
): boolean {
  try {
    if (
      snapshot.binding.deviceId !== identity.deviceId ||
      snapshot.binding.assignedHub !==
        azureDeviceHost(identity.assignedHub, false).host
    ) {
      return false;
    }
    return (
      snapshot.binding.registrationId === undefined ||
      identity.registrationId === undefined ||
      snapshot.binding.registrationId === identity.registrationId
    );
  } catch {
    return false;
  }
}

export function azurePortalUrl(
  resourceId: string,
  assignedHub?: string,
): string {
  try {
    const host =
      assignedHub === undefined ? '' : azureDeviceHost(assignedHub, false).host;
    const portal = host.endsWith('.azure-devices.cn')
      ? 'portal.azure.cn'
      : host.endsWith('.azure-devices.us')
      ? 'portal.azure.us'
      : 'portal.azure.com';
    if (typeof resourceId !== 'string') fail();
    const scope = resourceId.split('/');
    if (
      scope[0] === '' &&
      scope[1]?.toLowerCase() === 'subscriptions' &&
      GUID.test(scope[2] ?? '') &&
      (scope.length === 3 ||
        (scope.length === 5 &&
          scope[3].toLowerCase() === 'resourcegroups' &&
          RESOURCE_GROUP.test(scope[4])))
    ) {
      return `https://${portal}/#resource${resourceId}/overview`;
    }
    const resource = parseArmResource(resourceId);
    return `https://${portal}/#resource${resource.resourceId}/overview`;
  } catch {
    return fail();
  }
}
