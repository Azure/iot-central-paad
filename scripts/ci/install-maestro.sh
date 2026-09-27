#!/usr/bin/env bash
set -euo pipefail

version=cli-2.10.0
checksum=29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991
tools="$PWD/build/ci-tools"
mkdir -p "$tools"
curl --fail --location --retry 3 --connect-timeout 30 --max-time 300 \
  "https://github.com/mobile-dev-inc/Maestro/releases/download/$version/maestro.zip" \
  --output "$tools/maestro.zip"
printf '%s  %s\n' "$checksum" "$tools/maestro.zip" | shasum -a 256 --check
unzip -q -o "$tools/maestro.zip" -d "$tools"
test -x "$tools/maestro/bin/maestro"
printf '%s\n' "$tools/maestro/bin" >> "$GITHUB_PATH"
printf 'Maestro %s SHA256 %s\n' "$version" "$checksum"
