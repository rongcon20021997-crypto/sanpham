import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { emailToUsername } from "@/lib/helpers";
import {
  Shirt,
  LayoutDashboard,
  Layers,
  Package,
  Image,
  Boxes,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

export type PageKey =
  | "dashboard"
  | "blank-types"
  | "blanks"
  | "print-designs"
  | "products"
  | "users"
  | "settings";

interface LayoutProps {
  current: PageKey;
  onNavigate: (p: PageKey) => void;
  children: ReactNode;
}

const navItems: { key: PageKey; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { key: "blank-types", label: "Loại phôi", icon: Layers },
  { key: "blanks", label: "Phôi", icon: Package },
  { key: "print-designs", label: "Hình in", icon: Image },
  { key: "products", label: "Sản phẩm", icon: Boxes },
  { key: "users", label: "Nhân viên", icon: Users, adminOnly: true },
  { key: "settings", label: "Cài đặt", icon: Settings },
];

export function Layout({ current, onNavigate, children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = profile?.role === "admin";

  const visibleItems = navItems.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-800">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-sm font-bold text-slate-100 leading-tight">Áo Thun In</p>
            <p className="text-[11px] text-slate-500">Quản trị</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = current === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Icon size={18} className={active ? "text-brand-400" : "text-slate-500"} />
                {item.label}
                {item.adminOnly && (
                  <ShieldCheck size={14} className="ml-auto text-slate-600" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
              <UserCircle size={20} className="text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">
                {profile?.full_name || (profile?.email ? emailToUsername(profile.email) : "")}
              </p>
              <p className="text-[11px] text-slate-500">
                {isAdmin ? "Quản trị viên" : "Nhân viên"}
              </p>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 lg:hidden flex items-center gap-3 px-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-slate-200 text-sm sm:text-base">
            {navItems.find((i) => i.key === current)?.label}
          </span>
        </header>

        <main className="flex-1 p-3 sm:p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
