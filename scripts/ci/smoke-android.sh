#!/usr/bin/env bash
set -euo pipefail

test -s build/ci-artifacts/foundation-ci.apk
adb install -r build/ci-artifacts/foundation-ci.apk
adb logcat -c
collect_evidence() {
  result=$?
  trap - EXIT
  if ! adb logcat -d -s AndroidRuntime:E ReactNativeJS:V ReactNative:V \
    > build/ci-artifacts/android-runtime.log; then
    echo 'Could not capture Android runtime diagnostics' >&2
    result=1
  fi
  if ! adb exec-out screencap -p > build/ci-artifacts/android-screen.png; then
    echo 'Could not capture the credential-free Android screen' >&2
    result=1
  fi
  exit "$result"
}
trap collect_evidence EXIT
maestro --version
maestro test --no-ansi --format junit \
  --output build/ci-artifacts/maestro-android.xml \
  --test-output-dir build/ci-artifacts/maestro-android \
  -e APP_ID=com.iot_pnp.ci .maestro/startup.yaml
