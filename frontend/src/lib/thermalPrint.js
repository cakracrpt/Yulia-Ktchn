// Best-effort ESC/POS Bluetooth thermal printing via Web Bluetooth API.
// Works on Chrome (desktop/Android) over HTTPS with a compatible BLE printer.
// Falls back gracefully; caller should offer window.print() as alternative.

const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

async function findWritable(server, service) {
  const chars = await service.getCharacteristics();
  return chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
}

export async function printReceiptBluetooth(text) {
  if (!isBluetoothSupported()) {
    throw new Error("Browser tidak mendukung Bluetooth. Gunakan Chrome di Android/desktop.");
  }
  const device = await navigator.bluetooth.requestDevice({
    filters: PRINTER_SERVICES.map((s) => ({ services: [s] })),
    optionalServices: PRINTER_SERVICES,
  });
  const server = await device.gatt.connect();
  let characteristic = null;
  for (const uuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      characteristic = await findWritable(server, service);
      if (characteristic) break;
    } catch (e) { /* try next */ }
  }
  if (!characteristic) throw new Error("Karakteristik printer tidak ditemukan.");

  const encoder = new TextEncoder();
  const init = new Uint8Array([0x1b, 0x40]); // ESC @
  const cut = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]); // feed + cut
  const body = encoder.encode(text);
  const payload = new Uint8Array(init.length + body.length + cut.length);
  payload.set(init, 0);
  payload.set(body, init.length);
  payload.set(cut, init.length + body.length);

  // Chunk writes (BLE MTU ~ 100-180 bytes)
  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  server.disconnect();
}
