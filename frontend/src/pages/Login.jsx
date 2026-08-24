import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Salad, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@kopipos.id");
  const [password, setPassword] = useState("owner123");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) navigate("/kasir");
  };

  return (
    <div className="min-h-screen flex bg-background grain">
      <div className="hidden md:flex flex-1 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center">
            <Salad size={26} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-primary-foreground font-display">Yulia Kitchen</span>
        </div>
        <div>
          <h1 className="text-4xl lg:text-5xl font-bold text-primary-foreground leading-tight font-display">
            Segar, cepat, dan<br />mudah dikelola.
          </h1>
          <p className="mt-4 text-primary-foreground/60 text-lg max-w-md">
            Kelola pesanan minuman segar dan makanan, stok, serta laporan penjualan dalam satu aplikasi.
          </p>
        </div>
        <p className="text-primary-foreground/40 text-sm">© 2026 Yulia Kitchen. Kasir untuk bisnis F&B.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Salad size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold font-display">Yulia Kitchen</span>
          </div>
          <h2 className="text-2xl font-bold font-display">Masuk ke Akun</h2>
          <p className="text-muted-foreground mt-1 mb-6">Silakan masuk untuk mulai berjualan.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email" required className="h-12 rounded-xl bg-white"
                placeholder="email@warung.id"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Kata Sandi</label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password" required className="h-12 rounded-xl bg-white"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div data-testid="login-error" className="text-sm text-destructive bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <Button
              type="submit" disabled={loading} data-testid="login-submit"
              className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base tap"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Masuk"}
            </Button>
          </form>

          <div className="mt-6 text-xs text-muted-foreground bg-secondary rounded-xl p-4 space-y-1">
            <p className="font-semibold text-foreground">Akun Demo:</p>
            <p>Pemilik — owner@kopipos.id / owner123</p>
            <p>Kasir — kasir@kopipos.id / kasir123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
