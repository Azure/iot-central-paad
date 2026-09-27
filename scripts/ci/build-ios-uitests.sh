#!/usr/bin/env bash
set -euo pipefail

# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
#
# Builds the native XCUITest runner before any device credential exists.
# Only compiler and packaging output is produced here.

test "${PAAD_VARIANT:-}" = ci
test "$DEVELOPER_DIR" = /Applications/Xcode_26.6.app/Contents/Developer
test "$IOS_SIMULATOR_DEVELOPER_DIR" = "$DEVELOPER_DIR"
if [[ "${PAAD_XCTEST_CASE+x}" || "${PAAD_LIVE_CONFIG+x}" ||
      "${MAESTRO_DEVICE_KEY+x}" || "${TEST_RUNNER_PAAD_XCTEST_CASE+x}" ]]; then
  echo 'The XCUITest build refuses live configuration, even when empty.' >&2
  exit 1
fi
test ! -L build
test ! -L build/ci-artifacts
mkdir -p build/ci-artifacts
test ! -e build/ios-uitest-derived
test ! -L build/ios-uitest-derived

name=PaadLiveUITests
host_identifier=com.microsoft.iotpnp.ci.uitests.xctrunner
app=build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app
products=build/ios-uitest-derived/Build/Products
runner="$products/Release-iphonesimulator/$name-Runner.app"
test -x "$app/IoTPnP"

# The application is never rebuilt or re-signed by this lane. Capture its
# identity first so the claim is checked, not asserted.
app_identity=$(shasum -a 256 "$app/IoTPnP" "$app/_CodeSignature/CodeResources")
xcrun segedit "$app/IoTPnP" -extract __TEXT __entitlements \
  build/ci-artifacts/ios-uitest-app-entitlements-before.plist

bundle exec ruby scripts/ci/create-ios-uitest-project.rb build/ios-uitest \
  scripts/ci/PaadLiveUITests.swift | tee build/ci-artifacts/ios-uitest-project.json

xcodebuild -project "build/ios-uitest/$name.xcodeproj" -scheme "$name" \
  -configuration Release -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath build/ios-uitest-derived \
  ONLY_ACTIVE_ARCH=YES "ARCHS=$(uname -m)" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= \
  CODE_SIGN_ENTITLEMENTS= DEVELOPMENT_TEAM= PROVISIONING_PROFILE= \
  PROVISIONING_PROFILE_SPECIFIER= \
  build-for-testing 2>&1 | tee build/ci-artifacts/ios-uitest-build.log

shopt -s nullglob
generated=("$products/${name}_iphonesimulator"*.xctestrun)
shopt -u nullglob
if [[ "${#generated[@]}" -ne 1 ]]; then
  echo 'Expected exactly one generated XCUITest run configuration.' >&2
  exit 1
fi
xctestrun="${generated[0]}"
test -d "$runner"
test -d "$runner/PlugIns/$name.xctest"

plist() {
  /usr/libexec/PlistBuddy -c "Print $1" "$xctestrun"
}
plist_has() {
  /usr/libexec/PlistBuddy -c "Print $1" "$xctestrun" > /dev/null 2>&1
}
plist_set() {
  /usr/libexec/PlistBuddy -c "Set $1 $2" "$xctestrun" > /dev/null 2>&1 ||
    /usr/libexec/PlistBuddy -c "Add $1 $3 $2" "$xctestrun"
}

# Xcode emits format 1 for a scheme without a test plan; resolve rather than
# assume, because the run step addresses the test target through this root.
format=1
if plist_has ":__xctestrun_metadata__:FormatVersion"; then
  format=$(plist ":__xctestrun_metadata__:FormatVersion")
fi
case "$format" in
  1) root=":$name" ;;
  2) root=":TestConfigurations:0:TestTargets:0" ;;
  *) echo 'Unsupported XCUITest run configuration format.' >&2; exit 1 ;;
esac
test "$(plist "$root:BlueprintName")" = "$name"
test "$(plist "$root:IsUITestBundle")" = true
test "$(basename "$(plist "$root:TestHostPath")")" = "$name-Runner.app"
if plist_has "$root:TestHostBundleIdentifier"; then
  test "$(plist "$root:TestHostBundleIdentifier")" = "$host_identifier"
fi
# The tests select the installed application themselves; no target app is bound,
# so nothing here can rebuild, reinstall or re-sign it.
if plist_has "$root:UITargetAppPath"; then
  echo 'The XCUITest runner must not bind a target application path.' >&2
  exit 1
fi
plist_set "$root:UseUITargetAppProvidedByTests" true bool
test "$(plist "$root:UseUITargetAppProvidedByTests")" = true
# Automatic XCTest artifacts stay private and short-lived.
plist_set "$root:SystemAttachmentLifetime" keepNever string
plist_set "$root:UserAttachmentLifetime" keepNever string
test "$(plist "$root:SystemAttachmentLifetime")" = keepNever
test "$(plist "$root:UserAttachmentLifetime")" = keepNever
# Guarantee the exact dictionary the run step injects the test case into.
if ! plist_has "$root:EnvironmentVariables"; then
  /usr/libexec/PlistBuddy -c "Add $root:EnvironmentVariables dict" "$xctestrun"
fi
if plist_has "$root:EnvironmentVariables:PAAD_XCTEST_CASE" ||
   plist_has "$root:UITargetAppEnvironmentVariables:PAAD_XCTEST_CASE"; then
  echo 'The generated run configuration must not carry a test case yet.' >&2
  exit 1
fi

# Simulator runners are unsigned, so no iOS keychain or application-identifier
# entitlement can reach a host signature.
signature=build/ci-artifacts/ios-uitest-runner-signature-entitlements.plist
: > "$signature"
if ! codesign --display --entitlements - --xml "$runner" >> "$signature" \
  2> build/ci-artifacts/ios-uitest-runner-signature.log; then
  if [[ -s "$signature" ]] ||
     ! grep -Fq 'code object is not signed at all' build/ci-artifacts/ios-uitest-runner-signature.log; then
    echo 'The XCUITest runner signature could not be inspected.' >&2
    exit 1
  fi
fi
if [[ -s "$signature" ]] &&
   grep -Eq 'application-identifier|keychain-access-groups' "$signature"; then
  echo 'The XCUITest runner must not carry iOS entitlements.' >&2
  exit 1
fi

xcrun segedit "$app/IoTPnP" -extract __TEXT __entitlements \
  build/ci-artifacts/ios-uitest-app-entitlements-after.plist
cmp build/ci-artifacts/ios-uitest-app-entitlements-before.plist \
  build/ci-artifacts/ios-uitest-app-entitlements-after.plist
test "$(shasum -a 256 "$app/IoTPnP" "$app/_CodeSignature/CodeResources")" = "$app_identity"
codesign --verify --strict --deep "$app"

printf 'iOS XCUITest runner: %s (unsigned simulator bundle)\n' "$name" \
  | tee -a build/ci-artifacts/identity.txt
shasum -a 256 "$runner/PlugIns/$name.xctest/$name" "$xctestrun" \
  | tee -a build/ci-artifacts/identity.txt
printf '{"schemaVersion":1,"runner":"xcuitest","scheme":"%s","testTarget":"%s","xctestrun":"%s","formatVersion":%s,"environmentKeyPath":"%s:EnvironmentVariables"}\n' \
  "$name" "$name" "$xctestrun" "$format" "$root" \
  | tee build/ios-uitest-derived/paad-uitest.json
