#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const {parseArgs} = require('node:util');
const {validateLiveConfig} = require('./live-config');
const {
  ProofError,
  azureReader,
  validateTargets,
  registryDevices,
} = require('./verify-mobile-proof');

class AzureContextExportError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function supportedNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major > 24 || (major === 24 && minor >= 19);
}

function schema() {
  return require('../../src/onboarding/azureContext.ts');
}

function exportFail(code) {
  throw new AzureContextExportError(code);
}

function plainObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    exportFail(code);
  return value;
}

function array(value, code) {
  if (!Array.isArray(value)) exportFail(code);
  return value;
}

function serviceName(host, kind) {
  const pattern =
    kind === 'hub'
      ? /^([a-z0-9-]+)(?:\.service)?\.azure-devices\.(?:net|cn|us)$/
      : /^([a-z0-9-]+)\.azure-devices-provisioning\.(?:net|cn|us)$/;
  const match = pattern.exec(host);
  if (!match) exportFail('INVALID_OPERATOR_TARGET');
  return match[1];
}

function exactLink(records, resourceId, address, code) {
  const matches = array(records, code).filter(
    record =>
      record &&
      typeof record === 'object' &&
      typeof record.resourceId === 'string' &&
      record.resourceId.toLowerCase() === resourceId.toLowerCase() &&
      (address === undefined || record.address === address),
  );
  if (matches.length !== 1 || typeof matches[0].resourceId !== 'string') {
    exportFail(code);
  }
  return matches[0].resourceId;
}

