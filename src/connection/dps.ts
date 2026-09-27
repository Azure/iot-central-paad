import {
  computeKey,
  record,
  validateDeviceId,
  validateHost,
} from './credentials';
import {
  ConnectionError,
  safeError,
  safeNumber,
  safeOperationId,
} from './errors';
import {bounded, checkAbort, request, wait} from './http';
import {
  DeviceCredentials,
  DeviceIdentity,
  HttpResponse,
  HttpTransport,
} from './types';

export function sasToken(
  resource: string,
  key: string,
  registration = false,
): string {
  const uri = encodeURIComponent(resource);
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const signature = encodeURIComponent(computeKey(key, `${uri}\n${expiry}`));
  return `SharedAccessSignature sr=${uri}&sig=${signature}&se=${expiry}${
    registration ? '&skn=registration' : ''
  }`;
}

function retryAfter(response: HttpResponse): number {
  const value = response.headers.get('retry-after');
  if (!value) {
    return 1000;
  }
  const seconds = /^\d+$/.test(value) ? Number(value) : NaN;
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - Date.now();
  // The enclosing deadline cancels long server delays; never poll earlier.
  return Number.isFinite(delay)
    ? Math.max(100, Math.min(delay, 2147483647))
    : 1000;
}

export async function provision(
  credentials: DeviceCredentials,
  http: HttpTransport,
  signal: AbortSignal,
  onOperation: (operationId: string) => void = () => {},
): Promise<DeviceIdentity> {
  const registrationId = credentials.registrationId!;
  const host = validateHost(credentials.provisioningHost, 'dps');
  const resource = `${credentials.scopeId}/registrations/${registrationId}`;
  const base = `https://${host}/${resource}`;
  const authorization = sasToken(resource, credentials.deviceKey!, true);
  let operationId: string | undefined;
  for (let attempt = 0; attempt < 60; attempt++) {
    checkAbort(signal);
    const response = await request(
      http,
      `${base}/${
        operationId
          ? `operations/${encodeURIComponent(operationId)}`
          : 'register'
      }?api-version=2019-03-31`,
      {
        method: operationId ? 'GET' : 'PUT',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: operationId
          ? undefined
          : JSON.stringify({
              registrationId,
              payload: {
                modelId: credentials.modelId,
                iotcModelId: credentials.modelId,
              },
            }),
        signal,
        redirect: 'error',
      },
    );
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      await wait(retryAfter(response), signal);
      continue;
    }
    if (![200, 202].includes(response.status)) {
      let serviceCode: number | undefined;
      try {
        const body = record(await bounded(response.json(), signal));
        serviceCode = safeNumber(body.errorCode) ?? safeNumber(body.code);
      } catch (error) {
        checkAbort(signal);
        // An absent/malformed error body must not hide the HTTP failure.
        if (
          !(error instanceof SyntaxError) &&
          !(error instanceof ConnectionError && error.code === 'INVALID_RESPONSE')
        ) {
          throw safeError(error, 'NETWORK_ERROR');
        }
      }
      throw new ConnectionError(
        [401, 403].includes(response.status)
          ? 'AUTHENTICATION_FAILED'
          : 'PROVISIONING_FAILED',
        {status: response.status, operationId, serviceCode},
      );
    }
    let body: Record<string, unknown>;
    try {
      body = record(await bounded(response.json(), signal));
    } catch {
      checkAbort(signal);
      throw new ConnectionError('INVALID_RESPONSE', {
        status: response.status,
        operationId,
      });
    }
    if (body.operationId !== undefined) {
      const nextId = safeOperationId(body.operationId);
      if (!nextId || (operationId && operationId !== nextId)) {
        throw new ConnectionError('INVALID_RESPONSE', {
          status: response.status,
          operationId,
        });
      }
      operationId = nextId;
      onOperation(operationId);
    }
    if (body.status === 'assigned') {
      const state = record(body.registrationState);
      if (state.status !== undefined && state.status !== 'assigned') {
        throw new ConnectionError('INVALID_RESPONSE', {operationId});
      }
      return Object.freeze({
        assignedHub: validateHost(state.assignedHub, 'hub'),
        deviceId: validateDeviceId(state.deviceId),
        registrationId,
        operationId,
        modelId: credentials.modelId!,
      });
    }
    if (body.status === 'failed' || body.status === 'disabled') {
      const state = body.registrationState
        ? record(body.registrationState)
        : body;
      throw new ConnectionError('PROVISIONING_FAILED', {
        status: response.status,
        operationId,
        serviceCode: state.errorCode,
      });
    }
    if (body.status !== 'assigning' || !operationId) {
      throw new ConnectionError('INVALID_RESPONSE', {
        status: response.status,
        operationId,
      });
    }
    await wait(retryAfter(response), signal);
  }
  throw new ConnectionError('TIMEOUT', {operationId});
}
