# PAAD ADR namespace integration plan

Status: SAS-first prototype and native Home / Explore / Activity implemented.
Source-specific retained-device acceptance is recorded below. The later
Confluence refinement is installed on Windows with saved-context and genuine
cold-restoration acceptance, including the corrected native gradient coverage.
Optional Activity, Diagnostics and Bluetooth traversal remains partial.
Date: 2026-09-21. Branch: `feature/adr-onboarding`.
Parent: `modernize/paad-foundation`.

## CI-first update (2026-09-16)

This section supersedes the original Windows-first and early physical-iPhone
prerequisites. The approved direction is automated Android emulator runs on
standard GitHub Linux runners and iOS Simulator runs on standard macOS runners.
No local Mac, EAS account or paid Apple signing identity is needed for this
prototype gate. Local ad-hoc simulator signing may supply isolated Keychain
entitlements; it is not production signing or physical-phone acceptance.

The approved foundation is Expo SDK 57 development builds, with minimum iOS
16.4 and Android 7/API 24. Foundation implementation and its shared connection
interface must precede ADR application changes. The foundation passed both
native startup gates in run `35057354712` and was merged into this branch.
The owner authorized local integration and publication of both topic branches;
no merge into `master` or automatic PR merge is authorized.

Keep credential-free build/UI jobs separate from explicitly authorized live
Azure jobs. The foundation automation uses pinned tools, 45-minute job bounds,
and three-day nonsecret artifacts. Subsequent authorization permits scoped reuse
of the retained lab, uniquely named individual enrollments, actual device traffic,
independent inventory reads and temporary dedicated device-input Actions secrets.
No new billable resources, IAM changes, old-experiment changes, cloud cleanup or
physical-device distribution is authorized.

Use the local `image2.png` reference for information structure and `image1.png`
for restrained visual treatment, following the foundation's Apple HIG contract.
Do not publish the reference artwork. Virtual-device evidence never establishes
real BLE reception, camera/flashlight quality, sensor accuracy or secure hardware.

## Goal and dependency

Let a phone provision through a namespace-linked DPS, connect to its assigned
IoT Hub, and send activity while Azure creates a matching ADR registry record.
Keep direct Hub and classic DPS onboarding working. The phone is a device,
not an Azure administration console.

Follow the [modernization plan](MODERNIZATION.md), including its mandatory Apple
HIG design contract and the CI-first update above. Begin device implementation only
after M1 establishes a working modern build and the shared connection interface.
Cloud contract investigation and wireframes can proceed sooner. Future PR order
is foundation then ADR, but merging either into `master` requires separate approval.

## Implemented prototype

Individual-key DPS is the default, with configurable endpoint, registration ID,
scope and the phone model. Direct Hub and explicit legacy group input remain
available. Manual and versioned QR inputs share the foundation's decoder.
Details show actual assigned identity, safe diagnostics and local proof
submission; registry status deliberately remains **Not checked** in-app.

The separate `live-device.yml` workflow gates device inputs by owner, topic,
explicit consent and exact reviewed SHA. Its push-only registration job does
not use device secrets or send traffic. Manual jobs publish credential-free
binaries before receiving device keys and upload only allowlisted proof summaries
afterward. Raw live diagnostics/images are never published.

The operator-only `scripts/ci/verify-mobile-proof.js` reads DPS assignment,
the Hub model/nonce and the actual ADR record using an existing Entra CLI session.
It requests no keys and performs no cloud writes. See the
[simulator guide](../ADR-SIMULATOR.md) for manual use and evidence boundaries.

### Native Home / Explore / Activity implementation (2026-09-19)

Original redesign delivery (2026-09-20): both retained-device native lanes and
in-place Windows delivery are complete. Android is accepted on `0f2e54d` in
run `35479615461`; iOS retains its separate acceptance on `66b4902` in run
`35477325730`. The completed-delivery record below supersedes the historical
failed-run and pending statements in this section. The subsequent detail
refinement is now delivered on both platforms from `5b59919`, recorded below.

Implementation source: `f856e4e3875fdb2300fe03478eeffaac3f52a59a` on
`feature/adr-onboarding`. This implements the subsequently approved workflow Home,
not the older Device dashboard or guide-only Home proposal.

One shared runtime owns sensor intent, properties and device callbacks above
the three destinations. Home explains Phone / DPS / Hub / ADR relationships with
native panels, actionable attention and actual communication observations.
Explore retains all four tools, explicit source controls, property direction
and in-memory drafts across tool navigation. Activity preserves safe diagnostics
alongside typed observations; local submission is never described as cloud
receipt. Session generation invalidation, source metadata, storage bounds and
telemetry-failure coalescing are documented in
[`src/observation/README.md`](../../src/observation/README.md).

The native drivers now traverse map panels, all tools, unsent draft restoration,
Activity filters/disclosures and safe log disclosures through ordinary UI.
Assignment/model, unique proof nonce and actual process-stop cold-restoration
assertions remain in place. Public native records retain the existing byte
limit; their fixed target list records only the 16 most recently observed
distinct selectors, not an exhaustive list of visited screens.

