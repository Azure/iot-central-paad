import {Buffer} from 'buffer';
import {AzureContextSnapshot, parseAzureContext} from './azureContext';

export function decodeAzureContextInput(input: string): AzureContextSnapshot {
  if (typeof input !== 'string' || input.length > 87384) {
    throw new Error('Invalid Azure context snapshot');
  }
  const text = input.trim();
  if (text.startsWith('{')) return parseAzureContext(text);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    throw new Error('Invalid Azure context snapshot');
  }
  const decoded = Buffer.from(text, 'base64');
  const json = decoded.toString('utf8');
  if (
    decoded.toString('base64') !== text ||
    !Buffer.from(json, 'utf8').equals(decoded)
  ) {
    throw new Error('Invalid Azure context snapshot');
  }
  return parseAzureContext(json);
}
