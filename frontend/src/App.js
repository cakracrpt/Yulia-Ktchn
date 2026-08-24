import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Kasir from "@/pages/Kasir";
import Pesanan from "@/pages/Pesanan";
import Produk from "@/pages/Produk";
import Stok from "@/pages/Stok";
import Riwayat from "@/pages/Riwayat";
import Laporan from "@/pages/Laporan";
import Pengaturan from "@/pages/Pengaturan";

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-muted-foreground font-medium">Memuat Yulia Kitchen...</p>
      </div>
    </div>
  );
}

function Protected({ children, ownerOnly }) {
  const { user } = useAuth();
  if (user === null) return <Loader />;
  if (user === false) return <Navigate to="/login" replace />;
  if (ownerOnly && user.role !== "owner") return <Navigate to="/kasir" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/kasir" replace /> : <Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Navigate to="/kasir" replace />} />
        <Route path="kasir" element={<Kasir />} />
        <Route path="pesanan" element={<Pesanan />} />
        <Route path="riwayat" element={<Riwayat />} />
        <Route path="produk" element={<Protected ownerOnly><Produk /></Protected>} />
        <Route path="stok" element={<Protected ownerOnly><Stok /></Protected>} />
        <Route path="laporan" element={<Protected ownerOnly><Laporan /></Protected>} />
        <Route path="pengaturan" element={<Protected ownerOnly><Pengaturan /></Protected>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
