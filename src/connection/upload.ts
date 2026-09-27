import {Buffer} from 'buffer';
import {record, validateHost} from './credentials';
import {ConnectionError} from './errors';
import {bounded, request} from './http';
import {DeviceIdentity, FileUploadResult, HttpTransport} from './types';
import {IOT_HUB_API_VERSION} from './protocol';

export async function upload(
  identity: DeviceIdentity,
  password: string,
  http: HttpTransport,
  signal: AbortSignal,
  fileName: string,
  contentType: string,
  data: string | Uint8Array,
  encoding?: 'base64',
): Promise<FileUploadResult> {
  if (
    typeof fileName !== 'string' ||
    !fileName.length ||
    fileName.length > 1024 ||
    Array.from(fileName).some(character => character.charCodeAt(0) < 32) ||
    typeof contentType !== 'string' ||
    !/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(contentType) ||
    (encoding !== undefined && encoding !== 'base64')
  ) {
    throw new ConnectionError('OPERATION_FAILED');
  }
  let bytes: Uint8Array;
  if (encoding === 'base64' && typeof data === 'string') {
    if (
      !data.length ||
      data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
    ) {
      throw new ConnectionError('OPERATION_FAILED');
    }
    bytes = Buffer.from(data, 'base64');
    if (Buffer.from(bytes).toString('base64') !== data) {
      throw new ConnectionError('OPERATION_FAILED');
    }
  } else if (data instanceof Uint8Array && encoding === undefined) {
    bytes = data;
  } else {
    throw new ConnectionError('OPERATION_FAILED');
  }
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    throw new ConnectionError('OPERATION_FAILED');
  }
  const base = `https://${validateHost(
    identity.assignedHub,
    'hub',
  )}/devices/${encodeURIComponent(identity.deviceId)}/files`;
  const headers = {Authorization: password, 'Content-Type': 'application/json'};
  const initial = await request(
    http,
    `${base}?api-version=${IOT_HUB_API_VERSION}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({blobName: fileName}),
      signal,
      redirect: 'error',
    },
  );
  if (initial.status < 200 || initial.status >= 300) {
    throw new ConnectionError('OPERATION_FAILED', {status: initial.status});
  }
  const metadata = record(await bounded(initial.json(), signal));
  const host = validateHost(metadata.hostName, 'blob');
  if (
    typeof metadata.containerName !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(metadata.containerName) ||
    typeof metadata.blobName !== 'string' ||
    !metadata.blobName.length ||
    metadata.blobName.length > 2048 ||
    metadata.blobName.split('/').some(part => part === '.' || part === '..') ||
    typeof metadata.sasToken !== 'string' ||
    !metadata.sasToken.startsWith('?') ||
    /[#\r\n]/.test(metadata.sasToken) ||
    metadata.sasToken.length > 8192 ||
    typeof metadata.correlationId !== 'string' ||
    !/^[A-Za-z0-9._:=-]{1,1024}$/.test(metadata.correlationId)
  ) {
    throw new ConnectionError('INVALID_RESPONSE');
  }
  const blobPath = metadata.blobName
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const result = await request(
    http,
    `https://${host}/${metadata.containerName}/${blobPath}${metadata.sasToken}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-version': '2021-06-08',
      },
      body: bytes,
      signal,
      redirect: 'error',
    },
  );
  const success = result.status >= 200 && result.status < 300;
  const notification = await request(
    http,
    `${base}/notifications?api-version=${IOT_HUB_API_VERSION}`,
    {
      method: 'POST',
      headers,
      signal,
      redirect: 'error',
      body: JSON.stringify({
        correlationId: metadata.correlationId,
        isSuccess: success,
        statusCode: result.status,
        statusDescription: success ? 'Uploaded' : 'Upload failed',
      }),
    },
  );
  if (!success || notification.status < 200 || notification.status >= 300) {
    throw new ConnectionError('OPERATION_FAILED', {
      status: !success ? result.status : notification.status,
    });
  }
  return {status: result.status, delivery: 'acknowledged'};
}
