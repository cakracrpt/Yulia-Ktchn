import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import { Store, Save } from "lucide-react";

const Field = ({ label, children }) => (
  <div><label className="text-sm font-medium mb-1.5 block">{label}</label>{children}</div>
);

export default function Pengaturan() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get("/settings")).data });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return <div className="p-6 text-muted-foreground">Memuat...</div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", form);
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Pengaturan tersimpan");
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold font-display mb-1">Pengaturan</h1>
      <p className="text-muted-foreground mb-4">Atur informasi toko dan struk.</p>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold font-display flex items-center gap-2"><Store size={18} className="text-accent" /> Informasi Toko</h3>
          <Field label="Nama Toko"><Input value={form.shop_name} onChange={(e) => set("shop_name", e.target.value)} data-testid="setting-shop-name" className="h-11 rounded-xl bg-white" /></Field>
          <Field label="Alamat"><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} data-testid="setting-address" className="rounded-xl bg-white" rows={2} /></Field>
          <Field label="No. Telepon"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="setting-phone" className="h-11 rounded-xl bg-white" /></Field>
          <ImageUpload value={form.logo_url} onChange={(v) => set("logo_url", v)} label="Logo Toko" testid="logo-upload" />
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold font-display">Struk & Pembayaran</h3>
          <Field label="Footer Struk"><Input value={form.receipt_footer} onChange={(e) => set("receipt_footer", e.target.value)} data-testid="setting-footer" className="h-11 rounded-xl bg-white" /></Field>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Ukuran Printer</label>
            <div className="flex gap-2">
              {["58mm", "80mm"].map((s) => (
                <button key={s} onClick={() => set("printer_size", s)} data-testid={`printer-${s}`}
                  className={`h-11 px-6 rounded-xl font-medium border tap ${form.printer_size === s ? "bg-accent text-accent-foreground border-accent" : "bg-white border-border"}`}>{s}</button>
              ))}
            </div>
          </div>
          <ImageUpload value={form.qris_url} onChange={(v) => set("qris_url", v)} label="Gambar QRIS" testid="qris-upload" />
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold font-display">Pajak & Layanan</h3>
          <div className="flex items-center justify-between">
            <div><p className="font-medium">Aktifkan Pajak (PPN)</p><p className="text-xs text-muted-foreground">Tambahkan pajak pada setiap transaksi</p></div>
            <Switch checked={form.tax_enabled} onCheckedChange={(v) => set("tax_enabled", v)} data-testid="tax-toggle" />
          </div>
          {form.tax_enabled && (
            <Field label="Persentase Pajak (%)"><Input type="number" value={form.tax_percent} onChange={(e) => set("tax_percent", Number(e.target.value))} data-testid="tax-percent" className="h-11 rounded-xl bg-white w-32" /></Field>
          )}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div><p className="font-medium">Aktifkan Biaya Layanan</p><p className="text-xs text-muted-foreground">Service charge per transaksi</p></div>
            <Switch checked={form.service_enabled} onCheckedChange={(v) => set("service_enabled", v)} data-testid="service-toggle" />
          </div>
          {form.service_enabled && (
            <Field label="Persentase Layanan (%)"><Input type="number" value={form.service_percent} onChange={(e) => set("service_percent", Number(e.target.value))} data-testid="service-percent" className="h-11 rounded-xl bg-white w-32" /></Field>
          )}
        </div>

        <Button onClick={save} disabled={saving} data-testid="save-settings"
          className="h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 gap-2 tap">
          <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
