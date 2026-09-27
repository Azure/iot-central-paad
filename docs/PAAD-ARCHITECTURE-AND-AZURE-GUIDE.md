# PAAD: how the app works and how a phone connects to Azure

**PAAD means Phone as a Device.** It turns a supported phone into an example
Internet of Things (IoT) device: the phone can send measurements, report values,
receive cloud requests, and upload a selected image.

You do **not** need to be an app developer, create an Azure subscription, or
create new Azure resources just to use an already prepared connection. An
authorized administrator can provide this phone's connection information.
Start with [the phone-user steps](#7-phone-user-steps-connect-to-an-existing-setup)
if that information and an appropriate app build are already available.

For a visual explanation, open the offline
[app architecture diagram](diagrams/paad-app-architecture.html) or
[phone-to-Azure workflow diagram](diagrams/paad-phone-to-azure.html) in a browser.
Each has a big-picture map and a numbered walkthrough.

The repository's **IoT Central** name is historical. It retains IoT Central
compatibility and some older internal names, but today's app owns its connection
flow to **Azure Device Provisioning Service (DPS)** and **Azure IoT Hub**.
An IoT Central application is not mandatory for every supported connection.
**Azure Device Registry (ADR) is an optional cloud-side inventory integration,
not a third messaging connection made by the phone.**

This is a source-based guide, not a certificate that a particular downloaded
build works. Following the connection, proof, property, or upload steps does send
real device traffic; use only an administrator-approved identity and destination.

## 1. A small glossary

| Term | Plain-English meaning |
| --- | --- |
| App / UI | The installed program / its buttons, screens, and other visible controls. |
| Client / runtime | Code that talks to a service / the shared code managing a running device session. |
| Native | Code or controls supplied by Android or iOS, rather than a web page. |
| Azure resource | A cloud service instance managed by an administrator; it may incur charges. |
| Subscription / resource group | Azure's billing-and-access container / a grouping of resources inside it. These are not phone login fields. |
| IoT Hub | The service the phone connects to for device messages and device state. A dashboard or downstream processor is separate. |
| DPS / provisioning | The assignment service / asking which Hub and device identity this phone should use. |
| Enrollment | The administrator's DPS record that allows a particular device to request an assignment. |
| Registration ID / assigned device ID | The name used to request provisioning / the identity returned for use at the Hub. They can differ. |
| ADR / namespace | Azure Device Registry / its cloud-side scope for inventory, service links, and eligible-Hub allocation configuration. |
| Telemetry | Measurements sent by a device, such as battery level or acceleration. |
| Device twin | A cloud JSON record containing device metadata, desired properties, and reported properties. |
| Desired / reported property | A value requested by the cloud / a value reported by the device. |
| Command / direct method | A cloud request to do something now, with a device response, rather than a stored desired setting. |
| Device key / SAS token | A device's secret / a short-lived signed authorization string made from that secret. SAS means Shared Access Signature. |
| Base64 | A way to represent binary data as text. A supplied Base64 device key is still a secret: paste it exactly as provided, without decoding or editing it. |
| HTTPS / TLS / MQTT / WebSocket | An encrypted web-request protocol / connection encryption / a messaging protocol / a persistent connection that can carry MQTT. |
| Entra / ARM / IAM | Azure's user and service identity system / resource-management APIs / permissions administration. These belong to the operator, not this phone's device login. |
| Nonce | A fresh marker used for one proof attempt so an old result cannot be mistaken for new activity. It is not a password. |
| CI / artifact | Automated build-and-check jobs / the installable file or other output they produce. |

## 2. The big picture

```text
PHONE: one installed native app
+---------------------------------------------------------------------+
| Home: connection map | Explore: tools | Activity: local observations  |
| Registration + Connection details + Settings                         |
|                         |                                           |
| Shared DeviceRuntime: sensors, properties, command/property handlers |
|                         |                                           |
| ONE shared, observed DeviceClient: validation, cancellation, errors  |
|          |                    |                     |               |
| Secure local storage   Native capabilities   Device-side observations|
| device credentials     sensors/camera/BLE     bounded, in-memory only |
| and settings           + secure WebSocket    NOT a cloud observer    |
+----------|--------------------|-------------------------------------+
           |                    |
           +-- HTTPS ----------> DPS ---- returns assigned Hub + ID
           |
           +== MQTT over secure WebSocket <==> assigned IoT Hub
           |      measurements/properties -->   <-- commands/desired
           |
           +-- HTTPS --> Hub upload setup --> HTTPS --> Blob Storage
                         Hub notified afterward

AZURE: separately administered services
   ADR namespace - - cloud-managed DPS / Hub links and device inventory
   Administrator - - authorized assignment / twin / registry reads
   No phone-to-ADR or phone-to-Entra administration API connection
```

Solid paths above describe phone traffic. Dashed relationships describe
administrator/cloud configuration, not extra phone connections. DPS is used
during assignment; it is not a relay for every measurement. ADR is not a
telemetry store, and a namespace link is not proof that any message arrived.

### How the app is divided

- **UI layer:** `App.tsx` establishes navigation and shared providers.
  `Home.tsx` places Home, Explore, and Activity under one device runtime.
  Switching tabs does not intentionally create a second client or a second set
  of sensor and command handlers.
- **Shared visual controls:** `components/surface.tsx` paints the subtle
  gradients, while `hooks/press.ts` gives buttons their short press feedback.
  These are local drawing and interaction helpers, not extra Azure clients.
  The connection map's moving light is decoration, not measured traffic or
  proof of delivery. It stays still when disconnected and respects the phone's
  Reduce Motion setting; controls remain usable without movement.
- **Shared runtime:** `DeviceRuntime` owns sensor intent, properties, callbacks,
  and property submissions. The hooks obtain the same client from `IoTCContext`.
  Property drafts survive movement between tool screens in memory; they are not
  saved cloud values, nor a promise to survive quitting the app. Source changes
  can replace drafts.
- **Connection layer:** app-owned `src/connection` validates credentials and
  endpoints, provisions through DPS, connects to Hub, and implements uploads.
  Screens use its typed interface, not the vendor library directly.
- **Native-capability layer:** Expo and React Native modules access the OS.
  The local `paad-device` module provides the restricted secure WebSocket and
  checks whether a torch exists. The camera UI separately owns permission and
  actually switching the torch.
- **Storage boundary:** `react-native-keychain` stores credentials and settings
  using platform secure storage, rather than an ordinary preferences file.
  If secure storage fails, the app reports an error rather than pretending the
  connection was successfully saved.
  Simulator storage tests do not establish physical secure-hardware guarantees.
- **Observation boundary:** a wrapper records selected metadata about calls and
  callbacks on the existing client. It creates no extra cloud observer, client,
  or subscription. Activity is not an Azure monitoring service.

## 3. The important frameworks and dependencies

These are the significant pieces, not every package in the dependency tree.
Versions below describe the current [package manifest](../package.json).

| Piece | What PAAD uses it for |
| --- | --- |
| **React 19.2.3** | Describes screen components and updates them when state changes. It is the UI programming library, not the phone operating system. |
| **React Native 0.86.3** | Runs the shared JavaScript/TypeScript app with native Android/iOS controls and native-module access. This repository uses its New Architecture. |
| **Expo SDK 57.0.24** | Compatible native modules, app configuration, native-project generation, and development tooling around React Native. Expo is not a separate replacement for React Native. |
| **TypeScript 6.0.3** | Checks code-level types before running: clients, JSON values, connection states, and observation outcomes. It does not certify cloud delivery. |
| **React Navigation** and its native support packages | Root screens, bottom tabs, and the Explore tool stack; safe areas and gestures keep controls usable around system bars. |
| **React Native Elements (`@rneui`), vector icons, Expo Font/Fraunces** | Reusable controls, icons, and the bundled display font. Fraunces highlights the “Phone as a Device” heading and page titles; readable system type handles controls and data. Native/configured font changes require a new native build. |
| **`react-native-azure-iotcentral-client` 1.1.10** | A contained compatibility dependency: cryptographic/legacy credential helpers and the underlying Hub MQTT client. PAAD wraps version-specific internals in `legacyHub.ts`; its vendor DPS, upload, logger, retry loop, and unbounded reconnection are not used. |
| **App-owned `src/connection` and `expo/fetch`** | The actual application connection API, HTTPS provisioning/upload requests, deadlines, endpoint restrictions, and redirect refusal. |
| **Local Expo module `modules/paad-device`** | Swift/URLSession on iOS and Kotlin/OkHttp on Android implement TLS WebSockets that refuse redirects. It is repository code, not an Azure SDK or an Expo Go feature. |
| **`react-native-keychain`** | Secure local persistence for device credentials and app settings, including optional imported Azure context. |
| **Expo Sensors, Battery, Location; `react-native-device-info`** | Phone measurements, hardware availability, permission-aware location, and device information. |
| **Expo Camera and Image Picker** | QR scanning, camera/torch presentation, and selecting or taking an image. Selecting an image starts its upload. |
| **`react-native-ble-plx` and permissions support** | Bluetooth Low Energy advertisement scanning and OS access checks. PAAD does not implement arbitrary Bluetooth pairing or characteristic read/write tools. |
| **`react-native-svg`, `react-native-maps`** | Bundled charts, connection-map drawings, subtle gradients, and native location-map presentation. Android location-map display needs build-time configuration; coordinates can still be shown without it. |
| **Jest / React Native Testing Library, ESLint / Prettier** | Developer tests, static checks, and formatting. These are development tools, not cloud services. |

The native Fraunces font is included in the app, so displaying it does not
download anything from a font service. Its file is
`src/assets/fonts/PAADFraunces-Medium.ttf`, and its open-font license is
[`LICENSE.fraunces`](../LICENSE.fraunces). This is a static Medium instance
(`wght=500`, `opsz=24`, `SOFT=20`, `WONK=0`) of the official Google Fonts
Fraunces source at revision `e44c4b011a820c2cbe2fd2cfa8052037d7edb571`,
generated with FontTools 4.65.0. “Static” here means those typography choices
are fixed inside one small font file, which keeps Android and iOS consistent.
The native family/PostScript name is `PAADFraunces-Medium`; body text does
not depend on this font.

## 4. Which app build can I use?

- **Expo Go is not sufficient.** It is a general-purpose host app and does not
  contain PAAD's custom native module and full native dependency set.
- **A native development build** includes those modules. During development it
  can load JavaScript from Metro, the developer's local bundler/server.
- **The repository's bundled CI builds** include JavaScript and can launch
  without Metro. GitHub Actions builds the Android APK and iOS Simulator app;
  **EAS, Expo's hosted build service, is not a requirement.**
- **An Android emulator or iOS Simulator is a virtual device**, not PAAD's
  offline simulation mode. A correctly built virtual device can make real DPS
  and Hub connections with authorized device credentials. Missing hardware must
  remain unavailable, rather than silently becoming generated measurements.
- **A physical phone** needs a compatible installable build, OS permissions,
  and real hardware. An iOS Simulator app cannot be installed on an iPhone.
  Physical-device signing/distribution and production configuration are separate
  owner-controlled work; simulator ad-hoc signing is not an Apple distribution
  identity. Windows can run an Android emulator, not Apple's iOS Simulator.

The configured minimums are iOS 16.4 and Android 7/API 24. Build requirements and
optional local setup are in the [README](../README.md#build-and-run).
The [simulator guide](ADR-SIMULATOR.md#windows-emulator-with-a-wsl-checkout)
explains installing an approved bundled Android artifact.

**Current delivery (2026-09-20):** the Home/Explore/Activity experience completed
the retained-DPS Android emulator and iOS Simulator flows, including fresh cloud
proof and saved-credential restoration. The Windows emulator was updated in
place with its credentials and imported Azure context retained, including after
a cold restart. Exact sources, runs and remaining limits are recorded in the
[acceptance ledger](plans/ADR-NAMESPACE-INTEGRATION.md#native-home--explore--activity-implementation-2026-09-19).
This does not establish physical-phone, media-upload, large-text or direct-Hub
acceptance, and it does not produce a physical-iPhone installation package.
Production reliability, physical sensors/BLE/camera/torch, background operation,
and full platform parity are not guaranteed. A successful build is not a cloud
test, and this document is not artifact validation.

## 5. Choose the scenario, not three separate phone logins

| Existing setup | What the phone does | What is bypassed or remains separate |
| --- | --- | --- |
| **Classic DPS + IoT Hub** | Uses individual-enrollment inputs; DPS returns the Hub and device ID; the phone then connects to that Hub. | ADR is not required. The administrator manages the classic allocation/linked-Hub setup. |
| **ADR namespace-linked DPS + Hub** | Uses the same individual-key DPS form and phone protocols. The operator supplies the correct provisioning endpoint. | Namespace links/allocation and automatic inventory are cloud-side. No namespace name, subscription, or operator login is needed in the phone's connection form. |
| **Direct IoT Hub** | Uses a device connection string containing the Hub, device ID, and that device's key. | Skips DPS registration, polling, and assignment. Telemetry, properties, commands, and configured uploads still use the same Hub client. This connection alone does not establish an ADR enrollment/inventory result. |

Direct Hub is implemented, but it is a separate acceptance scenario from the
retained DPS simulator evidence. **LEGACY group key** is also implemented for
compatibility and derives a device key locally. Do not use that path for this
beginner workflow: a group key can generate credentials for other devices.
Certificate/X.509 onboarding is not implemented by this SAS-first phone flow.

## 6. Administrator preparation: use an approved existing setup

This section is for the person responsible for Azure, **not every phone user**.
It is a readiness checklist, not permission to create resources, grant IAM roles,
change enrollments, or spend money. Any new setup or change needs its own explicit
ownership, permission, and cost review.

1. Confirm which of the three scenarios above the existing environment supports,
   which phone identity may be used, and whether device traffic is authorized.
2. For DPS, confirm an **enabled individual symmetric-key enrollment**, its
   registration ID and ID scope, the supported device-facing provisioning
   hostname, and the intended allocation. Do not guess preview endpoints.
3. For namespace onboarding, independently check the ADR/DPS/Hub links, managed
   service identities, scoped permissions, and eligible Hub configuration.
   In this repository's namespace flow DPS is linked before Hub; it is not the
   classic DPS linked-Hub configuration. The phone cannot repair these settings.
4. Confirm Hub device SAS authentication is allowed. For direct Hub, supply an
   existing device identity's connection string, not a Hub service-policy string.
5. If image upload is wanted, confirm the Hub's file-upload storage configuration
   already exists and authorize the data being uploaded. Storage has separate
   costs, access policy, and retention.
6. Deliver only the needed device inputs through an approved secure channel.
   Arrange independent read access for the operator who will verify results.

An existing stack can serve multiple individually authorized phones. No ADR
record should be manually created just to make an automatic-onboarding proof
appear successful. Detailed operator context is in the
[ADR simulator guide](ADR-SIMULATOR.md#prepare-azure-once-then-enroll-each-phone);
its experimental preparation history is not a production permissions recipe.

## 7. Phone-user steps: connect to an existing setup

### Before you start

Have an approved native app build, network access, and your administrator's
inputs. Keep the app in the foreground for initial checks. Connecting initializes
enabled sensor sources; available readings can be sent without a separate
"send all telemetry" button. Review permissions and your destination first.
If you do not have these inputs, ask the authorized administrator first:
installing PAAD does not automatically create or configure Azure services.

For normal DPS onboarding, the form means exactly this:

| Field or displayed value | Meaning and what to enter |
| --- | --- |
| **Registration ID** | The enrollment's bootstrap identifier. Enter the administrator's value exactly; the supported DPS format uses lowercase letters, numbers, dots, underscores, or hyphens, with an alphanumeric beginning/end. |
| **ID scope** | Identifies the DPS instance, not an Azure subscription ID, tenant ID, or Hub name. Use the supplied alphanumeric value. |
| **Device key** | The individual enrollment's symmetric secret, in its supplied Base64 form. It is not your Azure password, an already-generated SAS token, a group key, or a service/owner key. |
| **Provisioning hostname** | The supported device endpoint, with no `https://`, port, or path. The default is `global.azure-devices-provisioning.net`; change it only to the supported endpoint supplied for your environment. |
| **Model** (shown after connection) | The app's public capability identifier: `dtmi:azureiot:PhoneAsADevice;2`. It is not a secret, unique phone ID, subscription, or app version. The manual/modern QR flows supply it automatically. |
| **Assigned device / Assigned Hub** (shown after connection) | DPS's returned identity and destination, not extra DPS form fields to invent. Direct-Hub mode instead obtains them from the connection string. |

### A. Connect using individual-key DPS

1. Open PAAD. On Registration select **Connect manually**. To return there later,
   use the top **Settings** button, then **Registration**.
2. Keep **DPS individual enrollment**, the default connection method. If another
   method is selected, use **Change connection method**.
3. Enter **Registration ID**, **ID scope**, **Device key**, and **Provisioning
   hostname** from the administrator. Do not substitute similarly named Azure
   resource identifiers. Keep the key masked unless you deliberately need to
   check it.
4. Press **Connect**. The app checks the input, requests an assignment, and then
   connects to the assigned Hub. **Cancel** stops the attempt. An error leaves
   the form available for correction; it does not authorize trying other keys.
5. On success, Home appears with the connection status. If iOS presents **Save
   Password?**, choose **Not Now** before opening Details; PAAD uses its own
   secure local storage, not that password-manager prompt.
6. Open **Connection details** in the status row (called **Details** in some
   descriptions/accessibility labels). Compare **Assigned device**, **Assigned
   Hub**, **Registration ID**, and **Model** with the expected values. A fabricated
   example is registration `example-phone-registration` returning device
   `example-phone-assigned`: those are different roles, not an error.
7. Leave **Registry status: Not checked** alone. It is an honest evidence limit,
   not a failed connection. Continue with the tools and independent verification
   below rather than searching for a missing ADR login button.

### B. If the administrator supplied a direct-Hub device connection string

Choose **Change connection method > IoT Hub device connection string**, enter
that string, and press **Connect**. Its shape is:

```text
HostName=example-hub.azure-devices.net;DeviceId=example-phone;SharedAccessKey=<individual-device-key>
```

This is a fabricated, deliberately unusable example. The supported string has
`HostName`, `DeviceId`, and `SharedAccessKey`, not `SharedAccessKeyName` or an
administrator policy. DPS is skipped; no Registration ID or ID scope is needed.
If already connected, Registration shows read-only information; **New device**
starts replacement onboarding. Do not replace another user's saved identity.

### C. If the administrator supplied a credential QR code

Select **Scan QR code**, allow camera access if appropriate, and scan the
administrator-provided code. The versioned `paad.connection` format supports
individual DPS and direct Hub; supported legacy formats remain compatible.
The [QR format reference](ADR-SIMULATOR.md#versioned-qr-input) is for whoever
prepares the code, not a requirement to program your own.

A QR code is a credential container, not a harmless picture. Generate real
credential codes offline; never upload them to public QR-generator sites.
On a failed scan use explicit **Retry**, or **Connect manually**. A simulator,
missing camera, denied permission, or busy camera may prevent scanning without
preventing manual onboarding.

### Keep secrets and local state safe

Never paste keys, connection strings, SAS tokens, or credential QR images into
chat, this document, source control, tickets, screenshots, or diagnostics.
Avoid clipboard history/sync and clear the clipboard after transferring a key.
Use **Share nonsecret diagnostics** only with an appropriate recipient: redacted
does not mean resource/device identifiers are public.

**Disconnect** stops the session but keeps saved credentials. **Reconnect**
uses them again. An ordinary cold launch attempts restoration once, not an
infinite retry loop. **Forget credentials** is a separate confirmed action:
it removes saved credentials and their Azure context from this phone, not an
Azure enrollment, Hub device, registry record, or previously uploaded data.
It is not server-side key revocation.

## 8. What happens on the network, step by step?

1. **Validate locally.** Manual and QR inputs share a decoder. Hosts are restricted
   to supported Azure endpoints; arbitrary servers, redirects, and service-key
   connection strings are not accepted.
2. **Create DPS authorization locally.** The phone signs an expiring SAS token
   using the individual device key. Azure can check this signature without the
   app sending the raw key as the registration payload. TLS encrypts transport.
   This authenticates a device, not an Azure administrator.
3. **Register using HTTPS, not MQTT.** PAAD's `dps.ts` sends an HTTPS `PUT` to
   `https://<provisioning-host>/<scope>/registrations/<registration-id>/register`
   with API version `2019-03-31`. The body includes the registration ID and the
   phone model in `modelId` and compatibility field `iotcModelId`.
4. **Wait for DPS's answer.** When DPS returns an assigning operation, the app
   polls its `/operations/<operation-id>` endpoint with HTTPS `GET`, respecting
   retry guidance and a bounded deadline. An assigned response supplies
   `assignedHub` and `deviceId`; the app retains the original registration ID
   separately. Provisioning failure is not a Hub connection.
5. **Connect directly to Hub.** The app signs device-scoped authorization for the
   returned Hub/device identity, using the device key, and opens **MQTT over
   secure WebSockets (WSS/TLS, port 443)**. The Hub username carries the model
   ID and device API version `2021-04-12`. Native code refuses redirects and
   retains system certificate/hostname validation.
6. **Subscribe and exchange device messages.** The transport subscribes for twin
   responses, desired-property changes, and direct methods. After connection,
   the app persists credentials through secure storage before adopting the new
   connected client. The shared runtime then requests the twin, reports
   available device properties, and sends enabled sensors' telemetry.

Direct-Hub onboarding skips steps 2-4: it uses the Hub/device/key from the
connection string for step 5. ADR-linked DPS uses these same phone-side steps,
not a separate ADR protocol. Provisioning on reconnect can request assignment
again; a saved registration ID is not a cached guarantee of the assigned ID.

SAS tokens currently last **one hour**. The device clock therefore matters.
**Reconnect** generates fresh authorization; this prototype does not silently
renew indefinitely or run the vendor's unbounded reconnect loop.

## 9. Try the tools, and understand their responses

The model `dtmi:azureiot:PhoneAsADevice;2` describes capabilities, not proof they
are available on your hardware. The shared TypeScript client carries JSON values
(strings, finite numbers, booleans, null, arrays, and objects), rather than
converting every measurement to text. This is not a full cloud-model validator.

| Tool / channel | A beginner's next step | Actual behavior and limit |
| --- | --- | --- |
| **Home > Connection** | Tap Phone, DPS, IoT Hub, or ADR. | Explains provided setup, assignment, and service relationships. It is not a live audit of Azure links or permissions. |
| **Explore > Telemetry** | Inspect readings, source controls, and charts; enable/disable a source deliberately. | Battery, accelerometer, gyroscope, magnetometer, barometer, and geolocation use available hardware/permissions. Enabled, available, and having a reading are different states. |
| **Settings > Delivery interval** | Choose a suitable interval; default is five seconds. | Changes sensor delivery scheduling. It is not a writable model property or a cloud-delivery guarantee. |
| **Explore > Properties > Device property** | Enter harmless sample text, then **Submit value**. | Sends `device_info.readOnlyProp`: editable on the phone, read-only from the cloud's point of view. Unsaved drafts are local only. |
| **Explore > Properties > Cloud property** | Ask the authorized application operator to change the desired value; observe it here. | Displays `device_info.writeableProp`. The phone receives desired values from a fetched twin or a later patch and submits an application acknowledgement. |
| **Commands from the cloud** | Coordinate a permitted test with the operator; inspect Activity afterward. | `lightOn` pulses an available permitted torch; `sensors*enableSensors` requests enable/disable; `sensors*changeInterval` requests a supported interval. Invalid/unavailable commands are rejected. |
| **Explore > Image upload** | Only select a non-sensitive image you are authorized to upload. | Selection starts upload immediately, without a separate review step. Camera capture requires permission; the system library picker grants access to the selected image. |
| **Explore > Bluetooth** | Allow appropriate OS access, enable Bluetooth, and inspect a supported nearby advertiser. | Advertisement decoding, not general BLE connection/GATT read/write. Generic devices provide signal strength; supported decoders can provide additional measurements. |

Phone sensor telemetry uses the `sensors` component (`$.sub` message metadata).
Reported phone properties use `device_info` with `__t: "c"` to identify a
Plug and Play component. Desired acknowledgements include the value, status
`ac: 200`, desired version `av`, and a description `ad`; these describe the
phone's acknowledgement submission, not independent confirmation Azure saved it.
Command responses use the originating request ID and success/error status.
An enable/interval command can be **requested** without proving fresh sensor data;
torch handler completion and command-reply submission are also separate facts.

### Image bytes take a different route

The app selects JPEG data and limits upload content to 20 MiB. It asks Hub over
HTTPS for a file-upload destination, sends the bytes by HTTPS `PUT` directly to
the returned Azure Blob Storage location using its limited SAS authorization,
then notifies Hub of the result over HTTPS. The bytes are **not** an MQTT
telemetry message and do not pass through ADR. Success requires both the storage
upload and Hub notification to succeed. It does not prove downstream processing.

## 10. "Submitted locally" is not "verified in Azure"

The Hub wrapper publishes outbound MQTT messages with **QoS 0**. In plain
English, it does not wait for a broker acknowledgement of those publications.
Telemetry, reported properties, twin requests, command replies, and desired
acknowledgements can therefore report **submitted** without proving cloud receipt.
This is not an exactly-once or guaranteed-delivery system.

**Activity** offers observations, **All / Issues**, expandable details, and
**Latest**. **Activity > Diagnostics** shows the separate safe logs. Observations
are bounded and in memory (up to 120 history rows and 64 KiB including latest
facts); successful periodic telemetry keeps its latest fact rather than every
sample. Repeated failures are coalesced. Disconnect, failed/lost connection,
reconnect, and identity changes invalidate old session facts.

Incoming commands/desired values show what the app received. Initial twin values
are distinguished from new desired patches. Command execution and reply submission
are separate. An upload's **acknowledged** outcome reflects the completed HTTP
operation, not an MQTT acknowledgement. Payloads, coordinates, image bytes, keys,
and proof nonce values are not retained in the observation records.

### A guided independent proof

1. With the operator's approval, open **Connection details > Device activity
   proof** while really connected, not in offline simulation.
2. Use a **fresh nonce** for this attempt: a new marker agreed with the operator,
   not a reused value from an old run. The input accepts 16-128 letters, numbers,
   underscores, or hyphens. The app proposes a marker; it is not a login secret
   or a cryptographic attestation of the phone.
3. Tap **Submit proof activity**. The client submits telemetry containing
   `paadProofNonce`/`paadProofPlatform` and a reported property shaped like
   `{"paadProof":{"nonce":"<fresh-marker>","platform":"android"}}`.
   The platform is the actual app platform, not a value to copy blindly.
4. **Submitted locally** means both submissions returned locally. It is neither
   a cloud ACK nor a registry confirmation. An incomplete attempt can leave
   partial activity; coordinate a new marker for a retry.
5. The authorized operator independently reads the DPS assignment, Hub twin
   identity/model and exact fresh `paadProof` marker, and, for namespace onboarding,
   the ADR record whose external device ID matches the actual assigned ID.

The existing [operator verifier](../scripts/ci/verify-mobile-proof.js) performs
bounded reads using an existing authorized Azure CLI/Entra session, requests no
keys, and performs no cloud writes. Its combined workflow expects DPS and ADR;
it is not a generic direct-Hub/classic-only verifier. For those scenarios the
operator checks the applicable assignment/Hub facts separately.

Seeing the marker in the Hub twin proves that reported marker reached that
cloud record. It does **not** independently verify receipt of the telemetry
message by a downstream consumer, continued online status, or physical sensors.
Proving a *new automatic ADR record* additionally needs authorized before/after
inventory evidence; reusing an existing matching record proves no new creation.
See [independent Azure confirmation](ADR-SIMULATOR.md#local-activity-versus-independent-azure-confirmation).

## 11. Optional Azure environment context: useful, but historical

You can connect without importing anything here. PAAD does not sign in to Entra
or call ADR, ARM, or operator APIs with the device key. An operator can use the
existing [context exporter](../scripts/ci/export-azure-context.js) to read approved
resource information separately.

If given such an export, open **Connection details > Azure environment >
Import snapshot**, paste its JSON or Base64 text, and select **Import snapshot**.
The app validates its shape and identity binding; it displays a snapshot only
for the matching assigned device/Hub, not offline simulation. Never paste a key,
connection string, or access token into this field.

The saved snapshot can show subscription, resource group, namespace, region,
Hub/DPS resources, a historical registry record, and management activity.
It is **operator-provided context**, not a live lookup or authenticated operator
assertion. Namespace activity is management history, not phone telemetry history.
Even with an imported record, current **Registry status remains Not checked**.
Refresh by importing a new approved export; **Remove snapshot** only removes the
local copy. Portal links open Azure Portal separately and grant no permissions.

## 12. Troubleshooting without guessing or exposing secrets

| What you see | What to check next |
| --- | --- |
| **Check connection details / INVALID_CREDENTIALS** | Compare field roles, formatting, and connection method with the administrator. Check whitespace and use an individual key, not a token or service-policy string. |
| **Authentication rejected / AUTHENTICATION_FAILED** | Ask the administrator to check the enabled enrollment and matching key/scope/registration. Also check device time. Do not request a broader administrator key. |
| **Provisioning did not complete / PROVISIONING_FAILED** | Ask the operator to inspect assignment/allocation and, if applicable, namespace service links and permissions. A service code alone does not identify the missing role. |
| **Endpoint not approved / UNSAFE_ENDPOINT** | Use the approved supported hostname without scheme/path/port. Do not bypass TLS checks or replace the endpoint with an arbitrary proxy. |
| **Network request failed / TIMEOUT / Could not connect** | Check connectivity and whether the network permits HTTPS and secure WebSockets to the approved services. Recheck the supplied endpoint, then retry explicitly. |
| **Connection interrupted / CONNECTION_LOST** | The established session dropped. Open Connection details and **Reconnect**. Network loss, suspension, and expiring authorization are possibilities, not a diagnosis of a wrong key. |
| **Settings were not saved / STORAGE_FAILED** | The app could not persist securely. Check the supported native build/storage setup; do not assume the new connection was saved or erase existing data as a first step. |
| **Secure transport required / SECURE_TRANSPORT_REQUIRED** | Use a correctly rebuilt native app with PAAD's secure transport, not Expo Go or an incomplete native build. |
| **Sensor unavailable / no reading** | Check the source's enabled state, real hardware, and OS permissions. Use the available retry/source controls. Missing hardware is not necessarily a cloud problem. |
| QR scan fails | Check camera permission/availability, close other camera use, then **Retry** or **Connect manually**. Never share a credential image for troubleshooting. |
| Image upload fails while telemetry works | Ask the operator about existing Hub file-upload/storage configuration; check image size, authorization, and network access. Do not upload sensitive content just to test. |
| Bluetooth is empty/unavailable | Check supported hardware, nearby advertisements, and OS Bluetooth/Nearby Devices permissions; older Android scanning may require location permission. Virtual devices do not establish real BLE acceptance. |
| Map preview is not configured | The Android build needs map configuration. This is separate from location permission and coordinate telemetry. |
| ADR says **Not checked**, or snapshot is absent/mismatched | Expected evidence boundary or a stale/wrong-device export. It does not by itself invalidate a working Hub connection. Ask for independent reads or a matching export. |
| Offline simulation label is shown | There is no live cloud proof. **Settings > Simulation Mode** exists in development-mode builds, not necessarily every bundled build; do not confuse it with running on an emulator. |

Connection details exposes sanitized error codes and available HTTP/numeric DPS
service codes; raw service response bodies are not shown. Do not infer cloud
delivery from the absence of an error. Hardware access is permission-dependent,
and keeping the app connected while backgrounded or locked is not guaranteed.

## 13. A final beginner checklist

- [ ] I have an approved native build and permission to use this device identity.
- [ ] I know whether my setup is classic DPS, namespace-linked DPS, or direct Hub.
- [ ] I entered only this device's secret, never a group/service/owner key.
- [ ] I compared the actual assigned identity and public phone model in Details.
- [ ] I understand that sensors can begin sending when connected and permitted.
- [ ] I can distinguish a local reading, local submission, and independent cloud evidence.
- [ ] If ADR matters, an authorized operator checked it independently.
- [ ] I know Disconnect, Forget credentials, and Azure deletion are different actions.

## 14. Where to read more

### This repository

- [Build and run](../README.md#build-and-run); [native configuration](../app.config.js);
  [GitHub foundation workflow](../.github/workflows/baseline.yml).
- [UI entry point](../src/App.tsx), [shared destinations](../src/Home.tsx),
  [device runtime](../src/runtime/DeviceRuntime.tsx), and
  [property drafts](../src/runtime/propertyDrafts.tsx).
- [Connection lifecycle](../src/hooks/iotc.ts), [secure storage](../src/contexts/storage.tsx),
  [credentials](../src/connection/credentials.ts), [DPS HTTPS flow](../src/connection/dps.ts),
  [Hub transport](../src/connection/legacyHub.ts), and [upload flow](../src/connection/upload.ts).
- [Native module](../modules/paad-device/README.md) and
  [device-side observation contract](../src/observation/README.md).
- [Current features](Features.md) and [Bluetooth design](Bluetooth.md).
  Some historical screenshots/navigation and IoT Central setup instructions
  in those documents describe older flows; use this guide's current UI paths.
- [ADR simulator/operator guide](ADR-SIMULATOR.md),
  [integration and acceptance ledger](plans/ADR-NAMESPACE-INTEGRATION.md),
  and [modernization plan](plans/MODERNIZATION.md).

### Official background documentation

- [Azure DPS symmetric-key attestation](https://learn.microsoft.com/en-us/azure/iot-dps/concepts-symmetric-key-attestation).
- [IoT Hub protocols and ports](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-protocols).
- [IoT Hub file upload](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-file-upload).
- [Expo development builds and Expo Go](https://docs.expo.dev/develop/development-builds/introduction/).

Official documentation describes service/framework capabilities broadly. The
repository source and acceptance ledger determine what this particular PAAD app
implements and what has actually been verified.
