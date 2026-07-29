import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader, StatCard } from "@/components/PageParts";
import { Layers, Package, Image, Boxes, TrendingUp, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

export function DashboardPage() {
  const [stats, setStats] = useState({
    blankTypes: 0,
    blanks: 0,
    designs: 0,
    products: 0,
    activeProducts: 0,
    avgPrice: 0,
  });
  const [recent, setRecent] = useState<
    { code: string; name: string; price: number; status: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      const [bt, bl, pd, pr] = await Promise.all([
        supabase.from("blank_types").select("id", { count: "exact", head: true }),
        supabase.from("blanks").select("id", { count: "exact", head: true }),
        supabase.from("print_designs").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id, price, status", { count: "exact" }),
      ]);
      const products = pr.data || [];
      const activeCount = products.filter((p) => p.status === "active").length;
      const avg =
        products.length > 0
          ? products.reduce((s, p) => s + Number(p.price), 0) / products.length
          : 0;
      setStats({
        blankTypes: bt.count || 0,
        blanks: bl.count || 0,
        designs: pd.count || 0,
        products: pr.count || 0,
        activeProducts: activeCount,
        avgPrice: avg,
      });

      const { data: recentProducts } = await supabase
        .from("products")
        .select("code, name, price, status")
        .order("created_at", { ascending: false })
        .limit(8);
      setRecent(recentProducts || []);
    })();
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tổng quan"
        subtitle="Thống kê nhanh về hệ thống quản lý áo thun in"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Loại phôi" value={stats.blankTypes} icon={Layers} color="bg-brand-500" />
        <StatCard label="Phôi" value={stats.blanks} icon={Package} color="bg-cyan-500" />
        <StatCard label="Hình in" value={stats.designs} icon={Image} color="bg-violet-500" />
        <StatCard label="Sản phẩm" value={stats.products} icon={Boxes} color="bg-emerald-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-gradient rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-brand-400" />
            <h3 className="font-semibold text-slate-100">Sản phẩm gần đây</h3>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Chưa có sản phẩm nào. Tạo sản phẩm từ mục "Sản phẩm".
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((p) => (
                <div
                  key={p.code}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{p.code}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-slate-300">
                      {formatCurrency(Number(p.price))}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        p.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-700/50 text-slate-400"
                      }`}
                    >
                      {p.status === "active" ? "Đang bán" : "Tạm dừng"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-gradient rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-emerald-400" />
            <h3 className="font-semibold text-slate-100">Tổng quan sản phẩm</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
              <span className="text-sm text-slate-400">Đang bán</span>
              <span className="text-lg font-bold text-emerald-400">
                {stats.activeProducts}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
              <span className="text-sm text-slate-400">Tạm dừng</span>
              <span className="text-lg font-bold text-slate-400">
                {stats.products - stats.activeProducts}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Giá bán TB</span>
              <span className="text-lg font-bold text-brand-400">
                {formatCurrency(stats.avgPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
