# Azure IoT Central PaaD
A Phone-as-a-Device solution to easily connect with Azure IoT Central by using a smartphone or tablet as an IoT device.

**Android**

develop: [![Build status](https://build.appcenter.ms/v0.1/apps/82ba91a2-c68c-4b4b-949e-2b0c581eb0af/branches/develop/badge)](https://appcenter.ms)


## What is this?
An useful tool to start playing with Azure IoT Central without using a real IoT device. The smartphone or tablet can send telemetry data from its embedded sensors (accelerometer, gyroscope...) and registered health platforms (Apple Health Kit, Google Fit). It can also receive properties and commands to demonstrate basic functionalities.

## Features

The main features of the app are:

- Telemetry data from real embedded sensors and health platform records.
- Real-time charts.
- Sample properties (readonly and writeable).
- Commands handling to enable/disable telemetry items and set their sending interval.
- Commands logs to trace data in app.
- Bluetooth Gateway (see [Bluetooth.md](./docs/Bluetooth.md) for documentation/implementation details)

## Build and Run

The application is available for both Android and iOS.
It can be run on simulator as well (Android Studio or Xcode required). In this case, sensor data is randomly generated.


### Required tools
See [React Native Getting Started](https://reactnative.dev/docs/getting-started)
and click on React Native CLI Quickstart for more detailed instructions.
"Installing dependencies" is the section that explains
developer setup. If you are developing on Windows for Android you will need:

1. Node.JS (12+)
1. Java SE Development Kit (JDK 8+)
1. Python 3.7+
1. Android Studio
1. React Native command line interface
1. Npm or Yarn

To set up a real device for development, follow the instructions for device setup [here.](https://reactnative.dev/docs/running-on-device)

## Installation
```shell
git clone https://github.com/Azure/iot-central-paad
cd iot-central-paad
npm install

```