#!/usr/bin/env bash
set -euo pipefail
umask 077

mode="${1:-replay}"
if [[ "$#" -gt 1 || ( "$mode" != replay && "$mode" != download ) ]]; then
  echo 'Unsupported Android replay invocation.' >&2
  exit 1
fi
if [[ "${MAESTRO_DEVICE_KEY+x}" || "${PAAD_LIVE_CONFIG+x}" ]]; then
  echo 'Android replay refuses device credentials or live configuration, even when empty.' >&2
  exit 1
fi
if [[ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ||
      "${GITHUB_REF:-}" != refs/heads/feature/adr-onboarding ||
      "${GITHUB_REPOSITORY:-}" != HangyiWang/iot-central-paad ||
      "${GITHUB_REPOSITORY_OWNER:-}" != HangyiWang ||
      "${GITHUB_ACTOR:-}" != "$GITHUB_REPOSITORY_OWNER" ||
      "${GITHUB_TRIGGERING_ACTOR:-}" != "$GITHUB_REPOSITORY_OWNER" ||
      ! "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ||
      ! "${SOURCE_RUN:-}" =~ ^[0-9]+$ ||
      ! "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ||
      "${PAAD_VARIANT:-}" != ci ]]; then
  echo 'Android replay authorization or source binding rejected.' >&2
  exit 1
fi
if [[ "$mode" = replay && ( "${GH_TOKEN+x}" || "${GITHUB_TOKEN+x}" ) ]]; then
  echo 'Artifact access tokens must not enter Android replay.' >&2
  exit 1
fi

verify_binary() {
  node scripts/ci/replay-artifact.js android verify
}

if [[ "$mode" = download ]]; then
  node scripts/ci/replay-artifact.js android download
  exit 0
fi

# Recheck the immutable source identity before any adb access, even in local invocations.
binary_identity=$(verify_binary)
maestro="$PWD/build/ci-tools/maestro/bin/maestro"
test -x "$maestro"
state="$PWD/build/replay-android-state"
diagnostics="$PWD/build/ci-artifacts/replay-android"
# Never adopt or delete existing directories. HOME and Java caches are not uploaded.
mkdir "$state"
mkdir "$diagnostics"
mkdir "$state/home" "$state/scratch" "$diagnostics/logs" "$diagnostics/debug" "$diagnostics/results"
printf '%s\n' "$binary_identity" > "$diagnostics/replay-identity.json"

device=''
flow_attempted=0
collect_evidence() {
  original_result=$?
  trap - EXIT INT TERM
  capture_failed=0
  capture() {
    local output="$1"
    shift
    if ! timeout --signal=KILL 15s adb -s "$device" "$@" \
      > "$diagnostics/$output" 2>> "$diagnostics/logs/capture-errors.log"; then
      capture_failed=1
      printf 'Android replay diagnostic capture failed: %s\n' "$output" >&2
    fi
  }
  if [[ -n "$device" ]]; then
    capture logs/android-runtime.log logcat -b main -b crash -d -v threadtime \
      AndroidRuntime:V ReactNativeJS:V ReactNative:V '*:S'
    capture logs/android-system.log logcat -b main -b system -b crash -d -v threadtime
    capture logs/foreground.log shell dumpsys activity activities
    capture logs/window.log shell dumpsys window windows
    capture final-screen.png exec-out screencap -p
    if [[ ! -s "$diagnostics/final-screen.png" ]]; then
      capture_failed=1
      echo 'Android replay final screenshot is missing or empty.' >&2
    fi
  fi
  if ! node - "$original_result" "$capture_failed" "$flow_attempted" "$device" <<'NODE' \
    > "$diagnostics/status.json"
console.log(JSON.stringify({
  commandExitCode: Number(process.argv[2]),
  captureFailed: process.argv[3] === '1',
  flowAttempted: process.argv[4] === '1',
  emulator: process.argv[5] || null,
}, null, 2));
NODE
  then
    capture_failed=1
    echo 'Android replay could not record its final result.' >&2
  fi
  # A diagnostic error fails a successful command but never replaces its original failure.
  if [[ "$original_result" = 0 && "$capture_failed" = 1 ]]; then original_result=1; fi
  exit "$original_result"
}
trap collect_evidence EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

timeout --signal=KILL 15s adb devices > "$diagnostics/logs/devices.log" 2> "$diagnostics/logs/devices-errors.log"
device=$(node - "$diagnostics/logs/devices.log" <<'NODE'
const fs = require('node:fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/)
  .map(line => line.trim()).filter(line => line && line !== 'List of devices attached');
if (lines.length !== 1 || !/^emulator-[0-9]+\s+device$/.test(lines[0])) {
  console.error('Android replay requires exactly one online emulator and no other targets.');
  process.exit(1);
}
console.log(lines[0].split(/\s+/)[0]);
NODE
)
timeout --signal=KILL 60s adb -s "$device" install -r build/ci-artifacts/foundation-ci.apk \
  > "$diagnostics/logs/install.log" 2>&1
timeout --signal=KILL 15s adb -s "$device" logcat -c > "$diagnostics/logs/clear.log" 2>&1

flow_attempted=1
# Match the live cold launcher: explicit binary, HOME and both Java properties, no version probe.
HOME="$state/home" TMPDIR="$state/scratch" \
JAVA_TOOL_OPTIONS="-Duser.home=$state/home -Djava.io.tmpdir=$state/scratch" \
node - "$maestro" "$device" "$diagnostics" <<'NODE' \
  > "$diagnostics/logs/maestro-stdout.log" 2> "$diagnostics/logs/maestro-stderr.log"
const {spawnSync} = require('node:child_process');
const [maestro, device, diagnostics] = process.argv.slice(2);
const result = spawnSync(maestro, [
  '--device', device, 'test', '--no-ansi',
  '--format', 'junit', '--output', `${diagnostics}/results/result.xml`,
  '--debug-output', `${diagnostics}/debug`, '--test-output-dir', `${diagnostics}/results`,
  '-e', 'APP_ID=com.iot_pnp.ci', '.maestro/startup.yaml',
], {stdio: 'inherit', timeout: 360000, killSignal: 'SIGKILL'});
if (result.error || result.signal) console.error('Android replay Maestro did not exit normally.');
process.exit(result.error || result.signal ? 1 : (result.status ?? 1));
NODE
