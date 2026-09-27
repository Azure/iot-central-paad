#!/usr/bin/env bash
set -euo pipefail

test "${PAAD_VARIANT:-}" = ci
mkdir -p build/ci-artifacts
if [[ "${PAAD_REFRESH_POD_LOCK:-0}" = 1 ]]; then
  mode=explicit-refresh
elif [[ -s ios/Podfile.lock ]]; then
  mode=deployment
elif [[ -s build/ci-artifacts/Podfile.lock ]]; then
  # Clean prebuild replaces ios/, so restore only the reviewed lock, not projects.
  cp build/ci-artifacts/Podfile.lock ios/Podfile.lock
  mode=deployment
else
  echo 'Missing reviewed Podfile.lock; dispatch refresh_pod_lock=true explicitly.' >&2
  exit 1
fi
printf 'CocoaPods lock mode: %s\n' "$mode" | tee -a build/ci-artifacts/identity.txt
(
  cd ios
  if [[ "$mode" = deployment ]]; then
    bundle exec pod install --deployment
  else
    bundle exec pod update --no-repo-update
  fi
) 2>&1 | tee build/ci-artifacts/pod-install.log
cp ios/Podfile.lock build/ci-artifacts/Podfile.lock
shasum -a 256 ios/Podfile.lock | tee -a build/ci-artifacts/identity.txt
