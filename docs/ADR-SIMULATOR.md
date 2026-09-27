# ADR onboarding and simulator use

The phone is a device client, not an Azure administration console. It provisions
through DPS, uses the returned Hub/device identity, and sends activity. Namespace
links, enrollments and operator authorization are configured outside the app.

Implementation and acceptance are distinct: inspect the actual run result and
independent operator report before treating a mobile-to-cloud case as proven.
The foundation's credential-free native gate is recorded in
[MODERNIZATION.md](plans/MODERNIZATION.md).
The completed Android/iOS simulator cloud-proof and cold-restoration evidence is
recorded in the [acceptance ledger](plans/ADR-NAMESPACE-INTEGRATION.md#completed-simulator-acceptance-2026-09-18).
These results do not establish physical-phone or downstream telemetry acceptance.

## Prepare Azure once, then enroll each phone

The namespace-based flow requires an operator-managed ADR namespace, DPS and
IoT Hub, their managed-identity configuration, and resource-scoped permissions.
Link DPS first and then Hub to the namespace; this flow does not use classic
DPS linked-Hub configuration. The tested preview configuration and role matrix
are in the [cloud preparation plan](plans/ADR-NAMESPACE-INTEGRATION.md#cloud-preparation-operator-or-setup-automation-never-the-phone).
Confirm preview access, supported endpoints and cost before creating a new stack.
An existing correctly configured stack can serve multiple individual enrollments.

For each phone, create an enabled individual symmetric-key DPS enrollment and
securely supply its bootstrap values below. Do not manually create an ADR registry
device for an automatic-onboarding proof. DPS provisions the assigned Hub device
identity, and the operator checks the resulting automatic ADR record separately.
The phone itself creates no Azure infrastructure and receives no operator login.
ADR is inventory, not a telemetry store or dashboard.

In Azure Portal, find the resource group, inspect the DPS enrollment and assigned
registration, and find the assigned device under the Hub's Devices page. Its
device twin exposes the model and reported properties. Preview portal support
may be incomplete; the existing authorized Azure CLI setup can inspect the
namespace links and registry without requesting keys:

```bash
az iot adr ns link dps list --namespace <namespace> --resource-group <rg> \
  --subscription <subscription-id>
az iot adr ns link hub list --namespace <namespace> --resource-group <rg> \
  --subscription <subscription-id>
az iot adr ns registry-device list --namespace <namespace> --resource-group <rg> \
  --subscription <subscription-id> \
  --query "[?properties.externalDeviceId=='<assigned-device-id>'].{name:name,id:id,externalDeviceId:properties.externalDeviceId}"
az iot hub device-twin show --hub-name <configured-Hub-service-host> \
  --device-id <assigned-device-id> --auth-type login \
  --subscription <subscription-id> \
  --query '{deviceId:deviceId,modelId:modelId,proof:properties.reported.paadProof}'
```

Use the assigned device ID, not an assumed copy of the enrollment registration
ID. Service hostnames can differ from the device-facing addresses shown by the
app. A stored proof marker establishes a past submission; it does not by itself
establish that the device is still online.

## Windows emulator with a WSL checkout

Keep source and development tools in WSL. Run Android Studio on Windows and
create/start an API 36 x86_64 emulator. Neither Expo Go nor a local Metro server
is needed for the bundled CI APK.

Download the exact reviewed commit's Android artifact from GitHub Actions and
extract `foundation-ci.apk`. The ordinary foundation workflow publishes it after
a credential-free build. A manually authorized live workflow also publishes
`live-build-android-<sha>-<attempt>` **before** the device-input step receives a key.
The accompanying `identity.txt` records source/toolchain identity and the APK hash.

Drag the APK onto the running emulator, or use Windows PowerShell:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb -e install -r "$env:USERPROFILE\Downloads\foundation-ci.apk"
& $adb -e shell monkey -p com.iot_pnp.ci -c android.intent.category.LAUNCHER 1
```

`-e` requires one running emulator. With multiple emulators, select the intended
serial from `adb devices` using `-s <serial>` instead. The isolated package is
`com.iot_pnp.ci`, not the production application. `install -r` preserves its data;
use the app's explicit Forget Credentials action when a fresh local connection
is intended.

Artifacts expire after three days. Download a completed run's artifact, not an
arbitrary latest build. Windows cannot run Apple's iOS Simulator; the equivalent
`foundation-simulator.app.zip` requires a Mac and compatible Xcode/runtime.

## Connect using an individual device key

Have an operator supply an enabled individual enrollment and these bootstrap
values. Do not put administrator, DPS service-policy or Hub service-policy keys
in the phone.

| Input | Meaning |
| --- | --- |
| Registration ID | The individual DPS enrollment's registration identifier. |
| ID scope | The configured DPS instance's scope. |
| Device key | This enrollment's individual symmetric key. |
| Provisioning host | The configured device endpoint, without a scheme/path/port. |

Choose **Connect manually**. Individual-key DPS is the default. For a
namespace-linked DPS, the operator configures those links; the phone does not
need subscription or namespace management fields. Preview environments may use
a different provisioning endpoint: obtain it from operator readback instead of
assuming the public default.

The phone model remains `dtmi:azureiot:PhoneAsADevice;2`. After connecting, compare
the displayed assigned device and Hub with the actual DPS result. The assigned
device ID is not assumed to equal the registration ID.

If iOS presents **Save Password?**, choose **Not Now** before opening Details.
PAAD manages device credentials in its own secure local storage; this system
password-manager sheet is not an Azure sign-in or provisioning step.

The device protocols use DPS `2019-03-31` and IoT Hub `2021-04-12` (MQTT and
file-upload APIs), matching the respective device SDK contracts. These are
separate from the operator's ARM and namespace-management API versions.

**Change connection method** exposes direct-Hub device connection strings and
the explicitly labelled legacy enrollment-group path. Group keys are retained
for compatibility, not recommended for new individual onboarding.

Keys are masked until deliberately revealed. Do not put keys, QR images or
credential screenshots in issues, logs or reports. Avoid clipboard history/sync
when transferring a key, and clear the clipboard after pasting it.

Connection failures show a sanitized error code, the HTTP status when available,
and a numeric DPS service code when returned. Service response bodies and raw
messages are not displayed. Form values remain available for correction/retry.

Disconnect stops the session without erasing saved credentials. Forget
Credentials is a separate confirmed action and does not delete an Azure device.
Ordinary cold restart restores the saved connection once; failures offer an
explicit retry rather than an infinite reconnect loop.

An established session that drops is labelled **Connection interrupted**
(`CONNECTION_LOST`), separately from an initial `CONNECT_FAILED`. Neither code
alone establishes invalid credentials or identifies the underlying network
failure. Device SAS tokens currently last one hour; **Reconnect** generates
fresh authorization from the saved device key. This prototype does not silently
renew or indefinitely reconnect a dropped session.

## Versioned QR input

New QR payloads use a strict envelope. The scanner accepts JSON, base64 JSON and
the existing encrypted decoding path. For individual DPS:

```json
{
  "schema": "paad.connection",
  "version": 1,
  "mode": "dps",
  "credentials": {
    "registrationId": "<individual-registration-id>",
    "scopeId": "<DPS-scope>",
    "deviceKey": "<individual-device-key>",
    "provisioningHost": "global.azure-devices-provisioning.net"
  }
}
```

For direct Hub, use `"mode": "hub"` and
`"credentials": {"connectionString": "<device-connection-string>"}`.
These are placeholder examples, not usable credentials. Unknown versions,
administrator/certificate fields and new group-key envelopes are rejected.
Legacy supported QR formats remain compatible. Generate any real QR offline:
the QR itself contains a device credential.

## Local activity versus independent Azure confirmation

Connected pages use a compact status row beneath the **Phone as a Device**
header, without a repeated connection heading. Tap **Details**
to see the full assigned device ID, Hub and model, or to disconnect, reconnect
or open manual connection settings. Identity values remain selectable and are
not shortened; they no longer occupy the top of every tab.
The connection busy state uses an accessible in-tree overlay so it does not
compete with the Details sheet's native iOS presentation. Other screen-local
loading dialogs retain their native blocking behavior. This is presentation
hardening, not independent evidence of a successful cloud connection.
The full-screen Android details sheet applies system safe-area insets so its
Close button and content remain outside system bars; iOS keeps its native
page-sheet inset behavior.

Connection errors belong to the connection summary or the active onboarding
screen, not below the bottom navigation tabs. The compact notice offers recovery;
technical error/status codes remain available in Details rather than being
repeated across the screen.

Open connection details and submit a unique proof nonce. The app sends telemetry
and a reported property:

```json
{"paadProof": {"nonce": "<unique-nonce>", "platform": "android"}}
```

**Submitted locally** means both MQTT operations were submitted to the local
transport. It is not a broker ACK or downstream telemetry receipt. Offline
simulation cannot produce a cloud-proof success.

Registry status deliberately stays **Not checked** in the app. A device key does
not authorize ARM inventory reads. The operator confirms the actual namespace
record separately; no registry device is manually created for this proof.

The operator uses an existing authorized Azure CLI login and a nonsecret config:

```json
{
  "schemaVersion": 1,
  "provisioningHost": "<configured-DPS-device-host>",
  "scopeId": "<DPS-scope>",
  "expectedHub": "<configured-Hub-device-host>",
  "cases": {
    "android": {
      "registrationId": "<unique-registration-id>",
      "expectedDeviceId": "<expected-assigned-device-id>",
      "nonce": "android-unique-proof-marker"
    }
  }
}
```

Use a fresh enrollment/device identity for a new automatic-record-creation case
and a fresh nonce for each traffic attempt. Do not place any key in this config.

```bash
node scripts/ci/verify-mobile-proof.js --before \
  --config /path/to/nonsecret-config.json --platform android \
  --subscription <subscription-id> --resource-group <resource-group> \
  --namespace <namespace-name> \
  --dps-service-host <configured-DPS-service-host> \
  --hub-service-host <configured-Hub-service-host>
```

If the installed preview CLI no longer exposes `iot adr ns registry-device`,
both operator helpers accept an explicit `--registry-arm-endpoint` of
`https://management.azure.com` or `https://centraluseuap.management.azure.com`.
This selects read-only inventory requests using API `2026-11-02-preview`, not
an automatic fallback or a CLI downgrade. Continuations must retain the same
origin, namespace path and API version; inventory is bounded to 20 pages and
10,000 records within the existing deadline. No permissions or resources are
changed, and no operator credentials enter the app or device-input workflow.

Retain this pre-traffic absence report. After the app sends the same nonce, run
the same command **without `--before`**. It performs bounded, read-only checks
for the exact DPS assignment, Hub twin model/nonce, and ADR external-device
identity. It requests no keys and performs no cloud writes. Service hostnames
may differ from device hostnames; supply the actual configured values.

## Import operator-provided Azure context

**Details > Azure environment** can show a saved namespace, subscription,
resource group, region, Hub/DPS links, registry record and namespace activity.
This is an explicitly labelled operator-provided snapshot, not an in-app ARM
query or a live registry check. It is displayed only for its matching assigned
device/Hub identity. Offline simulation does not display it.

Using the project's Node 24.19 or newer and the existing authorized Azure CLI
login, export a device-bound snapshot without requesting any keys:

```bash
node scripts/ci/export-azure-context.js \
  --config /path/to/nonsecret-config.json --platform android \
  --subscription <subscription-id> --resource-group <resource-group> \
  --namespace <namespace-name> \
  --dps-service-host <configured-DPS-service-host> \
  --hub-service-host <configured-Hub-service-host> \
  --out /path/to/new-azure-context.json
```

The exporter verifies actual namespace links and the DPS assignment, reads the
matching registry record when present, and captures up to 20 namespace management
events from the preceding 24 hours. It excludes caller identities, claims, IP
addresses, authentication material and device telemetry. A denied read fails
explicitly rather than producing an empty success. Version 1 requires the
namespace, DPS and Hub to share the stated subscription and resource group.

Choose **Import snapshot**, paste the exported JSON or its canonical Base64
encoding, and confirm the import. No lab values are bundled into the app.
The snapshot is saved with the existing local settings and survives restart;
**Remove snapshot** removes only this context, while **Forget credentials** or
**Clear Data** also removes it. Corrupt optional context surfaces an import error
without blocking valid device credentials from restoring.

Portal links open the external browser, where Azure authorization remains
separate. **Namespace activity** includes other devices in the namespace and is
neither a live feed nor telemetry history. Re-export and import to refresh its
timestamp. An imported record does not change the app's live registry status
from **Not checked**.

## Authorized automated live runs

The separate `live-device.yml` workflow requires the repository owner,
`feature/adr-onboarding`, an exact reviewed SHA, explicit confirmation and
validated nonsecret case JSON. Its push-only registration job only makes the
manual entrypoint discoverable and does not perform a live run.

Dedicated secrets are `PAAD_LIVE_ANDROID_DEVICE_KEY` and
`PAAD_LIVE_IOS_DEVICE_KEY`. Only the post-build device-input step receives them;
no Azure operator credentials are supplied to CI. The operator must remove these
temporary secrets after the run, including unsuccessful attempts.
Confirm the names were absent before creating them, and arrange operator-side
cleanup monitoring before waiting for interactive input. Native jobs remain
bounded to 45 minutes; the device step allows 20 minutes for simulator startup,
a 15-minute maximum Maestro process, and private-state cleanup.

The flow exercises manual navigation, actual provisioning/connection, assigned
identity, nonce submission and cold restoration. Credential-free binaries are
published before secret injection. Afterward, only allowlisted summaries and
safe failure codes are uploaded, never raw Maestro logs, hierarchies or images.
Maestro 2.10.0 creates private failure artifacts and has no supported automatic
failure-image opt-out; inputs remain masked, and those artifacts are deleted
without publication. Do not enable reveal or recording in live automation.
Unavailable diagnostics include only a fixed reason category, such as missing
supported metadata, a size/count limit, or a read failure. They never include
raw errors or paths, and unavailability alone does not establish a UI timeout.
Diagnostics may also list a small fixed set of UI target names observed in
captured failure hierarchies, without their values. This is accumulated target
presence, not a claim of current visibility, a successful tap, or cloud proof.
`hierarchyCaptured` distinguishes an absent hierarchy from a captured tree
without those targets. Failed commands may include a fixed framework failure
category; source error messages and operation details are never exported.
When time remains after an iOS failure, the pinned `maestro hierarchy` command
may obtain a new snapshot on that same owned simulator. This shares the original
15-minute Maestro deadline, does not retry the flow, and writes only allowlisted
fields after parsing in memory. Such presence is post-failure diagnostic context,
not a reconstruction of the failure instant or a successful UI assertion.
Reports may also classify a fixed set of public labels (app/manual/loading
headings and generic dialog actions), without copying their source text or
credential-field values. A generic Allow/Cancel label alone does not establish
which dialog was shown. All file, byte, command and node limits remain unchanged.
All iOS lanes allow four minutes for cold XCTest startup within their existing
overall command and job deadlines.

A UI success report still says independent Azure verification is pending.
Pair it with the operator verifier's result. Downstream telemetry consumption,
physical camera/BLE/sensor accuracy, production signing, secure-storage upgrade
acceptance, certificates and in-app inventory authorization remain separate.

The opt-in `ios_driver=xcuitest` lane builds a standalone native UI runner without
rebuilding or re-signing the app. A synthetic-input smoke flow runs before device
input and never presses Connect; the live flow retains exact assignment, nonce
and connected cold-restoration assertions. Ordinary Maestro coverage is unchanged.
To exercise only this credential-free lane, dispatch with `platform=ios`,
`ios_driver=xcuitest` and `ios_smoke_only=true`, plus the existing owner/exact-SHA
confirmation and nonsecret configuration. This mode skips the device-secret step
entirely. Only this no-secret mode also retains a bounded synthetic runner log
(final 1 MiB, three days). Credentialed runs export only fixed-category summaries;
their raw native output and result bundles remain private and are deleted.

For harness-only iteration, `replay-ios.yml` also accepts `ios_driver=xcuitest`.
Supply a completed authorized live-workflow `source_run` and exact `source_sha`;
the existing verifier downloads only its pre-secret simulator app and checks its
identity and hash. The replay builds only the small native runner, creates a
fresh owned simulator and exercises synthetic input without Connect. Its
diagnostics bind the older app source separately from the current harness.
This is not current-source mobile/cloud acceptance. The native harness uses
Apple's application activation API; a cold-restoration assertion still requires
actual termination and an observed not-running state before reactivation.

Native preflight and native replay allow up to ten minutes for a fresh
simulator's `bootstatus -b` operation to complete, including data migration.
They do not treat the earlier Booted state as ready. Installing the bundled app
on that fresh simulator has a separate three-minute allowance. Their steps are
bounded to
25 minutes; XCTest and live proof deadlines are unchanged. A failed synthetic
bootstrap reports only its fixed stage and subprocess outcome, even when raw
diagnostic retention is disabled.

Android map preview needs a restricted key configured at native build time;
without one, coordinates remain available. Image upload also requires Hub-side
storage configuration; this workflow does not create that infrastructure.

## Credential-free Android replay

`replay-android.yml` reuses a completed, owner-dispatched live run's pre-secret
APK without rebuilding it. Supply its exact run ID and source SHA:

```bash
gh workflow run replay-android.yml --ref feature/adr-onboarding \
  -f source_run=<completed-live-run-id> -f source_sha=<binary-source-sha>
```

The lane verifies the run, artifact, identity and APK checksum, then uses the
live-style isolated Java/home environment with synthetic input only. It never
presses Connect and refuses device-key/live-config environment variables.
Its three-day artifact contains credential-free runtime, window, screenshot and
Maestro evidence. `replay-identity.json` distinguishes the original binary source
from the replay harness and flow; this is not Azure acceptance evidence.
Startup recovery dismisses only the observed stock-emulator **Quickstep isn't
responding** and **System UI isn't responding** dialogs. It does not dismiss PAAD or other application ANRs, and the
normal app/startup assertions still have to pass.

## Credential-free iOS replay

`replay-ios.yml` accepts the same exact `source_run` and `source_sha` inputs and
reuses that completed live run's pre-secret `foundation-simulator.app.zip`.
Both replay lanes share the run/artifact/identity/checksum binding. iOS creates
its own iPhone 17 / iOS 26.5 Simulator with Xcode 26.6, verifies the isolated
bundle ID, and runs only the synthetic startup flow with a cold, isolated
Maestro home. It never adopts an existing simulator or receives device inputs.

The bounded Maestro budget and simulator operations leave cleanup
time within the fifteen-minute step. The lane captures credential-free Maestro
output, selected runtime logs and a final screenshot, then shuts down/deletes
only its newly created simulator. Its scoped three-day artifact distinguishes
the binary source from the replay harness; this is not mobile-to-Azure proof.