function collectAzureContext(
  config,
  platform,
  targets,
  read,
  now = () => new Date(),
) {
  const selected = config.cases[platform];
  const namespace = plainObject(
    read(
      [
        'iot',
        'adr',
        'ns',
        'show',
        '--namespace',
        targets.namespace,
        '--resource-group',
        targets.resourceGroup,
      ],
      '{resourceId:id,name:name,location:location}',
    ),
    'INVALID_NAMESPACE_RESPONSE',
  );
  const subscription = plainObject(
    read(['account', 'show'], '{id:id,name:name}'),
    'INVALID_SUBSCRIPTION_RESPONSE',
  );
  if (
    typeof subscription.id !== 'string' ||
    subscription.id.toLowerCase() !== targets.subscription.toLowerCase() ||
    typeof subscription.name !== 'string' ||
    typeof namespace.resourceId !== 'string' ||
    typeof namespace.name !== 'string' ||
    namespace.name.toLowerCase() !== targets.namespace.toLowerCase() ||
    typeof namespace.location !== 'string'
  ) {
    exportFail('AZURE_TARGET_MISMATCH');
  }

  const dpsLinks = read(
    [
      'iot',
      'adr',
      'ns',
      'link',
      'dps',
      'list',
      '--namespace',
      targets.namespace,
      '--resource-group',
      targets.resourceGroup,
    ],
    '[].{resourceId:resourceId,address:address}',
  );
  const hubLinks = read(
    [
      'iot',
      'adr',
      'ns',
      'link',
      'hub',
      'list',
      '--namespace',
      targets.namespace,
      '--resource-group',
      targets.resourceGroup,
    ],
    '[].{resourceId:resourceId,address:address}',
  );
  const dpsResourceId = exactLink(
    dpsLinks,
    `/subscriptions/${targets.subscription}/resourceGroups/${
      targets.resourceGroup
    }/providers/Microsoft.Devices/provisioningServices/${serviceName(
      targets.dpsServiceHost,
      'dps',
    )}`,
    undefined,
    'DPS_LINK_MISMATCH',
  );
  const hubResourceId = exactLink(
    hubLinks,
    `/subscriptions/${targets.subscription}/resourceGroups/${
      targets.resourceGroup
    }/providers/Microsoft.Devices/IotHubs/${serviceName(
      targets.hubServiceHost,
      'hub',
    )}`,
    targets.hubServiceHost,
    'HUB_LINK_MISMATCH',
  );

  const assignment = plainObject(
    read(
      [
        'iot',
        'dps',
        'enrollment',
        'registration',
        'show',
        '--dps-name',
        targets.dpsServiceHost,
        '--enrollment-id',
        selected.registrationId,
        '--auth-type',
        'login',
      ],
      '{registrationId:registrationId,deviceId:deviceId,assignedHub:assignedHub,status:status}',
    ),
    'INVALID_ASSIGNMENT_RESPONSE',
  );
  if (
    assignment.status !== 'assigned' ||
    assignment.registrationId !== selected.registrationId ||
    assignment.deviceId !== selected.expectedDeviceId ||
    assignment.assignedHub !== config.expectedHub
  ) {
    exportFail('ASSIGNMENT_MISMATCH');
  }

  const registryMatches = registryDevices(targets, read).filter(
    record =>
      record &&
      typeof record === 'object' &&
      record.externalDeviceId === selected.expectedDeviceId,
  );
  if (registryMatches.length > 1) exportFail('AMBIGUOUS_REGISTRY_EVIDENCE');

  const activities = array(
    read(
      [
        'monitor',
        'activity-log',
        'list',
        '--resource-id',
        namespace.resourceId,
        '--offset',
        '24h',
        '--max-events',
        '20',
      ],
      '[].{timestamp:eventTimestamp,operation:operationName.value,status:status.value,resourceId:resourceId}',
    ),
    'INVALID_ACTIVITY_RESPONSE',
  );
  const activitySnapshot = activities.map(activity => {
    const item = plainObject(activity, 'INVALID_ACTIVITY_RESPONSE');
    return {
      timestamp: item.timestamp,
      operation: item.operation,
      status: item.status,
      resourceId: item.resourceId,
    };
  });

  const snapshot = {
    schema: 'paad.azure-context',
    version: 1,
    capturedAt: now().toISOString(),
    binding: {
      deviceId: selected.expectedDeviceId,
      assignedHub: assignment.assignedHub,
      registrationId: selected.registrationId,
    },
    subscription: {id: subscription.id, name: subscription.name},
    resourceGroup: {name: targets.resourceGroup},
    namespace: {
      resourceId: namespace.resourceId,
      name: namespace.name,
      location: namespace.location,
    },
    hub: {
      resourceId: hubResourceId,
      name: serviceName(targets.hubServiceHost, 'hub'),
    },
    dps: {
      resourceId: dpsResourceId,
      name: serviceName(targets.dpsServiceHost, 'dps'),
    },
    activities: activitySnapshot,
  };
  if (registryMatches.length === 1) {
    snapshot.registryDevice = {
      resourceId: registryMatches[0].id,
      name: registryMatches[0].name,
      externalDeviceId: registryMatches[0].externalDeviceId,
    };
  }
  try {
    return schema().parseAzureContext(JSON.stringify(snapshot));
  } catch {
    return exportFail('INVALID_CONTEXT_SNAPSHOT');
  }
}

function ensureSafeEnvironment(environment) {
  if (
    environment.GITHUB_ACTIONS === 'true' ||
    ['MAESTRO_DEVICE_KEY', 'PAAD_LIVE_CONFIG'].some(key =>
      Object.prototype.hasOwnProperty.call(environment, key),
    )
  ) {
    exportFail('UNSAFE_EXECUTION_CONTEXT');
  }
}

