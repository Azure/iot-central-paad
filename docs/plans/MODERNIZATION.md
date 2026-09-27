# PAAD modernization plan

Status: M0 and M1 complete; modern prototype foundation ready for ADR integration.
Date: 2026-09-16. Branch: `modernize/paad-foundation`.
Base: fork `master` at `2549196`.

## Current decisions (supersede the original local-first plan)

The foundation uses **CI first**: Android emulators on standard GitHub Linux
runners and iOS Simulators on standard GitHub macOS runners. Windows Android
Studio, a local Mac, EAS and paid physical-iPhone signing are not prerequisites
for prototype progress. Physical-device acceptance remains an independent gate.

The owner approved Expo SDK 57 development builds, minimum iOS 16.4 and Android
7/API 24, and incremental foundation commits/pushes with credential-free Actions
runs. Each job is bounded to 45 minutes and nonsecret build/log/screenshot
artifacts to three days. No larger runners, Azure access, production signing,
automatic merges, or billable-resource/role changes are included.

Subsequent authorization permits local foundation-to-ADR merges and pushes of
both topic branches, plus scoped reuse of the retained proof lab for individual
test enrollments and device traffic. Dedicated temporary device-input Actions
secrets are permitted only in manually dispatched trusted-code live jobs and
must be removed afterward. No administrator credentials enter the app or CI.
No `master` merge, new billable resources, IAM changes or cloud cleanup is authorized.

The baseline lane is `.github/workflows/baseline.yml`: lint and genuine app-startup
Jest coverage, followed by independent bundled Android/iOS builds and Maestro
navigation/cold-restart scenarios. Builds use isolated `.ci` application IDs,
not production signing or credentials. Results must identify the exact built
commit and toolchain; a written workflow is not evidence of a successful run.

On September 18, the ADR footer run `35379275362` stopped before native builds
because Expo's online compatibility check required newly published SDK 57 patches.
That refresh selected Expo `57.0.24`, build-properties `57.0.21`,
and constants, image-picker and location `57.0.19`; React and React Native are
unchanged. The online check remains enabled; earlier native results below apply
to their recorded sources rather than automatically covering new dependency pins.

The September 27 connection-map delivery run `36341300284` encountered the same
online patch-version gate. With explicit owner approval, the current pins select
Expo `57.0.25`, build-properties `57.0.22`, and image-picker/location `57.0.20`.
Constants, React and React Native remain unchanged. The compatibility check is
not bypassed; the updated native resolution follows the explicit lock-refresh
and review process below before ordinary deployment-mode iOS validation.

The explicit refresh run `36341782701`, source
`a89edda0c76fbaf082c7976be5afabfa3487b3f8`, passed both native build/startup
lanes. The reviewed lock changes only versions/checksums for Expo,
ExpoImagePicker, ExpoLocation, ExpoModulesCore, ExpoModulesJSI and
ExpoModulesWorklets, matching the updated npm resolution. The exact generated
lock is committed; ordinary builds continue to use deployment mode.

The first refresh attempt, ADR run `35380792854`, rejected the changed
`ExpoLocation` podspec while still using `pod install`. Explicit refresh now uses
`pod update --no-repo-update` to resolve the requested new lock for review;
ordinary runs still require `pod install --deployment` and never update silently.
The repaired iOS build and startup lane passed in `35382356967` on ADR source
`2fed1f91619084c0b5d2ceaa7a0b0f1db9b93663`; Android passed in `35380792854`
on `4f5554ce403868f705d2bb0352f1a2a488e0f965`. The generated Pod lock was
reviewed: only Expo, EXConstants, ExpoAsset, ExpoImagePicker and ExpoLocation
versions/checksums changed, matching the npm resolution. Its exact bytes are now
committed for subsequent deployment-mode builds on both branches.
Podfile.lock SHA256:
`f3f51f8763c8e690b0ff06c0dd0df6cfce0735e7e6c1f43aa56a0d59d9b20cd7`.

