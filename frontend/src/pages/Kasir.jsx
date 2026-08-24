import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { fileUrl, apiError } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { FILTER_CATEGORIES, STOCK_STATUS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Search, ShoppingCart, ImageOff } from "lucide-react";
import { toast } from "sonner";
import ProductOptionsModal from "@/components/pos/ProductOptionsModal";
import PaymentModal from "@/components/pos/PaymentModal";
import CartPanel from "@/components/pos/CartPanel";
import SuccessScreen from "@/components/pos/SuccessScreen";

function makeKey(item) {
  return [item.product_id, JSON.stringify(item.variants), JSON.stringify(item.addons),
    item.sweetness, item.ice, item.note].join("|");
}

export default function Kasir() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"], queryFn: async () => (await api.get("/products")).data,
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get("/settings")).data });

  const [category, setCategory] = useState("Semua");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [optionProduct, setOptionProduct] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [mobileCart, setMobileCart] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successTxn, setSuccessTxn] = useState(null);
  const [clientTxnId] = useState(() => crypto.randomUUID());
  const [txnKey, setTxnKey] = useState(clientTxnId);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = category === "Semua" || p.category === category;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, category, search]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.unitTotal * i.quantity, 0), [cart]);
  const tax = settings?.tax_enabled ? subtotal * settings.tax_percent / 100 : 0;
  const service = settings?.service_enabled ? subtotal * settings.service_percent / 100 : 0;
  const total = Math.round(subtotal + tax + service);

  const addItem = (item) => {
    const key = makeKey(item);
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + item.quantity };
        return copy;
      }
      return [...prev, { ...item, key }];
    });
    toast.success(`${item.name} ditambahkan`);
  };

  const handleProductClick = (product) => {
    if (product.stock_status === "habis" || !product.active) return;
    const needsOptions = (product.variant_groups?.length || 0) > 0 ||
      (product.addons?.length || 0) > 0 || product.has_sweetness || product.has_ice;
    if (needsOptions) {
      setOptionProduct(product);
    } else {
      addItem({
        product_id: product.id, name: product.name, image_url: product.image_url,
        unit_price: product.price, unitTotal: product.price, variants: [], addons: [],
        sweetness: "", ice: "", note: "", quantity: 1,
      });
    }
  };

  const inc = (key) => setCart((p) => p.map((i) => i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
  const dec = (key) => setCart((p) => p.map((i) => i.key === key ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i));
  const remove = (key) => setCart((p) => p.filter((i) => i.key !== key));
  const clear = () => setCart([]);

  const openPayment = () => { setMobileCart(false); setPayOpen(true); };

  const pay = async (method, cashReceived) => {
    setProcessing(true);
    try {
      const payload = {
        items: cart.map((i) => ({
          product_id: i.product_id, name: i.name, quantity: i.quantity, unit_price: i.unit_price,
          variants: i.variants, addons: i.addons, sweetness: i.sweetness, ice: i.ice, note: i.note,
        })),
        order_type: orderType, customer_name: customerName, table_number: tableNumber,
        payment_method: method, cash_received: cashReceived, client_txn_id: txnKey,
      };
      const { data } = await api.post("/checkout", payload);
      setPayOpen(false);
      setSuccessTxn(data);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setProcessing(false);
    }
  };

  const newOrder = () => {
    setCart([]); setCustomerName(""); setTableNumber(""); setOrderType("dine_in");
    setSuccessTxn(null); setTxnKey(crypto.randomUUID());
  };

  const cartProps = {
    cart, orderType, setOrderType, customerName, setCustomerName, tableNumber, setTableNumber,
    subtotal, tax, service, total, settings, onInc: inc, onDec: dec, onRemove: remove, onClear: clear,
    onCheckout: openPayment,
  };
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex h-screen lg:h-screen overflow-hidden">
      {/* LEFT: products */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-0">
        <div className="p-4 pb-2 space-y-3 bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold font-display">Kasir</h1>
              <p className="text-xs text-muted-foreground">Ketuk produk untuk menambah ke pesanan</p>
            </div>
            <div className="relative flex-1 max-w-md ml-auto">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk..."
                data-testid="product-search" className="h-11 rounded-xl pl-10 bg-white" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {FILTER_CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} data-testid={`category-${c}`}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap tap border ${
                  category === c ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-2">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-52 rounded-2xl bg-white animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">Tidak ada produk ditemukan.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const st = STOCK_STATUS[p.stock_status];
                const disabled = p.stock_status === "habis" || !p.active;
                return (
                  <button key={p.id} onClick={() => handleProductClick(p)} disabled={disabled}
                    data-testid={`product-card-${p.id}`}
                    className={`text-left bg-white rounded-2xl border border-border overflow-hidden tap shadow-sm hover:shadow-md transition-shadow ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
                    <div className="aspect-square bg-secondary relative">
                      {p.image_url ? (
                        <img src={fileUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageOff /></div>
                      )}
                      <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st?.color}`}>
                        {!p.active ? "Tidak Tersedia" : st?.label}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] text-muted-foreground">{p.category}</p>
                      <p className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</p>
                      <p className="font-mono font-bold text-accent mt-1">{formatRupiah(p.price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: cart (desktop/tablet) */}
      <aside className="hidden md:flex w-80 lg:w-96 bg-secondary/30 border-l border-border flex-col h-screen sticky top-0">
        <CartPanel {...cartProps} />
      </aside>

      {/* Mobile floating cart bar */}
      {cart.length > 0 && !successTxn && (
        <button onClick={() => setMobileCart(true)} data-testid="mobile-cart-bar"
          className="md:hidden fixed bottom-4 inset-x-4 z-30 bg-accent text-accent-foreground rounded-2xl h-14 px-5 flex items-center justify-between shadow-lg tap">
          <span className="flex items-center gap-2 font-semibold"><ShoppingCart size={20} /> {cartCount} item</span>
          <span className="font-bold font-mono">{formatRupiah(total)}</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      <Sheet open={mobileCart} onOpenChange={setMobileCart}>
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-2xl md:hidden">
          <CartPanel {...cartProps} />
        </SheetContent>
      </Sheet>

      <ProductOptionsModal product={optionProduct} open={!!optionProduct}
        onClose={() => setOptionProduct(null)} onConfirm={addItem} />
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} total={total}
        settings={settings} onPay={pay} processing={processing} />
      {successTxn && <SuccessScreen txn={successTxn} settings={settings} onNewOrder={newOrder} />}
    </div>
  );
}
