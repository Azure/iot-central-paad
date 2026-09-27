import {
  ConnectionSessionStage,
  DeviceIdentity,
  JsonObject,
} from '../connection';
import {
  ConnectionError,
  safeError,
  safeOperationId,
} from '../connection/errors';

/** Export an explicit nonsecret DTO, never a client, credentials or native error. */
export function connectionDiagnostics(
  identity: DeviceIdentity | null,
  stage: ConnectionSessionStage,
  connected: boolean,
  simulated: boolean,
  error: ConnectionError | null,
): JsonObject {
  const result: JsonObject = {
    schema: 'paad.diagnostics',
    version: 1,
    connection: simulated
      ? 'offline-simulation'
      : connected
      ? 'connected'
      : 'disconnected',
    stage,
    registryStatus: 'Not checked',
  };
  if (identity && !simulated) {
    result.deviceId = identity.deviceId;
    result.assignedHub = identity.assignedHub;
    result.modelId = identity.modelId;
    if (identity.registrationId) {
      result.registrationId = identity.registrationId;
    }
    const operationId = safeOperationId(identity.operationId);
    if (operationId) {
      result.operationId = operationId;
    }
  }
  if (error) {
    const safe = safeError(error);
    result.errorCode = safe.code;
    if (safe.serviceCode !== undefined) {
      result.serviceCode = safe.serviceCode;
    }
    if (safe.status !== undefined) {
      result.httpStatus = safe.status;
    }
    if (safe.operationId) {
      result.operationId = safe.operationId;
    }
  }
  return result;
}
