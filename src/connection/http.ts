import {fetch as expoFetch} from 'expo/fetch';
import {ConnectionError, safeError} from './errors';
import {HttpRequest, HttpResponse, HttpTransport} from './types';

// Unlike RN's XMLHttpRequest-backed fetch, Expo fetch enforces redirect:'error'.
export const defaultHttp: HttpTransport = (url, init) =>
  expoFetch(url, init as Parameters<typeof expoFetch>[1]);

const abortReasons = new WeakMap<AbortSignal, ConnectionError>();
export function abortWithError(
  controller: AbortController,
  error: ConnectionError,
): void {
  if (!controller.signal.aborted) {
    abortReasons.set(controller.signal, error);
    controller.abort();
  }
}
export function abortError(signal: AbortSignal): ConnectionError {
  return abortReasons.get(signal) ?? new ConnectionError('CANCELLED');
}
export function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw abortError(signal);
  }
}
export function bounded<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError(signal));
    signal.addEventListener('abort', abort, {once: true});
    work.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
    if (signal.aborted) {
      abort();
    }
  });
}
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, {once: true});
  });
}

export async function request(
  http: HttpTransport,
  url: string,
  init: HttpRequest,
): Promise<HttpResponse> {
  checkAbort(init.signal);
  try {
    const response = await bounded(http(url, init), init.signal);
    checkAbort(init.signal);
    if (
      response.redirected ||
      (response.status >= 300 && response.status < 400) ||
      (response.url && response.url !== url)
    ) {
      throw new ConnectionError('UNSAFE_ENDPOINT', {status: response.status});
    }
    return response;
  } catch (error) {
    checkAbort(init.signal);
    throw safeError(error, 'NETWORK_ERROR');
  }
}
export function deadline(timeoutMs: number, parent?: AbortSignal) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) {
    throw new ConnectionError('INVALID_CREDENTIALS');
  }
  const controller = new AbortController();
  const cancel = () =>
    abortWithError(controller, new ConnectionError('CANCELLED'));
  parent?.addEventListener('abort', cancel, {once: true});
  if (parent?.aborted) {
    cancel();
  }
  const timer = setTimeout(
    () => abortWithError(controller, new ConnectionError('TIMEOUT')),
    timeoutMs,
  );
  return {
    controller,
    close() {
      clearTimeout(timer);
      parent?.removeEventListener('abort', cancel);
    },
  };
}
