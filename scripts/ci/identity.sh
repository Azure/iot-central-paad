#!/usr/bin/env bash
set -euo pipefail

mkdir -p build/ci-artifacts
if [[ -s ios/Podfile.lock ]]; then
  cp ios/Podfile.lock build/ci-artifacts/Podfile.lock
fi
{
  printf 'Foundation: Expo %s / React Native %s / React %s\n' \
    "$(node -p "require('expo/package.json').version")" \
    "$(node -p "require('react-native/package.json').version")" \
    "$(node -p "require('react/package.json').version")"
  printf 'Native template: expo-template-bare-minimum@57.0.25\n'
  printf 'Built commit: %s\n' "$(git rev-parse HEAD)"
  printf 'Event SHA: %s\n' "${GITHUB_SHA:-local}"
  printf 'PR head SHA: %s\n' "${PR_HEAD_SHA:-not-a-pr}"
  printf 'Run: %s attempt %s\n' "${GITHUB_RUN_ID:-local}" "${GITHUB_RUN_ATTEMPT:-1}"
  printf 'Runner: %s %s\n' "${RUNNER_OS:-local}" "${RUNNER_ARCH:-unknown}"
  printf 'Image: %s %s\n' "${ImageOS:-unknown}" "${ImageVersion:-unknown}"
  printf 'Node: %s\n' "$(node --version)"
  printf 'npm: %s\n' "$(npm --version)"
  printf 'Native variant: %s\n' "${PAAD_VARIANT:-development}"
  printf 'Maestro: cli-2.10.0\n'
  shasum -a 256 package-lock.json Gemfile.lock app.json app.config.js app.plugin.js
} | tee build/ci-artifacts/identity.txt
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat build/ci-artifacts/identity.txt >> "$GITHUB_STEP_SUMMARY"
fi
