#!/usr/bin/env bash
set -euo pipefail
umask 077

mode="${1:-replay}"
if [[ "$#" -gt 1 || ( "$mode" != replay && "$mode" != download ) ]]; then
  echo 'Unsupported iOS replay invocation.' >&2
  exit 1
fi
if [[ "${MAESTRO_DEVICE_KEY+x}" || "${PAAD_LIVE_CONFIG+x}" ]]; then
  echo 'iOS replay refuses device credentials or live configuration, even when empty.' >&2
  exit 1
fi
if [[ "$mode" = download ]]; then
  exec node scripts/ci/replay-artifact.js ios download
fi
if [[ "${GH_TOKEN+x}" || "${GITHUB_TOKEN+x}" ]]; then
  echo 'Artifact access tokens must not enter iOS replay.' >&2
  exit 1
fi
if [[ "${IOS_SIMULATOR_UDID+x}" ||
      "${DEVELOPER_DIR:-}" != /Applications/Xcode_26.6.app/Contents/Developer ||
      "${IOS_SIMULATOR_DEVELOPER_DIR:-}" != "$DEVELOPER_DIR" ]]; then
  echo 'iOS replay requires pinned Xcode and a newly created simulator, not a supplied target.' >&2
  exit 1
fi
binary_identity=$(node scripts/ci/replay-artifact.js ios verify)
maestro="$PWD/build/ci-tools/maestro/bin/maestro"
test -x "$maestro"
state="$PWD/build/replay-ios-state"
diagnostics="$PWD/build/ci-artifacts/replay-ios"
mkdir "$state"
mkdir "$diagnostics"
mkdir "$state/home" "$state/scratch" "$state/app" \
  "$diagnostics/logs" "$diagnostics/debug" "$diagnostics/results"
printf '%s\n' "$binary_identity" > "$diagnostics/replay-identity.json"

# macOS does not provide GNU timeout. Bound every subprocess without detaching it.
run_bounded() {
  node - "$@" <<'NODE'
const {spawnSync} = require('node:child_process');
const [milliseconds, command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  stdio: 'inherit', timeout: Number(milliseconds), killSignal: 'SIGKILL',
});
if (result.error || result.signal) {
  console.error(result.error?.code === 'ETIMEDOUT'
    ? 'iOS replay subprocess exceeded its deadline.'
    : 'iOS replay subprocess did not exit normally.');
}
process.exit(result.error || result.signal ? 1 : (result.status ?? 1));
NODE
}

device=''
flow_attempted=0
collect_evidence() {
  original_result=$?
  trap - EXIT INT TERM
  capture_failed=0
  cleanup_failed=0
  simulator_deleted=0
  if [[ -n "$device" ]]; then
    if ! run_bounded 20000 xcrun simctl spawn "$device" log show --style compact \
      --last 5m --predicate 'process == "IoTPnP" OR ((process == "SpringBoard" OR process == "runningboardd" OR process == "CoreSimulatorBridge") AND eventMessage CONTAINS "com.microsoft.iotpnp.ci")' \
      > "$diagnostics/logs/ios-runtime.log" 2> "$diagnostics/logs/runtime-errors.log"; then
      capture_failed=1
      echo 'iOS replay runtime diagnostic capture failed.' >&2
    fi
    if ! run_bounded 20000 xcrun simctl io "$device" screenshot "$diagnostics/final-screen.png" \
      > "$diagnostics/logs/screenshot.log" 2>&1 || [[ ! -s "$diagnostics/final-screen.png" ]]; then
      capture_failed=1
      echo 'iOS replay final screenshot capture failed.' >&2
    fi
    if ! run_bounded 20000 xcrun simctl shutdown "$device" > "$diagnostics/logs/shutdown.log" 2>&1; then
      cleanup_failed=1
      echo 'iOS replay owned simulator shutdown failed; attempting its deletion.' >&2
    fi
    if run_bounded 20000 xcrun simctl delete "$device" > "$diagnostics/logs/delete.log" 2>&1; then
      simulator_deleted=1
    else
      cleanup_failed=1
      echo 'iOS replay owned simulator deletion failed.' >&2
    fi
  fi
  if ! node - "$original_result" "$capture_failed" "$cleanup_failed" "$flow_attempted" \
    "$device" "$simulator_deleted" <<'NODE' > "$diagnostics/status.json"
console.log(JSON.stringify({
  commandExitCode: Number(process.argv[2]),
  captureFailed: process.argv[3] === '1',
  cleanupFailed: process.argv[4] === '1',
  flowAttempted: process.argv[5] === '1',
  simulator: process.argv[6] || null,
  simulatorDeleted: process.argv[7] === '1',
}, null, 2));
NODE
  then
    capture_failed=1
    echo 'iOS replay could not record its final result.' >&2
  fi
  if [[ "$original_result" = 0 && ( "$capture_failed" = 1 || "$cleanup_failed" = 1 ) ]]; then
    original_result=1
  fi
  exit "$original_result"
}
trap collect_evidence EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run_bounded 30000 ditto -x -k build/ci-artifacts/foundation-simulator.app.zip "$state/app" \
  > "$diagnostics/logs/extract.log" 2>&1
app="$state/app/IoTPnP.app"
test -d "$app" && test ! -L "$app"
test -f "$app/Info.plist" && test ! -L "$app/Info.plist"
test -s "$app/main.jsbundle" && test ! -L "$app/main.jsbundle"
bundle_id=$(run_bounded 10000 plutil -extract CFBundleIdentifier raw -o - "$app/Info.plist" \
  2> "$diagnostics/logs/bundle-errors.log")
if [[ "$bundle_id" != com.microsoft.iotpnp.ci ]]; then
  echo 'iOS replay simulator app bundle identity rejected.' >&2
  exit 1
fi
candidate=$(run_bounded 60000 xcrun simctl create PAAD-Replay-CI \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17 \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5 2> "$diagnostics/logs/create-errors.log")
if [[ ! "$candidate" =~ ^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$ ]]; then
  echo 'iOS replay did not receive a valid newly created simulator UUID.' >&2
  exit 1
fi
# Record ownership before boot so even a failed boot triggers this UUID's cleanup.
device="$candidate"
printf '%s\n' "$device" > "$diagnostics/simulator-uuid.txt"
run_bounded 15000 xcrun simctl boot "$device" > "$diagnostics/logs/boot.log" 2>&1
run_bounded 180000 xcrun simctl bootstatus "$device" -b >> "$diagnostics/logs/boot.log" 2>&1
run_bounded 60000 xcrun simctl install "$device" "$app" > "$diagnostics/logs/install.log" 2>&1
bash scripts/ci/show-ios-simulator.sh "$device" \
  > "$diagnostics/logs/simulator-ui.log" 2>&1

flow_attempted=1
export MAESTRO_DRIVER_STARTUP_TIMEOUT=240000
HOME="$state/home" TMPDIR="$state/scratch" \
JAVA_TOOL_OPTIONS="-Duser.home=$state/home -Djava.io.tmpdir=$state/scratch" \
run_bounded 400000 "$maestro" --device "$device" test --no-ansi \
  --format junit --output "$diagnostics/results/result.xml" \
  --debug-output "$diagnostics/debug" --test-output-dir "$diagnostics/results" \
  -e APP_ID=com.microsoft.iotpnp.ci .maestro/startup.yaml \
  > "$diagnostics/logs/maestro-stdout.log" 2> "$diagnostics/logs/maestro-stderr.log"
