import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { fileUrl } from "@/lib/api";
import { SWEETNESS_OPTIONS, ICE_OPTIONS } from "@/lib/constants";

export default function ProductOptionsModal({ product, open, onClose, onConfirm }) {
  const [variants, setVariants] = useState({});
  const [addons, setAddons] = useState([]);
  const [sweetness, setSweetness] = useState("Normal");
  const [ice, setIce] = useState("Normal Ice");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  React.useEffect(() => {
    if (product && open) {
      const initial = {};
      (product.variant_groups || []).forEach((g) => {
        if (g.options?.length) initial[g.name] = g.options[0];
      });
      setVariants(initial);
      setAddons([]);
      setSweetness("Normal");
      setIce("Normal Ice");
      setNote("");
      setQty(1);
    }
  }, [product, open]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    let p = product.price;
    Object.values(variants).forEach((v) => { p += v.price_delta || 0; });
    addons.forEach((a) => { p += a.price || 0; });
    return p;
  }, [product, variants, addons]);

  if (!product) return null;

  const toggleAddon = (addon) => {
    setAddons((prev) =>
      prev.find((a) => a.name === addon.name)
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon]
    );
  };

  const confirm = () => {
    onConfirm({
      product_id: product.id,
      name: product.name,
      image_url: product.image_url,
      unit_price: product.price,
      unitTotal: unitPrice,
      variants: Object.entries(variants).map(([group, v]) => ({ group, name: v.name, price_delta: v.price_delta || 0 })),
      addons: addons.map((a) => ({ name: a.name, price: a.price || 0 })),
      sweetness: product.has_sweetness ? sweetness : "",
      ice: product.has_ice ? ice : "",
      note,
      quantity: qty,
    });
    onClose();
  };

  const OptionBtn = ({ active, onClick, children, testid }) => (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-2 rounded-xl text-sm font-medium border tap ${
        active ? "bg-accent text-accent-foreground border-accent" : "bg-white border-border text-foreground hover:border-accent"
      }`}
    >
      {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="product-options-modal">
        <DialogHeader>
          <DialogTitle className="font-display">{product.name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3">
          {product.image_url && (
            <img src={fileUrl(product.image_url)} alt={product.name} className="w-16 h-16 rounded-xl object-cover" />
          )}
          <p className="font-mono font-bold text-lg text-accent">{formatRupiah(product.price)}</p>
        </div>

        {(product.variant_groups || []).map((group) => (
          <div key={group.name}>
            <p className="text-sm font-semibold mb-2">{group.name}</p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((opt) => (
                <OptionBtn
                  key={opt.name}
                  testid={`variant-${group.name}-${opt.name}`}
                  active={variants[group.name]?.name === opt.name}
                  onClick={() => setVariants((p) => ({ ...p, [group.name]: opt }))}
                >
                  {opt.name}{opt.price_delta ? ` (${opt.price_delta > 0 ? "+" : ""}${formatRupiah(opt.price_delta)})` : ""}
                </OptionBtn>
              ))}
            </div>
          </div>
        ))}

        {product.has_sweetness && (
          <div>
            <p className="text-sm font-semibold mb-2">Tingkat Gula</p>
            <div className="flex flex-wrap gap-2">
              {SWEETNESS_OPTIONS.map((s) => (
                <OptionBtn key={s} active={sweetness === s} onClick={() => setSweetness(s)} testid={`sweetness-${s}`}>{s}</OptionBtn>
              ))}
            </div>
          </div>
        )}

        {product.has_ice && (
          <div>
            <p className="text-sm font-semibold mb-2">Es</p>
            <div className="flex flex-wrap gap-2">
              {ICE_OPTIONS.map((s) => (
                <OptionBtn key={s} active={ice === s} onClick={() => setIce(s)} testid={`ice-${s}`}>{s}</OptionBtn>
              ))}
            </div>
          </div>
        )}

        {(product.addons || []).length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Tambahan</p>
            <div className="flex flex-wrap gap-2">
              {product.addons.map((a) => (
                <OptionBtn
                  key={a.name} testid={`addon-${a.name}`}
                  active={!!addons.find((x) => x.name === a.name)}
                  onClick={() => toggleAddon(a)}
                >
                  {a.name} +{formatRupiah(a.price)}
                </OptionBtn>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold mb-2">Catatan</p>
          <Textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="cth: tidak pedas, saus dipisah"
            data-testid="item-note" className="rounded-xl resize-none bg-white" rows={2}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} data-testid="qty-minus"
              className="w-11 h-11 rounded-xl border border-border flex items-center justify-center tap"><Minus size={18} /></button>
            <span className="font-bold text-lg w-6 text-center" data-testid="qty-value">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} data-testid="qty-plus"
              className="w-11 h-11 rounded-xl border border-border flex items-center justify-center tap"><Plus size={18} /></button>
          </div>
          <Button onClick={confirm} data-testid="confirm-add-item"
            className="h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-6 tap">
            Tambah • {formatRupiah(unitPrice * qty)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
