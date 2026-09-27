# Azure IoT Central PaaD
A Phone-as-a-Device solution to easily connect with Azure IoT Central by using a smartphone or tablet as an IoT device.

**Android**

develop: [![Build status](https://build.appcenter.ms/v0.1/apps/82ba91a2-c68c-4b4b-949e-2b0c581eb0af/branches/develop/badge)](https://appcenter.ms)


## What is this?
An useful tool to start playing with Azure IoT Central without using a real IoT device. The smartphone or tablet can send telemetry data from its embedded sensors (accelerometer, gyroscope...) and Bluetooth-LowEnergy (BLE) devices. It can also receive properties and commands to demonstrate basic functionalities.

## Beginner guide and diagrams

No app-development or Azure background is needed for these explanations:

- [PAAD architecture and Azure guide](docs/PAAD-ARCHITECTURE-AND-AZURE-GUIDE.md): frameworks, dependencies, connection steps and troubleshooting.
- [App architecture diagram](docs/diagrams/paad-app-architecture.html): from source code and native builds to the shared runtime.
- [Phone-to-Azure diagram](docs/diagrams/paad-phone-to-azure.html): device inputs, DPS assignment, Hub messages and ADR's separate role.

Open the HTML files in a browser for the visual walkthroughs. They work offline
and illustrate the design, not live device data or acceptance results.

## Features

The main features of the app are:

- Telemetry from six phone sensors, with explicitly labelled offline simulation.
- Sample properties (readonly and writeable).
- Commands handling to enable/disable telemetry items and set their sending interval.
- Commands logs to trace data in app.
- Bluetooth Gateway (see [Bluetooth.md](./docs/Bluetooth.md) for documentation/implementation details)
- Individual-key DPS onboarding, including operator-configured ADR namespace links.
- Assigned device/Hub details, safe diagnostics, and local proof-marker submission.
- Native Home / Explore / Activity navigation, with an explanatory connection
  map, discoverable tools and session-scoped device-side observations.

You can read more about all features with instructions [here](./docs/Features.md).
For the new onboarding flow, Windows emulator installation and independent Azure
confirmation, use the [ADR simulator guide](docs/ADR-SIMULATOR.md).

## Build and Run

### CI-first modernization

The [modernization plan](docs/plans/MODERNIZATION.md) records the migration from
the preserved RN 0.75 baseline to **Expo 57.0.25 / React Native 0.86.3 /
React 19.2.3**, using the New Architecture and development builds, not Expo Go.
Minimum operating systems are iOS 16.4 and Android 7/API 24. The current modern
native build results, not the historical baseline run, determine compatibility.

The `FOUNDATION - Expo 57 bundled native startup` GitHub Actions workflow runs on foundation
branch pushes and relevant pull requests. It performs Linux lint/startup checks,
then independently builds an Android APK and an iOS Simulator app and
drives credential-free navigation with Maestro. Neither app depends on Metro.
No local Mac, EAS account, Apple Developer signing identity, or Azure credentials
are needed. Xcode embeds CI-only Keychain entitlements in the Simulator executable
and applies a local ad-hoc signature. Simulator entitlements are separate from
the host macOS signature; no Apple certificate or provisioning profile is used.
The internal Azure pipeline dispatcher is manual-only.

CI application IDs are `com.iot_pnp.ci` and `com.microsoft.iotpnp.ci`; production
IDs and signing settings remain separate. Jobs are capped at 45 minutes, with
nonsecret build/log/screenshot artifacts retained for three days. Inspect the
exact run outcome and commit before treating a platform as supported. A build
or screenshot alone does not prove onboarding, cloud delivery, or hardware parity.
Live Azure scenarios are separate, explicitly authorized runs. Camera, BLE, real sensors,
secure hardware and physical-phone suspension still require device acceptance.

The `LIVE - Dedicated device-only proof` workflow requires a manually authorized
owner/topic/SHA combination and dedicated individual device-key secrets. Its
push-only entrypoint-registration job performs no device traffic. Live jobs run
the existing checks, build and publish credential-free binaries before receiving
device inputs, then retain only allowlisted live summaries. A passing UI report
still requires the separate operator-side Hub/ADR confirmation.

### Optional local development

The header uses the bundled Quicksand Bold typeface and an original rounded
phone mark. The font is embedded by `expo-font` during native prebuild, without a
runtime download; changing it requires rebuilding the native app, not only Metro.
Its complete SIL Open Font License is bundled in the public app configuration and
is readable under **Settings → Quicksand font license**.

The application is available for both Android and iOS.
It can run on a simulator as well (Android Studio or Xcode required).
Unavailable hardware is reported as unavailable; generated data requires explicit
simulation mode. The phone connects through an app-owned, bounded Hub/DPS
transport; charts are bundled SVG with bounded history rather than remote scripts.

### Setup

Use Node 24.19.0, JDK 17, Android SDK/Build Tools 36 and NDK 27.1.12297006.
For iOS use Xcode 26.4 or newer; CI pins Xcode 26.6 with iOS 26.5.
On macOS, install Ruby 3.3.8 and Bundler 2.5.23 and run `bundle install`.
`npm ci` never installs CocoaPods implicitly.

```shell
git clone https://github.com/HangyiWang/iot-central-paad
cd iot-central-paad
npm ci
npm run prebuild:ci
```

`app.config.js`, `app.plugin.js` and the pinned template own native generation.
Commit native/config changes together; do not make hand-edits that disappear on
prebuild. The local `modules/paad-device` Expo module supplies redirect-rejecting
TLS WebSockets and real torch capability queries.

#### iOS
Install pods
```shell
npm run podinstall
```

CI generates isolated native projects, installs Ruby dependencies, then runs
`bundle exec pod install --deployment` using the reviewed lock. Prebuild preserves
that lock while replacing generated project metadata.

If dependency changes require a new CocoaPods lock, explicitly dispatch the
foundation workflow with `platform=ios` and `refresh_pod_lock=true`. Review the
generated `Podfile.lock` artifact and commit it before accepting ordinary
deployment-mode runs. CI never silently retries a frozen-lock failure with
unlocked dependency resolution.

### Build source code
Source code can be validated and formatted to ensure js bundle gets correctly generated. However this does not guarantee the application can run as expected on each platform due to the various native modules. Always run the application on simulators to check functionalities.

#### Format, Lint and Typescript compile:
```shell
npm run build
```

#### Run Android
```shell
# runs on default simulator (as configured in Android Studio)
PAAD_VARIANT=ci npm run android

```

#### Run iOS
```shell
# runs on default simulator (as configured in XCode)
PAAD_VARIANT=ci npm run ios

# runs on specific device
PAAD_VARIANT=ci npm run ios -- --device <simulator-id>
```

Use `npm start` for Metro development. CI artifacts contain bundled JavaScript
and can launch without Metro. Production distribution and physical-device signing
remain owner-controlled, separate from these isolated development identities.