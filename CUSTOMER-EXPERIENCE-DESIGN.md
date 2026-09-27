# Phone as a Device: a calmer customer experience

Date: 2026-09-18

**Design proposal, not authorization to implement a new UI.** This develops
[PRODUCT-BRAINSTORM.md](PRODUCT-BRAINSTORM.md) into a staged customer experience.
It does not replace the current branch implementation or authorize a broader
redesign. The completed simulator acceptance and delivered Details refinements
are recorded in the [implementation ledger](docs/plans/ADR-NAMESPACE-INTEGRATION.md#completed-simulator-acceptance-2026-09-18).

Prepared through GPT-6 Astra's source-level analysis and an independent
**Claude Opus 5 high** product/UX critique. The synthesis below deliberately
accepts some recommendations and rejects others where they add scope or do not
match the implemented protocol.

The intended customer is primarily a solution builder trying to understand or
exercise an IoT integration. Learners and device developers should be welcome,
without separate beginner/professional products. This audience is a hypothesis,
not a conclusion from customer interviews.

## 1. Recommendation

**Keep the capabilities. Change the order in which people encounter them.**

The current app is organized largely around technical features. The proposed
experience is organized around three customer questions:

| Destination | Customer question | Responsibility |
| --- | --- | --- |
| **Device** | Is this phone ready, and what should I try next? | Orientation, a small current-state summary, one useful next action |
| **Explore** | What can I do with it? | An explicit directory of existing tools, with optional guided experiments |
| **Activity** | What actually happened? | Device-side events and diagnostics, later enriched with structured observations |

Keep **Settings** behind the existing labeled gear and **Connection details**
behind the accepted status capsule. Registration remains a setup/maintenance
flow, not another permanent tab.

Three tabs are a recommendation, not a magic number. The important change is
three stable destinations with distinct jobs. Do not remove tabs when offline,
hide tools behind an unexplained "More" menu, or make people complete lessons
before reaching a familiar feature.

### What stays familiar

Keep the accepted "Phone as a device" identity, phone mark, connection capsule,
warm neutral surfaces, restrained teal, system body typography, compact
Registration footer and grouped Details action rows. Reuse the refined Azure
Scope/Resources groups. No new branding, font family, illustration pack or
design-system replacement is needed.

The navigation proposal adds a small orientation page, not a dashboard of
gauges, six new feature pages or a mandatory wizard.

### What our discussion changed

Opus's strongest diagnosis is that the current navigation mixes three axes:
capabilities, evidence and setup. We agree the solution is clearer responsibility,
not simply fewer icons. We also agree that **source and freshness can be more
valuable than moving tabs**, so the rollout puts those improvements first.

| Opus recommendation | Decision after source-level review |
| --- | --- |
| Three destinations: Device / Activity / Environment | Keep the three-question principle, but prefer **Device / Explore / Activity**. Environment would elevate optional management context and duplicate the accepted Details entry; a named tool directory protects discoverability |
| Put the first useful step in Activity | Put the initial invitation on Device, where a newly connected person lands; Activity should first explain observations, not become another onboarding page |
| Fully usable local-only sensors before registration | Defer. This is a legitimate future possibility, but requires a separate runtime, activation and permission decision; it is not a free navigation change |
| Freshness and a named observer on evidence | Adopt, only where a real source exists. Avoid adding a distracting clock to every control or inventing missing timestamps |
| Treat delivery interval as a writable property | Reject that protocol interpretation. The current app-wide setting and per-sensor command are distinct controls, not an implemented writable DTDL property |
| Long-press any value to copy | Keep native selection/copy for appropriate values; do not overwrite the existing sensor long-press action or make hidden gestures the only accessible control |
| A self-describing evidence export | Adopt as later work, but omit device identity from the filename by default and retain an explicit privacy preview |

The three-tab structure remains a hypothesis to evaluate with customer tasks.
If clearer information within the existing navigation solves the problem, stop
there rather than forcing a structural migration.

## 2. Map every existing surface

| Current surface | Proposed home | What changes, and what does not |
| --- | --- | --- |
| Telemetry and charts | Explore -> Telemetry; direct shortcut from Device | Keep the sensor cards and existing chart/map destination; add clearer enable controls and data-source context |
| Properties | Explore -> Properties | Keep the protocol term, but group phone-reported values, cloud-requested values and device information |
| Bluetooth | Explore -> Bluetooth | Keep the existing list/detail flow; explain advertisement support and hardware limitations |
| Image Upload | Explore -> Image upload | Keep the focused tool; make the selected image and destination understandable before sending in a later, explicit behavior change |
| Logs | Activity | Reuse the existing list, All/Issues filters and disclosures before introducing any new evidence system |
| Connection details | Existing capsule -> existing sheet | Remains the authoritative place for identity, connection controls, diagnostics and Azure context |
| Registration | Initial setup; Settings -> Registration | Preserve QR/manual input, individual DPS default, classic/direct-Hub compatibility and existing confirmations |
| Settings | Existing gear | Theme, delivery interval, registration and app information; no experiments or inventory dashboard here |
| Proof marker | Connection details initially | Keep this technical operator tool; do not make a nonce the first customer task |
| Command handling | Later Explore -> Commands | Add discoverability for existing behavior, not a cloud administrator command console |

Explore must show the named tool rows immediately, with short descriptions.
Moving Bluetooth and images out of the tab bar must not make them undiscoverable.
Unavailable tools remain inspectable, with the reason and an appropriate action.
Only execution controls are disabled when their prerequisites are unmet.

**Tradeoff:** a tool that currently has a tab may gain a navigation step. Offset
that with a direct Telemetry shortcut and a single recent-tool shortcut on
Device, not configurable dashboards or a second navigation system. Returning
users keep their position while switching tabs; the guide never resets it.

## 3. What the customer sees, one step at a time

These are progressive invitations, not required levels or locked achievements.

| Moment | Show first | Offer next | Do not imply |
| --- | --- | --- | --- |
| First launch | One sentence about the purpose; existing scan/manual setup choices | A short "What can I try?" explanation and prerequisites | That the app creates Azure resources or that an Azure snapshot is required |
| Connecting | The actual current stage and Cancel | A specific recovery action if it fails | A made-up percentage, success before authentication, or an inevitable assignment |
| First connection | The accepted Connected capsule and one useful next action | See one available reading, or try a sample property when hardware is unavailable | That Connected proves cloud processing or current ADR inventory |
| First observation | The value, unit, source and time the app observed it | Open its chart; understand what telemetry means | That a local chart is a cloud chart |
| First deliberate submission | The exact sample property the person chose to submit | Explain where an authorized cloud-side operator can observe it | "Delivered to Azure" when the client only reports local submission |
| Optional two-way experiment | Prerequisites, expected effect and safe command/property instructions | Observe a cloud-originated request and its device-side response | That the phone can issue service-side commands with its device key |
| Investigating or sharing | Relevant Activity rows and Connection details | Share a safe result, with its limitations | A universal green "end-to-end" badge |
| Returning later | Current connection state and the person's existing tool position | Resume a guide by choice | That yesterday's evidence is a fresh observation |

A person without configuration can read a **static** explanation of the tools.
That preview must not instantiate sensors, request permissions, make cloud calls
or secretly enable simulation. A full anonymous/offline exploration mode is not
needed for the first redesign.

Keep startup initialization in `Welcome.tsx`. Put this orientation after storage
initialization, in the registration entry or the appropriate device destination;
do not turn the initialization splash into a wizard or defer secure-storage
restoration until someone completes a lesson.

### First-use guidance should be small

Use one dismissible **Try one thing** card. It explains the next action in two
short sentences and links to the real tool. Add a secondary "Browse tools" link.
Do not overlay coach marks over every control, interrupt with a carousel, or
show a numbered progress score across unrelated cloud services.

Dismissal is a convenience preference, not evidence that an experiment passed.
The guide remains available from Explore. A connection failure takes priority
over a recommendation, but not over access to the person's diagnostics.

## 4. Screen sketches and component decisions

The sketches show hierarchy, not fixed dimensions or a pixel-perfect layout.
Status and sample values are illustrative, not claimed current results.
Render new freshness or outcome fields only after their real observation source
exists. An early navigation-only version should omit those fields rather than
invent them to complete the sketch.

### Device: orientation, not a second Details sheet

```text
Phone as a device                              Settings

[ existing Connected / Disconnected capsule     Details ]

This device
Android emulator
Some physical capabilities may be unavailable.

Try one thing
See a reading from this device.
Learn what the device observes before following it to the cloud.
[ Open telemetry ]                         Browse tools

Current observation
Battery level       <value> %
Observed by this app <time>                 View reading

Device                    Explore                    Activity
```

Show at most one current observation and one suggested action. If there is no
eligible reading, replace the observation with a useful empty state; do not
populate a decorative zero. Use existing emulator detection and real sensor
availability, not device-name guesses.

Do not repeat subscription, resource group, namespace, assigned Hub and operation
IDs here. Exact identity stays one action away in Details. Do not introduce a
nickname that replaces or can be confused with the actual assigned device ID.

### Explore: an explicit directory, not a miscellaneous drawer

```text
Explore
Small experiments with your device and your cloud solution.

Suggested
See one reading                         [ Open telemetry ]

Data
Telemetry       Measurements and charts                  >
Properties      What the phone reports or the cloud asks >

Interactions
Commands        What the cloud can ask this phone to do  >
Image upload    Send a selected image                    >

Nearby
Bluetooth       Observe supported advertisements         >
```

Commands appears when a useful capability/instruction view is implemented; do
not ship an empty placeholder merely to match the sketch. Other existing tool
rows remain visible from the first navigation migration. Keep the directory
short enough to scan; no carousel, marketplace or library of dozens of lessons.

Each tool opens its existing screen first. Add a small optional "Try it step by
step" disclosure inside suitable tools instead of duplicating them as separate
beginner screens.

### Activity: start with the useful log viewer already built

```text
Activity                                      Latest
Device-side observations in this session.

[ All ] [ Issues ]

<time>  Command observed by this phone
        Change sensor interval
        Response submitted locally              Details

<time>  Reported property submitted locally
        Cloud receipt not checked here           Details
```

The structured rows in this sketch require new instrumentation. Reuse the
existing safe log viewer during migration; it must not manufacture these rows
by interpreting English log messages.

Namespace management activity stays inside the historical Azure context panel.
It is a different source and scope, not another stream of phone telemetry.
No news-feed behavior, automatic scrolling away from the reader, or badges for
routine readings. Preserve All/Issues and the explicit Latest action.

### Connection details: keep authority, reduce first-use prominence

Keep identity/session facts first, connection controls nearby, and deeper proof,
Azure context, diagnostics and credential management below. The existing Azure
groups already move in the right direction; do not redesign them again to match
an abstract new aesthetic.

Later, the technical proof action may link to an experiment, but there should
still be one implementation and one mounted set of its native controls. Do not
duplicate `proof-send` or identity selectors in two simultaneously mounted views.
The former iOS obstruction was resolved in the native workflow without replacing
Details. New navigation must preserve that same acceptance requirement.

### Telemetry, properties and hardware tools

Telemetry should make enable/disable discoverable with an explicit labeled
control using the existing action. Long-press can remain a shortcut, never the
only way to discover control. Distinguish **enabled**, **available**, **has a
reading**, and **submitted locally**; these are not synonyms.

Properties should retain exact model names in a technical disclosure while
explaining direction. A property that is read-only *to the cloud* may still be
editable by the phone app before being reported. Do not accidentally invert
`readOnlyProp` and `writeableProp`, or turn reported device information into a
form. Separate desired-property versions/acknowledgements from command responses.

Bluetooth should say what is supported: advertisement observations and existing
decoders, not generic GATT, guaranteed proximity or a separately provisioned
Azure identity for every discovered peripheral.

Image upload deserves a later review-before-send step: selected image, size,
known destination and an explicit Send action. Today selection starts upload;
adding a preview is a real behavior change with lifecycle/cancellation work,
not just a rearranged card. Never preselect personal media or upload on behalf
of the person without their action.

## 5. Two useful guided experiences

### A. Understand one reading, then one deliberate submission

1. Open Telemetry. Recommend one already available, low-permission reading; do
   not ask for location or camera access just to populate an overview.
2. Show its value and unit, identify the source, and explain that this is a local
   observation. On physical hardware, a gentle movement can make an appropriate
   motion reading tangible; a simulator must not claim physical movement.
3. If no suitable reading exists, offer the existing sample-property tool.
   Do not fall back to generated readings.
4. Let the person explicitly submit a nonpersonal sample such as
   `hello from this phone`. Show **Submitted locally** only after the actual
   submission result. Otherwise show the specific safe failure and Retry.
5. Offer instructions for separate authorized cloud observation. Until an actual
   observer is integrated, say **Cloud receipt not checked here**. Do not show
   an endless "waiting for cloud confirmation" spinner.

Important existing behavior: the sensor hook currently initializes enabled
sensors. In the first redesign this guide **observes the existing behavior**;
it cannot claim nothing is collected or sent before the person starts the guide.
Show the enable state plainly. Changing first-use sensor activation or permission
timing requires a separately reviewed phase, preserving existing user choices.

### B. Ask the phone to change a reporting interval

1. Explain the prerequisites: an available sensor, a connected phone, and a
   separately authorized cloud-side tool/operator.
2. Show the existing modeled command and a bounded example, such as
   `sensors*changeInterval` with `{"sensor":"accelerometer","interval":5}`.
   Offer Copy for this nonsecret example; do not execute a service command
   directly from the phone.
3. Observe the incoming command through the real device callback. Show the
   request identifier when supplied, the requested setting, and the handler's
   actual result. Record response submission separately.
4. Observe subsequent device-side behavior if enough real readings exist.
   A requested interval is not itself proof that a periodic measurement or a
   cloud consumer changed cadence.
5. Explain how the authorized cloud-side caller can inspect the response.
   Without that observation, stop at the device-side conclusion.

Command execution cannot be undone by leaving the guide. Do not silently restore
an interval and overwrite a legitimate cloud request. Display the current
setting only when its effective value is actually known; otherwise distinguish
the requested value from observed behavior. An intentional change back follows
the normal control path.

This experiment is preferable to a surprise flashlight action. Camera, torch,
Bluetooth and other physical effects remain explicit, capability-dependent
choices with their own permission and safety constraints.

## 6. Additional information worth showing

| Information | Where it helps | Implementation/authority requirement |
| --- | --- | --- |
| Physical device versus emulator | Device overview and relevant tool | Existing device detection; do not infer real sensor availability from this alone |
| Real, unavailable or explicit simulation source | Reading/chart and result | Existing source/availability state; no release simulation bypass |
| Unit and enabled state | Telemetry | Existing sensor metadata and controls |
| Last reading observed by this app | Reading detail | New timestamp at the observation boundary; not an invented sensor capture time |
| Last local submission, by channel | Activity or an expanded reading | New record of actual `SubmissionResult`; not a sent-message counter inferred from a timer |
| Property direction and observed desired version | Properties | Existing property definitions plus typed callback metadata |
| Command name, request identifier and response outcome | Commands/Activity | New safe instrumentation around real callbacks; identifier may be unavailable |
| Model capability explanation | Explore or a small read-only disclosure | Curated, version-bound metadata reconciled with the implemented phone model; no arbitrary model loading |
| Snapshot source and capture time | Azure context | Existing historical metadata; schema validity does not authenticate the operator's claims |
| Build/model/platform context | Shared diagnostic result | Nonsecret allowlisted fields; identify what the report actually covers |

Do **not** add uptime scores, arbitrary health percentages, decorative cloud
latency, estimated cloud delivery counts, registry success inferred from a name,
or "all systems healthy" from a successful connection.

## 7. State and wording rules

| Situation | Customer treatment |
| --- | --- |
| No configuration | Explain the required device configuration; preserve scan/manual setup and a static capability preview |
| Connecting | Actual stage, bounded operation and Cancel; no synthetic percentage |
| Connected | Session ready for device operations; no implied registry or downstream confirmation |
| Disconnected | Keep tools and diagnostics reachable; explain which actions need a connection and provide Reconnect |
| No reading yet | "No reading observed yet"; preserve the distinction from a measured zero |
| Hardware unavailable | Explain the known limitation and offer another tool; if the reason is unknown, do not call it permission denial |
| Permission denied | Explain how to recover only when that reason is actually known; no repeated unsolicited prompts |
| Simulation | Persistent source label wherever synthetic output appears; never eligible for a live-cloud success claim |
| Old reading or snapshot | Show source/time and that it is historical; do not silently present it as current |
| Partial experiment | Show observed facts and missing observations separately; not simply failed or passed |
| Interrupted operation | Say observation was interrupted; cancellation is not proof that the remote action did not occur |
| Invalid or failed persistence | Surface the existing error; preserve credentials and do not claim the new configuration was saved |

Use quiet text for unknown/not checked states, not alarming red. Reserve red for
an actual actionable failure. All status meanings need words or icons as well as
color.

Keep the first layer brief: the observation, its source and its relevant time.
Put longer protocol explanations behind a clearly labeled disclosure. Truthful
wording should make the app easier to understand, not turn every card into a
disclaimer.

## 8. Friendly, restrained delight

The best surprise is understanding something quickly.

After a person's first real local observation in an optional guide, a short
sentence such as **"That is your device describing what it sees."** can connect
the reading to telemetry. Match the sentence to the actual source; do not
attribute a simulator value to physical movement.

A small, one-time surface emphasis may acknowledge that observation. Keep it
brief, nonflashing and unnecessary for comprehension, and use an immediate static
change when Reduce Motion is enabled. No confetti, mascot, sound, surprise torch,
streaks, achievement badges or animation on every incoming sample.

A source label can offer a short, accessible "What does this mean?" disclosure:
for example, why **Submitted locally** is useful but not a cloud receipt. Keep
the explanation near the result, not in another modal. Native selection/copy
for exact identifiers is useful without requiring a new clipboard dependency.

Another useful detail: opening Activity from an error can locate the relevant
event without clearing the user's filters or history. Show an explicit context
filter with a clear way back, rather than silently changing what the list means.

## 9. Critical implementation details

### Preserve a single owner of the live session

`Home.tsx` currently owns sensor hooks, property state, telemetry listeners,
command/property callbacks and delivery-interval behavior as well as the tabs.
`useSensors()` and `useProperties()` contain local hook state; calling them again
in each new screen is **not** subscribing to one shared state.

Before distributing those views across destinations, extract the existing
behavior into one narrowly scoped runtime/provider above the new tabs, or retain
one owner and pass typed view models. Do not create one MQTT client, sensor
subscription set or command handler per tab.

Registration, restoration and secure storage remain with the existing
`IoTCProvider`, `StorageProvider` and connection hooks. A tab switch must not
reconnect, resend initial properties, reset sensor intent or fetch the twin again
because a screen remounted. Bluetooth still stops observing on the appropriate
blur/unmount; camera ownership and image-operation cleanup remain intact.

### Observe facts at their source, not by parsing the UI

The current `SubmissionResult` is `submitted | simulated`; it is not a broker or
cloud acknowledgement. File upload has a different acknowledged HTTP outcome.
Desired properties carry a version; commands may carry a request ID. Preserve
these differences.

Likewise, the Settings delivery interval applies across sensors, whereas
`sensors*changeInterval` targets a particular sensor. `ItemProps` currently
exposes a setter, not an authoritative effective-interval field. Do not relabel
either control as a writable property, claim the global preference changed
after a per-sensor command, or display a requested interval as a measured rate.
A later shortcut may reuse one interval editor with its scope clearly stated.

For later structured Activity, add a small typed observation adapter at existing
submission and receive/handler boundaries. A conceptual record needs:

| Field | Rule |
| --- | --- |
| Kind and channel | For example local telemetry submission, desired-property observation, command response submission; never one ambiguous "delivery" flag |
| Session generation and identity binding | Actual assigned Hub/device/model and source mode, not registration ID alone |
| Observed time and observer | Device clock plus `device-app`, `operator-report`, or a future authorized reader; distinguish observation time from import time |
| Correlation | Explicit operation/request identifier, property version or proof nonce where available; absent means uncorrelated |
| Outcome | The exact bounded outcome the source can establish |
| Safe detail | Typed allowlisted fields and error codes, not arbitrary payloads, token-bearing URLs or raw SDK errors |

Use discriminated unions and source-specific rendering, not strings cast into a
generic "verified" state. Do not correlate two operations solely because their
timestamps are close. An initial twin read may expose an old desired value; it
is not automatically a newly issued cloud request.

Invalidate current-session facts when identity, client generation or simulation
mode changes. Guard async completion with the existing generation/unmount
patterns so old work cannot decorate a newly registered device. Cancellation and
timeouts must retain truthful partial outcomes.

### Keep observation storage small

Reuse the existing redacted log viewer and its 500-entry bound. Structured
observations should be a separate typed input, not a second unbounded stream of
every sensor sample. Keep only the latest fact per supported capability plus a
bounded recent operation history; choose and exercise explicit count/byte limits
before adding that history.

Start session observations in memory. Persisting complete run history is not
required for this redesign. Guide preferences may use the existing storage
mechanism with a versioned, bounded schema; they must not alter credential
formats or the atomic save/restore path.

Use device timestamps for labeled local observations. Do not calculate cloud
latency by subtracting unsynchronized device and service clocks.
Show age before inventing a universal stale threshold: a slowly changing
property, a periodic measurement and an operator snapshot have different
lifetimes. A disconnected reading is last-known data, and even a recently
imported snapshot remains historical. Missing timing metadata stays unknown.

### Keep one implementation of each tool and control

Use the existing typed React Navigation setup, stable destination names and
small destination components. Keep Settings/Registration return behavior,
Android Back, iOS sheet dismissal and per-tab navigation state explicit.
Do not pass keys, full snapshots or sensor payloads as route parameters.

Retain native action/value IDs, especially `connection-details`,
`connection-details-sheet`, assigned identity fields, registration inputs,
`proof-send`, property inputs and Azure disclosure paths. If a future navigation
label deliberately changes, update the genuine native route traversal in the
same change; do not add a hidden legacy route or test-only entry point.

The runtime owner should survive ordinary tool navigation. The actual controls
should not be duplicated across hidden, simultaneously mounted screens.

### Reuse the presentation system

Build on `palette`, `detailStyles`, `DetailsAction`, the existing typography and
cards. Keep the current 17/24 section, 15/22 value, 13/19 supporting and 12/16
metadata roles coherent; do not put essential instructions in tiny metadata.
Use system text scaling without caps, wrapping names and selectable exact
identifiers. Longer first-use explanations need comfortable body-sized text,
not a compressed card.

Keep controls at least 48 dp on Android and 44 pt on iOS; the existing shared
48-unit actions are a useful baseline. Measure actual rendered targets rather
than assuming a style declaration suffices. Preserve visible button boundaries.
Check text contrast in both themes and increased-contrast settings; pastels
belong on surfaces, not as low-contrast text.

Support screen-reader names, roles and states, modal focus/return, keyboard
avoidance, safe areas, rotation, large text and logical layout direction.
Announce meaningful operation changes politely, not every sample. Use native
accessibility/reduced-motion APIs already available in React Native rather than
adding an animation or accessibility dependency.

### Keep Azure authority outside device credentials

No Azure sign-in, new backend or management permissions are required for the
navigation and guidance phases. A guided experiment can explain use of an
already authorized external tool without controlling it.

An imported operator result, if designed later, must identify itself as an
operator report, bind to the correct identity/operation and retain its timestamp.
Parsing a file successfully is not authenticated live verification. Automatic
Azure context or a trusted cloud observer requires a separately approved
authorization, freshness, privacy and failure design.

If a person records an external observation manually, label it **user-attested**
and keep it distinct from app-observed facts. "I did not find the message" does
not prove nondelivery, nor isolate the problem to one component. A future report
must retain the observer, scope, correlation and observation window.

Sharing also requires a preview and an explicit action. Exclude credentials,
SAS URLs, raw images, location readings and unrestricted payloads; make inclusion
of environment identifiers understandable. Sharing cancellation is not success.
Prefer a filename such as `paad-<scenario>-<timestamp>.json`, without a device ID
that would otherwise leak into chat previews or file indexes.

## 10. A low-risk implementation sequence

These are future reviewable increments, not a delivery schedule. Each can stop
at a useful outcome without committing to all later phases.

| Phase | Small deliverable | Gate before moving on |
| --- | --- | --- |
| **0. Preserve the working product** | Record and preserve the accepted UI, navigation, connection/storage behavior and exact platform evidence before new design work | Known baseline and no attempt to hide a regression with new navigation |
| **1. Improve orientation in place** | Small optional first-action guidance, existing source labels, clearer property direction and explicit sensor controls within current navigation | Existing tasks remain as reachable; defaults, message contracts and credentials unchanged |
| **2. Add truthful observations** | Source timestamps and typed submission/receive facts; extract a single runtime owner in a separate small change before distributing its state | Every label has a typed source; unknown, simulated, stale and interrupted cases are covered; existing navigation still works |
| **3. Reorganize only if useful** | Device / Explore / Activity shell; existing tools reused and completely mapped, with the original log viewer consuming the new facts | Customer tasks support the move; no duplicate listeners/network effects; native navigation and restoration work on both platforms |
| **4. Add one guided experience** | Reading/sample-property guide, then one optional authorized cloud-command interaction | A person can explain what was observed and what was not; no fake cloud completion |
| **5. Deepen only demonstrated needs** | Review-before-send images, carefully revised permission activation, a safe run export or a richer capability view, as separately chosen work | Each behavior/privacy change has its own acceptance and migration review |

Automatic Azure context, a backend observer, arbitrary DTDL loading, certificate
onboarding, fleet management and production/background gateway guarantees are
**outside this sequence unless explicitly approved later**.

Recovery guidance should begin with inspection and Reconnect, not deleting
credentials. Keep Forget credentials and New device as deliberate maintenance
actions with their existing safeguards, never automatic fixes or casual lesson
steps. No clock changes, weakened TLS or production enrollment mutation.

Use a short-lived nonsecret development/CI build switch for the new navigation
shell while comparing it with the existing one. Mount only one shell at a time;
the flag must not change authentication, simulation gates or transport behavior.
Do not ship a permanent "old versus new app" preference or migrate credential
storage just to roll out layout changes.

### Suggested implementation touch points

| Existing area | Proposed responsibility |
| --- | --- |
| `src/App.tsx`, `src/Home.tsx`, `src/types.ts` | Stable navigation, single runtime owner and typed destination parameters |
| `src/hooks/common.ts` and existing connection hooks | Reuse sensor/property state; add narrow observation boundaries only when required |
| `src/CardView.tsx`, property metadata and existing chart | Clear source/direction/enable presentation without new payload semantics |
| `src/Logs.tsx`, `src/contexts/logs.tsx` | Reuse bounded safe logs; consume typed observations rather than parse display text |
| `src/components/connectionSummary.tsx`, Azure/proof components | Keep one authoritative details surface and native selectors |
| `src/Registration.tsx`, `src/Settings.tsx` | Preserve setup, saved-registration and return behavior |
| `src/bluetooth/Bluetooth.tsx`, `src/FileUpload.tsx` | Reuse tool screens and preserve native resource lifetimes |
| `src/strings.ts`, palette and shared styles | Centralized copy and small reusable presentation roles |

Add a component only for a repeated or stateful responsibility: a next-action
card, source/freshness label, or observation row. Avoid a generic dashboard
schema, page-builder framework, global state-library migration or broad rewrite.

## 11. Acceptance before calling it an improvement

Use the repository's existing Jest, type/lint and hosted native workflows.
Documentation itself does not establish behavioral or accessibility acceptance.

For a navigation increment, exercise every mapped destination, return path,
large-text layout and unavailable state. Assert a tab switch adds no connection,
command/property listener or sensor subscription, and does not change delivery
intervals or erase unsent input.

For an observation increment, cover concurrent operations, missing request IDs,
duplicate desired versions, initial twin values, late completion after a device
change, disconnect, simulation, timeout and cancellation. Local submissions must
never satisfy external-observation or registry assertions.

For native acceptance, retain actual UI entry, secure masking, exact assigned
identity/model, device-only cloud traffic, independent scoped readback and
genuine connected cold restoration where applicable. Keep public artifacts
credential-free or allowlisted. Simulator results do not establish physical
sensor, BLE, camera/torch or background reliability.

For customer acceptance, observe a few intended users performing concrete tasks:
find Properties and Bluetooth without assistance; obtain one meaningful result;
explain the difference between a local reading, a local submission and a cloud
observation; recover from a disconnected state without losing registration.
Treat navigation labels and first-action choice as hypotheses until this is
observed. Do not optimize for time spent in the app.

## 12. Decision summary and sources

The recommended first move is **orientation and discoverability**, not a visual
overhaul. The recommended eventual structure is **Device / Explore / Activity**.
The recommended new information is **source, time, direction and honest outcome**,
not more Azure identifiers or gauges.

Sources and implementation anchors:

- [Product purpose brainstorm](PRODUCT-BRAINSTORM.md).
- Claude Opus 5 high's independent critique, reconciled with the source-level
  constraints above. Its proposed timings, causal diagnoses and protocol
  classifications were not treated as established facts.
- [Original Microsoft Plug and Play overview](https://learn.microsoft.com/en-us/previous-versions/azure/iot/overview-iot-plug-and-play).
- [Apple HIG: tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
  and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
  These inform stable navigation and inclusive interaction; this proposal does
  not claim full HIG compliance.
- [`Home.tsx`](src/Home.tsx), [`App.tsx`](src/App.tsx) and
  [`hooks/common.ts`](src/hooks/common.ts): current navigation and runtime ownership.
- [`connection/types.ts`](src/connection/types.ts),
  [`properties/index.ts`](src/properties/index.ts) and
  [`onboarding/proof.tsx`](src/onboarding/proof.tsx): actual protocol/result boundaries.
- [Current ADR implementation/evidence plan](docs/plans/ADR-NAMESPACE-INTEGRATION.md).
