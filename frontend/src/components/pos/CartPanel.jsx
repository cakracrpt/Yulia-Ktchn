import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, ShoppingCart, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { formatRupiah } from "@/lib/format";

function itemOptions(item) {
  const parts = [];
  (item.variants || []).forEach((v) => parts.push(v.name));
  if (item.sweetness) parts.push(item.sweetness);
  if (item.ice) parts.push(item.ice);
  (item.addons || []).forEach((a) => parts.push("+" + a.name));
  return parts.join(" · ");
}

export default function CartPanel({
  cart, orderType, setOrderType, customerName, setCustomerName,
  tableNumber, setTableNumber, subtotal, tax, service, total, settings,
  onInc, onDec, onRemove, onClear, onCheckout,
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-bold text-lg font-display flex items-center gap-2">
          <ShoppingCart size={20} className="text-accent" /> Pesanan
        </h2>
        {cart.length > 0 && (
          <button onClick={onClear} data-testid="clear-cart-btn" className="text-sm text-destructive font-medium tap">Kosongkan</button>
        )}
      </div>

      <div className="p-4 space-y-3 border-b border-border">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setOrderType("dine_in")} data-testid="order-type-dinein"
            className={`h-11 rounded-xl text-sm font-medium border flex items-center justify-center gap-1.5 tap ${
              orderType === "dine_in" ? "bg-accent text-accent-foreground border-accent" : "bg-white border-border"}`}>
            <UtensilsCrossed size={16} /> Makan di Tempat
          </button>
          <button onClick={() => setOrderType("takeaway")} data-testid="order-type-takeaway"
            className={`h-11 rounded-xl text-sm font-medium border flex items-center justify-center gap-1.5 tap ${
              orderType === "takeaway" ? "bg-accent text-accent-foreground border-accent" : "bg-white border-border"}`}>
            <ShoppingBag size={16} /> Bawa Pulang
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama pelanggan"
            data-testid="customer-name" className="h-10 rounded-xl bg-white text-sm" />
          <Input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="No. Meja"
            data-testid="table-number" className="h-10 rounded-xl bg-white text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2" data-testid="cart-items">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
            <ShoppingCart size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Keranjang kosong</p>
            <p className="text-sm">Ketuk produk untuk menambahkan.</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.key} className="bg-white rounded-xl border border-border p-3" data-testid={`cart-item-${item.product_id}`}>
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  {itemOptions(item) && <p className="text-xs text-muted-foreground">{itemOptions(item)}</p>}
                  {item.note && <p className="text-xs italic text-accent">"{item.note}"</p>}
                </div>
                <button onClick={() => onRemove(item.key)} data-testid={`remove-item-${item.product_id}`} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={16} /></button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => onDec(item.key)} data-testid={`dec-item-${item.product_id}`}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center tap"><Minus size={14} /></button>
                  <span className="font-bold w-5 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => onInc(item.key)} data-testid={`inc-item-${item.product_id}`}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center tap"><Plus size={14} /></button>
                </div>
                <span className="font-mono font-bold text-sm text-accent">{formatRupiah(item.unitTotal * item.quantity)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-4 space-y-2 bg-secondary/40">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatRupiah(subtotal)}</span></div>
        {settings?.tax_enabled && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pajak ({settings.tax_percent}%)</span><span>{formatRupiah(tax)}</span></div>}
        {settings?.service_enabled && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Layanan ({settings.service_percent}%)</span><span>{formatRupiah(service)}</span></div>}
        <div className="flex justify-between items-center pt-1">
          <span className="font-bold">Total</span>
          <span className="font-bold text-2xl font-mono text-accent" data-testid="cart-total">{formatRupiah(total)}</span>
        </div>
        <Button disabled={cart.length === 0} onClick={onCheckout} data-testid="checkout-btn"
          className="w-full h-14 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg tap mt-1">
          Bayar {cart.length > 0 && `• ${formatRupiah(total)}`}
        </Button>
      </div>
    </div>
  );
}