Foundation run `35385478270` subsequently passed JavaScript and both native lanes
on `070841a21c0d2cd2cc709eea31eab07f644c0ee3`. Its iOS artifact records
`deployment` mode and that exact committed lock hash, confirming ordinary
locked builds after the deliberate refresh. This is simulator startup and
compatibility evidence, not physical-device or production-signing acceptance.

The iOS harness presents only its explicitly owned simulator with the pinned
Xcode Simulator app before Maestro requests XCTest screenshots. GUI launch is
bounded to sixty seconds and rejects live device inputs. This addresses a
reported headless-runner stability condition without bypassing UI assertions;
it is not itself evidence of a successful native or cloud run.
The iOS driver startup allowance is four minutes inside the existing overall
job/command bounds. In credential-free run `35193094005`, XCTest's HTTP server
became ready after the pinned driver's default two-minute deadline; this is
separate from app-level assertions and the earlier screenshot failures.

Foundation run `35193089860`, source
`2d587df91ee42447f0b09eac09c01e853e6bc490`, passed JavaScript and both native
lanes with the Opus-informed activity-log and utility-page refinements.
Follow-up log controls use actual 48 dp/pt minimum touch regions rather than
relying on hit slop outside a parent's bounds.
The later header/input refinement
`3e4a1529ad522cdceb50a235c6562802b8b58068` passed all three lanes in run
`35257843934`. It retains the foundation's legacy onboarding form, with the
shared restrained header, explicit 48 dp/pt Settings target and actual editable
input minimum height.
Foundation run `35247956689`, source
`3bf1f3a11731dd52f3697d12265ce69a0447f2b2`, passed JavaScript and both native
lanes. It distinguishes a lost established session (`CONNECTION_LOST`) from an
initial connection failure; it does not infer a network cause or add automatic
reconnection. The newer property-card presentation preserves protocol IDs while
removing the synthetic editable value and clarifying empty states.

The foundation property/notice adaptation
`31467af09a22ce83062b6f75a02e9c8853c1975d` subsequently passed all three lanes
in run `35252459704`, retaining the legacy form while placing errors in the
owning screen rather than below the tab bar.
The synthetic startup flow follows the real flow's endpoint-before-key input
order and rechecks the endpoint afterward. Credential-free run `35227323436`
otherwise left the endpoint at its default while the secure field changed
after an attempted endpoint edit; a completed tap was not proof of focus.

The rounded-header refinement `dc7313e1cc9cb95164973efee054e1d8d640726d`
passed JavaScript and both native lanes in run `35274510385`. It replaces the
two-size chip with uniform Quicksand Bold typography and an original phone mark.
Native font registration and the unchanged font binary are generated from the
pinned package; the full OFL notice is distributed and readable in Settings.
The equivalent ADR source `467617f3a39ae9be4f927092fe3f23fef7074d7b`
passed all three lanes in run `35274389173`. Its in-place Windows emulator update
restored the same Connected identity and retained the user-imported Azure context.
These are startup, presentation and local persistence results, not a new cloud
nonce or physical-device acceptance claim.

Run `35166673016` at `3f6e41cd0ad72af69a44bbb8aca1e437d101bd1e` passed the
refreshed foundation iOS flow. Its Android flow closed Quickstep successfully,
then encountered a stacked System UI ANR. Recovery therefore allows at most
two separately title-checked stock-dialog dismissals; PAAD/unrelated dialogs
and persistent stock dialogs still fail. The feature iOS run `35166676868`
stopped during GUI launch under the original ten-second bound, before Maestro; it does
not establish that the earlier XCTest screenshot failure recurred.

Reference artwork remains local and untracked. Use `image2.png` for information
structure and `image1.png` for calm visual tone, with selective accents from the
other two images. Produce an original design, not copied artwork.

## M0 evidence (2026-09-16)

