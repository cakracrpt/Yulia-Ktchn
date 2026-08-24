import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, PlusCircle, Receipt, Bluetooth } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import ReceiptView, { buildReceiptText } from "@/components/ReceiptView";
import { printReceiptBluetooth, isBluetoothSupported } from "@/lib/thermalPrint";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function SuccessScreen({ txn, settings, onNewOrder }) {
  const navigate = useNavigate();
  const [bt, setBt] = useState(false);

  const printBrowser = () => window.print();

  const printBluetooth = async () => {
    setBt(true);
    try {
      await printReceiptBluetooth(buildReceiptText(txn, settings));
      toast.success("Struk terkirim ke printer Bluetooth");
    } catch (e) {
      toast.error(e.message || "Gagal mencetak via Bluetooth");
    } finally {
      setBt(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-md rounded-2xl max-h-[92vh] overflow-y-auto" data-testid="success-screen">
        <div className="text-center no-print">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={38} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold font-display">Pembayaran Berhasil</h2>
          <p className="text-muted-foreground">No. {txn.txn_number}</p>
          <p className="text-3xl font-bold font-mono text-accent mt-2">{formatRupiah(txn.total)}</p>
          {txn.payment_method === "cash" && (
            <p className="text-sm text-muted-foreground mt-1">Kembalian: <span className="font-semibold text-foreground">{formatRupiah(txn.change)}</span></p>
          )}
        </div>

        <div className="border rounded-xl overflow-hidden bg-stone-50 max-h-64 overflow-y-auto no-print">
          <ReceiptView txn={txn} settings={settings} />
        </div>
        {/* Hidden print target */}
        <div className="hidden print:block"><ReceiptView txn={txn} settings={settings} /></div>

        <div className="space-y-2 no-print">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={printBrowser} data-testid="print-receipt-btn" variant="outline" className="h-12 rounded-xl gap-2 tap">
              <Printer size={18} /> Cetak Struk
            </Button>
            {isBluetoothSupported() && (
              <Button onClick={printBluetooth} disabled={bt} data-testid="print-bluetooth-btn" variant="outline" className="h-12 rounded-xl gap-2 tap">
                <Bluetooth size={18} /> {bt ? "Menghubungkan..." : "Bluetooth"}
              </Button>
            )}
          </div>
          <Button onClick={onNewOrder} data-testid="new-order-btn"
            className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2 tap">
            <PlusCircle size={18} /> Pesanan Baru
          </Button>
          <Button onClick={() => navigate("/riwayat")} data-testid="view-transactions-btn" variant="ghost" className="w-full h-11 rounded-xl gap-2">
            <Receipt size={18} /> Lihat Transaksi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
