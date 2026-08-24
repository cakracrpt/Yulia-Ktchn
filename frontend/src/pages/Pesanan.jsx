import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiError } from "@/lib/api";
import { formatRupiah, formatTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/constants";
import { toast } from "sonner";
import { UtensilsCrossed, ShoppingBag, User, Hash } from "lucide-react";

const NEXT = { baru: "diproses", diproses: "siap", siap: "selesai" };
const NEXT_LABEL = { baru: "Proses", diproses: "Siapkan", siap: "Selesaikan" };

function itemOptions(item) {
  const parts = [];
  (item.variants || []).forEach((v) => parts.push(v.name));
  if (item.sweetness) parts.push(item.sweetness);
  if (item.ice) parts.push(item.ice);
  (item.addons || []).forEach((a) => parts.push("+" + a.name));
  return parts.join(" · ");
}

export default function Pesanan() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("aktif");
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"], queryFn: async () => (await api.get("/orders")).data,
    refetchInterval: 15000,
  });

  const update = async (id, status) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Status pesanan diperbarui");
    } catch (e) { toast.error(apiError(e)); }
  };

  const filtered = orders.filter((o) => {
    if (filter === "aktif") return !["selesai", "dibatalkan"].includes(o.order_status);
    return o.order_status === filter;
  });

  const statusMeta = (key) => ORDER_STATUS.find((s) => s.key === key);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold font-display mb-1">Pesanan</h1>
      <p className="text-muted-foreground mb-4">Kelola dan perbarui status pesanan dapur.</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {[{ key: "aktif", label: "Aktif" }, ...ORDER_STATUS].map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)} data-testid={`order-filter-${s.key}`}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap tap border ${
              filter === s.key ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 bg-white rounded-2xl border border-border">Tidak ada pesanan.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((o) => {
            const meta = statusMeta(o.order_status);
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-border p-4 shadow-sm" data-testid={`order-card-${o.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold font-mono">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(o.created_at)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta?.color}`}>{meta?.label}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    {o.order_type === "dine_in" ? <UtensilsCrossed size={13} /> : <ShoppingBag size={13} />}
                    {o.order_type === "dine_in" ? "Makan di Tempat" : "Bawa Pulang"}
                  </span>
                  {o.customer_name && <span className="flex items-center gap-1"><User size={13} /> {o.customer_name}</span>}
                  {o.table_number && <span className="flex items-center gap-1"><Hash size={13} /> Meja {o.table_number}</span>}
                </div>
                <div className="border-t border-border pt-2 space-y-1 mb-3">
                  {o.items.map((it, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{it.quantity}x {it.name}</span>
                        <span className="font-mono">{formatRupiah(it.line_total)}</span>
                      </div>
                      {itemOptions(it) && <p className="text-xs text-muted-foreground">{itemOptions(it)}</p>}
                      {it.note && <p className="text-xs italic text-accent">"{it.note}"</p>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-mono font-bold text-accent">{formatRupiah(o.total)}</span>
                </div>
                {!["selesai", "dibatalkan"].includes(o.order_status) && (
                  <div className="flex gap-2">
                    {NEXT[o.order_status] && (
                      <button onClick={() => update(o.id, NEXT[o.order_status])} data-testid={`order-next-${o.id}`}
                        className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground font-medium text-sm tap">
                        {NEXT_LABEL[o.order_status]}
                      </button>
                    )}
                    <button onClick={() => update(o.id, "dibatalkan")} data-testid={`order-cancel-${o.id}`}
                      className="h-10 px-3 rounded-xl border border-destructive text-destructive font-medium text-sm tap">
                      Batal
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
