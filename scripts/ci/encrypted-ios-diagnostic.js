'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {TextDecoder} = require('node:util');
const {spawnSync} = require('node:child_process');

const RUNNER = 'com.microsoft.iotpnp.ci.uitests.xctrunner';
const CAPTURE_DIRECTORY = 'paad-approved-diagnostic';
const OUTPUT = 'build/ios-encrypted-diagnostic.json';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_BYTES = 512 * 1024;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function diagnosticRecipient(pem) {
  if (pem === undefined || pem === '') return undefined;
  if (typeof pem !== 'string' || pem.length > 4096 ||
      !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\s*$/.test(pem)) {
    throw new Error('Invalid diagnostic public key');
  }
  let key;
  try {
    key = crypto.createPublicKey(pem);
  } catch {
    throw new Error('Invalid diagnostic public key');
  }
  if (key.asymmetricKeyType !== 'rsa' ||
      ![3072, 4096].includes(key.asymmetricKeyDetails?.modulusLength)) {
    throw new Error('Diagnostic recipient requires RSA 3072 or 4096');
  }
  return key;
}

function sealDiagnostic(recipient, capture, context) {
  if (!recipient || !/^[a-f0-9]{40}$/.test(context.sourceSha || '') ||
      !/^[1-9][0-9]{0,19}$/.test(context.runId || '') ||
      !Buffer.isBuffer(capture.hierarchy) || capture.hierarchy.length === 0 ||
      capture.hierarchy.length > MAX_TEXT_BYTES ||
      (capture.screen !== undefined && (!Buffer.isBuffer(capture.screen) ||
        capture.screen.length > MAX_IMAGE_BYTES ||
        !capture.screen.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))))) {
    throw new Error('Invalid approved diagnostic payload');
  }
  const metadata = {
    schemaVersion: 1, algorithm: 'RSA-OAEP-SHA256+AES-256-GCM',
    sourceSha: context.sourceSha, runId: context.runId,
  };
  const plaintext = Buffer.from(JSON.stringify({
    hierarchy: new TextDecoder('utf-8', {fatal: true}).decode(capture.hierarchy),
    ...(capture.screen ? {screen: capture.screen.toString('base64')} : {}),
  }));
  const key = crypto.randomBytes(32);
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      ...metadata,
      wrappedKey: crypto.publicEncrypt({
        key: recipient, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      }, key).toString('base64'),
      iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

function requireDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe diagnostic directory');
}

function readPrivate(file, maximum) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size === 0 || stat.size > maximum) throw new Error('Invalid capture file');
    const data = fs.readFileSync(fd);
    if (data.length !== stat.size) throw new Error('Capture file changed');
    return data;
  } finally {
    fs.closeSync(fd);
  }
}

function collectEncryptedDiagnostic(recipient, captureState, privateRoot, env) {
  if (!['captured', 'hierarchy-only'].includes(captureState)) {
    throw new Error('Approved diagnostic was not captured');
  }
  if (!UUID.test(env.IOS_SIMULATOR_UDID || '') || !path.isAbsolute(env.HOME || '')) {
    throw new Error('Invalid diagnostic simulator binding');
  }
  const result = spawnSync('xcrun', [
    'simctl', 'get_app_container', env.IOS_SIMULATOR_UDID, RUNNER, 'data',
  ], {env, encoding: 'utf8', timeout: 15000, maxBuffer: 4096});
  if (result.error || result.signal || result.status !== 0) throw new Error('Capture container unavailable');
  const container = result.stdout.trim();
  const parent = path.join(env.HOME, 'Library/Developer/CoreSimulator/Devices',
    env.IOS_SIMULATOR_UDID, 'data/Containers/Data/Application');
  if (path.dirname(container) !== parent || !UUID.test(path.basename(container))) {
    throw new Error('Unexpected diagnostic container');
  }
  const documents = path.join(container, 'Documents');
  const directory = path.join(documents, CAPTURE_DIRECTORY);
  for (const folder of [parent, container, documents, directory, 'build', privateRoot]) {
    requireDirectory(folder);
  }
  const names = captureState === 'captured' ? ['hierarchy.txt', 'screen.png'] : ['hierarchy.txt'];
  if (JSON.stringify(fs.readdirSync(directory).sort()) !== JSON.stringify(names)) {
    throw new Error('Unexpected diagnostic files');
  }
  const capture = {hierarchy: readPrivate(path.join(directory, 'hierarchy.txt'), MAX_TEXT_BYTES)};
  if (captureState === 'captured') capture.screen = readPrivate(path.join(directory, 'screen.png'), MAX_IMAGE_BYTES);
  try {
    const envelope = sealDiagnostic(recipient, capture, {
      sourceSha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
    });
    const temporary = path.join(privateRoot, 'encrypted-diagnostic.json');
    fs.writeFileSync(temporary, JSON.stringify(envelope), {flag: 'wx', mode: 0o600});
    // Publish only a complete ciphertext file, without replacing any prior output.
    fs.linkSync(temporary, OUTPUT);
    fs.unlinkSync(temporary);
  } finally {
    capture.hierarchy.fill(0);
    capture.screen?.fill(0);
    for (const name of names) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  }
}

module.exports = {
  diagnosticRecipient, sealDiagnostic, collectEncryptedDiagnostic,
  RUNNER, CAPTURE_DIRECTORY, OUTPUT, MAX_IMAGE_BYTES, MAX_TEXT_BYTES,
};
