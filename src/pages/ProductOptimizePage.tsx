import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Field";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Download,
  Filter,
  Layers,
  FileText,
  Boxes,
  Eye,
  Settings,
  Pencil,
  Save,
  CheckSquare,
  Square,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";
import { formatCurrency, formatColorName } from "@/lib/helpers";
import {
  getOpenAiApiKey,
  getOpenAiModel,
  getOpenAiCustomPrompt,
  generateShopeeOptimization,
  type ShopeeOptimizationResult,
} from "@/lib/openai";

interface MasterProductItem {
  key: string;
  master_code: string;
  master_name: string;
  shopee_name?: string | null;
  shopee_description?: string | null;
  is_optimized: boolean;
  optimized_at?: string | null;
  blank_type?: BlankType;
  print_designs: PrintDesign[];
  colors: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
  preview_url: string | null;
  variantIds: string[];
  variants: Product[];
}

export function ProductOptimizePage({ onNavigateToSettings }: { onNavigateToSettings?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [designs, setDesigns] = useState<PrintDesign[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unoptimized" | "optimized">("all");

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Modal / Detail state
  const [editingItem, setEditingItem] = useState<MasterProductItem | null>(null);
  const [modalShopeeName, setModalShopeeName] = useState("");
  const [modalShopeeDesc, setModalShopeeDesc] = useState("");
  const [modalKeywords, setModalKeywords] = useState<string[]>([]);
  const [modalHashtags, setModalHashtags] = useState<string[]>([]);
  const [modalOptimizing, setModalOptimizing] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalCopiedName, setModalCopiedName] = useState(false);
  const [modalCopiedDesc, setModalCopiedDesc] = useState(false);

  // Batch optimization state
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: "",
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [pr, bl, pd, bt] = await Promise.all([
        supabase
          .from("products")
          .select("*, blanks(*, blank_types(*)), print_designs(*)")
          .order("created_at", { ascending: false }),
        supabase.from("blanks").select("*, blank_types(*)").order("code"),
        supabase.from("print_designs").select("*").order("code"),
        supabase.from("blank_types").select("*").order("name"),
      ]);

      const rawProducts = (pr.data as Product[]) || [];
      const rawDesigns = (pd.data as PrintDesign[]) || [];
      const designMap = new Map<string, PrintDesign>();
      rawDesigns.forEach((d) => {
        if (d?.id) designMap.set(d.id, d);
      });

      const enrichedProducts = rawProducts.map((p) => {
        const designIds =
          p.print_design_ids && p.print_design_ids.length > 0
            ? p.print_design_ids
            : [p.print_design_id].filter(Boolean);
        const allDesigns = designIds.map((id) => (id ? designMap.get(id) : null)).filter(Boolean) as PrintDesign[];
        return {
          ...p,
          all_print_designs: allDesigns.length > 0 ? allDesigns : p.print_designs ? [p.print_designs] : [],
        };
      });

      setProducts(enrichedProducts);
      setBlanks((bl.data as Blank[]) || []);
      setDesigns(rawDesigns);
      setTypes((bt.data as BlankType[]) || []);
    } catch (err) {
      console.error("Error loading products for optimization:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Nhóm các biến thể thành Sản phẩm chung (Master Products)
  const masterGroups: MasterProductItem[] = useMemo(() => {
    const map = new Map<string, MasterProductItem>();

    products.forEach((p) => {
      const allDesigns = p.all_print_designs || (p.print_designs ? [p.print_designs] : []);
      const primaryDesign = allDesigns[0] || p.print_designs;
      const bType = p.blanks?.blank_types;

      const key = p.master_code || `${bType?.code || "BT"}-${primaryDesign?.code || "PD"}`;
      const existing = map.get(key);

      const color = p.blanks?.color || "Tiêu chuẩn";
      const size = p.blanks?.size || "Freesize";
      const price = Number(p.price) || 0;
      const isOpt = Boolean(p.is_optimized);

      if (!existing) {
        map.set(key, {
          key,
          master_code: p.master_code || key,
          master_name: p.master_name || p.name,
          shopee_name: p.shopee_name || null,
          shopee_description: p.shopee_description || null,
          is_optimized: isOpt,
          optimized_at: p.optimized_at || null,
          blank_type: bType,
          print_designs: allDesigns,
          colors: [color],
          sizes: [size],
          minPrice: price,
          maxPrice: price,
          preview_url: p.preview_url || p.blanks?.image_url || null,
          variantIds: [p.id],
          variants: [p],
        });
      } else {
        if (!existing.colors.includes(color)) existing.colors.push(color);
        if (!existing.sizes.includes(size)) existing.sizes.push(size);
        if (price < existing.minPrice) existing.minPrice = price;
        if (price > existing.maxPrice) existing.maxPrice = price;
        if (p.preview_url && !existing.preview_url) existing.preview_url = p.preview_url;
        if (isOpt) existing.is_optimized = true;
        if (p.shopee_name && !existing.shopee_name) existing.shopee_name = p.shopee_name;
        if (p.shopee_description && !existing.shopee_description) existing.shopee_description = p.shopee_description;
        if (p.optimized_at && !existing.optimized_at) existing.optimized_at = p.optimized_at;

        existing.variantIds.push(p.id);
        existing.variants.push(p);
      }
    });

    return Array.from(map.values());
  }, [products]);

  // Bộ lọc sản phẩm
  const filteredGroups = useMemo(() => {
    return masterGroups.filter((g) => {
      const matchesSearch =
        search === "" ||
        g.master_name.toLowerCase().includes(search.toLowerCase()) ||
        g.master_code.toLowerCase().includes(search.toLowerCase()) ||
        (g.shopee_name || "").toLowerCase().includes(search.toLowerCase()) ||
        g.print_designs.some((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()));

      const matchesType = !filterType || g.blank_type?.id === filterType;
      const matchesTheme = !filterTheme || g.print_designs.some((d) => d.theme === filterTheme);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "optimized" && g.is_optimized) ||
        (filterStatus === "unoptimized" && !g.is_optimized);

      return matchesSearch && matchesType && matchesTheme && matchesStatus;
    });
  }, [masterGroups, search, filterType, filterTheme, filterStatus]);

  // Thống kê
  const totalCount = masterGroups.length;
  const optimizedCount = masterGroups.filter((g) => g.is_optimized).length;
  const unoptimizedCount = totalCount - optimizedCount;

  const themes = useMemo(
    () => [...new Set(designs.map((d) => d.theme).filter(Boolean))] as string[],
    [designs]
  );

  // Toggle selection
  function toggleSelect(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleSelectAll() {
    if (selectedKeys.length === filteredGroups.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(filteredGroups.map((g) => g.key));
    }
  }

  // Mở modal chỉnh sửa chi tiết Shopee Content
  function openDetailModal(item: MasterProductItem) {
    setEditingItem(item);
    setModalShopeeName(item.shopee_name || item.master_name);
    setModalShopeeDesc(item.shopee_description || "");
    setModalKeywords([]);
    setModalHashtags([]);
  }

  // Chạy AI tối ưu cho 1 sản phẩm
  async function runSingleAiOptimize(item: MasterProductItem) {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      showToast("⚠️ Chưa có OpenAI API Key! Hãy vào Cài đặt -> AI OpenAI để cấu hình.");
      return;
    }

    try {
      setModalOptimizing(true);
      const res = await generateShopeeOptimization({
        masterName: item.master_name,
        masterCode: item.master_code,
        blankTypeName: item.blank_type?.name || "Áo Thun Cotton",
        designNames: item.print_designs.map((d) => d.name),
        designThemes: item.print_designs.map((d) => d.theme).filter(Boolean) as string[],
        colors: item.colors,
        sizes: item.sizes,
        price: item.minPrice,
      });

      setModalShopeeName(res.shopee_name);
      setModalShopeeDesc(res.shopee_description);
      setModalKeywords(res.keywords);
      setModalHashtags(res.hashtags);
      showToast("✨ Đã tạo xong Tên & Mô tả Shopee chuẩn SEO!");
    } catch (err) {
      alert(`Lỗi AI: ${(err as Error).message}`);
    } finally {
      setModalOptimizing(false);
    }
  }

  // Lưu nội dung Shopee vào database
  async function handleSaveShopeeContent() {
    if (!editingItem) return;

    setModalSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("products")
        .update({
          shopee_name: modalShopeeName.trim(),
          shopee_description: modalShopeeDesc.trim(),
          is_optimized: true,
          optimized_at: now,
        })
        .in("id", editingItem.variantIds);

      if (error) throw error;

      showToast("✅ Đã lưu và cập nhật trạng thái [ĐÃ TỐI ƯU] cho sản phẩm!");
      setEditingItem(null);
      await loadData();
    } catch (err) {
      alert(`Lỗi khi lưu: ${(err as Error).message}`);
    } finally {
      setModalSaving(false);
    }
  }

  // Tối ưu hàng loạt (Batch AI Optimize)
  async function runBatchOptimization() {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      showToast("⚠️ Chưa có OpenAI API Key! Hãy vào Cài đặt -> AI OpenAI để cấu hình.");
      return;
    }

    const itemsToOptimize = masterGroups.filter((g) => selectedKeys.includes(g.key));
    if (itemsToOptimize.length === 0) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn dùng AI OpenAI để tối ưu đồng loạt cho ${itemsToOptimize.length} sản phẩm chung đã chọn?`
    );
    if (!confirmed) return;

    setBatchRunning(true);
    let completed = 0;

    for (const item of itemsToOptimize) {
      setBatchProgress({
        current: completed + 1,
        total: itemsToOptimize.length,
        currentName: item.master_name,
      });

      try {
        const res = await generateShopeeOptimization({
          masterName: item.master_name,
          masterCode: item.master_code,
          blankTypeName: item.blank_type?.name || "Áo Thun Cotton",
          designNames: item.print_designs.map((d) => d.name),
          designThemes: item.print_designs.map((d) => d.theme).filter(Boolean) as string[],
          colors: item.colors,
          sizes: item.sizes,
          price: item.minPrice,
        });

        const now = new Date().toISOString();
        await supabase
          .from("products")
          .update({
            shopee_name: res.shopee_name.trim(),
            shopee_description: res.shopee_description.trim(),
            is_optimized: true,
            optimized_at: now,
          })
          .in("id", item.variantIds);
      } catch (err) {
        console.error(`Lỗi tối ưu SP ${item.master_code}:`, err);
      }

      completed++;
    }

    setBatchRunning(false);
    showToast(`🎉 Đã tối ưu AI thành công cho ${completed}/${itemsToOptimize.length} sản phẩm!`);
    setSelectedKeys([]);
    await loadData();
  }

  // Xuất file CSV / Excel Shopee
  function exportShopeeCsv() {
    const itemsToExport = masterGroups.filter(
      (g) => selectedKeys.length === 0 || selectedKeys.includes(g.key)
    );

    if (itemsToExport.length === 0) {
      showToast("Không có sản phẩm nào để xuất.");
      return;
    }

    const headers = ["Mã sản phẩm", "Tên sản phẩm gốc", "Tên Shopee chuẩn SEO", "Loại phôi", "Giá bán (VND)", "Trạng thái tối ưu", "Mô tả Shopee"];
    const rows = itemsToExport.map((g) => [
      `"${g.master_code.replace(/"/g, '""')}"`,
      `"${g.master_name.replace(/"/g, '""')}"`,
      `"${(g.shopee_name || g.master_name).replace(/"/g, '""')}"`,
      `"${(g.blank_type?.name || "").replace(/"/g, '""')}"`,
      `"${g.minPrice}"`,
      `"${g.is_optimized ? "Đã tối ưu" : "Chưa tối ưu"}"`,
      `"${(g.shopee_description || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Shopee_Products_Optimized_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Đã xuất file CSV Shopee thành công!");
  }

  return (
    <div className="space-y-4 animate-fade-in text-xs sm:text-sm">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-3.5 px-5 rounded-2xl bg-brand-500 text-white font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Tối ưu Sản phẩm Shopee (AI)"
        subtitle="Sử dụng OpenAI AI để tự động tạo Tên sản phẩm chuẩn SEO và Mô tả bán hàng thu hút cho Shopee"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings size={15} className="text-brand-400" />
                <span>Cài đặt OpenAI API Key</span>
              </button>
            )}
            <button
              type="button"
              onClick={exportShopeeCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={15} />
              <span>Xuất CSV Shopee</span>
            </button>
          </div>
        }
      />

      {/* Thẻ Thống kê & Tab Trạng thái */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === "all"
              ? "bg-brand-500/10 border-brand-500/40 shadow-lg shadow-brand-500/10"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-xs uppercase tracking-wider">Tổng sản phẩm</span>
            <Boxes size={18} className="text-brand-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{totalCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Sản phẩm chung trong hệ thống</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus("unoptimized")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === "unoptimized"
              ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-xs uppercase tracking-wider text-amber-300">⚡ Chưa tối ưu Shopee</span>
            <AlertCircle size={18} className="text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-400 mt-1">{unoptimizedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Cần chạy AI tạo Tên & Mô tả</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus("optimized")}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === "optimized"
              ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-xs uppercase tracking-wider text-emerald-300">✅ Đã tối ưu Shopee</span>
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{optimizedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Đã sẵn sàng đăng sàn Shopee</p>
        </button>
      </div>

      {/* Thanh Tìm kiếm & Bộ lọc */}
      <div className="card-gradient rounded-2xl border border-slate-700/50 p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-6">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Tìm theo tên sản phẩm, mã SP, tên Shopee, tên hình in..."
            />
          </div>
          <div className="sm:col-span-3">
            <Select
              label=""
              value={filterType}
              onChange={setFilterType}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Tất cả loại phôi"
            />
          </div>
          <div className="sm:col-span-3">
            <Select
              label=""
              value={filterTheme}
              onChange={setFilterTheme}
              options={themes.map((t) => ({ value: t, label: t }))}
              placeholder="Tất cả chủ đề"
            />
          </div>
        </div>

        {/* Thanh tác vụ hàng loạt khi có chọn sản phẩm */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              {selectedKeys.length === filteredGroups.length && filteredGroups.length > 0 ? (
                <CheckSquare size={14} className="text-brand-400" />
              ) : (
                <Square size={14} className="text-slate-400" />
              )}
              <span>{selectedKeys.length === filteredGroups.length && filteredGroups.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span>
            </button>

            {selectedKeys.length > 0 && (
              <span className="text-xs font-semibold text-brand-400">
                Đã chọn ({selectedKeys.length}/{filteredGroups.length} SP)
              </span>
            )}
          </div>

          {selectedKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runBatchOptimization}
                disabled={batchRunning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 hover:from-brand-600 hover:to-violet-700 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {batchRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>⚡ Tối ưu AI cho {selectedKeys.length} sản phẩm đã chọn</span>
              </button>
            </div>
          )}
        </div>

        {/* Thanh tiến trình Batch Running */}
        {batchRunning && (
          <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs text-brand-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Đang chạy AI tối ưu hàng loạt: {batchProgress.current}/{batchProgress.total} sản phẩm
              </span>
              <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-all duration-300 rounded-full"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 truncate">Đang xử lý: {batchProgress.currentName}</p>
          </div>
        )}
      </div>

      {/* Danh sách Sản phẩm */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-600" size={32} />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-8 text-center">
          <EmptyState message="Không tìm thấy sản phẩm nào phù hợp với bộ lọc." />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isSelected = selectedKeys.includes(group.key);
            const shopeeNameLength = (group.shopee_name || "").length;

            return (
              <div
                key={group.key}
                className={`card-gradient rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 shadow-md hover:shadow-lg flex flex-col md:flex-row gap-3.5 sm:gap-4 items-start md:items-center justify-between group ${
                  isSelected ? "border-brand-500/60 bg-brand-500/5" : "border-slate-700/50 hover:border-slate-600"
                }`}
              >
                {/* Checkbox & Thumbnail & Master Info */}
                <div className="flex gap-3 sm:gap-4 items-start min-w-0 flex-1 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => toggleSelect(group.key)}
                    className="p-1 rounded-md text-slate-400 hover:text-brand-400 transition-colors mt-1 cursor-pointer"
                  >
                    {isSelected ? <CheckSquare size={18} className="text-brand-400" /> : <Square size={18} />}
                  </button>

                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-800/80 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center">
                    {group.preview_url ? (
                      <img src={group.preview_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Boxes size={22} className="text-slate-600" />
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {group.master_code}
                      </span>
                      {group.blank_type && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/50">
                          {group.blank_type.name}
                        </span>
                      )}
                      {group.is_optimized ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 size={11} /> ĐÃ TỐI ƯU SHOPEE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <AlertCircle size={11} /> CHƯA TỐI ƯU
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug">
                      {group.master_name}
                    </h3>

                    {/* Khung Tên Shopee đã tối ưu */}
                    {group.shopee_name ? (
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-emerald-400 flex items-center gap-1">
                            <ShoppingBag size={11} /> Tên chuẩn SEO Shopee:
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              shopeeNameLength >= 80 && shopeeNameLength <= 120
                                ? "text-emerald-400"
                                : shopeeNameLength > 120
                                ? "text-rose-400"
                                : "text-amber-400"
                            }`}
                          >
                            {shopeeNameLength}/120 ký tự
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed">
                          {group.shopee_name}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        💡 Chưa có Tên & Mô tả Shopee. Hãy bấm "⚡ Tối ưu AI" để tự động tạo.
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      openDetailModal(group);
                      runSingleAiOptimize(group);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>{group.is_optimized ? "Tối ưu lại AI" : "⚡ Tối ưu AI"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openDetailModal(group)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>Xem & Sửa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CHI TIẾT & CHỈNH SỬA SHOPEE CONTENT */}
      {editingItem && (
        <Modal open={true} onClose={() => setEditingItem(null)} title="Tối ưu Nội dung Shopee bằng AI" size="xl">
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-brand-400">{editingItem.master_code}</span>
                <h4 className="text-sm font-bold text-slate-100">{editingItem.master_name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Phôi: <strong>{editingItem.blank_type?.name}</strong> • {editingItem.colors.length} màu • {editingItem.sizes.length} size
                </p>
              </div>

              <button
                type="button"
                onClick={() => runSingleAiOptimize(editingItem)}
                disabled={modalOptimizing}
                className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {modalOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{modalOptimizing ? "Đang viết..." : "⚡ Sinh lại bằng AI"}</span>
              </button>
            </div>

            {/* Ô Tên Shopee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-200 flex items-center gap-1">
                  <ShoppingBag size={14} className="text-emerald-400" /> Tên sản phẩm Shopee (Chuẩn SEO):
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      modalShopeeName.length >= 80 && modalShopeeName.length <= 120
                        ? "text-emerald-400"
                        : modalShopeeName.length > 120
                        ? "text-rose-400"
                        : "text-amber-400"
                    }`}
                  >
                    {modalShopeeName.length}/120 ký tự
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(modalShopeeName);
                      setModalCopiedName(true);
                      setTimeout(() => setModalCopiedName(false), 2000);
                    }}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 px-2 text-[10px] font-semibold cursor-pointer"
                  >
                    {modalCopiedName ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{modalCopiedName ? "Đã copy" : "Copy tên"}</span>
                  </button>
                </div>
              </div>
              <textarea
                value={modalShopeeName}
                onChange={(e) => setModalShopeeName(e.target.value)}
                rows={2}
                placeholder="Nhập tên sản phẩm chuẩn SEO Shopee..."
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 text-xs font-medium outline-none focus:border-brand-500 custom-scrollbar"
              />
            </div>

            {/* Ô Mô tả Shopee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-200 flex items-center gap-1">
                  <FileText size={14} className="text-indigo-400" /> Mô tả sản phẩm chi tiết Shopee:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(modalShopeeDesc);
                    setModalCopiedDesc(true);
                    setTimeout(() => setModalCopiedDesc(false), 2000);
                  }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 px-2 text-[10px] font-semibold cursor-pointer"
                >
                  {modalCopiedDesc ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{modalCopiedDesc ? "Đã copy" : "Copy mô tả"}</span>
                </button>
              </div>
              <textarea
                value={modalShopeeDesc}
                onChange={(e) => setModalShopeeDesc(e.target.value)}
                rows={10}
                placeholder="Nội dung mô tả sản phẩm sẽ hiển thị tại đây sau khi AI xử lý..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 text-xs leading-relaxed outline-none focus:border-brand-500 custom-scrollbar font-mono"
              />
            </div>

            {/* Gợi ý Hashtags & Keywords */}
            {(modalHashtags.length > 0 || modalKeywords.length > 0) && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                {modalHashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="font-bold text-slate-400 text-[10px] mr-1">Hashtags:</span>
                    {modalHashtags.map((h, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-mono text-[10px]">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
                {modalKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="font-bold text-slate-400 text-[10px] mr-1">Từ khóa SEO:</span>
                    {modalKeywords.map((k, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Buttons Lưu & Đóng */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSaveShopeeContent}
                disabled={modalSaving}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                {modalSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Lưu & Đánh dấu [Đã tối ưu]</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
