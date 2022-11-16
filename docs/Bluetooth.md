# Bluetooth Gateway

## What is this?

The Bluetooth feature of the Azure IoT PaaD application allows you to read data from Bluetooth Low Energy
(BLE) devices around your phone and send it as telemetry to your Azure IoT Central application or an Azure IoT Hub.

## How it works

1. Once connected to Azure IoT, select the Bluetooth tab from the bottom tab bar.
1. The app will start scanning for BLE devices nearby. Once they are found, they will show in the list.
1. Tapping on a device will bring you to a detail view where you can see the data read from the device.
Every time this data updates, it will be sent as a telemetry message.
    - For most devices, the only data read will be the RSSI (signal strength). See below to learn how to read specific data from your own BLE sensor.

## Implementing devices

    Note: Currently, the PaaD application supports reading data from BLE advertisements only. It does not support the BLE connection mechanism, nor reading/writing data to/from characteristics or services.

### Implementation structure

- All relevant code can be found in [`src/bluetooth`](../src/bluetooth/)
- [`BleDevice.ts`](../src/bluetooth/devices/BleDevice.ts) contains the interface that must be implemented in order to read specific data from a given device's BLE advertisement. Refer to the inline documentation for the purpose of each method.
  - [`Govee5074.ts`](../src/bluetooth/devices/Govee5074.ts) contains an example implementation of the [Govee H5074 sensor](https://www.amazon.com/Govee-Hygrometer-Thermometer-Bluetooth-Notification/dp/B09BHSLWBL)
  - [`GenericDevice.ts`](../src/bluetooth/devices/GenericDevice.ts) is a generic device implementation that reads the device's signal strength only.
- Once your device model is implemented, it needs to be added to the `DeviceModels` set in [`BleManger.ts`](../src/bluetooth/BleManager.ts).
