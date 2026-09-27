#!/usr/bin/env bash
set -euo pipefail
umask 077

platform="${1:-}"
if [[ "$platform" != android && "$platform" != ios ]]; then
  echo 'Live smoke requires one supported platform.' >&2
  exit 1
fi
driver="${PAAD_IOS_UI_DRIVER:-maestro}"
if [[ "$driver" != maestro && ( "$platform" != ios || "$driver" != xcuitest ) ]]; then
  echo 'Unsupported live UI driver.' >&2
  exit 1
fi
# Recheck authorization before even reading a key; dispatch data is never shell code.
if [[ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ||
      "${PAAD_LIVE_CONFIRM:-}" != true ||
      "${GITHUB_REF:-}" != refs/heads/feature/adr-onboarding ||
      -z "${GITHUB_REPOSITORY_OWNER:-}" ||
      "${GITHUB_ACTOR:-}" != "$GITHUB_REPOSITORY_OWNER" ||
      ! "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ||
      "${PAAD_LIVE_EXPECTED_SHA:-}" != "$GITHUB_SHA" ||
      "${PAAD_VARIANT:-}" != ci ]]; then
  echo 'Live smoke authorization rejected.' >&2
  exit 1
fi
node scripts/ci/live-config.js validate "$platform"
if [[ -z "${MAESTRO_DEVICE_KEY:-}" ]]; then
  echo 'Dedicated device input secret is unavailable.' >&2
  exit 1
fi
node - <<'NODE'
const key = process.env.MAESTRO_DEVICE_KEY;
if (key.length > 512 || Buffer.from(key, 'base64').length < 16 ||
    Buffer.from(key, 'base64').toString('base64') !== key) {
  console.error('Dedicated device input is not canonical Base64 key material.');
  process.exit(1);
}
NODE

