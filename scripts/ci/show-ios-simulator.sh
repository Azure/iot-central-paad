#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" != 1 || ! "$1" =~ ^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$ ||
      "${DEVELOPER_DIR:-}" != /Applications/Xcode_26.6.app/Contents/Developer ||
      "${IOS_SIMULATOR_DEVELOPER_DIR:-}" != "$DEVELOPER_DIR" ||
      "${MAESTRO_DEVICE_KEY+x}" || "${PAAD_LIVE_CONFIG+x}" ]]; then
  echo 'Simulator UI requires a pinned developer directory, explicit UUID and no device inputs.' >&2
  exit 1
fi

# Present only the already-owned device before XCTest requests screen captures.
node - "$1" "$DEVELOPER_DIR/Applications/Simulator.app" <<'NODE'
const {spawnSync} = require('node:child_process');
const result = spawnSync('open', [
  '-a', process.argv[3], '--args', '-CurrentDeviceUDID', process.argv[2],
], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, killSignal: 'SIGKILL', maxBuffer: 65536});
if (result.error || result.signal || result.status !== 0) {
  const reason = result.error?.code === 'ETIMEDOUT' ? 'deadline-exceeded'
    : result.error ? 'spawn-failed' : result.signal ? 'signal' : 'nonzero-exit';
  console.error(`Owned Simulator UI could not be opened: ${reason}.`);
  process.exit(1);
}
console.log('Owned Simulator UI opened.');
NODE
