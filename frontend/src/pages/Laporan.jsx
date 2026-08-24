import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatRupiah, formatDateTime } from "@/lib/format";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, Receipt, Package, Wallet, Banknote, QrCode, PiggyBank, Award,
} from "lucide-react";

const KPI = ({ icon: Icon, label, value }) => (
  <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-accent/10">
      <Icon size={20} className="text-accent" />
    </div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-bold text-xl font-display mt-0.5">{value}</p>
  </div>
);

export default function Laporan() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get("/reports/dashboard")).data });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Memuat laporan...</div>;

  const rp = (v) => formatRupiah(v);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold font-display mb-1">Laporan & Dashboard</h1>
      <p className="text-muted-foreground mb-4">Ringkasan performa bisnis Anda hari ini.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI icon={TrendingUp} label="Penjualan Hari Ini" value={rp(data.today_sales)} />
        <KPI icon={Receipt} label="Jumlah Transaksi" value={data.today_count} />
        <KPI icon={Package} label="Produk Terjual" value={data.products_sold} />
        <KPI icon={Wallet} label="Rata-rata Transaksi" value={rp(data.avg_txn)} />
        <KPI icon={Banknote} label="Penjualan Tunai" value={rp(data.cash_sales)} />
        <KPI icon={QrCode} label="Penjualan QRIS" value={rp(data.qris_sales)} />
        <KPI icon={PiggyBank} label="Estimasi Laba Kotor" value={rp(data.gross_profit)} />
        <KPI icon={Award} label="Produk Terlaris" value={data.best_products[0]?.name || "-"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-bold font-display mb-3">Penjualan 7 Hari Terakhir</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D1E7D5" />
              <XAxis dataKey="label" fontSize={12} stroke="#5B7A66" />
              <YAxis fontSize={11} stroke="#5B7A66" tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
              <Tooltip formatter={(v) => rp(v)} />
              <Line type="monotone" dataKey="total" stroke="#16A34A" strokeWidth={3} dot={{ fill: "#16A34A" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-bold font-display mb-3">Penjualan Bulanan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D1E7D5" />
              <XAxis dataKey="label" fontSize={11} stroke="#5B7A66" />
              <YAxis fontSize={11} stroke="#5B7A66" tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
              <Tooltip formatter={(v) => rp(v)} />
              <Bar dataKey="total" fill="#0F3D2E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-bold font-display mb-3">Produk Terlaris</h3>
          {data.best_products.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
            <div className="space-y-2">
              {data.best_products.map((p, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm"><span className="text-accent font-bold mr-2">{i + 1}</span>{p.name}</span>
                  <span className="font-mono font-semibold text-sm">{p.qty}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-bold font-display mb-3">Kategori Terlaris</h3>
          {data.best_categories.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
            <div className="space-y-2">
              {data.best_categories.map((c, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm">{c.name}</span>
                  <span className="font-mono font-semibold text-sm text-accent">{rp(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-bold font-display mb-3">Stok Menipis</h3>
          {data.low_stock.length === 0 ? <p className="text-sm text-muted-foreground">Semua stok aman.</p> : (
            <div className="space-y-2">
              {data.low_stock.map((p) => (
                <div key={p.id} className="flex justify-between items-center">
                  <span className="text-sm">{p.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.stock_status === "habis" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.stock} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm mt-4">
        <h3 className="font-bold font-display mb-3">Transaksi Terbaru</h3>
        {data.recent.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada transaksi.</p> : (
          <div className="divide-y divide-border">
            {data.recent.map((t) => (
              <div key={t.id} className="flex justify-between items-center py-2.5">
                <div>
                  <p className="font-mono font-semibold text-sm">{t.txn_number}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
                </div>
                <span className="font-mono font-bold text-accent">{rp(t.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