test ! -L build
mkdir -p build
# No preexisting directory is adopted or deleted. All raw Maestro output is private.
private="$PWD/build/live-device-private"
mkdir "$private"
private_identity=$(node -e 'const s=require("node:fs").lstatSync(process.argv[1]); console.log(`${s.dev}:${s.ino}`)' "$private")
flow_attempted=0
flow_result=failed
device=''
cleanup() {
  code=$?
  trap - EXIT INT TERM
  unset MAESTRO_DEVICE_KEY
  cleanup_failed=0
  diagnostics='{"availability":"unavailable"}'
  if [[ "$flow_attempted" = 1 ]]; then
    # Only an allowlisted value leaves the private tree, after the UI driver exits.
    if [[ "$driver" = xcuitest ]]; then
      diagnostics=$(node scripts/ci/run-ios-xcuitest.js diagnostics) || code=1
    else
      diagnostics=$(node scripts/ci/live-diagnostics.js "$platform") || code=1
    fi
  fi
  if [[ "$platform" = android && -n "$device" ]]; then
    adb -s "$device" shell am force-stop com.iot_pnp.ci >/dev/null 2>&1 || cleanup_failed=1
    adb -s "$device" shell pm clear com.iot_pnp.ci >/dev/null 2>&1 || cleanup_failed=1
    adb -s "$device" logcat -c >/dev/null 2>&1 || cleanup_failed=1
  elif [[ "$platform" = ios && -n "$device" ]]; then
    if ! xcrun simctl shutdown "$device" >/dev/null 2>&1; then
      echo '::warning::Dedicated simulator shutdown did not complete (it may already be stopped); attempting owned-device deletion.'
    fi
    if xcrun simctl delete "$device" >/dev/null 2>&1; then
      printf 'PAAD_LIVE_SIMULATOR_DELETED=1\n' >> "$GITHUB_ENV"
    else
      cleanup_failed=1
    fi
  fi
  # Refuse replaced/symlinked roots; remove only the inode exclusively created above.
  if ! PAAD_LIVE_SAFE_DIAGNOSTICS="$diagnostics" \
    node - "$private_identity" "$platform" "$flow_attempted" "$flow_result" "$cleanup_failed" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const {createLiveReport} = require('./scripts/ci/live-config');
try {
  const root = path.resolve('build/live-device-private');
  const build = fs.lstatSync(path.resolve('build'));
  const stat = fs.lstatSync(root);
  if (!build.isDirectory() || build.isSymbolicLink() || !stat.isDirectory() ||
      stat.isSymbolicLink() || `${stat.dev}:${stat.ino}` !== process.argv[2]) throw new Error();
  let report;
  try {
    if (process.argv[4] === '1') {
      report = createLiveReport(process.env.PAAD_LIVE_CONFIG, process.argv[3], {
        sourceSha: process.env.GITHUB_SHA,
        uiResult: process.argv[6] === '1' ? 'failed' : process.argv[5],
        diagnostics: JSON.parse(process.env.PAAD_LIVE_SAFE_DIAGNOSTICS),
      });
    }
  } catch { process.exitCode = 1; }
  try {
    fs.rmSync(root, {recursive: true});
  } catch {
    process.exitCode = 1;
    if (report) report.uiResult = 'failed';
  }
  if (report) {
    const current = fs.lstatSync(path.resolve('build'));
    if (current.isSymbolicLink() || current.dev !== build.dev || current.ino !== build.ino) throw new Error();
    fs.writeFileSync(`build/live-device-summary-${process.argv[3]}.json`,
      `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  }
} catch {
  process.exitCode = 1;
}
NODE
  then cleanup_failed=1; fi
  if [[ "$cleanup_failed" = 1 ]]; then
    code=1
    flow_result=failed
    echo 'Live private-state cleanup failed; no raw diagnostics will be uploaded.' >&2
  fi
  if [[ "$code" != 0 ]]; then
    echo 'Live smoke failed. Consult only the allowlisted summary; independent Azure verification remains pending.' >&2
  fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir "$private/home" "$private/scratch" "$private/debug" "$private/results"
test ! -e "$PWD/build/live-device-summary-$platform.json"
maestro="$PWD/build/ci-tools/maestro/bin/maestro"
if [[ "$driver" = maestro ]]; then test -x "$maestro"; fi
node scripts/ci/live-config.js env "$platform" > "$private/case.env"
while IFS='=' read -r name value; do
  export "$name=$value"
done < "$private/case.env"

if [[ "$platform" = android ]]; then
  # Refuse physical devices and ambiguity; the workflow creates exactly one emulator.
  candidate=$(adb devices | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" {print $1}')
  [[ "$candidate" =~ ^emulator-[0-9]+$ ]]
  device="$candidate"
  adb -s "$device" install -r build/ci-artifacts/foundation-ci.apk > "$private/install.log" 2>&1
  adb -s "$device" logcat -c > "$private/clear.log" 2>&1
else
  export MAESTRO_DRIVER_STARTUP_TIMEOUT=240000
  export DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR"
  candidate="${IOS_SIMULATOR_UDID:-}"
  [[ "$candidate" =~ ^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$ ]]
  device="$candidate"
  xcrun simctl boot "$device" > "$private/boot.log" 2>&1
  xcrun simctl bootstatus "$device" -b >> "$private/boot.log" 2>&1
  xcrun simctl install "$device" \
    build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app > "$private/install.log" 2>&1
  env -u MAESTRO_DEVICE_KEY -u PAAD_LIVE_CONFIG \
    bash scripts/ci/show-ios-simulator.sh "$device" > "$private/simulator-ui.log" 2>&1
fi

export PAAD_LIVE_MAESTRO_DEVICE="$device"
export PAAD_LIVE_PRIVATE="$private"
export PAAD_LIVE_MAESTRO_BIN="$maestro"
export PAAD_LIVE_PLATFORM="$platform"
flow_attempted=1
if [[ "$driver" = xcuitest ]]; then
  set +e
  node scripts/ci/run-ios-xcuitest.js live > "$private/native-launch.log" 2>&1
  status=$?
  set -e
  if [[ "$status" = 0 ]]; then flow_result=passed; fi
  exit "$status"
fi
set +e
# Java does not necessarily honor HOME; isolate its home and scratch explicitly.
# cli-2.10.0 has no supported failure-screenshot opt-out. Its ephemeral images
# stay private and are deleted, never uploaded. Secure key fields remain masked.
# The installed Gradle launcher resolves APP_HOME relative to its own path.
# No key is passed on argv. Maestro imports MAESTRO_* directly from step env.
HOME="$private/home" TMPDIR="$private/scratch" \
JAVA_TOOL_OPTIONS="-Duser.home=$private/home -Djava.io.tmpdir=$private/scratch" \
node - <<'NODE' > "$private/maestro.log" 2>&1
const {spawnSync} = require('node:child_process');
const {captureFailedIosUi} = require('./scripts/ci/capture-failed-ios-ui');
const path = process.env.PAAD_LIVE_PRIVATE;
const startedAt = Date.now();
const result = spawnSync(process.env.PAAD_LIVE_MAESTRO_BIN, [
  '--device', process.env.PAAD_LIVE_MAESTRO_DEVICE, 'test', '--no-ansi',
  '--format', 'junit', '--output', `${path}/results/result.xml`,
  '--debug-output', `${path}/debug`, '--test-output-dir', `${path}/results`,
  '.maestro/live-device.yaml',
], {stdio: 'inherit', timeout: 900000, killSignal: 'SIGKILL'});
if (result.error || result.signal || result.status !== 0) {
  const capture = captureFailedIosUi({
    platform: process.env.PAAD_LIVE_PLATFORM, startedAt, privateDirectory: path,
    maestro: process.env.PAAD_LIVE_MAESTRO_BIN, device: process.env.PAAD_LIVE_MAESTRO_DEVICE,
  });
  console.error(`Bounded post-failure UI capture: ${capture}`);
}
process.exit(result.error || result.signal ? 1 : (result.status ?? 1));
NODE
status=$?
set -e
if [[ "$status" = 0 ]]; then flow_result=passed; fi
exit "$status"
