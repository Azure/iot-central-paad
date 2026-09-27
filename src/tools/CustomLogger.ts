// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Redact before either console output or storage/copyable in-app history. */
export function redactLog(value: string | number): string {
  if (
    /\\["'](?:connectionString|deviceKey|authKey|sharedAccessKey|sharedAccessSignature|password|token)\\["']/i.test(
      String(value),
    )
  ) {
    return '[REDACTED CREDENTIAL DATA]';
  }
  return String(value)
    .replace(/HostName\s*=[^\s"'\r\n]+/gi, '[REDACTED CONNECTION STRING]')
    .replace(/SharedAccessSignature\s+[^\s"'\r\n]+/gi, '[REDACTED SAS]')
    .replace(/Bearer\s+[^\s"'\r\n]+/gi, 'Bearer [REDACTED]')
    .replace(
      /(["']?(?:connectionString|sharedAccessKey|sharedAccessSignature|deviceKey|authKey|sasKey|sas|primaryKey|secondaryKey|password|authorization|secret|token|key|sig)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}&]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/[A-Za-z0-9+/]{43,}={1,2}/g, '[REDACTED KEY]');
}

export function Log(msg: string | number) {
  console.log(redactLog(msg));
}

export function Debug(msg: string, functionName: string, tag: string) {
  console.log(
    redactLog(
      `[${functionName.toUpperCase()}] - [${tag.toUpperCase()}]: ${msg}`,
    ),
  );
}