[Run 35047634369](https://github.com/HangyiWang/iot-central-paad/actions/runs/35047634369)
completed successfully for commit `6d6186d23d30dfb2b12d5fb947a76750ea31f4c6`.
This is the repaired **RN 0.75.4 / React 18.3.1 baseline**, not the Expo or
New Architecture compatibility gate.

| Lane | Environment | Observed result |
| --- | --- | --- |
| JavaScript | Ubuntu 24.04, Node 20.19.4 | Lint and all 19 startup/recovery, device-contract and pod-install tests passed. |
| Android | AOSP API 34, x86_64 emulator, bundled `ci` APK | Launch, manual-form assertions, back navigation and cold restart passed without Metro or cloud credentials. |
| iOS | macOS 15 ARM64, Xcode 16.4, iPhone 16 / iOS 18.5 Simulator | Real Keychain initialization and the same bundled launch/manual/back/cold-restart flow passed. |

The native artifact identities, JUnit reports and final screenshots were
inspected, and the downloaded artifact hashes matched their identity records:

| Artifact | SHA-256 |
| --- | --- |
| `baseline-ci.apk` | `190fb7244a4271bf84632475b7dcab7bd41c21a6c5ee8f431ac945be84838823` |
| `baseline-simulator.app.zip` | `7133891db252aeffa5e7e69a64a713d7d9c04e55642dbb4f978278976f7b6f57` |

Artifacts expire after three days. The exact source commit and this evidence
record remain available for reproducing the baseline.

The iOS lane uses Xcode-managed local ad-hoc signing: simulated Keychain
entitlements are embedded in the executable's `__TEXT,__entitlements` section,
not the host macOS signature. No Apple account, certificate or provisioning
profile is used. The form's keyboard-dismiss wrapper no longer groups its
heading and choices into one inaccessible element on iOS.

No live Hub/DPS/ADR traffic, secure-storage upgrade migration, physical
sensor/BLE/camera behavior, suspension handling or full HIG acceptance is
established by this run. Those gates, the modern shell and ADR application
implementation remain pending.

## Modern foundation progress (2026-09-16)

The September 18 registration follow-up uses compact content-width New device
and Clear registration actions, an 8 dp gap and 48 dp minimum touch regions.
Narrow windows and large text stack the controls without fixed heights or
truncated labels. The full registration accessibility label and both existing
confirmation flows remain unchanged; this does not add the ADR Details sheet
or replace the foundation's clear-credentials action with Close.
Foundation source `30bb9acf822b716b7788a764af53bb04f501133d` passed
JavaScript and both native startup lanes in `35303073801`. The separately
adapted ADR UI passed all three in `35303108607` on `df5bcb6`.

[Run 35052582168](https://github.com/HangyiWang/iot-central-paad/actions/runs/35052582168)
built `f02ed75b061f675b5a3312a67c940de4b2a37cbc` using Expo 57.0.23,
React Native 0.86.3 and React 19.2.3. Its JavaScript gate and real Android
API 36 bundled launch/manual/back/cold-restart flow passed. iOS resolved its
new CocoaPods lock on Xcode 26.6, then rejected duplicate icon-font copies.
The fix leaves CocoaPods as the sole iOS font-copy owner; Expo embeds Android
fonts, and both platforms register the required font families.

The initially resolved lock had SHA-256
`ff546c745d21063bbb8f83507a086d1edabe48b867d94bad8d6d2c5f9bdc1f78`.
The follow-up promotes Expo Constants 57.0.18 to a direct dependency, updating
only its two external-source paths in that lock; versions/checksums are retained.
Subsequent installs use deployment mode, not implicit resolution updates.

[Run 35055499091](https://github.com/HangyiWang/iot-central-paad/actions/runs/35055499091)
at `33fe667412b517c07a7969d1cb0f6afe218ed8f6` passed all 223 JavaScript tests
and Android's full startup flow. iOS compiled successfully and its deployment
install preserved the reviewed lock byte-for-byte (current SHA-256:
`351da6b578ae9db25305302f1c9f386e315ee7ae11ecd69621d622d8106e5584`).
Its app initialized, opened the manual form and exposed the expected fields,
but the Back tap failed to leave that form. The captured hierarchy placed the
120-point intrinsic logo view over the Back target. The follow-up bounds the
noninteractive logo to 30 points and computes nested-header ownership in
Navigation 7's options callback rather than a stale route effect.

**M1 passed:** [run 35057354712](https://github.com/HangyiWang/iot-central-paad/actions/runs/35057354712)
at `966969648307c242b222668b5a514b0126f5b93e` passed all 229 JavaScript tests
and both native launch/manual/back/cold-restart flows. The iOS Back assertion
was unchanged. JUnit, final screens and exact-commit artifact hashes were inspected:

| Modern artifact | SHA-256 |
| --- | --- |
| Android `foundation-ci.apk` | `1e97eda636c3f762089dd29012394505b902b4ce2be77502b0f963a5ac8a635f` |
| iOS `foundation-simulator.app.zip` | `e676f39ed310af9411fda5211601fa64556a6bc1fba74bc899279dbb9c7425bd` |

This establishes the modern shared/native compatibility gate, not live Azure
traffic or physical-device acceptance. ADR application implementation can now
consume this foundation without replacing its connection or storage boundary.

Follow-up coverage exercises the real vendor/Paho/owned-WebSocket boundary
against an in-memory broker, secure-storage serialization, shared connection
ownership, cancellation, explicit disconnect, one-shot restoration, commands,
PnP component acknowledgements, sensor availability and bounded/redacted logs.
It does not replace actual mobile-to-cloud acceptance.

Android map previews require an operator-supplied, application-restricted
`PAAD_ANDROID_MAPS_API_KEY` at native build time. Without one, the location
view displays coordinates and an explicit configuration notice instead of
creating a native map that would fail. No Maps service or key is created by CI.
Hardware parity, production distribution and secure-storage upgrade acceptance
remain separate from the simulator prototype.

## Goal and branch order

Create a supported native foundation, migrate useful PAAD code, and preserve
existing device behavior. Do not rewrite the whole app or embed Azure CLI.

```text
master
  modernize/paad-foundation
    feature/adr-onboarding
```

Both planning branches start now. ADR implementation starts after milestone M1,
not against the old app. Merge modernization into `master` first, then ADR.
During parallel work, merge foundation changes into the ADR branch; assign one
owner to dependencies, navigation, secure storage, and the connection interface.
Do not mix ADR feature changes into the modernization PR.

## Scope and starting evidence

The inspected app has 58 TypeScript/TSX files, about 7,372 source lines, and 35
runtime dependencies. It already uses hooks, contexts, and TypeScript. The main
cost is native compatibility, not converting React programming styles.

Preserve Hub connection strings, DPS device/group-key input, existing QR formats,
phone-model telemetry, properties, direct methods, six phone telemetry sources,
BLE advertisement scanning, image upload, settings, simulation, and local logs.
Health integrations are commented out; BLE GATT is not an existing feature.

Defer health restoration, GATT, guaranteed background operation, multiple active
devices, a full Azure resource browser, and certificate provisioning. Do not
promise unlimited offline delivery or assume sensor data should be uploaded
after a long suspension.

## Foundation decision

Approved foundation for the compatibility spike: **Expo SDK 57 development
builds**, using Expo 57.0.23 with its matched React Native 0.86.3 / React 19.2.3
dependency set. Published bare-minimum template: 57.0.25. These package versions
were rechecked against npm and the official templates on 2026-09-15. It is not
Expo Go; GitHub Actions builds locally on its runners without EAS.

Confirm versions against the supported template at implementation time and pin
the result. Do not independently upgrade every package to its latest release.
The candidate requires the New Architecture and raises the minimum supported OS;
SDK 57 specifies iOS 16.4 and Android API 24; these floors are owner-approved.
Pin Node 24.19.0 for the modern shell, JDK 17, Android compile/target SDK 36,
Build Tools 36.0.0 and NDK 27.1.12297006. Use the template's Gradle wrapper.
The modern iOS lane needs Xcode 26.4 or newer; the assessed runner is
`macos-26` with Xcode 26.6. The legacy baseline uses its own older toolchain.

If a required native integration or the iOS floor rules this out, evaluate a
fresh bare React Native shell with selective Expo modules and development-client
support. The assessed alternative is RN 0.87.1 / React 19.2.3, with iOS 15.1 as
its runtime floor. Record the choice at M1; do not maintain two implementations.

| Area | Planned treatment |
| --- | --- |
| Camera and QR | Replace archived camera/scanner packages together; start with Expo Camera. Keep gallery selection separate. Confirm camera ownership does not break the existing flashlight command. |
| Sensors | Evaluate Expo Sensors behind existing sensor interfaces. Preserve units, timestamps, availability and sampling semantics; current iOS acceleration is converted from g to m/s2. |
| BLE | Upgrade BLE-PLX to a framework-compatible version; preserve advertisement decoding and update Android runtime permissions. |
| Credentials | Upgrade Keychain deliberately. Check old Android cipher migration requirements before dropping older versions; do not replace storage without a migration. |
| Navigation and UI | Keep React Navigation, prefer native stack/system controls, and upgrade RNEUI where compatible. A UI library does not establish HIG compliance. |
| Charts | Replace internet-loaded `tsiclient@latest` with bundled, bounded-history charts. Consider simple SVG sparklines; remove native charts-wrapper after removing its type-only dependency. |
| IoT | Isolate the old Paho-backed client behind an app-owned interface; prove compatibility or maintain/replace its implementation deliberately. |
| State and tooling | Keep Context/useReducer, npm, TypeScript, ESLint and Prettier. No Redux, monorepo, or extra styling framework by default. |

Use Expo's dependency resolver only after Expo is configured. Preserve production
app IDs (`com.iot_pnp`, `com.microsoft.iotpnp`), signing ownership, universal links,
and the existing Keychain credential format. Use a separate development app ID
for experiments; separately exercise an in-place upgrade with the real app ID.
Never copy signing files or credentials into Git.

## Design contract: Apple Human Interface Guidelines

Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
are a required design and acceptance reference, not merely visual inspiration.
Apply the shared principles on Android while preserving Android back behavior,
system permissions, typography and accessibility conventions. Do not ship Apple
platform-only fonts or symbols as Android assets.

| HIG topic | PAAD requirement |
| --- | --- |
| [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Respect safe areas, keyboard, rotation and compact screens. Use content-driven layouts, not fixed heights that clip enlarged text. |
| [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Use system fonts and semantic text styles. Support Dynamic Type and Bold Text; never disable scaling globally to make a layout fit. |
| [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Label controls and expose values/states to VoiceOver and TalkBack. Provide textual equivalents for charts. Support large text, increased contrast, and logical focus order. |
| [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Minimum 44 x 44 pt hit regions on iOS; use 48 dp on Android. Provide pressed/disabled states and one clear primary action per task. |
| [Color](https://developer.apple.com/design/human-interface-guidelines/color) | Use semantic, adaptive colors; check light, dark and increased-contrast appearances. Pair status color with text and an icon. |
| [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Keep motion purposeful and subtle. Honor Reduce Motion; avoid decorative looping or flashing indicators. Respect reduced transparency for materials. |
| [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Tabs represent stable destinations, never Connect/Scan actions. Use labels; do not hide or disable tabs when disconnected. Explain unavailable content. |
| [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) and [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) | Keep setup short; retain manual entry and simulation. Request camera/BLE/location only when needed, explain why, and provide a useful denial path. No blanket launch-time permission prompts. |
| [Progress](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) and [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) | Show real stages, cancellation and recovery. No invented percentage or success. Prefer inline status; reserve alerts for necessary decisions and irreversible credential reset. |

Start by polishing existing screens rather than redesigning the information
architecture. Present a connection summary above sensor cards. Put values,
units, availability, and live/simulated labels ahead of decoration. Group
secondary tasks logically; review any tab consolidation separately so no
existing feature disappears. Prefer standard native navigation/materials over
a hand-built glass or blur system.

The reference-inspired presentation uses a warm neutral canvas, restrained
mint/lavender/peach/sand surfaces, system typography and low visual elevation.
Sensor colors are stable by identifier rather than random. Phone readings use
roomy single-column cards; wide layouts may use two columns, returning to one
for enlarged text. Cards grow with their content instead of clipping values
into fixed-height tiles. Settings are grouped, while availability and simulation
remain explicit text rather than color-only signals. Reference artwork is not
copied into the app.

The activity log follows the references' timeline/list pattern: severity icons
and text badges, timestamps, rounded event cards, optional issue filtering and
expandable selectable payloads. Chronological ordering and the 500-entry,
redacted in-memory limit are preserved; stable entry IDs prevent expanded rows
from being reused for different events. Upload content scrolls and sizes within
its page rather than using the whole display height. Bluetooth uses the shared
app header, with its scan control and explicit empty/unavailable states in the
page content.

A second design pass used the local references alongside Apple HIG
[lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables),
[sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility),
plus Material 3 [lists](https://m3.material.io/components/lists/guidelines)
and [cards](https://m3.material.io/components/cards/overview). It keeps one
subject per card, separates primary content from supporting text, uses explicit
drill-in affordances and preserves actual touch-target size rather than relying
on hit slop. No reference artwork or custom font is bundled.

Each UI PR must map changed screens to the applicable HIG rows and include
light/dark, enlarged-text, keyboard and error-state evidence. An Android emulator
cannot establish iOS HIG conformance. Require physical-iPhone VoiceOver, large
text and Reduce Motion review before calling the design complete.

## Responsibilities and milestones

Keep screens separate from hardware services and IoT transport. The connection
interface must cover connect/cancel/disconnect, provisioned Hub/device identity,
telemetry, twin updates, methods, file upload, and explicit lifecycle events.
Do not expose a third-party client object throughout the UI. Distinguish send
attempts from protocol acknowledgements and independently observed cloud state.
Redact keys, tokens, connection strings and sensitive payloads at the log boundary.

| Priority | Work | Exit criterion |
| --- | --- | --- |
| M0: baseline | Record behavior and message/model contracts; repair the existing automated baseline in a small implementation commit. Preserve a known baseline build if available. | Reproducible install, clear supported toolchain, and useful baseline checks. |
| M1: compatibility gate | Fresh shell, New Architecture, dev client, secure storage, sensor/QR/BLE adapters and shared connection interface. Establish bundled build and smoke automation before feature migration. | Android emulator and iOS Simulator builds launch and pass real UI assertions. Simulator-only ad-hoc signing may be used for Keychain entitlements; no paid Apple identity is needed. Authorized live-cloud follow-up proves model-bearing Hub/DPS WSS traffic independently on both platforms. Physical sensors, QR/camera, BLE, secure hardware and phone suspension remain not exercised until device acceptance. Target 3-5 engineer-days, not a guarantee. |
| M2: parity migration | Port remaining sensors, BLE advertisements, properties/methods, image upload, registration, settings, logs and charts. Add dependency replacements in small batches. | Existing active features and telemetry units preserved; no unbounded subscriptions/history or duplicate connection attempts. |
| M3: design and resilience | Apply the HIG contract, permission recovery, clear errors, reconnect/resume, credential reset and minimal redacted diagnostics. | Usable offline/error states, accessible controls, no false delivery claims or secret logging. |
| M4: release readiness | Align CI and release toolchains; standalone Android/iPhone builds, upgrade migration, documentation and hardware coverage. | Acceptance matrix below passes; platform gaps explicitly block parity sign-off. |

Run existing logic checks on every PR; add focused Jest + React Native Testing
Library coverage as needed. Establish Maestro launch/navigation assertions with
the build pipeline, then expand them with each migrated feature. Native signing
must not be exposed to untrusted fork PRs.
Keep cloud device credentials in restricted test jobs, not ordinary UI jobs.

## CI-first build and test

1. Repair baseline install/type/Jest issues separately from migration regressions.
2. Build the legacy baseline with bundled JS and isolated IDs. Record native
   incompatibilities honestly rather than weakening tests or faking modules.
3. Create the approved fresh native shell, then run equivalent Android and iOS
   Simulator flows. Do not port every screen before this gate succeeds.
4. Exercise manual onboarding, navigation, denied permissions, restart and
   explicitly labelled simulation without cloud credentials. Use actual UI
   assertions and bounded waits, not screenshots alone.
5. Keep live-cloud jobs separate and opt-in on trusted code, after additional
   scoped-access authorization. The running app must report a unique nonce;
   independent Hub twin and ADR inventory reads must match the assigned identity.
6. Preserve exact-commit evidence and report passed, failed and not-exercised
   coverage. Virtual-device results never satisfy physical hardware acceptance.

The first baseline install succeeded with `npm ci`; the IoT dependency includes
its Paho fork in the published package. This does not establish maintained
transport ownership or native/runtime compatibility on the new foundation.
The baseline animation typing, test import, missing native Jest setup and
ESLint plugin resolution are repaired deliberately, without relaxing type rules.

## Optional Windows and physical-device development

The following local workflows are alternatives for developers and later hardware
acceptance, not prerequisites for the CI-first milestone.

### A. Run the current checkout, before modernization

These steps apply to the existing RN 0.75.4 app, not to the proposed Expo app.
The plans alone do not fix native build compatibility.

1. Install Android Studio **on Windows**, its emulator/platform tools, and JDK 17.
   Enable hardware virtualization. Install the repository's SDK Platform 34,
   Build-Tools 34.0.0 and NDK 26.1.10909125; let its Gradle wrapper select Gradle.
   Create and start a Google APIs virtual phone in Device Manager.
2. Use a Windows-native checkout, Windows Node 20 for this baseline, and PowerShell.
   Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to Android Studio's SDK location;
   add SDK `platform-tools` to PATH. Accept SDK licenses. Check `adb devices`.
3. Synchronize the desired branch into that checkout. The branches created with
   this plan are local until explicitly pushed. After reviewing them, they can
   be published from the WSL checkout:

```bash
git push -u origin modernize/paad-foundation
git push -u origin feature/adr-onboarding
```

In the separate Windows checkout:

```powershell
git fetch origin
git switch modernize/paad-foundation
npm ci
adb devices
npm run lint
npm test -- --runInBand --watchman=false
npm start
```

In another PowerShell terminal in the same checkout:

```powershell
npm run android -- --no-packager
```

The inspected baseline has a TypeScript animation error in `src/Welcome.tsx`
and its sole Jest file imports nonexistent `../App`. M0 fixes these; do not
silently treat their current failures as migration regressions. `npm run build`
currently formats and lints; it is **not** an APK or iOS build.

Use simulation for UI work, then real test credentials for cloud behavior.
The emulator can exercise layouts and networking but does not prove BLE or
physical sensor behavior. Do not enter production keys.

### B. Daily workflow after M1 configures Expo development builds

For the selected modern template, pin a compatible Node release (candidate:
Node 24 LTS, at least 24.3), JDK and SDK/NDK in the plan implementation.
Use its Android versions rather than carrying Platform 34 forward.

| Environment | Role |
| --- | --- |
| Windows-native checkout | Android Studio/emulator, local Android builds and Metro for the simplest Android workflow. |
| WSL checkout | Primary editing, automated checks, Azure scripts, EAS CLI and Metro for the iPhone workflow. |
| Approved EAS or team macOS builder | Native iOS compilation/signing; not local iOS compilation in WSL. |
| Physical iPhone | Real iOS hardware, permissions, accessibility and connectivity. |

Keep `node_modules`, SDKs, Gradle output and caches separate between Windows and
WSL. Synchronize committed source through Git, not copied dependencies. Do not
let two Metro processes compete for port 8081.

After Expo, `expo-dev-client`, signing and build profiles are implemented:

```powershell
# Windows checkout: build/install on the running Android emulator.
npx expo run:android
```

```bash
# WSL: authenticated EAS CLI, approved cloud service and signing access required.
eas device:create
eas build --platform ios --profile development
# After installing the signed build and enabling iPhone Developer Mode:
npx expo start --dev-client
```

This optional hardware profile must target a **physical device**. The primary
GitHub Actions profile instead targets an **iOS Simulator** with local ad-hoc
signing and isolated Keychain entitlements, not an Apple distribution identity.
Use Apple Developer team access if available. EAS is a separate build service;
its free build quota does not remove Apple's device-signing requirement.
Prefer an existing approved macOS pipeline if code/signing cannot go to EAS.
No local iOS Simulator runs on Windows/WSL.

Use trusted same-Wi-Fi LAN access. For WSL, configure mirrored networking where
supported or narrow port forwarding/firewall rules; the iPhone cannot use the
laptop's `localhost`. Do not disable firewalls. An Expo tunnel is an optional
external/public endpoint and requires organizational approval.

Reuse the development binary for compatible JavaScript changes. Rebuild after
native dependency/configuration changes and track the native dependency set
and commit used by each build. A JS update cannot add native modules.
At milestones, create a signed internal preview that embeds the JS bundle and
runs without Metro. Test cold launch and release behavior, not only Fast Refresh.

## Acceptance and effort

| Layer | Required coverage |
| --- | --- |
| Automated | Credential/QR validation, key derivation, sensor units, cancellation, retry/state transitions, no secret logging, critical UI behavior. |
| Android emulator and iOS Simulator in CI | Bundled cold launch, navigation, forms, layouts, errors, denied-permission UI and labelled simulation. Live cloud networking requires separate authorized runs on both platforms. |
| Physical iPhone | QR/camera, available sensors, Keychain restore/reset, BLE with a peripheral, flashlight, image upload, connectivity and HIG review. |
| Physical Android before parity sign-off | BLE/sensors, platform permissions, secure-storage upgrade, file/image behavior and reconnect. Borrow a device if necessary; emulator-only status remains incomplete. |
| Cloud | Direct Hub and classic DPS still work; reported-property nonce independently matches. Do not equate MQTT acknowledgement with downstream telemetry consumption. |
| Release | Signed standalone builds, offline launch, network loss/resume, old-to-new app upgrade, current store toolchains/target requirements and Android native page-size compatibility. |

Budget **5-8 engineer-weeks** for parity, including the compatibility spike:
approximately **60-90 affected paths** (30-40 existing app files, 15-25 native
paths, 5-10 tooling/docs paths, 10-15 new adapter/coverage files). These are
estimates, not an implemented diff; generated dependencies/assets are excluded.
Major new UX, diagnostic export, profiles and certificate work need separate
scope. Signing access, hardware gaps or native incompatibilities can extend it.

## Implementation references

- [Expo SDK 57](https://expo.dev/changelog/sdk-57)
- [React Native support](https://reactnative.dev/releases/overview)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android Studio/emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Using development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [WSL networking](https://learn.microsoft.com/en-us/windows/wsl/networking)
- [Apple developer account and signing](https://developer.apple.com/help/account/basics/about-your-developer-account)
