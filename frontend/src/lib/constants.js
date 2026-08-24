export const CATEGORIES = ["Makanan", "Mojito", "Es Teh", "Jus", "Minuman", "Dessert", "Snack", "Paket"];
export const FILTER_CATEGORIES = ["Semua", ...CATEGORIES];

export const UNITS = ["pcs", "porsi", "cup", "botol", "bungkus", "mangkuk", "gelas", "paket"];

export const SWEETNESS_OPTIONS = ["Normal", "Less Sugar", "Half Sugar", "No Sugar"];
export const ICE_OPTIONS = ["Normal Ice", "Less Ice", "No Ice"];

export const ORDER_STATUS = [
  { key: "baru", label: "Baru", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "diproses", label: "Diproses", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "siap", label: "Siap", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "selesai", label: "Selesai", color: "bg-stone-100 text-stone-600 border-stone-200" },
  { key: "dibatalkan", label: "Dibatalkan", color: "bg-red-100 text-red-700 border-red-200" },
];

export const STOCK_STATUS = {
  tersedia: { label: "Tersedia", color: "bg-emerald-100 text-emerald-700" },
  menipis: { label: "Stok Menipis", color: "bg-amber-100 text-amber-700" },
  habis: { label: "Habis", color: "bg-red-100 text-red-700" },
};

export const NAV = [
  { path: "/kasir", label: "Kasir", icon: "ShoppingCart", roles: ["owner", "cashier"] },
  { path: "/pesanan", label: "Pesanan", icon: "ClipboardList", roles: ["owner", "cashier"] },
  { path: "/produk", label: "Produk & Menu", icon: "UtensilsCrossed", roles: ["owner"] },
  { path: "/stok", label: "Stok", icon: "Boxes", roles: ["owner"] },
  { path: "/riwayat", label: "Riwayat Transaksi", icon: "Receipt", roles: ["owner", "cashier"] },
  { path: "/laporan", label: "Laporan", icon: "BarChart3", roles: ["owner"] },
  { path: "/pengaturan", label: "Pengaturan", icon: "Settings", roles: ["owner"] },
];

export const QUICK_CASH = [20000, 50000, 100000];
