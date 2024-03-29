// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function Log(msg: string | number) {
  console.log(msg);
}

export function Debug(msg: string, functionName: string, tag: string) {
  console.log(
    `[${functionName.toUpperCase()}] - [${tag.toUpperCase()}]: ${msg}`,
  );
}
