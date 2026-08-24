import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Printer, Bluetooth } from "lucide-react";
import ReceiptView, { buildReceiptText } from "@/components/ReceiptView";
import { printReceiptBluetooth, isBluetoothSupported } from "@/lib/thermalPrint";
import { toast } from "sonner";

export default function Riwayat() {
  const [period, setPeriod] = useState("today");
  const [method, setMethod] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [detail, setDetail] = useState(null);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get("/settings")).data });
  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["transactions", period, method, start, end],
    queryFn: async () => (await api.get("/transactions", { params: { period, method, start, end } })).data,
  });

  const printBt = async () => {
    try {
      await printReceiptBluetooth(buildReceiptText(detail, settings));
      toast.success("Struk terkirim ke printer");
    } catch (e) { toast.error(e.message); }
  };

  const Pill = ({ active, onClick, children, testid }) => (
    <button onClick={onClick} data-testid={testid}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap tap border ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border"}`}>{children}</button>
  );

  const totalSum = txns.reduce((s, t) => s + t.total, 0);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold font-display mb-1">Riwayat Transaksi</h1>
      <p className="text-muted-foreground mb-4">Lihat dan cetak ulang transaksi.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <Pill active={period === "today"} onClick={() => setPeriod("today")} testid="period-today">Hari Ini</Pill>
        <Pill active={period === "all"} onClick={() => setPeriod("all")} testid="period-all">Semua</Pill>
        <Pill active={period === "range"} onClick={() => setPeriod("range")} testid="period-range">Rentang Tanggal</Pill>
        <span className="mx-1 self-center text-muted-foreground">|</span>
        <Pill active={method === "all"} onClick={() => setMethod("all")} testid="method-all">Semua</Pill>
        <Pill active={method === "cash"} onClick={() => setMethod("cash")} testid="method-cash">Tunai</Pill>
        <Pill active={method === "qris"} onClick={() => setMethod("qris")} testid="method-qris">QRIS</Pill>
      </div>

      {period === "range" && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-xl bg-white w-40" data-testid="range-start" />
          <span className="text-muted-foreground">s/d</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 rounded-xl bg-white w-40" data-testid="range-end" />
        </div>
      )}

      <div className="bg-primary text-primary-foreground rounded-2xl p-4 mb-4 flex justify-between items-center">
        <span>{txns.length} transaksi</span>
        <span className="font-bold font-mono text-accent text-xl">{formatRupiah(totalSum)}</span>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : txns.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 bg-white rounded-2xl border border-border">Belum ada transaksi.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {txns.map((t) => (
              <button key={t.id} onClick={() => setDetail(t)} data-testid={`txn-row-${t.id}`}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/40 text-left tap">
                <div>
                  <p className="font-bold font-mono">{t.txn_number}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)} · {t.cashier_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-accent">{formatRupiah(t.total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.payment_method === "cash" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                    {t.payment_method === "cash" ? "Tunai" : "QRIS"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md rounded-2xl max-h-[92vh] overflow-y-auto" data-testid="txn-detail">
          <DialogHeader><DialogTitle className="font-display no-print">Detail Transaksi</DialogTitle></DialogHeader>
          {detail && (
            <>
              <div className="border rounded-xl bg-stone-50 no-print"><ReceiptView txn={detail} settings={settings} /></div>
              <div className="hidden print:block"><ReceiptView txn={detail} settings={settings} /></div>
              <div className="grid grid-cols-2 gap-2 no-print">
                <Button variant="outline" onClick={() => window.print()} data-testid="reprint-btn" className="h-11 rounded-xl gap-2"><Printer size={18} /> Cetak Ulang</Button>
                {isBluetoothSupported() && (
                  <Button variant="outline" onClick={printBt} className="h-11 rounded-xl gap-2"><Bluetooth size={18} /> Bluetooth</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
