import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { fileUrl, apiError } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { CATEGORIES, UNITS, STOCK_STATUS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImageOff, X } from "lucide-react";

const EMPTY = {
  name: "", category: "Makanan", price: 0, cost_price: 0, stock: 0, min_stock: 5,
  unit: "pcs", sku: "", description: "", image_url: "", active: true,
  variant_groups: [], addons: [], has_sweetness: false, has_ice: false,
};

export default function Produk() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get("/products")).data });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing("new"); setForm(EMPTY); };
  const openEdit = (p) => { setEditing(p.id); setForm({ ...EMPTY, ...p }); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // variant groups
  const addGroup = () => set("variant_groups", [...form.variant_groups, { name: "", options: [{ name: "", price_delta: 0 }] }]);
  const updGroup = (i, k, v) => { const g = [...form.variant_groups]; g[i] = { ...g[i], [k]: v }; set("variant_groups", g); };
  const rmGroup = (i) => set("variant_groups", form.variant_groups.filter((_, x) => x !== i));
  const addOpt = (gi) => { const g = [...form.variant_groups]; g[gi].options = [...g[gi].options, { name: "", price_delta: 0 }]; set("variant_groups", g); };
  const updOpt = (gi, oi, k, v) => { const g = [...form.variant_groups]; g[gi].options[oi] = { ...g[gi].options[oi], [k]: k === "price_delta" ? Number(v) : v }; set("variant_groups", g); };
  const rmOpt = (gi, oi) => { const g = [...form.variant_groups]; g[gi].options = g[gi].options.filter((_, x) => x !== oi); set("variant_groups", g); };

  // addons
  const addAddon = () => set("addons", [...form.addons, { name: "", price: 0 }]);
  const updAddon = (i, k, v) => { const a = [...form.addons]; a[i] = { ...a[i], [k]: k === "price" ? Number(v) : v }; set("addons", a); };
  const rmAddon = (i) => set("addons", form.addons.filter((_, x) => x !== i));

  const save = async () => {
    if (!form.name) { toast.error("Nama produk wajib diisi"); return; }
    setSaving(true);
    const payload = {
      ...form, price: Number(form.price), cost_price: Number(form.cost_price),
      stock: Number(form.stock), min_stock: Number(form.min_stock),
      variant_groups: form.variant_groups.filter((g) => g.name).map((g) => ({ ...g, options: g.options.filter((o) => o.name) })),
      addons: form.addons.filter((a) => a.name),
    };
    delete payload.id; delete payload.stock_status; delete payload.created_at;
    try {
      if (editing === "new") await api.post("/products", payload);
      else await api.put(`/products/${editing}`, payload);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk tersimpan");
      setEditing(null);
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/products/${deleteId}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk dihapus");
    } catch (e) { toast.error(apiError(e)); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Produk & Menu</h1>
          <p className="text-muted-foreground">Kelola daftar produk dan menu.</p>
        </div>
        <Button onClick={openNew} data-testid="add-product-btn" className="h-11 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2 tap">
          <Plus size={18} /> <span className="hidden sm:inline">Tambah Produk</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {products.map((p) => {
          const st = STOCK_STATUS[p.stock_status];
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm" data-testid={`product-item-${p.id}`}>
              <div className="flex gap-3 p-3">
                <div className="w-20 h-20 rounded-xl bg-secondary shrink-0 overflow-hidden">
                  {p.image_url ? <img src={fileUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageOff /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-tight">{p.name}</p>
                    {!p.active && <span className="text-[10px] bg-stone-200 px-1.5 py-0.5 rounded-full shrink-0">Nonaktif</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.category} · {p.unit}</p>
                  <p className="font-mono font-bold text-accent text-sm mt-0.5">{formatRupiah(p.price)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st?.color}`}>{st?.label} ({p.stock})</span>
                  </div>
                </div>
              </div>
              <div className="flex border-t border-border">
                <button onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`} className="flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-secondary/50 tap"><Pencil size={15} /> Edit</button>
                <button onClick={() => setDeleteId(p.id)} data-testid={`delete-product-${p.id}`} className="flex-1 py-2.5 text-sm font-medium text-destructive flex items-center justify-center gap-1.5 hover:bg-red-50 tap border-l border-border"><Trash2 size={15} /> Hapus</button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[92vh] overflow-y-auto" data-testid="product-form">
          <DialogHeader><DialogTitle className="font-display">{editing === "new" ? "Tambah Produk" : "Edit Produk"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <ImageUpload value={form.image_url} onChange={(v) => set("image_url", v)} label="Foto Produk" testid="product-image" />
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama produk" data-testid="product-name" className="h-11 rounded-xl bg-white" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="h-11 rounded-xl bg-white" data-testid="product-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger className="h-11 rounded-xl bg-white" data-testid="product-unit"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Harga Jual</label><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} data-testid="product-price" className="h-11 rounded-xl bg-white" /></div>
              <div><label className="text-xs text-muted-foreground">Harga Modal</label><Input type="number" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} data-testid="product-cost" className="h-11 rounded-xl bg-white" /></div>
              <div><label className="text-xs text-muted-foreground">Stok</label><Input type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} data-testid="product-stock" className="h-11 rounded-xl bg-white" /></div>
              <div><label className="text-xs text-muted-foreground">Stok Minimum</label><Input type="number" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} data-testid="product-minstock" className="h-11 rounded-xl bg-white" /></div>
            </div>
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SKU / Kode produk" data-testid="product-sku" className="h-11 rounded-xl bg-white" />
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Deskripsi (opsional)" className="rounded-xl bg-white" rows={2} />

            <div className="flex items-center justify-between bg-secondary/40 rounded-xl px-3 py-2">
              <span className="text-sm font-medium">Produk Aktif (bisa dijual)</span>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} data-testid="product-active" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-secondary/40 rounded-xl px-3 py-2">
                <span className="text-sm">Opsi Gula</span>
                <Switch checked={form.has_sweetness} onCheckedChange={(v) => set("has_sweetness", v)} data-testid="product-sweetness" />
              </div>
              <div className="flex items-center justify-between bg-secondary/40 rounded-xl px-3 py-2">
                <span className="text-sm">Opsi Es</span>
                <Switch checked={form.has_ice} onCheckedChange={(v) => set("has_ice", v)} data-testid="product-ice" />
              </div>
            </div>

            {/* Variant groups */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">Varian (cth: Ukuran, Suhu)</p>
                <button onClick={addGroup} data-testid="add-variant-group" className="text-accent text-sm font-medium flex items-center gap-1"><Plus size={14} /> Grup</button>
              </div>
              {form.variant_groups.map((g, gi) => (
                <div key={gi} className="bg-secondary/30 rounded-xl p-3 mb-2 space-y-2">
                  <div className="flex gap-2">
                    <Input value={g.name} onChange={(e) => updGroup(gi, "name", e.target.value)} placeholder="Nama grup" className="h-9 rounded-lg bg-white text-sm" />
                    <button onClick={() => rmGroup(gi)} className="text-destructive px-2"><X size={16} /></button>
                  </div>
                  {g.options.map((o, oi) => (
                    <div key={oi} className="flex gap-2 pl-2">
                      <Input value={o.name} onChange={(e) => updOpt(gi, oi, "name", e.target.value)} placeholder="Opsi" className="h-9 rounded-lg bg-white text-sm flex-1" />
                      <Input type="number" value={o.price_delta} onChange={(e) => updOpt(gi, oi, "price_delta", e.target.value)} placeholder="+harga" className="h-9 rounded-lg bg-white text-sm w-24" />
                      <button onClick={() => rmOpt(gi, oi)} className="text-muted-foreground px-1"><X size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => addOpt(gi)} className="text-xs text-accent font-medium pl-2">+ Tambah opsi</button>
                </div>
              ))}
            </div>

            {/* Addons */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">Tambahan (Add-on)</p>
                <button onClick={addAddon} data-testid="add-addon" className="text-accent text-sm font-medium flex items-center gap-1"><Plus size={14} /> Add-on</button>
              </div>
              {form.addons.map((a, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={a.name} onChange={(e) => updAddon(i, "name", e.target.value)} placeholder="Nama tambahan" className="h-9 rounded-lg bg-white text-sm flex-1" />
                  <Input type="number" value={a.price} onChange={(e) => updAddon(i, "price", e.target.value)} placeholder="Harga" className="h-9 rounded-lg bg-white text-sm w-28" />
                  <button onClick={() => rmAddon(i)} className="text-destructive px-1"><X size={16} /></button>
                </div>
              ))}
            </div>

            <Button onClick={save} disabled={saving} data-testid="save-product" className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold tap">
              {saving ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus produk?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} data-testid="confirm-delete" className="rounded-xl bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