Run [35461767481](https://github.com/HangyiWang/iot-central-paad/actions/runs/35461767481)
built both binaries from this exact source, but **did not pass connected
acceptance**. Android stopped at the exact `assigned-device-id` assertion,
before the fresh proof submission. iOS connected, submitted the fresh proof and
traversed Home, then stopped at an ambiguous native element during Explore.
Independent iOS reads matched assignment, model, fresh proof and registry; that
is partial evidence, not acceptance of Activity or cold restoration.
Independent Android reads also matched the retained enrollment, DPS assignment
and Hub identity/model. They do not establish that the app's Details sheet opened
or that its assigned-identity control was accessible.

Both owned temporary device-input slots were removed after this run completed.
No new diagnostic capture was enabled. The failed-run Android binary was not
installed on Windows; the existing installation was relaunched without clearing
data or re-entering credentials, but its fresh connection/context observation
was unconfirmed. The September 18 acceptance below remains the working baseline,
not evidence for the redesigned interface.

Follow-up native diagnostics identify the ambiguous fixed selector and at most
three native element kinds, without exporting values, labels or hierarchy data.
Selector readiness now waits a bounded interval for a unique native match before
requiring that same element to be hittable; persistent duplicates still fail.
Android derives only fixed presence/comparison categories from the existing
failure artifact, bound to that failed command and bundle rather than a union
of captured screens. A completed driver tap is not proof that app Details opened.
The 4 KiB record bound, 1 MiB log bound and 16-target bound are unchanged.
Further source-bound native acceptance is still required.
Physical sensors, BLE/camera/torch, background reliability, native large-text
and direct-Hub scenarios remain separate from the retained DPS simulator lane.

The follow-up run
[35464823047](https://github.com/HangyiWang/iot-central-paad/actions/runs/35464823047),
source `22818dcf087095f232bf0b81060974875e72bfd4`, again built both binaries but
failed connected acceptance. Android stopped at the `connection-details` tap,
before the assigned-identity assertion. iOS identified the ambiguous selector:
the global `Nearby devices` text query matched two native static-text elements.
It had already completed the unsent property-draft round trip and tool navigation
through Bluetooth; Activity and cold restoration were not reached. Independent
iOS assignment/model/fresh-proof/registry reads matched again.

The subsequent driver correction identifies the actual Bluetooth tool heading
by its stable identifier, then requires uniqueness, hittability and the exact
heading text rather than selecting an arbitrary matching label. Android now
separately awaits connection-operation completion, an enabled Details control
and the visible sheet before asserting exact identity. Its existing failure
metadata also distinguishes pinned driver error categories, empty/unsupported
hierarchy roots and bounded control counts; no additional capture is enabled.
Both owned input slots were removed at 20:11 UTC after run completion. The failed APK was
not installed on Windows; retained data was not cleared, but fresh connection
and context restoration remain unconfirmed because the bounded observer was
unavailable.

Run [35467496064](https://github.com/HangyiWang/iot-central-paad/actions/runs/35467496064),
source `313f9a5b6cde8dabc18df3a71ba409038c3bf699`, built both binaries but
still failed connected acceptance. iOS passed the corrected Bluetooth check
and reached Activity, where a control was not hittable during the
Latest/disclosure portion. The subsequent driver correction selects a recent
row after Latest and scrolls the actual observation/log list, rather than the
whole app or the changing, potentially offscreen telemetry header. It still
requires the matching disclosure to open and close through ordinary UI.

Android failed the enabled Details visibility check before tapping. Its
failure-bound hierarchy was a nonempty tree, but contained no Details button,
sheet or assigned-identity control. This does not establish foreground-window
ownership: the pinned driver drops package attributes and may merge window
roots, and the earlier presence vocabulary did not include the new Home panels.
The subsequent fixed diagnostic vocabulary includes those app surfaces and
exact permission/autofill/ANR resource signatures. Resource-namespace categories
are evidence only, never a claim about which window owns the foreground.
The two owned temporary inputs were removed at 20:56:52 UTC after completion.
Neither platform reached accepted cold restoration for this source.

Run [35472470305](https://github.com/HangyiWang/iot-central-paad/actions/runs/35472470305),
source `2091779b2e3fe4a208758d6379d7ca1dd9487f41`, built both binaries but
failed acceptance. Android reached the Details tap, then the sheet assertion
failed with an exact permission-controller dialog signature in the same
failure snapshot. This is evidence for narrowly handling that permission UI,
not for dismissing arbitrary system alerts. iOS failed its credential-free
input smoke with `keyboard-unavailable` before the connected lane, so this run
did not exercise the new list-scoped disclosure correction.

The follow-up Android flow denies only the two known permission-controller
deny-button IDs, at most four times per checkpoint. A single Details retry
requires an actual post-tap permission denial and continued sheet absence;
unknown dialogs are not dismissed. The iOS input helper now waits for Return's
keyboard dismissal before focusing another field, preserving exact-value and
masked-secret assertions rather than bypassing keyboard readiness.

Both temporary inputs were removed at 22:28:21 UTC after completion. Neither
fresh proof was independently observed and no failed APK was installed on
Windows. The Windows observer bootstrap was repaired independently, but full
retained-connection/context assertions remain pending actual delivery.

Run [35474589482](https://github.com/HangyiWang/iot-central-paad/actions/runs/35474589482),
source `797b1b8eaf8e7930c612570bbc2bfb4c3b38a3eb`, built both binaries.
Android's independent assignment, model, fresh proof and retained registry
binding matched, but the native flow failed at assertion sequence 168. Its
existing summary does not identify the target or traversal stage, so full
traversal and cold restoration are not established.

The follow-up Android sanitizer attributes fixed experience controls and exact
known assertion patterns without exporting dynamic row IDs or selector text.
For the known permission-absence assertion, only its existing same-bundle,
same-sequence hierarchy can supply fixed permission-control categories. Unknown
conditions remain unknown. This improves future diagnosis; it neither proves
the earlier failure's cause nor broadens permission dismissal.

iOS failed credential-free smoke with `missing-element` at the `welcome`
milestone, before connected execution. A recent observed control is not the
missing control. The follow-up harness retains the allowlisted target only when
its bounded search exhausts, without exporting text or changing navigation,
timeouts or assertions. Credential-free replay can reuse this run's pre-secret
Simulator binary to investigate without another live input or app rebuild.

Both temporary inputs were removed at 23:15:14 UTC after terminal completion
at 23:14:55 UTC, and both slots are empty. No failed APK was installed. The
unchanged Windows app was relaunched without clearing data or re-entering
credentials; fresh connection and retained-context confirmation remain pending.

Credential-free replay
[35476697538](https://github.com/HangyiWang/iot-central-paad/actions/runs/35476697538)
passed with harness `7abf8a14366dc1ec56f1af13db69a9cdf2b30c53` and the unchanged
`797b1b8` Simulator binary. The fixed summary and synthetic log agree on
`smoke` / `finished` / `not-running`, and the owned simulator was deleted.
The earlier missing-element failure was not reproduced or explained. This is
synthetic navigation/input evidence, not connected cold restoration.

Run [35477325730](https://github.com/HangyiWang/iot-central-paad/actions/runs/35477325730),
source `66b490276c14219d368fc1f15329b0da73101084`, identifies Android's failed
permission-absence assertion at sequence 169. Its bound hierarchy contains a
known permission dialog and the `deny-and-dont-ask-again` control, with no ordinary
deny control recorded. Resource namespaces do not establish foreground ownership,
and this result does not retrospectively identify the previous run's failure.
The next CI-only correction permits that exact denial variant alongside ordinary
denial, retaining the shared four-tap budget, refusal to grant access, and all
sheet/identity/proof/traversal/restoration assertions. App and Windows permission
policies are unchanged.

The iOS lane of that run passed the ordered Home/Explore/Activity traversal,
exact identity/model/proof assertions and genuine saved-credential cold
restoration. Its final record is `live / passed / finished / not-running`, with
`connected`, `nonceSubmitted` and `coldRestored` all true. Independent fresh
assignment, Hub, model, nonce/platform and retained-registry bindings matched
for both platforms; Android's UI failure still prevents overall acceptance.
The accepted iOS Simulator archive is `foundation-simulator.app.zip`, SHA-256
`ed2b5a9b919e7efa33892616f9c2988e414f2408a137566df3369b4a51b673bc`,
from artifact `live-build-ios-66b490276c14219d368fc1f15329b0da73101084-1`.
This is not physical-iPhone acceptance or new registry-record creation;
downstream telemetry receipt remains unchecked.

The workflow completed at 00:24:24 UTC on September 20. Both owned input slots
were confirmed empty at 00:35:00 UTC. A monitor receipt-write failure required
recovery, so the original deletion timestamp is unavailable; no input was
recreated. The unchanged Windows app was relaunched without installing the
failed candidate, clearing data or entering credentials. Fresh connection and
retained-context confirmation are still pending.

#### Completed redesign delivery (2026-09-20)

| Platform | Accepted source | Run |
| --- | --- | --- |
| Android emulator and installed Windows APK | `0f2e54df977bb49fa610363c06891edc651edb68` | [35479615461](https://github.com/HangyiWang/iot-central-paad/actions/runs/35479615461) |
| iOS Simulator | `66b490276c14219d368fc1f15329b0da73101084` | [35477325730](https://github.com/HangyiWang/iot-central-paad/actions/runs/35477325730) |

Android passed the mandatory, fail-fast native flow: Home panels, all four
Explore tools, unsent draft retention, Activity and diagnostic disclosures,
exact assignment/model/proof, and a genuine stop/relaunch with saved-credential
restoration. Independent reads matched its fresh nonce/platform, assignment,
Hub, model and retained registry binding. Android does not emit an iOS-style
`coldRestored` flag; its restoration evidence is the passed source-bound flow.

The iOS app, harness, native dependencies and executable logic did not change
between these accepted sources. Their only differences are the Android
permission helper, its tests, this ledger and a diagnostic comment. Its earlier
accepted artifact is preserved under its actual source/run, not relabeled.

The installed Android `foundation-ci.apk` SHA-256 is
`1c3afea337055f63a0141f14bc2fc72d1b08eebeaf08048aab5d092cbbb2eb85`,
from artifact `live-build-android-0f2e54df977bb49fa610363c06891edc651edb68-1`.
The accepted iOS archive hash remains
`ed2b5a9b919e7efa33892616f9c2988e414f2408a137566df3369b4a51b673bc`.

Windows received only that accepted APK through `install -r`. The bounded
observer confirmed Connected, exact assignment/Hub/model, and the retained
Azure context after upgrade and again after an actual process stop and new
process launch. Details was closed afterward and the app remains running.
No uninstall, data clear, credential re-entry, storage injection, screenshot
or hierarchy dump was used. In-app registry status remains **Not checked**.

The Android workflow completed at 01:07:47 UTC; its owned input was removed at
01:08:42 UTC with durable receipts. The iOS slot was never populated for this
Android-only run, and both slots are empty. Owned observer processes/files were
removed. Windows delivery completed at 01:27:22 UTC. Local exact evidence is
retained under `build/native-delivery-0f2e54d/`, particularly
`paired-delivery-final.json`, `windows-delivery.json` and
`safe-delivery-summary.json`; `build/actions-installed-0f2e54d.json` records
installed provenance. These ignored operational artifacts are not published
with the source.

This completes the retained DPS emulator/Simulator delivery, not physical-phone,
media-upload, large-text, direct-Hub or downstream-telemetry acceptance. The
registry association was retained, not newly created. The earlier intermittent
iOS missing-element failure remains unexplained despite subsequent successful
native acceptance.

#### Native detail refinement (2026-09-20)

The follow-on refinement keeps the accepted runtime, connection flows, native
selectors and source/protocol boundaries. Home now uses **Connection** and
**Latest observations**, with centered map labels and a brief connector,
connection-emblem and attention-icon settle. This is decorative arrival motion,
not animated packets, a live topology audit or evidence of Azure traffic.

Sensor and technical-name actions share a quieter card footer. Activity uses a
neutral Observations/Diagnostics selector, subordinate All/Issues chips and
borderless disclosure glyphs. Smaller painted controls retain separate native
48-point touch frames, accessibility state and wrapping text. Bluetooth waiting
and unavailable states are integrated into scrollable page content rather than
a floating loader; empty results no longer keep pull-to-refresh spinning.
Registration groups a restrained scan action with a quiet manual choice.

Motion shares a reference-counted native accessibility/app-state subscription.
Decorative transitions are finite, non-interaction native-driver transforms or
opacity changes, and stop when hidden, backgrounded or Reduce Motion is enabled.
The Bluetooth indicator represents waiting for advertisements, not measured
progress, and becomes a still glyph under Reduce Motion.

Claude Opus 5/high provided the scoped design critique and Bluetooth/Registration
implementation. The treatment follows Apple's guidance on
[motion](https://developer.apple.com/design/human-interface-guidelines/motion),
[buttons](https://developer.apple.com/design/human-interface-guidelines/buttons),
[segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)
and [loading](https://developer.apple.com/design/human-interface-guidelines/loading):
quiet hierarchy, useful feedback and unchanged accessible reach.

Native delivery completed from source
`5b59919acd91d0c75925d84e16d5da6fa3a2e12b` in
[run 35529669229](https://github.com/HangyiWang/iot-central-paad/actions/runs/35529669229).
The owner renewed narrowly scoped consent for the same two retained individual
enrollments. Both platforms newly completed the connected Home/Explore/Activity
flow and genuine saved-credential cold restoration; earlier acceptance was not
substituted. Independent reads matched each fresh proof, assigned Hub/device,
phone model and retained registry binding.

| Artifact | SHA-256 |
| --- | --- |
| Installed Android `foundation-ci.apk` | `51012e16a36e160df1ceb5a69e05a2365909c9713332167efb5b2a4c7f167f1c` |
| iOS `foundation-simulator.app.zip` | `2c204d0e9f9fd20fde3a14f0f50876780651c3862b242e649c75713ab44ae4f3` |

Windows received the matching accepted APK using `install -r`. Bounded native
observations confirmed Connected, exact assignment/Hub/model and retained Azure
context after upgrade and again after an actual process stop/new launch.
Details was closed and the app left running. No data clear, uninstall,
credential re-entry, storage injection or raw capture was used.

Both owned temporary inputs were removed at 19:04:57 UTC after terminal run
completion, with durable receipts and both slots confirmed empty. Owned observer
processes/files were removed. Windows observations completed at 19:26:47 UTC;
the final delivery record is `build/native-delivery-5b59919/delivery-final.json`,
with `windows-delivery.json`, `safe-delivery-summary.json` and
`build/actions-installed-5b59919.json` retaining local provenance.

This is emulator/Simulator acceptance, not physical-phone signing, large-text,
media-upload or direct-Hub acceptance. The registry association was retained,
not newly created; downstream telemetry receipt remains unchecked. No new Azure
resources, IAM privileges or raw diagnostic capture were included.

#### Native Confluence delivery and follow-on refinement (2026-09-21)

The approved Botanical/Prismatic union added the bundled, licensed static
Fraunces heading **Phone as a Device**, a warm forest palette, responsive
Explore tiles, two-way Home connectors, and finite native interaction motion.
The existing runtime, credentials, model and protocol ownership were retained.

The first ordinary build, `35543271731` on `fb6f92b`, exposed the Android
welcome footer underneath the system navigation bar. Source `58a6227` fixed
measured safe-area padding and theme-aware status icons without removing the
startup assertions. Android then passed in `35544976110`; its iOS run was
interrupted by the optional native `Save Password?` sheet. The existing form
already opts out of autofill. A narrowly gated, one-time `Not Now` step was
added to the credential-free startup flow, retaining the return-screen and
cold-launch requirements. Its shared replay expectations and fixtures were
synchronized after the JavaScript-only failure in `35560783118`.

Ordinary credential-free JavaScript, Android and iOS Simulator lanes completed
on source `432ef4d8af9be964f8841e1b2893e61a11cb8f29` in
[run 35561339204](https://github.com/HangyiWang/iot-central-paad/actions/runs/35561339204),
attempt 1. Both packages contain the reviewed Fraunces bytes; the hosted
synthetic images show the correct heading and corrected system-bar layout.

| Binary | SHA-256 |
| --- | --- |
| Installed Android APK | `8e93a6ae505b14cb4cbec2ce8d4649ee1c8b5635230522024289e3a6fcaf2cca` |
| iOS Simulator ZIP | `4c7cfc3c646e4dc2e4a85d17499abde20855c38cc19f3963e678c7236b11bb56` |

The Android APK was installed with `install -r`, without clearing data,
uninstalling, re-entering credentials or injecting storage. Exact
identity/Hub/model and saved Azure context matched after the upgrade.
A real process stop/relaunch initially showed Connected, but full
cold-context confirmation remained incomplete; a later observation showed
Disconnected. The cause of that connection loss was not established.

Windows coverage reached the four Home panels, the three non-Bluetooth tools,
and Activity filters/Latest. All four Explore titles were initially visible
at normal font scale. Bluetooth entry was skipped because existing permission
metadata could not be established. Activity disclosure completion and
diagnostic-log traversal remain incomplete; later visible detail bounds do
not retroactively establish a completed traversal or an animation trajectory.
No full Windows acceptance or new connected iOS traversal is claimed.

The later read-only motion observation found a compact Home at approximately
411 dp and font scale 1.0, in real mode but Disconnected. Android transition
and window animation scales were `1.0`; animator scale was unset. The
installed React Native rule therefore indicates Reduce Motion false, although
the JavaScript hook state was not inspected. Disconnected status explains
the map's intentional stillness, not every reported missing animation.

Provenance remains in `build/actions-installed-432ef4d.json` and
`build/native-confluence-delivery/runs/432ef4d8af9be964f8841e1b2893e61a11cb8f29-35561339204/delivery-final.json`.
Owned observers and temporary device payloads were removed; the app was left
on Home. There were no new dedicated live inputs, operator cloud setup/proof
operations, permission changes or private Windows captures. Earlier live proof
belongs to its earlier source and is not substituted for this delivery.

The owner subsequently requested more perceptible legitimate motion,
porcelain/mineral Explore gradients with restrained depth, an integrated
Activity footer action, and consistent controls throughout the app. That
Opus 5/high refinement now uses a shared porcelain material, mineral icon
plates, a full-width Activity footer, and tonal press feedback without dimming
labels. Connection light has a broader swell and a trailing glint; large-text
layouts use separately labelled horizontal relationship lanes rather than
unanchored forks. Finite tool entry, selection and disclosure share one fluid
curve. Disconnected, simulated, background and reduced-motion gates remain
intact.

Source `1b1a55211c5bd651be00726a769df7f606f9aa7a` completed ordinary
[run 35609360569](https://github.com/HangyiWang/iot-central-paad/actions/runs/35609360569),
attempt 1, on JavaScript, Android and iOS Simulator. Its Android APK was
installed in place over `432ef4d`, without clearing data or re-entering
credentials. Exact identity, Hub, model and Azure context matched a fresh
pre-install baseline both after upgrade and after a confirmed stopped-process,
new-process cold launch. The app was left on Home, Connected, in real mode.

| Binary | SHA-256 |
| --- | --- |
| Installed Android APK | `26024799036bc83d2ed2caa4994565d4ac53f82a64981969a7bc731f666e041d` |
| iOS Simulator ZIP | `f6bf42822fb0ee5c5e4bf2d4b773845fbc091b0f95355c5519e0fd6e5053af35` |

Coverage reached all four Home panels, the three non-Bluetooth tools, all four
initial Explore titles, and Activity filters/Latest. Optional Activity
disclosure traversal stopped at a scoped scroll operation for a reason not
established by the fixed evidence; diagnostics/logs were not reached.
Bluetooth was skipped because existing grants could not be established.
Neither animation trajectories nor large-text native coverage are claimed.
There were no permission/settings changes, private captures, new live inputs
or cloud-proof operations. Owned observers and active approvals were cleaned.

Public credential-free screenshots from both native platforms then exposed
partial gradient coverage inside padded controls. A follow-up isolates SVG
percentage sizing in a non-collapsible, unpadded absolute-fill viewport,
preserving the approved colours and control geometry. Its native rendering
confirmation and delivery are separate from the successful `1b1a552`
preservation result above.

The correction, source `ee99db9c59f4dbbcd2b4b8f14d6ded7367391dd4`,
completed ordinary
[run 35615328625](https://github.com/HangyiWang/iot-central-paad/actions/runs/35615328625),
attempt 1, on all three lanes. Both hosted native images were inspected before
installation: the primary control has full gradient coverage without the
short upper-left capsule, and the Profile plate and labels remain aligned.

| Binary | SHA-256 |
| --- | --- |
| Installed Android APK | `9358de1a7207caddb27a66c75831a83506f4ea7db45a92934a5f4681c798fdba` |
| iOS Simulator ZIP | `3df3aabaf018ec7eec3d4117bc92d12624394a7ee77945e8a58d7b6d23696d2f` |

The corrected APK was installed with `install -r` over `1b1a552`. Exact
identity, Hub, model and Azure context matched a fresh pre-install baseline
after upgrade and after a genuine stopped/new-process cold launch. No old
context was restored over user data. The app was left running on Home,
Connected, with connection Details closed.

The four Home panels, three non-Bluetooth tools, initial visibility of all
four Explore titles, and Activity controls were reached. Observation
disclosure stopped at a scoped scroll. Diagnostics was attempted independently
but stopped at a controls tap before log disclosure; the fixed record does not
distinguish the exact failed control. These optional failures are not claimed
as successful traversal, and their underlying causes remain unestablished.
Bluetooth grants could not be established, so its entry was skipped without
prompting or changing permissions. Native animation trajectories and
large-text fit remain outside the completed coverage.

The pre-install app was Disconnected for an unknown reason; only normal
launch and automatic restoration were used, not a forced reconnect for
motion. No data clearing, credential re-entry, storage injection, private
captures, new live inputs, cloud proof, or OS/permission changes occurred.
Owned observers, temporary payloads and active approval were cleaned;
earlier delivery evidence was preserved.

### Solid surfaces and explicit disconnection (2026-09-22)

The owner clarified that the reported broken Reconnect concerned its outline,
not the connection operation. A bounded probe of the unchanged installed
`ee99db9` image began with Disconnected / Connection interrupted. One genuine
Reconnect tap was acknowledged; the observer saw the busy overlay,
provisioning, connecting and Connected within its approximately 20-second
post-tap observation window. The app was left on Home, Connected. This is
evidence for that one attempt, not an explanation of earlier disconnections
or independent cloud proof. No credential values or private captures were
collected. There was no data clearing, storage injection, app restart or
OS/permission change. The observer and temporary device payloads were cleaned.

The follow-up design keeps gradients on page backgrounds only. Buttons,
panels and messages use solid tonal surfaces, clear edges and no decorative
shadows; functional busy-overlay stacking remains. Activity observation
headings use the quieter 15-point entry style instead of the 17-point section
heading. Removing control paint overlays also leaves their native outlines
uncovered. These are
Opus 5/high design refinements, not changes to Azure transport behaviour.

An explicit local `disconnected` session stage distinguishes the user's
Disconnect action from both initial idle/setup and an unexpected
`CONNECTION_LOST`. Manual disconnection keeps saved credentials, exposes a
non-error Home recovery notice and marks the phone paths red and broken.
It does not manufacture an error code, change cloud resources or initiate an
automatic reconnect. The state is not persisted: normal cold-start restoration
continues to use the saved setup. Reconnect uses the existing connection
pipeline and clears the disconnected presentation as it starts.

Source `c4f2bda19f3b72e6ae5f18cda2e7c216f4fa793e` completed ordinary
[run 35787537369](https://github.com/HangyiWang/iot-central-paad/actions/runs/35787537369),
attempt 1, on all three lanes. Both hosted, credential-free light-theme startup
images show solid fills, intact outlines and distinct page/panel tones.

| Binary | SHA-256 |
| --- | --- |
| Installed Android APK | `ca867a96e6f634448c7ab9d3433d72cc81e3cf25475d7a39085d994de1d51dc1` |
| iOS Simulator ZIP | `9e73f837ea169a9461d7e39c3d4e44bdc39df4dbffab185316c385b1399d6840` |

The Android APK was installed with `install -r` over `ee99db9`. Its fresh
pre-install state was Disconnected for an unknown reason. Exact identity,
Hub, model and imported Azure context matched after upgrade, after a genuine
stopped/new-process cold restoration, and after the manual-disconnect flow.
No stale context was written back over user data.

One normal Disconnect and one manual Reconnect were performed. Native metadata
showed the explicit disconnected stage, the manual notice, the map's manual
state and Home connection attention, with no transport-interruption notice or
visible error code. Reconnect showed the busy overlay, provisioning, connecting
and Connected during approximately 16.5 seconds of post-tap observation.
The last native observation at 22:08:20 UTC was Home, Connected, Details closed.

Retained-screen evidence is bounded metadata, not red-pixel or animation
trajectory proof. Optional Home-panel, Explore, Activity and Bluetooth traversal
was not performed; dark-theme native acceptance is not claimed. iOS coverage
is hosted build/startup only. No private captures, credential collection, data
clearing, storage injection, OS/permission changes or new cloud proof occurred.
Owned observers, temporary payloads and active approvals were cleaned.

Provenance is retained in `build/actions-installed-c4f2bda.json` and
`build/native-solid-delivery/runs/c4f2bda19f3b72e6ae5f18cda2e7c216f4fa793e-35787537369/delivery-final.json`.

### Green Meridian refinement (2026-09-23)

Source `283bf58fb9d3f4a611c4580652d03b0e6feb2422` implements the owner's
selected Meridian direction with Opus 5/high collaboration. The light page
now falls from pale mint `#ECF7ED` to sage `#C2E3CA`; solid header backgrounds
match the top stop to avoid a horizontal colour seam. Near-white panels remain
solid and shadow-free. Dark colours, the four Explore tiles and their identity
colours, and all telemetry/property/image/Bluetooth tool layouts are preserved.

The connection map has an 18-unit inner inset, 16-unit service gap and a
quiet solid group outline instead of a close-fitting dashed perimeter. The
visible namespace coordination caption is removed; its meaning remains in
accessibility output and ADR Details. Measured routes, direct-Hub behaviour,
RTL/large-text layouts, flow gates and red broken disconnected paths remain.

The top capsule names Connected, Disconnected or Connection interrupted,
with compact Reconnect/Details actions where recovery applies. Routine manual
and transport-loss paragraphs are removed, while meaningful setup/auth/network
failure notices, pending-stage cancellation and simulation disclosure remain.
Manual disconnection is still a non-error session state; interruption has a
distinct icon. Reconnect's accessible hint explains reuse of saved credentials.
Activity uses bare timestamps, one locality explanation and a small retained
Latest marker instead of a separate telemetry heading.

Ordinary [run 35802266441](https://github.com/HangyiWang/iot-central-paad/actions/runs/35802266441),
attempt 1, completed all three lanes with locked pods for this exact source.

| Binary | SHA-256 |
| --- | --- |
| Installed Android APK | `2f3c23224b7d47da137ab9c337fe055070f4eb039d51eab9056cabf886afeafc` |
| iOS Simulator ZIP | `434f252b5cccb653c2ee82f325326edff617e7c9fc077276da228cafd23c0ec9` |

Android was installed with `install -r` over `c4f2bda`. The fresh baseline was
Disconnected for an unknown reason; no reconnect was forced for that baseline.
Exact identity, Hub, model and imported context matched after upgrade, after a
genuine stopped/new-process cold restoration and after the manual recovery flow.
No credentials were read and no old context was injected.

Exactly one Disconnect and one Reconnect were performed. The first observer
stopped because it could not resolve the compact recovery control's native
ancestry; its partial receipt remains unchanged. A read-only target inspection
confirmed the unique, visible, enabled control inside the recovery bounds.
A source/container-bound continuation consumed only the unused Reconnect
budget, in the same cold-restored process. The compact Disconnected header,
explicit manual Details stage and Home attention were observed without an
error code. Reconnect showed busy, provisioning, connecting and Connected over
approximately 14.2 seconds of post-tap observation. The last native UI
observation at 01:17:53 UTC was Home, Connected, Details closed.

Hosted credential-free startup images show the pale-green base and clean
controls. Their sampled backgrounds are uniformly `#ECF7ED`, so they do not
establish the stronger Home/Explore/Activity gradient. Retained-app evidence
is bounded metadata, not map-spacing, red-path, icon, gradient or animation
pixel proof. Unchanged tools and broader tab/Bluetooth traversal were not
repeated; iOS coverage is hosted build/startup only. No private capture, new
live input, manufactured network loss, cloud proof, data clearing, or
OS/permission changes occurred. Owned observers, temporary device payloads
and active approvals were cleaned.

Final provenance is retained in `build/actions-installed-283bf58.json` and
`build/native-meridian-preparation/runs/283bf58fb9d3f4a611c4580652d03b0e6feb2422-35802266441/delivery-final.json`.
The original `windows-delivery.json` records the earlier partial outcome;
the final receipt binds the continuation and subsequent preservation evidence.

### Completed simulator acceptance (2026-09-18)

The foundation's ordinary locked build/startup lanes passed on Android and iOS
in `35385478270`, source `070841a21c0d2cd2cc709eea31eab07f644c0ee3`.
The current Android action refinement was delivered from `35385882890`, source
`e8d4d6644aa5eb88611982230d84fcadbde370c0`, preserving the retained connection
and imported Azure context. Earlier app-submitted Android markers and genuine
cold-restoration evidence are preserved below; this UI-only update is not a new
Android marker submission.

Strict iOS live run `35390910824`, source
`7a0f664799436b97f87776b3dca99f39c50e9a66`, passed real credential entry and
masking, Connected, Details, exact assignment/model, proof submission and genuine
terminate/relaunch restoration of the same connected identity. Its native record
confirms that the observed password-saving sheet was dismissed. The ordinary
Details gesture began from a hittable target; no extra ordinary tap, coordinate
fallback, injected application state or weakened preflight was used.

At 20:51:21 UTC, the independent operator verifier matched the actual DPS
assignment, Hub phone model and exact iOS nonce with the namespace's actual
registry-device external ID. The run reuses the retained device and existing
automatic record; it does not claim a new registry-record creation case.
The owned temporary input was removed at 20:49:46 UTC and both dedicated slots
were independently confirmed empty. No diagnostic capture was enabled in this
successful run. Its pre-secret Simulator app archive SHA256 is:
`2bde3c652cc0575b231c39d4a5d901ad99bf4b1040e424fcfe1f644c7b41646d`.

This completes the current simulator prototype gate, not production or physical
device acceptance. Independent downstream telemetry receipt, physical sensors,
BLE/camera, secure hardware, background reliability, certificate onboarding and
automatic authorized Azure context remain separate work. In-app registry status
still correctly says **Not checked** without a separately authorized observer.
The dated entries below retain the earlier failures and incomplete attempts;
they do not supersede this completed acceptance record.

### Follow-up: automatic Azure details

The intended follow-up experience populates Azure details automatically, without
requiring app users to export or import a snapshot. The current optional snapshot
is a prototype bridge, not a required step in device onboarding.

Choose the authorized delivery mechanism separately: static resource context can
accompany onboarding configuration, while fresh inventory and management activity
need an appropriately authorized Azure user session or backend. Device credentials
must not gain Azure management permissions. This future direction does not
authorize a new backend, Azure sign-in implementation, resources or IAM changes in
the current simulator acceptance work.

### Native input gate (2026-09-17)

Credential-free native XCTest replay `35276368490`, harness
`4b7de135587988d45637ddde23aa299c26d11d56`, passed actual launch, manual
navigation, exact synthetic inputs, masking, endpoint-after-key confirmation and
cold startup. It reused the pre-secret app `bc0410e` from run `35264683214`;
it does not establish cloud acceptance or execution of the newer header binary.
The preceding replay isolated an input mismatch before Return. Individual public
XCTest key actions passed where burst typing did not; the app's input behavior and
strict assertions were not changed. Live iOS nonce/connected restoration and
independent operator confirmation remained outstanding at this point.

The later native live run `35277305904`, source
`0d206068bcb1069ed5b60cf617cdcc16e95c0a47`, passed synthetic preflight and reached
Connected, but Details was not hittable. Independent reads matched assignment,
model and one automatic ADR record; the nonce and connected cold restoration
were not established. The owned temporary device input was removed.

The native runner now waits boundedly for the fixed Details control and handles
only the existing allowlisted permission-denial actions. It does not substitute
coordinates or swipe that fixed header. Credential-free replay `35283136275`
passed exact input, masking and cold-start assertions and deleted its owned
simulator. This replay used harness
`9007ba1d6d036a86101075f00a899810be37c119` and the pre-secret `0d20606` app from
`35277305904`. That replay used a five-minute smoke boot allowance following an
observed three-minute fresh-simulator data-migration timeout. Synthetic smoke never
connects, so this result does not prove the connected Details readiness fix or
the pending live nonce/cold-restoration gate.

On September 18, credential-free replay `35291595509` exhausted that five-minute
allowance while CoreLocation migration was still non-terminal; no app UI ran, and
the owned simulator was deleted. Native smoke now uses `simctl bootstatus -b` as
one bounded boot/readiness operation, allowing ten minutes for a fresh runtime.
The native preflight/replay steps allow 25 minutes; the existing XCTest execution,
post-connection readiness and live proof deadlines are unchanged. A Booted state
alone is never accepted as readiness. Fixed bootstrap-stage/outcome reporting
does not relax the restrictions on raw logs from credentialed jobs.

Retained-device run `35293248335`, source
`4e37c8e4bcd6ce46145ab1033c9e0f8cc2e4e0b5`, passed preflight and reached Connected.
Its preserved diagnostics found exactly one enabled Details button inside the
app bounds, but the pre-tap hittability flag remained false; the harness stopped
without attempting the gesture. The following harness revision keeps uniqueness,
enabled-state, full-frame and overlay checks, then lets XCTest's real `tap()`
compute the hit point. It requires the sheet to be absent before that action and
present afterward. No coordinate fallback or application shortcut is introduced,
and exact identity, nonce and genuine cold-restoration assertions remain required.

Run `35295215422` on `c346af1` still stopped before the gesture: initial resolution
completed, then XCTest reported an unclassified issue during readiness polling.
It does not establish a failed tap. Readiness polling now queries the native
attributes directly, outside a nested predicate waiter, with the same bounded
deadline and permission checks. Fixed operation markers distinguish permission,
query, state, resolution and gesture failures without exporting error text.

The next attempt, `35297432418` on `a993529`, stopped in credential-free app
installation at its 60-second deadline, before XCTest or device-input execution.
Native smoke now allows three minutes for that install operation and still
requires a successful command result. Its temporary input was removed; this
attempt supplies no additional post-connection evidence.

Credential-free replay `35298845776` passed with app source `a993529` and harness
`c152898`, and deleted its owned simulator. The subsequent retained-device run
`35299327617` on `c152898` passed preflight, connected, and reached the actual
Details tap. The sheet marker remained absent afterward; capsule/status
hittability alone does not prove that the sheet opened. Its temporary input was
removed, and neither nonce submission nor connected cold restoration passed.

The native harness now records bounded per-tap completion, whether a known
permission was actually dismissed during that tap, and presence of the sheet,
Close control and assigned-identity marker. Only an observed in-tap permission
dismissal with the sheet still absent permits one retry; that retry additionally
requires a hittable button. Ordinary missing-sheet failures still fail without
retry. This distinguishes an interrupted action from an absent container marker
without exporting UI text or changing the app. The cause of the preceding
missing-sheet result is not yet established.

Credential-free replay `35301528401` compiled and passed that harness (`8567687`)
against the pre-secret `c152898` app, with owned simulator deletion. Its subsequent
live-workflow attempt `35302135929` failed in synthetic welcome/manual navigation
before the device-input step. The temporary input was removed; this is not an
additional connected Details result.

Run `35305013750` on the delivered `df5bcb6` app passed preflight and connected.
Its completed Details tap began with a non-hittable target and did not handle a
permission interruption; the sheet, Close and identity markers were all absent
afterward. The temporary input was removed. No nonce or connected cold-restoration
claim follows from this run.

The Details control now reports ordinary busy/expanded accessibility states for
requested versus native-confirmed presentation (`Modal.onShow`), clearing them
when closed. This changes no visual styling or navigation and adds no test-only
entry point. The native harness classifies only that fixed button's state into
allowlisted categories; it never exports the raw accessibility value. These
describe the state at observation time. A later closed state does not exclude
a previously invoked handler followed by a component remount or rapid dismissal;
it is not proof of the cause.

Retained-device run `35308619148` on `1722f0e` passed preflight and connected.
The Details tap completed from a non-hittable target, with no permission handled
during that gesture. The sheet, Close and identity markers were absent, and the
new presentation probe remained `closed`. No JS-open state was observed; this
does not support adding a speculative native Modal remount. The exact gesture
failure remains to be diagnosed. Nonce submission and connected cold restoration
are still unproven. Its owned temporary input was removed, and both dedicated
device-input slots were confirmed empty.

The next native diagnostic retains the pre-tap button's uniqueness, membership
and frame containment in the capsule, and whether its dimensions meet the iOS
44-point touch-target baseline. It also records target state after `tap()`
returns and during subsequent sheet diagnosis. These are fixed categories,
not coordinates or exported accessibility text, and remain within the existing
record bounds. Actual gestures, readiness/proof assertions and the narrowly
permission-gated retry rule are unchanged. Opening a sheet from `onPressIn`
would change user interaction semantics and is deliberately not used.

Credential-free replay `35313776253` passed that harness (`fcd01c6`) against
the pre-secret `1722f0e` app, including exact synthetic input and cold startup;
its owned simulator was deleted. Retained live run `35314665825` on `fcd01c6`
then passed preflight and connected, but again did not open Details. New evidence
found one button inside one capsule, with the expected capsule membership and
at least a 44-point frame. It was non-hittable before the unsuccessful tap but
hittable immediately afterward and at the later observation. Presentation
remained closed; no permission was handled during that tap. This rules against
a persistently undersized or out-of-container target, not every possible cause.
The run ended at 06:49 UTC; the local watcher next reported and confirmed removal
of its temporary input at 13:12 UTC. Both dedicated secret slots were then empty.

The native driver now uses its direct bounded polling to require hittability
before the initial gesture as well as any permission-gated retry, and checks
again after collecting readiness diagnostics. It does not use nested XCTest
predicate polling for this readiness check. An in-frame but non-hittable target
no longer triggers a speculative first tap. This strengthens the precondition
without changing app behavior, introducing a second ordinary tap, or relaxing
the sheet/identity/nonce/cold-restoration requirements. It is not itself a fix
for the underlying interaction.

Run `35350111973` compiled `c38d25d` and passed the credential-free native flow,
but did not attempt live connection. The operator controller had removed its
repository input immediately after the workflow was queued; the dependent iOS
job subsequently reported `Dedicated device input secret is unavailable.`
There is no live UI result or new cloud proof from that run. Both temporary
input slots were confirmed empty. Queue-time removal is therefore not used for
this workflow: the controller again retains timestamp-owned inputs until the
exact run completes, then removes and confirms their absence. The retained
retry below used the same app/harness source and completion-based cleanup.

The retained retry `35355041556` on the same `c38d25d` source passed preflight
and connected. Its Details readiness window ended with one in-frame but
non-hittable button, so no Details tap was attempted. No visible app/system
alert, keyboard or connection busy overlay explained that state; nonce and
connected cold restoration remain unproven. The owned repository input was
removed at 14:55:31 UTC after completion, and both slots were confirmed empty.

The next native-only observation compares the unique Details button, Settings
header button, Telemetry tab and navigation container at the beginning and end
of that existing readiness window. It retains only fixed state categories
(including unavailable for ambiguous matches); no text, coordinates or extra
gestures are exported or introduced. Settings is outside the stack screen
subtree and Telemetry is inside it, which can help localize the affected region.
Static-text or container hittability alone does not prove a real touch failure;
the actual cause is not established and app behavior is not changed on a guess.

Run `35362218755` on `f129b0e` passed preflight and connected. Both the initial
and timeout samples reported Details, Settings, Telemetry and navigation as
non-hittable, so the symptom is not isolated to the capsule. No tap, nonce or
cold-restoration proof followed. Its owned input was removed at 15:49:40 UTC,
and both repository slots were confirmed empty.

The reported application state had been cached before these observations.
`c7235f2` added fresh app/system states and fixed presence/hittability categories
for allowlisted system denial buttons, initially without dismissing controls
outside its existing alert handler. Before Details it explicitly requires a
foreground app: only an observed running-background state permits one activation;
a stopped or unknown app fails instead of being relaunched. Before/after state
and whether activation was requested are retained. This does not establish that
backgrounding caused the prior failure, change the app, add a Details retry or
weaken the identity/proof/restoration assertions.

Run `35366489937` on `c7235f2` passed preflight and connected but still found
all four app comparators non-hittable. Fresh state stayed foregrounded and no
activation was requested. The initial system-denial comparator was hittable;
the final one was missing. This establishes a tappable allowlisted system
control during the observation, not backgrounding or conclusively a particular
alert class: these native queries are sequential. No Details tap, nonce or
cold-restoration proof followed. Its owned input was removed at 16:36:53 UTC,
and both repository slots were confirmed empty.

The permission handler now also permits one uniquely matched, enabled, hittable
SpringBoard control with the same three exact denial labels, only while the
test app is foregrounded. It shares the existing four-attempt budget and never
selects a generic first button. Fixed action-source categories identify attempted
denials. The readiness deadline now starts after initial diagnostic collection;
only a completed denial action renews its settling window, within that same
global budget. Poll counts are categorized so zero-poll failures are no longer
indistinguishable from actual readiness polling. App UI and cloud assertions
are unchanged; the next native result must establish whether this resolves the
observed permission/readiness issue.

Run `35370709671` on `125bb31` connected but remained non-hittable after more
than three readiness polls. It recorded one alert denial, no outstanding
allowlisted system-denial control in either comparison, and a foreground app.
No Details tap, nonce or connected cold restoration followed. Its temporary
input was removed at 17:18:28 UTC and both slots were confirmed empty.

The owner explicitly approved a temporary encrypted visual diagnostic after
these fixed-category observations did not isolate the obstruction. The optional
`diagnostic_public_key` input is restricted to the trusted live iOS XCUITest
lane. Only after Connected, with the credential form and editable credential
inputs absent, may a failing Details wait capture the screen and app/system
hierarchy. The device key is additionally removed from hierarchy text. Files
remain in the private runner container, with a hierarchy-only outcome reported
explicitly if screenshot capture is unavailable.

CI uses a one-time operator-held RSA public key (3072/4096 bits) to wrap a random
AES-256-GCM key with RSA-OAEP-SHA256. Commit/run metadata is authenticated. Only
the ciphertext envelope may be uploaded, with one-day retention; the private
decryption key never enters CI. Raw capture files are removed after sealing and
the owned simulator is deleted by the existing cleanup. The operator must delete
the diagnostic artifact, local plaintext and one-time key after inspection.
Ordinary runs still retain fixed-category results only. This opt-in is diagnostic,
not a relaxed mobile proof or authorization to implement the new customer design.

The first opted-in run `35376592786` compiled `21dff58` but stopped during the
credential-free cold-launch preflight (`launch-failed`, native timeout, app
not running after termination). The live step and capture were not attempted;
no ciphertext or plaintext diagnostic was produced. Its temporary input was
removed at 18:12:42 UTC and both slots were confirmed empty. The capture approval
remains for a guarded retry; no preflight assertion is weakened.

Retained retry `35379301590` on `ad1e17c` passed preflight, connected and produced
the approved encrypted capture. Local inspection identified an app-owned native
`Save Password?` sheet above the connected screen, with `Not Now` and `Save`
buttons. This explains why alert-only permission handling missed the obstruction.
It does not indicate a capsule-layout or native Modal presentation failure.
No nonce or connected cold restoration was completed. Its temporary input was
removed at 19:07:49 UTC, and both dedicated slots were independently confirmed
empty. After inspection, the remote encrypted artifact, local ciphertext,
plaintext capture and one-time key files were deleted and their absence confirmed.

The native driver now declines only that exact app-owned sheet, only after a
live connection with the credential form absent, and only through its unique
enabled/hittable `Not Now` button alongside `Save`. It never presses Save or
adds a global Not Now dismissal. A single attempt consumes the existing shared
four-action budget and requires actual sheet disappearance. Fixed
`declining`/`dismissed` evidence distinguishes the gesture from its outcome.
This does not enable another Details tap or relax identity, nonce, preflight or
cold-restoration assertions. A new native run must establish the result.

Run `35385899894` compiled the new handler on `e8d4d66`, but stopped in the
credential-free input preflight at `host-input` with `keyboard-unavailable`.
The live-device step was skipped; the password-sheet handling was not exercised.
Its temporary input was removed at 20:02:20 UTC and both slots were confirmed
empty. Credential-free replay `35389585963` then passed unchanged exact input,
masking and cold startup using that run's pre-secret `e8d4d66` binary and the
docs-only `7a0f664` harness source. The earlier input failure did not reproduce,
so no application input behavior or preflight assertion was changed on a guess.
This replay is not a cloud proof.

### Details utility footer refinement (2026-09-18)

At the owner's request, Opus 5 high refined only Share nonsecret diagnostics and
Forget credentials. They are grouped in a card matching the sheet, with aligned
leading glyphs, full-width text rows, a restrained sharing accent and a separate
destructive treatment. Supporting text describes the redacted connection report
and phone-only credential removal. Existing callbacks, share payload, confirmation,
error handling and busy/disabled guards are unchanged. This is a narrow refinement,
not implementation of the broader customer-experience proposal.

The first delivery run `35379275362` stopped at Expo's newly updated compatibility
requirements before building either platform. After the shared SDK patch alignment,
the Android lane of `35380792854` passed for
`4f5554ce403868f705d2bb0352f1a2a488e0f965`. Its APK was installed in place on the
retained Windows emulator. Native inspection confirmed aligned full-width rows,
48 dp minimum targets and the unchanged Forget confirmation, which was cancelled;
no report was shared and no credentials were removed. A public-controls-only crop
was inspected without exporting a full live screenshot.

The same saved identity/model and imported Azure context/activity survived the
upgrade and a genuine stopped-process/new-process cold restart. An initial restart
attempt correctly refused an open Details sheet; it was closed before the actual
restart, without relaxing the readiness guard. This delivery did not submit a new
cloud nonce. APK SHA256:
`c6dca3e0f8b69793a65d81505bd04da3c867ad456f6c7aff91cc7745ad6b4045`.
The iOS lane of that run failed at the explicit Pod lock refresh, before an app
build; its repair and reviewed lock are recorded in the modernization plan.
The foundation's subsequent deployment-mode run `35385478270` passed JavaScript
and both native lanes on `070841a21c0d2cd2cc709eea31eab07f644c0ee3`. Its iOS
identity confirms `deployment` mode and the exact committed Pod lock hash.

After approving that footer, the owner requested the same coherent treatment for
connection and snapshot actions. The follow-up reuses its row component in
`Manage connection` and `Manage snapshot`, keeping recovery/manual entry before
destructive actions and adding concise, local-only explanations. The accepted
diagnostics footer, callbacks, IDs, disabled states and existing confirmation
semantics are preserved; snapshot removal does not acquire a new confirmation.
The snapshot editor's Import/Cancel controls remain compact.

This follow-up passed the Android lane in `35385882890`, source
`e8d4d6644aa5eb88611982230d84fcadbde370c0`, and was installed in place on the
retained Windows emulator. Native inspection confirmed aligned, readable rows,
minimum touch targets and the expected action order. The Replace editor was
opened and cancelled without importing or removing anything; Disconnect and
Remove were not invoked. Saved identity/model, namespace, subscription, resource
group, region and activity remained available without credential entry or snapshot
reimport. Public-controls-only crops were inspected. This UI delivery does not
claim a fresh Android cloud nonce. APK SHA256:
`b666614a534c25a5f308ac8c6d21853ba19145b3818234915f9e2b31c64ebd12`.

### Connection capsule delivery (2026-09-17)

The accepted capsule keeps status, a ringed cloud icon and a separated Details
action together, with a stacked large-text layout. Feature source
`2ed3d5a5f93ef3d05ebf7646036d7295fa89fbaf` passed JavaScript and both native lanes
in `35280082698`. Foundation adaptation
`15cdffb1331eceb449ee40fa3a7cb7ab079dd962` passed all three in `35280821601`;
it retains the legacy connection flow and local disclosure rather than adding
the feature's ADR sheet.

The feature APK was installed in place on the retained Windows Android emulator.
Connected identity, saved Azure context/activity, Details and utility/log actions
remained available. A fresh app-submitted nonce independently matched the exact
DPS identity, phone model and existing automatic ADR record. This is a new traffic
proof for the retained device, not a new automatic registry-creation case.
APK SHA256:
`6192bd6e0a9181c29b888cb267c3641362e983a7694c942f09b37721561a7584`.

### Registration and Details refinement (2026-09-17)

The Azure-only follow-up, source `f724bde83a5b4cfb08ea81dc81ba5829991fdc86`,
passed JavaScript and both native startup lanes in `35310328278`. Its APK was
installed in place on the retained Windows Android emulator, preserving the
accepted heading, capsule, compact Registration footer and other Details actions.
Azure facts now use separate Scope/Resources groups, compact Portal links and
one snapshot-management group with wrapping controls and consistent typography.
Native saved-context paths retained the exact namespace, subscription, resource
group, region and management activity without reimport. Bounded layout crops
excluded inputs and redacted the resource values; no full live screenshot was
written. A genuine process stop/relaunch restored Connected and the same assigned
identity/model, and the saved context/activity remained available afterward.
This layout delivery is not a new independently confirmed nonce, automatic
registry-creation case or completed iOS live acceptance.
APK SHA256:
`4b63cc5647f306a16f6beb4d9b555c9766e6f13dac72321c05ab0c568403f36a`.

The September 18 compact-action follow-up responds to further simulator feedback:
Registration now pairs content-width Close and New device controls with an
8 dp gap and 48 dp minimum touch regions. Narrow screens and large text stack
them without truncation; the full new-registration accessibility label remains.
Details uses a shared outlined/icon action treatment, contrasting fills on
snapshot cards, explicit expand/external-link glyphs, and distinct primary and
destructive actions. Static resource values and registry badges remain non-actions.
The accepted app heading and connection capsule are unchanged.

The compact-action feature source `df5bcb61053c70d8b6b43800f2d1fe9f40d2bd05`
passed JavaScript and both native startup lanes in `35303108607`; foundation
`30bb9acf822b716b7788a764af53bb04f501133d` passed all three in `35303073801`.
The feature APK was installed in place on the retained Windows Android emulator.
Its Registration controls measured 48 dp high, approximately 72/140 dp wide,
and exactly 8 dp apart in one row. Close returned to the connected device; New
device was not invoked. Public-only button crops confirmed visible action edges,
icons and distinct destructive styling without exporting full live screenshots.

The updated app submitted a fresh nonce, independently matched against DPS
assignment, the phone model and the existing automatic ADR record. A genuine
force-stop/relaunch restored the same connected identity without credential entry,
and the saved Azure resource/activity context remained usable without reimport.
This is retained-device evidence, not new registry creation or iOS live acceptance.
APK SHA256:
`8b62f4b5e266fd336270051b3182ebd805e7b5d776a9dd7fc6d14cd677de9893`.

Feature source `31e7e8e7658abb7c152fa038bb8c98b4ecd7cf2c` passed JavaScript,
Android and iOS lanes in `35285951515`. The corresponding foundation-only footer
adaptation, `113ac715d29215077c005632d7497c704ddff687`, passed all three in
`35284774063`. Foundation retains its legacy registration/clear confirmation
flows; the feature retains its distinct Close/new-device flow and ADR sheet.

The feature uses scoped shared Details typography, card spacing and action styles
across identity, registry, proof and Azure context. Static values are neutral;
unknown registry state remains neutral and snapshot activity remains historical.
The accepted display header and connection capsule are unchanged.

The Android APK was installed over the retained app without clearing data.
Settings-to-Registration interaction confirmed separate approximately 52 dp
buttons, the nominal 12 dp gap, and Close returning to the connected device.
The inspection did not invoke new registration. Saved Azure context/activity
survived without reimport, and an exact newly submitted proof nonce independently
matched assignment, model and the existing automatic ADR record. This is
retained-device update/traffic evidence, not a new registry-creation case or a
claim of new Azure resources. A subsequent scoped force-stop on September 18
confirmed the process was gone, then a new process restored Connected and the
exact identity/model without credential entry or clearing data.
APK SHA256:
`d6d48debef8d548abdf44d494c67eeac1e9f435223da2232718c6fc7aa80ab6c`.

### Recorded mobile evidence (2026-09-16)

Credential-free Android replay `35149722810` and iOS replay `35149723154`
passed bundled startup, manual-input, Back and cold-start assertions.
The iOS replay also confirmed deletion of its freshly owned simulator.

Real-device-input run `35150711575`, app source
`d8cd8abea76b67a6658bd5b493c8524535726ffd`, reached actual DPS assignment and
Hub connection on both virtual platforms. Independent operator reads confirmed
the phone model in both Hub twins and one matching automatic ADR record per
assigned device. That CI run still failed its details-screen UI assertions;
these partial cloud results do not make the run or milestone A1 pass.

The same run's credential-free Android APK was subsequently exercised manually
on the Windows Android Studio emulator. The operator independently matched the
exact submitted nonce/platform, assigned identity, Hub model and automatically
created ADR record. A scoped force-stop and relaunch produced a new app process
that returned to Connected with the same identity without re-entering credentials.
APK SHA256:
`e03817b61d15a7e678c1c26ed1a8cef2ea12838df5685b3535089ca1e04ba3ba`.
Lab-specific proof reports remain private and are not committed.

The refreshed Android UI from run `35164148425`, source
`41be7a028c9e4fc2aee7ed8b09d8d3049a73449e`, was installed over that CI app with
`adb -e install -r`. Private native UI inspection confirmed Connected and the
same assigned device/Hub without credential re-entry. No app data was cleared.

The follow-up design keeps a compact connection status row on every tab and
moves full identity plus secondary connection actions into the details sheet.
The live UI flow checks the same exact assigned values inside that sheet;
registry status and local-submission semantics are unchanged.

Android's manual cloud/cold-restore case is complete. iOS still needs the exact
nonce and connected cold-restoration evidence; XCTest screenshot and simulator
startup reliability remain under investigation. None of this establishes physical-device parity or downstream
telemetry receipt.

The follow-up iOS run `35185542106` on source
`64ea3610ee6dc578021412bddb051e4195943c4f` again reached independently matching
DPS assignment, Hub model and one automatic ADR record. Its details-screen
model-field assertion failed before nonce submission; connected cold restoration
was not reached. The owned temporary device input was removed afterward.

Run `35193531988` on source `af399da31f93cede305936808a1f712dfcc762d6`
used the in-tree connection loading overlay. The iOS Connected assertion failed,
although independent reads again confirmed exact DPS assignment and the phone
model in the Hub twin. The expected nonce was absent; cold restoration remains
unproven. Its safe report did not contain UI target presence, which alone does
not distinguish missing capture from missing controls. Temporary device inputs
were removed. The modal-handoff change is not established as a fix for these
automation failures.

The final Android UI from run `35227323436`, source
`d9e8b63034ab6f5b25e2ad70d4a2018af30cc212`, was installed over the retained CI
app without clearing credentials. Native interaction confirmed the compact row,
expandable/filterable logs, utility-page layout and exact identity/model.
The details Close button now works at its center outside the system bar, and
the log disclosure measured 126 pixels at 420 dpi (48 dp).
APK SHA256:
`9351ddfdfef90540887c5e7188cab2048e41cbb4a6d5e8094c2261c7a285cafd`.
A fresh app-submitted nonce independently matched the Hub twin and existing
automatic ADR record. A scoped process stop/relaunch restored Connected and the
same identity without re-entry. This reuses the previously established Android
registry-creation case rather than claiming a new record was created by the update.

The subsequent iOS live run `35228256697` on source
`63932ec1ea2a8d3cb1b3782cd0b15a62fbeb6568` again matched assignment, model and
one automatic ADR record, but failed the initial Connected assertion before
nonce submission. Its allowlisted category was an assertion failure; a captured
hierarchy contained none of the fixed target names. That does not identify the
cause or establish a driver disconnect. Temporary inputs were removed, and the
iOS nonce/cold-restoration gate remained open at that point.

An isolated Foundation API probe (`35240491338`) compared 15-second and
180-second request timeouts on iOS Simulator with 30 seconds of loopback
WebSocket silence. Both received the subsequent frame. This did not reproduce
the proposed 15-second idle-disconnect explanation, so the production transport
was not changed on that hypothesis. The probe is not PAAD/TLS/Azure acceptance.

Run `35242626049` on source
`b3902cbe550f9d9d8e68dac916a6d965b98ed8b4` passed the Connected assertion but
failed the following Details tap. Independent reads matched assignment, phone
model and one automatic ADR record; the nonce was still absent. The safe UI
capture exposed only the fixed app-root label, which does not establish a crash
or a transport cause. Its temporary input was removed.

The owner subsequently approved a focused native XCUITest lane for iOS. It is
opt-in (`ios_driver=xcuitest`) within the existing owner/exact-SHA live workflow.
The runner is built and exercised with synthetic input before the dedicated
device-key step; synthetic smoke never presses Connect. The native live path
retains exact identity/model/nonce and actual terminate/relaunch assertions.
Ordinary Maestro smoke remains in place. By default, credentialed runs export only
fixed-category native milestones and the existing nonsecret proof summary.
The explicitly approved, failure-only encrypted capture exception is described
above; it never exports plaintext or entire result bundles. Raw Xcode test output,
result bundles and device inputs are deleted. Implementation of this lane alone
did not close the gate; the later accepted run is recorded above.
Set `ios_smoke_only=true` with `platform=ios` and `ios_driver=xcuitest` to
exercise the new runner without ever requesting a device secret or sending
device traffic. This credential-free-only mode additionally retains the final
1 MiB of synthetic runner output for three days so actual Xcode/driver startup
failures can be diagnosed. It never receives a device key; this exception does
not apply to a credentialed run or its preflight. The ordinary exact-source/owner
authorization still applies.

The property/connection-notice UI candidate `2ae9a1f2901e287002d6420be1ab514786b33d31`
passed JavaScript and both credential-free native lanes in run `35252178223`.
The corresponding foundation adaptation
`31467af09a22ce83062b6f75a02e9c8853c1975d` passed all three lanes in run
`35252459704`. These are native startup/input-flow results, not the outstanding
iOS live nonce and connected cold-restoration proof.

The `2ae9a1f` Android APK was installed over the retained CI app without clearing
credentials. It restored the same assigned device and Hub, and a fresh
app-submitted nonce independently matched the Hub twin, phone model and existing
automatic ADR record. The private interaction helper also exercised log
expansion/filtering, utility pages and Details. An initial helper failure was
an offscreen target with zero bounds; requiring visible bounds and scrolling
resolved the helper failure without an app or transport change.
APK SHA256:
`e539f4223b4a1faeea0726992fde4ec5b128fee1ebf973a41b542217f56bbea0`.
This is retained-identity upgrade/restoration evidence, not a new registry
creation case or a separate process-force-stop assertion for this binary.

The quieter header and 48 dp editable input candidate
`aed9186c8c327442b27dc5c475c5335d809fa103` passed JavaScript and both native
lanes in run `35257757198`. Its Android APK was installed in place, preserving
the saved device identity and restoring Connected. The native helper observed
the new header, no redundant visible connection caption, a 48 dp Settings
target, the empty property input and its actual focus/48 dp height, disabled
unchanged submission, cloud empty state, and working Details/log/utility controls.
It left the app on Telemetry. This update did not submit a new proof nonce.
APK SHA256:
`ca7e57b47ec3dc2143d063a87e3f4420ddadf934a868ad96efd84548dab3163b`.
The completed foundation ancestry was merged in `6d613a6` without changing the
ADR feature tree; `master` remains untouched.

## What the experiment proved, and what it did not

The 2026-09-13 isolated cloud experiment used `azure-iot-device` Python SDK
**2.14.0**, fresh resources in **centraluseuap**, a shared user-assigned managed
identity (UAMI), and a namespace-linked Hub/DPS.

| Path | Observed result |
| --- | --- |
| Direct Hub device key | SDK connection, acknowledged telemetry, independently matching reported-property nonce, and an automatic ADR record. |
| DPS device key | SDK registration assigned a Hub; device connected, sent activity and had a matching automatic ADR record. |
| DPS CSR/certificate | Preview REST issued a three-certificate chain; SDK connected with X.509 and produced matching activity/ADR evidence. |

No ADR record was manually created. The namespace was empty before the run.
Telemetry was acknowledged but not independently consumed downstream; activity
was independently established by reading the Hub twin. ADR inventory is not a
telemetry store or a ready-made activity dashboard.

The experiment was not a React Native or physical-phone run. It omitted the
phone model payload. The old stack's `403000` did not recur, but the precise cause
and minimum necessary RBAC set remain unisolated. Preview availability outside
the tested region/subscription must be confirmed, not assumed.

## Priorities and exclusions

1. **P0: device-key/SAS onboarding.** Use a pre-created individual enrollment;
   support configurable provisioning endpoint, scope, registration ID and key.
   Use the assigned Hub and assigned device ID returned by DPS.
2. **P0: honest activity and registry evidence.** Show device connection/activity
   locally; prove the real namespace record through a separately authorized
   operator lookup. Never infer registry confirmation from the registration ID.
3. **P1: polished namespace-aware setup.** Validated manual/QR input, meaningful
   progress, copyable nonsecret diagnostics, retry/cancel and safe restoration.
4. **P2: certificates and in-app registry lookup.** Separate decision gates for
   native TLS/key lifecycle and for an authorized user/backend read path.

Do not embed CLI, subscription administrator credentials, enrollment-creation
permissions, or service shared keys in the phone. No full namespace management
surface, bulk operations, jobs, CA administration or new Azure backend in P0.
Do not expand group-key use for new onboarding: deliver an individual device
key to each phone. Preserve existing group-key input only for backward compatibility.

## Cloud preparation: operator or setup automation, never the phone

For new experiments, create uniquely named/tagged owned resources. Do not use
unrelated resources in the subscription/RG. Reuse a retained test stack only
with explicit authorization; confirm preview access and billing before creation.
Record ownership and retention/cleanup decisions; do not delete automatically.

The following captures the successful configuration, not a least-privilege
production recommendation. CLI names identify equivalent operations, not
commands to invoke from mobile code.

| Step | Configuration | Operation / CLI equivalent |
| --- | --- | --- |
| 1 | Shared UAMI | `az identity create`; retain its resource and principal IDs in operator setup state. |
| 2 | Fresh namespace; select UAMI for outbound calls | `az iot adr ns create --outbound-user-assigned-mi <identity-id>`; ADR ARM API `2026-11-02-preview`. |
| 3 | Fresh DPS; attach same UAMI, set `disableLocalAuth=true` | ARM `PUT` on the DPS resource with API `2026-06-01-preview`; the experiment used `az rest` because the installed DPS create command lacked the flag. |
| 4 | Fresh S1 Hub; attach UAMI, service local auth off, device SAS on | `az iot hub create --user-assigned-mi <identity-id> --disable-local-auth true --disable-device-sas false`; Hub ARM API `2026-10-01-preview`. |
| 5 | Resource-scoped roles below | `az role assignment create`; operator needs resource creation and role-assignment authority. Temporary PIM activation is an operator prerequisite, not a device operation. |
| 6 | Link DPS first, then Hub, using shared UAMI as inbound caller | `az iot adr ns link dps add` and `az iot adr ns link hub add`, both with `--user-assigned-mi`; Hub also uses `--availability Available --allocation-weight 1`. |
| 7 | Wait for resources/links to be ready and allow bounded RBAC propagation | Read back namespace endpoints and provisioning state. The namespace controls eligible Hubs; do not edit classic `iot dps linked-hub` links for this flow. |
| 8 | Create enabled individual symmetric-key enrollment | `az iot dps enrollment create --attestation-type symmetricKey --auth-type login`; service API `2026-11-02-preview`. Securely deliver only this device's bootstrap inputs. |

Namespace link commands coordinate endpoint configuration and role/identity
checks; they are not necessarily a single REST request. In the experiment, ARM
operations used the regional endpoint `https://centraluseuap.management.azure.com`
with the ARM token audience `https://management.azure.com/`.
The device endpoint was `global-canary.azure-devices-provisioning.net`; discover
and carry the configured endpoint rather than deriving it from the namespace name.

### Role assignments present in the successful run

| Principal | Scope | Roles |
| --- | --- | --- |
| Shared UAMI | Namespace | Contributor; Azure Device Registry Contributor; Azure Device Registry Onboarding |
| Shared UAMI | DPS | Contributor; Device Provisioning Service Data Contributor |
| Shared UAMI | Hub | Contributor; IoT Hub Data Contributor |
| Azure IoT Hub first-party service principal | Each owned UAMI, namespace, DPS and Hub resource | Contributor |
| Operator | Test Hub / DPS | IoT Hub Data Contributor / Device Provisioning Service Data Contributor |

There was no RG-wide Contributor grant. Verify tenant service identity and scopes;
do not copy another tenant's principal ID. Reproduce the known-good matrix first,
then isolate and reduce permissions in an authorized experiment. A `403000`
message alone does not identify the denied principal, action or scope.

The proof also had a root CA, intermediate CA and 30-day policy for the separate
certificate enrollment. The SAS enrollment was not policy-bound. A SAS-only stack
without those CA resources is a reasonable scope reduction to verify, not an
independently proven configuration from that run.

## Mobile flow and transport boundary

Use the foundation's connection interface rather than exposing a vendor SDK to
screens. Reuse the existing Hub/DPS code where reliable; own endpoint selection,
timeouts, cancellation, credential handling and typed results.

| Step | Phone responsibility | Reference behavior |
| --- | --- | --- |
| 1 | Read manual/QR input, validate it and show destination/device identity | Preserve existing QR/connection-string inputs. Version any new QR schema and redact secrets. |
| 2 | Register with scope, registration ID and device key | Python proof: `ProvisioningDeviceClient.create_from_symmetric_key(..., websockets=True)` then `register()`; SDK DPS protocol API `2019-03-31`. Implement equivalent mobile behavior, not Python inside the app. |
| 3 | Wait for assignment with bounded polling/retries | Honor retry guidance; handle failure and cancellation. Never assume assigned `deviceId` equals registration ID. |
| 4 | Connect to the returned Hub/device identity | Proof: `IoTHubDeviceClient.create_from_symmetric_key(...)`; MQTT over secure WebSockets. Validate the expected service destination and keep TLS verification enabled. |
| 5 | Send sensor telemetry and reported properties; handle methods/desired properties | Proof SDK calls: `connect()`, `send_message()`, `patch_twin_reported_properties()`, `shutdown()`; Hub protocol API `2019-10-01`. Preserve PAAD's PnP payload contract independently of SDK version. |
| 6 | Save the minimum device credentials in secure storage and restore safely | Avoid duplicated sessions/listeners; regenerate expiring SAS credentials and reconnect without infinite tight loops. |
| 7 | Show local connection/activity; keep registry status separate | Operator verifies the record. There is no automatic app-side ARM access from possessing a DPS key. |

The current app sends model `dtmi:azureiot:PhoneAsADevice;2` and PnP component
payloads. Test that actual model-bearing request on the working namespace path.
Do not silently remove the model to make onboarding pass. Keep a minimal-payload
diagnostic case to distinguish model/transport issues from service configuration.
The Python proof's protocol versions are evidence, not a requirement to downgrade
every mobile API to those versions.

Keep provisioning and connection state separate from optional registry evidence:

```text
Not connected -> Validating -> Provisioning -> Connecting -> Connected
                         failure/cancel/retry states are explicit

Registry: Not checked | Checking | Confirmed at <time> | Check failed
```

For direct-Hub registration, skip Provisioning. "Valid input" is not proof that
Azure accepted credentials. For P0, registry status stays "Not checked" in-app;
operator evidence satisfies acceptance. An inaccessible registry does not turn a
working Hub connection into a failed connection.

## HIG application to onboarding and device activity

Apply the complete [foundation HIG contract](MODERNIZATION.md#design-contract-apple-human-interface-guidelines).
These requirements are specific to this branch:

| Screen / state | Required behavior |
| --- | --- |
| Connection method | Keep "IoT Hub" and "DPS"; explain that namespace support depends on the operator's links, not a separate phone transport. Do not require unused subscription fields. |
| Credentials | Clear field labels, no autocorrection of IDs/keys, secure key input with deliberate reveal, manual fallback to QR. Inline validation preserves entered data. |
| QR camera | Ask for camera access at Scan, include accessible Close and Enter Manually actions, prevent duplicate submissions, release camera on exit. |
| Provisioning | Show the actual stage with an activity indicator, not invented percentages. Allow Cancel and explain actionable failure/retry choices. |
| Connected device | Prioritize device ID, assigned Hub and connection state. Label local sends versus acknowledgements; do not claim downstream receipt or namespace confirmation without evidence. |
| Permissions / errors | No startup permission barrage or routine modal alerts. Explain denial in context; offer Settings where appropriate without repeated prompts. |
| Diagnostics | Put technical codes and operation IDs behind Details. User-initiated export/copy excludes keys, SAS tokens and sensitive payloads. |
| Accessibility | Announce major connection-state changes, not every sensor sample. Use text plus status icons, Dynamic Type, VoiceOver/TalkBack, adequate hit regions and Reduce Motion. |
| Reset / disconnect | Disconnect ends the session; Forget Credentials is a separate, clearly explained action. Do not delete Azure devices when clearing local data. |

No custom Azure-portal dashboard or decorative glass system. Follow Apple's
[onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding),
[privacy](https://developer.apple.com/design/human-interface-guidelines/privacy),
[progress](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)
and [alert](https://developer.apple.com/design/human-interface-guidelines/alerts)
guidance. Keep Android's native interaction conventions.

## In-app namespace visibility: separate authorization decision

A device key authorizes device operations, not subscription inventory reads.
P0 therefore documents an external operator lookup; it does not add Azure login.
If in-app confirmation becomes required, first choose either an authorized-user
read flow or an approved backend with narrowly scoped, caller-authorized access.
Design authorization, consent, caching, revocation and failure behavior before
implementing it. Do not ship a shared administrative token or infer confirmation
from `registryDeviceExternalId` returned by a client helper.

## Certificate milestone: not part of SAS acceptance

The reference experiment used:

1. `az iot adr ns ca create` for ECC root/intermediate CAs, then
   `az iot adr ns ca policy create` for a 30-day policy.
2. A symmetric-key enrollment with `--adr-namespace`, `--adr-ca-name` and
   `--adr-cert-policy-name` references.
3. A device-generated P-256 key and CSR; device REST `PUT
   /{scope}/registrations/{id}/register?api-version=2026-11-02-preview` with
   `registrationId` and a base64-DER `csr`, authenticated by bootstrap SAS.
4. `GET /{scope}/registrations/{id}/operations/{operationId}` with the same API
   version until assigned. CLI equivalent: `az iot device registration create`
   with CSR input, followed by `operation-status`.
5. Decoding the returned base64-PEM certificate chain, matching the leaf public
   key, and connecting through SDK `create_from_x509_certificate(...)`.
   The successful response used the `classic` connection profile.

Mobile adoption needs a separate iPhone/Android proof for secure key generation,
CSR signing, chain validation, native TLS client authentication, expiry/renewal,
rotation and recovery. Ordinary JS WebSocket options do not supply this support.
Reject unsupported connection profiles explicitly. Keep private keys on-device;
do not introduce exportable production keys merely to copy the Python harness.

## CI-first validation and milestones

After M1, run the real app with bundled JavaScript on both an Android emulator
and an iOS Simulator in GitHub Actions. Drive onboarding, cancellation, recovery
and restart with assertions and bounded waits. Retain nonsecret screenshots,
logs, platform/toolchain details and the exact built commit. Compilation,
screenshots or a mocked registration alone do not satisfy mobile-to-cloud proof.

Windows/WSL development and signed physical-iPhone builds are optional developer
workflows and later hardware acceptance routes, not prerequisites for simulator
progress. Reuse a dev binary only when its native dependency/configuration set
matches this branch. No new native build is required for compatible JS edits in
a development client; milestone acceptance still uses bundled builds without Metro.

| Milestone | Acceptance |
| --- | --- |
| A0: setup contract | Operator can reproduce/read back a known-good owned namespace/Hub/DPS setup, role scopes and enrollment. No unrelated resources are modified. |
| A1: first mobile proof | The actual app on Android emulator and iOS Simulator registers with a device key and the phone model, uses the returned Hub/device assignment, and reports a unique marker. Separate authorized Hub twin and ADR inventory reads match it on each platform. This is not physical-device acceptance. |
| A2: real PAAD behavior | Model-bearing registration, sensors, twin/method contracts, cancellation, retry, secure restore and classic Hub/DPS compatibility work. HIG onboarding/error states are reviewed. |
| A3: release gate | Standalone builds work without Metro; network loss, restart, permissions and credential reset are covered. Physical iPhone and Android sensor/BLE/camera, secure-storage upgrade and accessibility acceptance remain required before two-platform parity sign-off. |

For each cloud case, use an independent device/enrollment ID and record a
nonsecret run nonce, assigned device/Hub, operation ID and timestamps:

1. Read initial ADR inventory and establish that the test device record is absent.
2. Provision/connect from the app. Do not manually create an ADR registry record.
3. Send telemetry and report the nonce in the twin.
4. Independently run `az iot hub device-twin show --auth-type login`; match the
   exact nonce and assigned identity.
5. Run `az iot adr ns registry-device list`; require a matching `externalDeviceId`
   in the intended namespace. Allow bounded eventual-consistency polling.
6. If downstream telemetry reception is claimed, additionally consume the payload
   at the configured destination. A twin match or PUBACK alone is not that proof.

Run malformed/duplicate QR, wrong key/scope, unavailable endpoint, timeout/cancel,
network loss/resume, unassigned registration and permission-denial cases. Preserve
actual service codes; do not diagnose every error as missing RBAC or silently
fall back to a different Hub. Test credential reset without cloud deletion.
Ordinary automated logic/UI jobs use mocked services or remain disconnected;
separate live-cloud jobs exercise the actual mobile transport on trusted code
with explicit opt-in and scoped access. Python SDK evidence is a reference,
not a replacement for the app's model-bearing requests.

Keep new reports secret-free and out of ordinary logs; never commit raw enrollment
responses, keys or signing material. Obtain permission before retention changes,
new billable resources, role expansion or external diagnostic uploads.

## Planning estimate and boundaries

After the foundation, initially allow **1-2 engineer-weeks for a narrow SAS
phone proof/onboarding slice**, then reassess using A1 results. Rough affected
scope: **8-15 existing/new app, test and documentation paths** around registration,
connection adapter, storage metadata, status/details and acceptance coverage;
these overlap the modernization file estimate and must not simply be added.
Preview service issues, transport replacement or a new backend can increase it.

Do not include mobile certificate support, in-app Azure authorization/registry
reads or full namespace management in that estimate. A cloud SDK success alone
does not resolve those mobile product and native-platform decisions.
