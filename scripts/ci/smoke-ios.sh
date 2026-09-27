#!/usr/bin/env bash
set -euo pipefail

export DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR"
xcrun simctl boot "$IOS_SIMULATOR_UDID"
printf 'IOS_SIMULATOR_STARTED=1\n' >> "$GITHUB_ENV"
xcrun simctl bootstatus "$IOS_SIMULATOR_UDID" -b
xcrun simctl install "$IOS_SIMULATOR_UDID" \
  build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app
collect_evidence() {
  result=$?
  trap - EXIT
  if ! xcrun simctl spawn "$IOS_SIMULATOR_UDID" log show --style compact \
    --last 5m --predicate 'process == "IoTPnP" OR ((process == "SpringBoard" OR process == "runningboardd" OR process == "CoreSimulatorBridge") AND eventMessage CONTAINS "com.microsoft.iotpnp.ci")' \
    > build/ci-artifacts/ios-runtime.log; then
    echo 'Could not capture iOS runtime diagnostics' >&2
    result=1
  fi
  if ! xcrun simctl io "$IOS_SIMULATOR_UDID" screenshot \
    build/ci-artifacts/ios-screen.png; then
    echo 'Could not capture the credential-free iOS screen' >&2
    result=1
  fi
  exit "$result"
}
trap collect_evidence EXIT
bash scripts/ci/show-ios-simulator.sh "$IOS_SIMULATOR_UDID"
# The cold hosted XCTest runner can take more than the default two minutes.
export MAESTRO_DRIVER_STARTUP_TIMEOUT=240000
maestro --version
maestro --device "$IOS_SIMULATOR_UDID" test --no-ansi --format junit \
  --output build/ci-artifacts/maestro-ios.xml \
  --test-output-dir build/ci-artifacts/maestro-ios \
  -e APP_ID=com.microsoft.iotpnp.ci .maestro/startup.yaml
