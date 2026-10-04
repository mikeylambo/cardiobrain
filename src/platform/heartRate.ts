// Heart-rate straps over Bluetooth: the standard Heart Rate service (0x180D), which
// every chest strap and most watches in broadcast mode speak. Web Bluetooth in Chrome and
// Edge (Android and desktop; not iOS Safari), the Capacitor BLE plugin in the native apps.
// The parser and zone maths are unit-tested; the radio paths need a real strap.
import { isNative } from "./native";

const HR_SERVICE = 0x180d;
const HR_MEASUREMENT = 0x2a37;

/** Parse a Heart Rate Measurement characteristic value (Bluetooth spec, GATT 0x2A37). */
export function parseHeartRate(view: DataView): number {
  const flags = view.getUint8(0);
  return flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
}

export type Zone = 1 | 2 | 3 | 4 | 5;

/** Five zones by share of max heart rate: under 60%, 60-70, 70-80, 80-90, 90 and up. */
export function zoneFor(bpm: number, maxHr: number): Zone {
  const p = bpm / maxHr;
  return p < 0.6 ? 1 : p < 0.7 ? 2 : p < 0.8 ? 3 : p < 0.9 ? 4 : 5;
}

/**
 * How much extra time to give answers in each zone. The harder you're working, the
 * longer the window, so a hill climb doesn't read as a cognitive slump.
 */
export const ZONE_TIME_FACTOR: Record<Zone, number> = { 1: 1, 2: 1, 3: 1.1, 4: 1.25, 5: 1.4 };

export const ZONE_LABEL: Record<Zone, string> = { 1: "Easy", 2: "Steady", 3: "Moderate", 4: "Hard", 5: "Max" };

export const isHeartRateSupported = () => isNative || (typeof navigator !== "undefined" && "bluetooth" in navigator);

export interface HeartRateConnection {
  name: string;
  disconnect: () => void;
}

type BluetoothNavigator = Navigator & {
  bluetooth: {
    requestDevice: (o: { filters: Array<{ services: number[] }> }) => Promise<{
      name?: string;
      gatt?: {
        connect: () => Promise<{
          getPrimaryService: (s: number) => Promise<{
            getCharacteristic: (c: number) => Promise<EventTarget & { value?: DataView; startNotifications: () => Promise<unknown> }>;
          }>;
          disconnect: () => void;
        }>;
      };
      addEventListener: (t: string, f: () => void) => void;
    }>;
  };
};

/** Ask the user to pick a strap, then stream bpm to onBpm until disconnected. */
export async function connectHeartRate(onBpm: (bpm: number) => void, onGone: () => void): Promise<HeartRateConnection> {
  if (isNative) {
    const { BleClient, numberToUUID } = await import("@capacitor-community/bluetooth-le");
    await BleClient.initialize({ androidNeverForLocation: true });
    const device = await BleClient.requestDevice({ services: [numberToUUID(HR_SERVICE)] });
    await BleClient.connect(device.deviceId, () => onGone());
    await BleClient.startNotifications(device.deviceId, numberToUUID(HR_SERVICE), numberToUUID(HR_MEASUREMENT), (value) => onBpm(parseHeartRate(value)));
    return { name: device.name ?? "Heart-rate strap", disconnect: () => void BleClient.disconnect(device.deviceId).catch(() => undefined) };
  }
  const bt = (navigator as BluetoothNavigator).bluetooth;
  const device = await bt.requestDevice({ filters: [{ services: [HR_SERVICE] }] });
  if (!device.gatt) throw new Error("This device has no heart-rate service.");
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(HR_SERVICE);
  const ch = await service.getCharacteristic(HR_MEASUREMENT);
  ch.addEventListener("characteristicvaluechanged", () => {
    if (ch.value) onBpm(parseHeartRate(ch.value));
  });
  device.addEventListener("gattserverdisconnected", onGone);
  await ch.startNotifications();
  return { name: device.name ?? "Heart-rate strap", disconnect: () => server.disconnect() };
}
