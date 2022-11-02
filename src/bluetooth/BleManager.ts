import {BleError, BleManager as NativeBle, BleManagerOptions, Device, ScanOptions, UUID} from 'react-native-ble-plx';

type ScanCallback = (error: BleError | null, scannedDevice: Device | null) => void;

export class BleManager extends NativeBle {
    protected constructor(options?: BleManagerOptions) {
        super(options);
    }

    private static instance: BleManager;
    public static getInstance(): BleManager {
        if (!BleManager.instance) {
            BleManager.instance = new BleManager();
        }
        return BleManager.instance;
    }

    private scannedDevices: Device[] = [];
    private deviceIds: Set<UUID> = new Set();

    private scanCallback: ScanCallback = () => {};

    // public async startDeviceScan(UUIDs: string[] | null, options: ScanOptions | null, listener: ScanCallback): void {
    //     this.scanCallback = listener;


    // }
    public setScanCallback(callback: ScanCallback): void {
        this.scanCallback = callback;
    }
}