function writeExclusive(out, snapshot, fileSystem = fs) {
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  try {
    fileSystem.writeFileSync(out, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    fileSystem.chmodSync(out, 0o600);
  } catch (error) {
    if (error && error.code === 'EEXIST') exportFail('OUTPUT_ALREADY_EXISTS');
    exportFail('OUTPUT_WRITE_FAILED');
  }
}

function parseInvocation(argv) {
  let values;
  try {
    ({values} = parseArgs({
      args: argv,
      strict: true,
      options: {
        config: {type: 'string'},
        platform: {type: 'string'},
        subscription: {type: 'string'},
        'resource-group': {type: 'string'},
        namespace: {type: 'string'},
        'dps-service-host': {type: 'string'},
        'hub-service-host': {type: 'string'},
        'registry-arm-endpoint': {type: 'string'},
        out: {type: 'string'},
        help: {type: 'boolean', default: false},
      },
    }));
  } catch {
    exportFail('INVALID_OPERATOR_INPUT');
  }
  return values;
}

function help() {
  return `Export a bounded, read-only Azure context snapshot using the operator's Azure CLI login.
Requires Node >=24.19.0 and refuses GitHub Actions/device-secret environments.
Required:
  --config <existing nonsecret live config JSON>
  --platform android|ios
  --subscription <GUID>
  --resource-group <name>
  --namespace <Azure Device Registry namespace>
  --dps-service-host <DPS service FQDN>
  --hub-service-host <IoT Hub service FQDN>
  --out <new JSON file>
Optional: --registry-arm-endpoint <https://management.azure.com or
  https://centraluseuap.management.azure.com> explicitly reads preview registry
  inventory through ARM when the installed CLI lacks registry-device.
The output file is created exclusively with mode 0600 and is never overwritten.
Only allowlisted resource metadata, exact DPS assignment, optional registry identity,
and up to 20 namespace activity events from the last 24 hours are read. No keys,
credentials, telemetry, caller identity, claims, IP addresses, or raw Azure errors are emitted.`;
}

function run(argv, environment = process.env, dependencies = {}) {
  if (!supportedNode()) exportFail('UNSUPPORTED_NODE');
  const values = parseInvocation(argv);
  if (values.help) return {help: true, text: help()};
  ensureSafeEnvironment(environment);
  const required = [
    'config',
    'platform',
    'subscription',
    'resource-group',
    'namespace',
    'dps-service-host',
    'hub-service-host',
    'out',
  ];
  if (required.some(key => typeof values[key] !== 'string')) {
    exportFail('INVALID_OPERATOR_INPUT');
  }
  if (!['android', 'ios'].includes(values.platform)) {
    exportFail('INVALID_OPERATOR_INPUT');
  }

  let configText;
  try {
    configText = (dependencies.fs || fs).readFileSync(values.config, 'utf8');
  } catch {
    exportFail('CONFIG_READ_FAILED');
  }
  let config;
  try {
    config = validateLiveConfig(configText, values.platform);
  } catch {
    exportFail('INVALID_LIVE_CONFIG');
  }
  const targets = validateTargets({
    subscription: values.subscription,
    resourceGroup: values['resource-group'],
    namespace: values.namespace,
    dpsServiceHost: values['dps-service-host'],
    hubServiceHost: values['hub-service-host'],
    registryArmEndpoint: values['registry-arm-endpoint'],
  });
  const deadline = Date.now() + 180000;
  const read = dependencies.read || azureReader(targets, deadline);
  const snapshot = collectAzureContext(
    config,
    values.platform,
    targets,
    read,
    dependencies.now,
  );
  writeExclusive(values.out, snapshot, dependencies.fs || fs);
  return {
    help: false,
    message: `Azure context exported (${snapshot.activities.length} namespace activities).`,
    snapshot,
  };
}

function main() {
  try {
    const result = run(process.argv.slice(2));
    console.log(result.help ? result.text : result.message);
  } catch (error) {
    const code =
      error instanceof AzureContextExportError || error instanceof ProofError
        ? error.code
        : 'INVALID_OPERATOR_INPUT';
    console.error(
      `Azure context export failed: ${code}. No raw input or Azure response was logged.`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  AzureContextExportError,
  collectAzureContext,
  ensureSafeEnvironment,
  help,
  parseInvocation,
  run,
  writeExclusive,
};
if (require.main === module) main();
