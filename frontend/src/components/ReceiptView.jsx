import React from "react";
import { formatRupiah, formatDateTime } from "@/lib/format";

function optionsLine(item) {
  const parts = [];
  (item.variants || []).forEach((v) => parts.push(v.name));
  if (item.sweetness) parts.push(item.sweetness);
  if (item.ice) parts.push(item.ice);
  (item.addons || []).forEach((a) => parts.push("+" + a.name));
  return parts.join(", ");
}

// Plain text for ESC/POS thermal printing
export function buildReceiptText(txn, settings) {
  const width = settings?.printer_size === "58mm" ? 32 : 42;
  const line = (l, r) => {
    l = String(l); r = String(r);
    const space = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(space) + r;
  };
  const center = (t) => {
    const pad = Math.max(0, Math.floor((width - t.length) / 2));
    return " ".repeat(pad) + t;
  };
  const sep = "-".repeat(width);
  let out = "";
  out += center(settings?.shop_name || "KopiPOS") + "\n";
  if (settings?.address) out += center(settings.address) + "\n";
  if (settings?.phone) out += center(settings.phone) + "\n";
  out += sep + "\n";
  out += line("No", txn.txn_number) + "\n";
  out += line("Tgl", formatDateTime(txn.created_at)) + "\n";
  out += line("Kasir", txn.cashier_name) + "\n";
  out += line("Tipe", txn.order_type === "dine_in" ? "Makan di Tempat" : "Bawa Pulang") + "\n";
  if (txn.customer_name) out += line("Nama", txn.customer_name) + "\n";
  if (txn.table_number) out += line("Meja", txn.table_number) + "\n";
  out += sep + "\n";
  (txn.items || []).forEach((it) => {
    out += `${it.name}\n`;
    const opt = optionsLine(it);
    if (opt) out += `  ${opt}\n`;
    if (it.note) out += `  Catatan: ${it.note}\n`;
    out += line(`  ${it.quantity} x`, formatRupiah(it.line_total / it.quantity)) + "\n";
    out += line("", formatRupiah(it.line_total)) + "\n";
  });
  out += sep + "\n";
  out += line("Subtotal", formatRupiah(txn.subtotal)) + "\n";
  if (txn.tax_amount > 0) out += line("Pajak", formatRupiah(txn.tax_amount)) + "\n";
  if (txn.service_amount > 0) out += line("Layanan", formatRupiah(txn.service_amount)) + "\n";
  out += line("TOTAL", formatRupiah(txn.total)) + "\n";
  out += line("Bayar", txn.payment_method === "cash" ? "Tunai" : "QRIS") + "\n";
  if (txn.payment_method === "cash") {
    out += line("Diterima", formatRupiah(txn.cash_received)) + "\n";
    out += line("Kembali", formatRupiah(txn.change)) + "\n";
  }
  out += sep + "\n";
  out += center(settings?.receipt_footer || "Terima kasih!") + "\n\n";
  return out;
}

export default function ReceiptView({ txn, settings }) {
  const width = settings?.printer_size === "58mm" ? "max-w-[220px]" : "max-w-[300px]";
  return (
    <div className={`print-area bg-white mx-auto text-black font-mono text-xs leading-relaxed ${width} p-3`}>
      <div className="text-center">
        {settings?.logo_url && (
          <img src={settings.logo_url.startsWith("http") ? settings.logo_url : `${process.env.REACT_APP_BACKEND_URL}${settings.logo_url}`}
               alt="logo" className="h-10 mx-auto mb-1 object-contain" />
        )}
        <p className="font-bold text-sm">{settings?.shop_name || "KopiPOS"}</p>
        {settings?.address && <p>{settings.address}</p>}
        {settings?.phone && <p>{settings.phone}</p>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="space-y-0.5">
        <div className="flex justify-between"><span>No</span><span>{txn.txn_number}</span></div>
        <div className="flex justify-between"><span>Tgl</span><span>{formatDateTime(txn.created_at)}</span></div>
        <div className="flex justify-between"><span>Kasir</span><span>{txn.cashier_name}</span></div>
        <div className="flex justify-between"><span>Tipe</span><span>{txn.order_type === "dine_in" ? "Makan di Tempat" : "Bawa Pulang"}</span></div>
        {txn.customer_name && <div className="flex justify-between"><span>Nama</span><span>{txn.customer_name}</span></div>}
        {txn.table_number && <div className="flex justify-between"><span>Meja</span><span>{txn.table_number}</span></div>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      {(txn.items || []).map((it, i) => (
        <div key={i} className="mb-1">
          <p className="font-semibold">{it.name}</p>
          {optionsLine(it) && <p className="text-[10px]">{optionsLine(it)}</p>}
          {it.note && <p className="text-[10px] italic">Catatan: {it.note}</p>}
          <div className="flex justify-between">
            <span>{it.quantity} x {formatRupiah(it.line_total / it.quantity)}</span>
            <span>{formatRupiah(it.line_total)}</span>
          </div>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <div className="space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(txn.subtotal)}</span></div>
        {txn.tax_amount > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatRupiah(txn.tax_amount)}</span></div>}
        {txn.service_amount > 0 && <div className="flex justify-between"><span>Layanan</span><span>{formatRupiah(txn.service_amount)}</span></div>}
        <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{formatRupiah(txn.total)}</span></div>
        <div className="flex justify-between"><span>Bayar</span><span>{txn.payment_method === "cash" ? "Tunai" : "QRIS"}</span></div>
        {txn.payment_method === "cash" && <>
          <div className="flex justify-between"><span>Diterima</span><span>{formatRupiah(txn.cash_received)}</span></div>
          <div className="flex justify-between"><span>Kembali</span><span>{formatRupiah(txn.change)}</span></div>
        </>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <p className="text-center">{settings?.receipt_footer || "Terima kasih!"}</p>
    </div>
  );
}
