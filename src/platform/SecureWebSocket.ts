import {Buffer} from 'buffer';
import {
  getPaadDevice,
  PaadDeviceNative,
  SocketEvent,
} from '../../modules/paad-device';
import type {ClientOptions} from '../connection/types';

type EventType = SocketEvent['type'];
type SocketEventObject = {
  type: EventType;
  target: SecureWebSocket;
  currentTarget: SecureWebSocket;
  data?: ArrayBuffer;
  code?: number;
  reason?: string;
  wasClean?: boolean;
  message?: string;
};
type Listener = (event: SocketEventObject) => void;
let nextId = 0;
const instancePrefix = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2)}`;
const endpoint =
  /^wss:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:device\.)?azure-devices\.(?:net|cn|us)(?::443)?(?:\/[^#\s\\]*)?$/i;

/** MQTT-only binary socket. Never replaces the global/dev-server WebSocket. */
export class SecureWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly url: string;
  readonly extensions = '';
  onopen: Listener | null = null;
  onmessage: Listener | null = null;
  onerror: Listener | null = null;
  onclose: Listener | null = null;
  private state = SecureWebSocket.CONNECTING;
  private selectedProtocol = '';
  private readonly id = `${instancePrefix}-${++nextId}`;
  private readonly protocols: string[];
  private native?: PaadDeviceNative;
  private subscription?: {remove(): void};
  private listeners = new Map<EventType, Set<Listener>>();

  constructor(url: string, protocols: string | string[]) {
    if (
      typeof url !== 'string' ||
      !url.startsWith('wss://') ||
      !endpoint.test(url) ||
      [...url].some(
        char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
      )
    ) {
      throw new SyntaxError('Unsafe MQTT endpoint');
    }
    const requested = typeof protocols === 'string' ? [protocols] : protocols;
    if (
      !Array.isArray(requested) ||
      requested.length === 0 ||
      new Set(requested).size !== requested.length ||
      requested.some(p => p !== 'mqtt' && p !== 'mqttv3.1')
    ) {
      throw new SyntaxError('An MQTT subprotocol is required');
    }
    // Paho supplies :443; the native boundary receives a canonical TLS URL.
    this.url = url.replace(/^(wss:\/\/[^/:]+):443(?=\/|$)/, '$1');
    this.protocols = [...requested];
    // A constructor must return before open/error callbacks can be delivered.
    Promise.resolve().then(() => this.connect());
  }

  get readyState() {
    return this.state;
  }

  get protocol() {
    return this.selectedProtocol;
  }

  get binaryType(): 'arraybuffer' {
    return 'arraybuffer';
  }

  set binaryType(value: string) {
    if (value !== 'arraybuffer') {
      throw new TypeError('MQTT sockets require arraybuffer binaryType');
    }
  }

  addEventListener(type: EventType, listener: Listener | null) {
    if (!listener) {
      return;
    }
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: EventType, listener: Listener | null) {
    if (listener) {
      this.listeners.get(type)?.delete(listener);
    }
  }

  send(data: ArrayBuffer | Uint8Array) {
    if (this.state === this.CONNECTING) {
      throw new Error('Socket is not open');
    }
    if (this.state !== this.OPEN) {
      return;
    }
    if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) {
      throw new TypeError('MQTT sockets require binary data');
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    try {
      this.native!.send(this.id, Buffer.from(bytes).toString('base64'));
    } catch {
      this.fail();
    }
  }

  close(code = 1000, reason = '') {
    if (
      !Number.isInteger(code) ||
      (code !== 1000 && (code < 3000 || code > 4999)) ||
      typeof reason !== 'string' ||
      Buffer.byteLength(reason, 'utf8') > 123
    ) {
      throw new SyntaxError('Invalid close parameters');
    }
    if (this.state === this.CLOSING || this.state === this.CLOSED) {
      return;
    }
    this.state = this.CLOSING;
    if (!this.native) {
      Promise.resolve().then(() => this.finish(1006, false));
      return;
    }
    try {
      this.native.close(this.id, code, reason);
    } catch {
      this.finish(1006, false);
    }
  }

  private connect() {
    if (this.state !== this.CONNECTING) {
      return;
    }
    try {
      this.native = getPaadDevice();
      this.subscription = this.native.addListener('socketEvent', event =>
        this.receive(event),
      );
      this.native.connect(this.id, this.url, this.protocols);
    } catch {
      this.fail();
    }
  }

  private receive(event: SocketEvent) {
    if (event.id !== this.id || this.state === this.CLOSED) {
      return;
    }
    switch (event.type) {
      case 'open':
        if (this.state !== this.CONNECTING) {
          return;
        }
        if (!event.protocol || !this.protocols.includes(event.protocol)) {
          this.fail();
          return;
        }
        this.selectedProtocol = event.protocol;
        this.state = this.OPEN;
        this.dispatch('open');
        break;
      case 'message': {
        if (this.state !== this.OPEN || typeof event.data !== 'string') {
          return;
        }
        const bytes = Uint8Array.from(Buffer.from(event.data, 'base64'));
        this.dispatch('message', {data: bytes.buffer});
        break;
      }
      case 'error':
        this.fail();
        break;
      case 'close':
        this.finish(event.code ?? 1006, event.wasClean === true);
        break;
    }
  }

  private fail() {
    if (this.state === this.CLOSED) {
      return;
    }
    this.state = this.CLOSING;
    const native = this.native;
    try {
      this.dispatch('error', {message: 'Secure MQTT connection failed'});
    } finally {
      try {
        this.finish(1006, false);
      } finally {
        try {
          native?.close(this.id, 1000, '');
        } catch {
          console.warn('Secure MQTT socket cleanup failed.');
        }
      }
    }
  }

  private finish(code: number, wasClean: boolean) {
    if (this.state === this.CLOSED) {
      return;
    }
    this.state = this.CLOSED;
    this.subscription?.remove();
    this.subscription = undefined;
    this.native = undefined;
    try {
      this.dispatch('close', {code, wasClean, reason: ''});
    } finally {
      this.listeners.clear();
      this.onopen = this.onmessage = this.onerror = this.onclose = null;
    }
  }

  private dispatch(type: EventType, fields: Partial<SocketEventObject> = {}) {
    const event = {type, target: this, currentTarget: this, ...fields};
    this[`on${type}`]?.call(this, event);
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.call(this, event);
    }
  }
}

// Paho consumes this binary WebSocket subset, not DOM Blob/EventTarget APIs.
export const secureWebSocket: NonNullable<ClientOptions['secureWebSocket']> = {
  implementation: SecureWebSocket as unknown as typeof WebSocket,
  rejectsRedirects: true,
};
