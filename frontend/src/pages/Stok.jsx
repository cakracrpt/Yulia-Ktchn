import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiError } from "@/lib/api";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { STOCK_STATUS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PackagePlus, History, AlertTriangle } from "lucide-react";

export default function Stok() {
  const qc = useQueryClient();
  const [adjust, setAdjust] = useState(null);
  const [type, setType] = useState("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("stok");

  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get("/products")).data });
  const { data: movements = [] } = useQuery({ queryKey: ["movements"], queryFn: async () => (await api.get("/stock/movements")).data });

  const openAdjust = (p) => { setAdjust(p); setType("in"); setQty(""); setNote(""); };

  const submit = async () => {
    if (!qty) { toast.error("Masukkan jumlah"); return; }
    try {
      await api.post("/stock/adjust", { product_id: adjust.id, type, quantity: Number(qty), note });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success("Stok berhasil diperbarui");
      setAdjust(null);
    } catch (e) { toast.error(apiError(e)); }
  };

  const lowStock = products.filter((p) => p.stock_status !== "tersedia");

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold font-display mb-1">Stok</h1>
      <p className="text-muted-foreground mb-4">Kelola persediaan produk.</p>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">{lowStock.length} produk perlu perhatian</p>
            <p className="text-sm text-amber-700">{lowStock.map((p) => p.name).join(", ")}</p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="rounded-xl h-11">
          <TabsTrigger value="stok" className="rounded-lg gap-1"><PackagePlus size={16} /> Stok Produk</TabsTrigger>
          <TabsTrigger value="riwayat" className="rounded-lg gap-1"><History size={16} /> Riwayat</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "stok" ? (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {products.map((p) => {
              const st = STOCK_STATUS[p.stock_status];
              return (
                <div key={p.id} className="flex items-center justify-between p-4" data-testid={`stock-row-${p.id}`}>
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Min: {p.min_stock} {p.unit} · SKU {p.sku || "-"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg">{p.stock}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st?.color}`}>{st?.label}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openAdjust(p)} data-testid={`adjust-stock-${p.id}`} className="rounded-xl">Atur</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {movements.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Belum ada riwayat stok.</p>
          ) : (
            <div className="divide-y divide-border">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{m.product_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)} · {m.user_name} · {m.note || m.type}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${m.quantity < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {m.quantity > 0 ? "+" : ""}{m.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.before} → {m.after}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!adjust} onOpenChange={() => setAdjust(null)}>
        <DialogContent className="max-w-sm rounded-2xl" data-testid="adjust-stock-modal">
          <DialogHeader><DialogTitle className="font-display">Atur Stok — {adjust?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Stok saat ini: <span className="font-bold text-foreground">{adjust?.stock} {adjust?.unit}</span></p>
          <div className="grid grid-cols-3 gap-2">
            {[["in", "Stok Masuk"], ["out", "Stok Keluar"], ["adjust", "Set Total"]].map(([v, l]) => (
              <button key={v} onClick={() => setType(v)} data-testid={`stock-type-${v}`}
                className={`h-11 rounded-xl text-sm font-medium border tap ${type === v ? "bg-accent text-accent-foreground border-accent" : "bg-white border-border"}`}>{l}</button>
            ))}
          </div>
          <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Jumlah"
            data-testid="adjust-qty" className="h-12 rounded-xl bg-white" />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className="rounded-xl bg-white" rows={2} />
          <Button onClick={submit} data-testid="submit-adjust" className="h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">Simpan</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
