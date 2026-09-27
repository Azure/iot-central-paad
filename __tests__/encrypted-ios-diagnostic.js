jest.mock('node:child_process', () => ({spawnSync: jest.fn()}));
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  diagnosticRecipient, sealDiagnostic, collectEncryptedDiagnostic,
  CAPTURE_DIRECTORY, OUTPUT, RUNNER, MAX_IMAGE_BYTES, MAX_TEXT_BYTES,
} = require('../scripts/ci/encrypted-ios-diagnostic');

let keys;
let recipient;
const context = {sourceSha: 'a'.repeat(40), runId: '123456'};
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const capture = {hierarchy: Buffer.from('PRIVATE_UI_CANARY'), screen: png};

beforeAll(() => {
  keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
  });
  recipient = diagnosticRecipient(keys.publicKey);
});

function decrypt(envelope) {
  const {schemaVersion, algorithm, sourceSha, runId} = envelope;
  const key = crypto.privateDecrypt({
    key: keys.privateKey, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  }, Buffer.from(envelope.wrappedKey, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(JSON.stringify({schemaVersion, algorithm, sourceSha, runId})));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final(),
  ]).toString('utf8'));
}

test('only the locally held private key decrypts authenticated, run-bound capture data', () => {
  const envelope = sealDiagnostic(recipient, capture, context);
  expect(JSON.stringify(envelope)).not.toContain('PRIVATE_UI_CANARY');
  expect(decrypt(envelope)).toEqual({hierarchy: 'PRIVATE_UI_CANARY', screen: png.toString('base64')});
  expect(() => decrypt({...envelope, runId: '123457'})).toThrow();
  expect(() => decrypt({...envelope, tag: Buffer.alloc(16).toString('base64')})).toThrow();
  expect(sealDiagnostic(recipient, capture, context).ciphertext).not.toBe(envelope.ciphertext);
});

test('hierarchy-only capture is explicitly partial, not a fabricated screenshot', () => {
  expect(decrypt(sealDiagnostic(recipient, {hierarchy: capture.hierarchy}, context)))
    .toEqual({hierarchy: 'PRIVATE_UI_CANARY'});
});

test('absent keys disable capture, while private or weak keys are rejected', () => {
  expect(diagnosticRecipient(undefined)).toBeUndefined();
  expect(diagnosticRecipient('')).toBeUndefined();
  expect(() => diagnosticRecipient(keys.privateKey)).toThrow();
  expect(() => diagnosticRecipient('RAW_CANARY')).toThrow();
  const weak = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048, publicKeyEncoding: {type: 'spki', format: 'pem'},
  });
  expect(() => diagnosticRecipient(weak.publicKey)).toThrow();
});

test.each([
  {hierarchy: Buffer.alloc(MAX_TEXT_BYTES + 1)},
  {hierarchy: Buffer.alloc(0)},
  {hierarchy: Buffer.from([0xff])},
  {...capture, screen: Buffer.alloc(MAX_IMAGE_BYTES + 1)},
  {...capture, screen: Buffer.from('not a PNG')},
])('rejects oversized or malformed private payloads (%#)', value => {
  expect(() => sealDiagnostic(recipient, value, context)).toThrow();
});

function withCapture(body, state = 'captured') {
  const original = process.cwd();
  const directory = fs.mkdtempSync(path.join(original, '.encrypted-ui-unit-'));
  const device = '12345678-1234-1234-1234-123456789ABC';
  const env = {
    HOME: directory, IOS_SIMULATOR_UDID: device, GITHUB_SHA: context.sourceSha, GITHUB_RUN_ID: context.runId,
  };
  const container = path.join(directory, 'Library/Developer/CoreSimulator/Devices',
    device, 'data/Containers/Data/Application/12345678-1234-1234-1234-123456789DEF');
  const root = path.join(container, 'Documents', CAPTURE_DIRECTORY);
  try {
    process.chdir(directory);
    fs.mkdirSync(root, {recursive: true});
    fs.mkdirSync('build/private', {recursive: true});
    fs.writeFileSync(path.join(root, 'hierarchy.txt'), capture.hierarchy);
    if (state === 'captured') fs.writeFileSync(path.join(root, 'screen.png'), png);
    spawnSync.mockImplementation((binary, args) => {
      expect(binary).toBe('xcrun');
      expect(args).toEqual(['simctl', 'get_app_container', device, RUNNER, 'data']);
      return {status: 0, stdout: container + '\n'};
    });
    body({root, env, privateRoot: path.resolve('build/private'), state});
  } finally {
    process.chdir(original);
    spawnSync.mockReset();
    fs.rmSync(directory, {recursive: true});
  }
}

test.each(['captured', 'hierarchy-only'])('publishes only complete ciphertext and removes raw %s files', state => {
  withCapture(({root, env, privateRoot}) => {
    collectEncryptedDiagnostic(recipient, state, privateRoot, env);
    expect(fs.existsSync(root)).toBe(false);
    expect(fs.statSync(OUTPUT).mode & 0o777).toBe(0o600);
    expect(decrypt(JSON.parse(fs.readFileSync(OUTPUT, 'utf8')))).toEqual({
      hierarchy: 'PRIVATE_UI_CANARY', ...(state === 'captured' ? {screen: png.toString('base64')} : {}),
    });
  }, state);
});

test('refuses another simulator container and unapproved capture states', () => {
  withCapture(({env, privateRoot}) => {
    expect(() => collectEncryptedDiagnostic(recipient, 'ineligible', privateRoot, env)).toThrow();
    spawnSync.mockReturnValue({status: 0, stdout: '/another/container'});
    expect(() => collectEncryptedDiagnostic(recipient, 'captured', privateRoot, env)).toThrow();
    expect(fs.existsSync(OUTPUT)).toBe(false);
  });
});

test('refuses symlinked capture files rather than reading their targets', () => {
  withCapture(({root, env, privateRoot}) => {
    fs.unlinkSync(path.join(root, 'hierarchy.txt'));
    fs.symlinkSync(path.join(root, 'screen.png'), path.join(root, 'hierarchy.txt'));
    expect(() => collectEncryptedDiagnostic(recipient, 'captured', privateRoot, env)).toThrow();
    expect(fs.existsSync(OUTPUT)).toBe(false);
  });
});

test('does not overwrite a prior encrypted output and still cleans captured plaintext', () => {
  withCapture(({root, env, privateRoot}) => {
    fs.writeFileSync(OUTPUT, 'prior');
    expect(() => collectEncryptedDiagnostic(recipient, 'captured', privateRoot, env)).toThrow();
    expect(fs.readFileSync(OUTPUT, 'utf8')).toBe('prior');
    expect(fs.existsSync(root)).toBe(false);
  });
});
