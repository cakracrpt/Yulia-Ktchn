import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Banknote, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { fileUrl } from "@/lib/api";
import { QUICK_CASH } from "@/lib/constants";

export default function PaymentModal({ open, onClose, total, settings, onPay, processing }) {
  const [tab, setTab] = useState("cash");
  const [cash, setCash] = useState(0);

  React.useEffect(() => { if (open) { setCash(0); setTab("cash"); } }, [open]);

  const change = useMemo(() => cash - total, [cash, total]);
  const enough = cash >= total;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="payment-modal">
        <DialogHeader>
          <DialogTitle className="font-display">Pembayaran</DialogTitle>
        </DialogHeader>
        <div className="bg-primary rounded-2xl p-4 text-center">
          <p className="text-primary-foreground/60 text-sm">Total Pembayaran</p>
          <p className="text-3xl font-bold text-accent font-mono" data-testid="payment-total">{formatRupiah(total)}</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full rounded-xl h-12">
            <TabsTrigger value="cash" data-testid="tab-cash" className="rounded-lg gap-2"><Banknote size={18} /> Tunai</TabsTrigger>
            <TabsTrigger value="qris" data-testid="tab-qris" className="rounded-lg gap-2"><QrCode size={18} /> QRIS</TabsTrigger>
          </TabsList>

          <TabsContent value="cash" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setCash(total)} data-testid="quick-cash-pas"
                className="h-12 rounded-xl font-semibold tap">Uang Pas</Button>
              {QUICK_CASH.map((amt) => (
                <Button key={amt} variant="outline" onClick={() => setCash(amt)} data-testid={`quick-cash-${amt}`}
                  className="h-12 rounded-xl font-semibold tap">{formatRupiah(amt)}</Button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Uang Diterima</label>
              <Input type="number" value={cash || ""} onChange={(e) => setCash(Number(e.target.value))}
                data-testid="cash-input" className="h-12 rounded-xl bg-white text-lg font-mono" placeholder="0" />
            </div>
            <div className={`rounded-xl p-4 flex justify-between items-center ${enough ? "bg-emerald-50" : "bg-red-50"}`}>
              <span className="font-medium">Kembalian</span>
              <span data-testid="change-amount" className={`font-bold text-xl font-mono ${enough ? "text-emerald-600" : "text-destructive"}`}>
                {enough ? formatRupiah(change) : "Kurang " + formatRupiah(-change)}
              </span>
            </div>
            <Button disabled={!enough || processing} onClick={() => onPay("cash", cash)} data-testid="confirm-cash-payment"
              className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base tap">
              {processing ? <Loader2 className="animate-spin" /> : "Bayar & Selesai"}
            </Button>
          </TabsContent>

          <TabsContent value="qris" className="space-y-3 mt-4 text-center">
            {settings?.qris_url ? (
              <div className="bg-white rounded-2xl p-4 border border-border inline-block mx-auto">
                <img src={fileUrl(settings.qris_url)} alt="QRIS" className="w-56 h-56 object-contain mx-auto" data-testid="qris-image" />
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-700 rounded-xl p-4 text-sm">
                Belum ada gambar QRIS. Unggah di menu Pengaturan.
              </div>
            )}
            <p className="text-sm text-muted-foreground">Tunjukkan QR ini ke pelanggan. Jumlah yang harus dibayar:</p>
            <p className="text-2xl font-bold font-mono text-accent">{formatRupiah(total)}</p>
            <Button disabled={processing} onClick={() => onPay("qris", 0)} data-testid="confirm-qris-payment"
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base tap gap-2">
              {processing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> Tandai Sudah Dibayar</>}
            </Button>
            <p className="text-xs text-muted-foreground">Transaksi hanya ditandai lunas setelah Anda konfirmasi pembayaran diterima.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
