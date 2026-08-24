import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NAV } from "@/lib/constants";
import {
  ShoppingCart, ClipboardList, UtensilsCrossed, Boxes, Receipt,
  BarChart3, Settings, LogOut, Salad, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ICONS = { ShoppingCart, ClipboardList, UtensilsCrossed, Boxes, Receipt, BarChart3, Settings };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const NavItems = ({ onClick }) => (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClick}
            data-testid={`nav-${item.path.slice(1)}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm tap transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-primary-foreground/70 hover:bg-white/10"
              }`
            }
          >
            <Icon size={20} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background grain">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-primary flex-col p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Salad size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary-foreground leading-none font-display">Yulia Kitchen</h1>
            <p className="text-xs text-primary-foreground/50">Kasir & Minuman Segar</p>
          </div>
        </div>
        <NavItems />
        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-semibold text-primary-foreground">{user.name}</p>
            <p className="text-xs text-accent capitalize">{user.role === "owner" ? "Pemilik / Admin" : "Kasir"}</p>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm w-full text-primary-foreground/70 hover:bg-white/10 tap"
          >
            <LogOut size={20} /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-primary flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Salad size={18} className="text-white" />
          </div>
          <span className="font-bold text-primary-foreground font-display">Yulia Kitchen</span>
        </div>
        <button onClick={() => setOpen(true)} data-testid="mobile-menu-btn" className="text-primary-foreground">
          <Menu size={26} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-primary flex flex-col p-4 h-full">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-primary-foreground text-lg font-display">Menu</span>
              <button onClick={() => setOpen(false)} className="text-primary-foreground"><X size={24} /></button>
            </div>
            <NavItems onClick={() => setOpen(false)} />
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="px-3 py-2 mb-2">
                <p className="text-sm font-semibold text-primary-foreground">{user.name}</p>
                <p className="text-xs text-accent">{user.role === "owner" ? "Pemilik / Admin" : "Kasir"}</p>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm w-full text-primary-foreground/70 hover:bg-white/10">
                <LogOut size={20} /> Keluar
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
