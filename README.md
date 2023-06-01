# Azure IoT Central PaaD
A Phone-as-a-Device solution to easily connect with Azure IoT Central by using a smartphone or tablet as an IoT device.

**Android**

develop: [![Build status](https://build.appcenter.ms/v0.1/apps/82ba91a2-c68c-4b4b-949e-2b0c581eb0af/branches/develop/badge)](https://appcenter.ms)


## What is this?
An useful tool to start playing with Azure IoT Central without using a real IoT device. The smartphone or tablet can send telemetry data from its embedded sensors (accelerometer, gyroscope...) and Bluetooth-LowEnergy (BLE) devices. It can also receive properties and commands to demonstrate basic functionalities.

## Features

The main features of the app are:

- Telemetry data from real embedded sensors and health platform records.
- Sample properties (readonly and writeable).
- Commands handling to enable/disable telemetry items and set their sending interval.
- Commands logs to trace data in app.
- Bluetooth Gateway (see [Bluetooth.md](./docs/Bluetooth.md) for documentation/implementation details)

You can read more about all features with instructions [here](./docs/Features.md).

## Build and Run

The application is available for both Android and iOS.
It can be run on simulator as well (Android Studio or Xcode required). In this case, sensor data is randomly generated.

### Setup
```shell
git clone https://github.com/Azure/iot-central-paad
cd iot-central-paad
npm install
```

#### iOS
Install pods
```shell
cd ios && pod install
```

### Build source code
Source code can be validated and formatted to ensure js bundle gets correctly generated. However this does not guarantee the application can run as expected on each platform due to the various native modules. Always run the application on simulators to check functionalities.

#### Format, Lint and Typescript compile:
```shell
npm run build
```

#### Run Android
```shell
# runs on default simulator (as configured in Android Studio)
npm run android

```

#### Run iOS
```shell
# runs on default simulator (as configured in XCode)
npm run ios

# runs on specific device
npm run ios --device <device-id>
```