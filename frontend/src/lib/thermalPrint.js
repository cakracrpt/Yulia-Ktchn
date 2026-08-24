// Best-effort ESC/POS Bluetooth thermal printing via Web Bluetooth API.
// Works on Chrome (desktop/Android) over HTTPS with a compatible BLE printer,
// and only when the page is NOT embedded in a cross-origin iframe.

const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

export function isInIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// Returns a Bahasa Indonesia reason string when Bluetooth cannot be used, else null.
export function bluetoothBlockedReason() {
  if (!isBluetoothSupported()) {
    return "Browser tidak mendukung Bluetooth. Gunakan Google Chrome di Android atau desktop.";
  }
  if (isInIframe()) {
    return "Cetak Bluetooth diblokir saat aplikasi dibuka di dalam pratinjau. Buka aplikasi di tab browser tersendiri (Chrome) atau setelah di-deploy, lalu coba lagi.";
  }
  return null;
}

function friendlyError(e) {
  const msg = (e && (e.message || "")) + "";
  if (/globally disabled|permissions policy|disallowed|SecurityError/i.test(msg) || e?.name === "SecurityError") {
    return "Cetak Bluetooth diblokir oleh browser di lingkungan ini. Buka aplikasi di tab browser tersendiri (Chrome) atau setelah di-deploy untuk mencetak via Bluetooth.";
  }
  if (e?.name === "NotFoundError" || /cancelled|canceled|no devices/i.test(msg)) {
    return "Tidak ada printer yang dipilih atau ditemukan. Pastikan printer Bluetooth menyala dan sudah dipasangkan.";
  }
  if (e?.name === "NotAllowedError") {
    return "Izin Bluetooth ditolak. Aktifkan izin Bluetooth pada browser Anda.";
  }
  return msg || "Gagal mencetak via Bluetooth.";
}

async function findWritable(server, service) {
  const chars = await service.getCharacteristics();
  return chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
}

export async function printReceiptBluetooth(text) {
  const blocked = bluetoothBlockedReason();
  if (blocked) throw new Error(blocked);

  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: PRINTER_SERVICES.map((s) => ({ services: [s] })),
      optionalServices: PRINTER_SERVICES,
    });
  } catch (e) {
    throw new Error(friendlyError(e));
  }

  try {
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
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
