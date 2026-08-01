import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Field";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Boxes,
  Eye,
  Layers as LayersIcon,
  Sparkles,
  Filter,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video,
  Upload,
  X,
  Play,
  Layers,
  LayoutGrid,
  List,
} from "lucide-react";
import { formatCurrency, uploadFile } from "@/lib/helpers";

export interface MasterProductGroup {
  key: string;
  master_code: string;
  master_name: string;
  images: string[];
  video_url: string | null;
  blank_type?: BlankType;
  print_design?: PrintDesign;
  variants: Product[];
  minPrice: number;
  maxPrice: number;
}

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [designs, setDesigns] = useState<PrintDesign[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  const [createModal, setCreateModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<Product | null>(null);
  const [previewGroup, setPreviewGroup] = useState<MasterProductGroup | null>(null);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [editMasterGroup, setEditMasterGroup] = useState<MasterProductGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pr, bl, pd, bt] = await Promise.all([
      supabase
        .from("products")
        .select("*, blanks(*, blank_types(*)), print_designs(*)")
        .order("created_at", { ascending: false }),
      supabase.from("blanks").select("*, blank_types(*)").order("code"),
      supabase.from("print_designs").select("*").order("code"),
      supabase.from("blank_types").select("*").order("name"),
    ]);
    setItems((pr.data as Product[]) || []);
    setBlanks((bl.data as Blank[]) || []);
    setDesigns((pd.data as PrintDesign[]) || []);
    setTypes((bt.data as BlankType[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const colors = useMemo(
    () => [...new Set(blanks.map((b) => b.color))].sort(),
    [blanks]
  );
  const sizes = useMemo(
    () => [...new Set(blanks.map((b) => b.size))].sort(),
    [blanks]
  );
  const themes = useMemo(
    () => [...new Set(designs.map((d) => d.theme).filter(Boolean))] as string[],
    [designs]
  );

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const blank = p.blanks;
      const design = p.print_designs;
      const matchSearch =
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.master_code || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.master_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (blank?.color || "").toLowerCase().includes(search.toLowerCase()) ||
        (blank?.size || "").toLowerCase().includes(search.toLowerCase()) ||
        (design?.code || "").toLowerCase().includes(search.toLowerCase()) ||
        (design?.theme || "").toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || blank?.blank_type_id === filterType;
      const matchColor = !filterColor || blank?.color === filterColor;
      const matchSize = !filterSize || blank?.size === filterSize;
      const matchTheme = !filterTheme || design?.theme === filterTheme;
      const matchStatus = !filterStatus || p.status === filterStatus;
      return matchSearch && matchType && matchColor && matchSize && matchTheme && matchStatus;
    });
  }, [items, search, filterType, filterColor, filterSize, filterTheme, filterStatus]);

  // Group products into Master Product Groups
  const masterGroups = useMemo(() => {
    const map = new Map<string, MasterProductGroup>();

    filtered.forEach((p) => {
      const blankType = p.blanks?.blank_types;
      const design = p.print_designs;
      const key = p.master_code
        ? p.master_code
        : `${p.blanks?.blank_type_id || "type"}_${p.print_design_id || "design"}`;

      if (!map.has(key)) {
        const fallbackName = p.master_name
          ? p.master_name
          : `${blankType?.name || "Sản phẩm"} - ${design?.name || "Hình in"}`;
        const fallbackCode = p.master_code
          ? p.master_code
          : `${blankType?.code || "SP"}-${design?.code || "PRINT"}`;

        map.set(key, {
          key,
          master_code: fallbackCode,
          master_name: fallbackName,
          images: p.images || [],
          video_url: p.video_url || null,
          blank_type: blankType,
          print_design: design,
          variants: [p],
          minPrice: Number(p.price) || 0,
          maxPrice: Number(p.price) || 0,
        });
      } else {
        const group = map.get(key)!;
        group.variants.push(p);
        const price = Number(p.price) || 0;
        if (price < group.minPrice) group.minPrice = price;
        if (price > group.maxPrice) group.maxPrice = price;
        if (!group.video_url && p.video_url) group.video_url = p.video_url;
        if ((!group.images || group.images.length === 0) && p.images && p.images.length > 0) {
          group.images = p.images;
        }
      }
    });

    return Array.from(map.values());
  }, [filtered]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openEditVariant(p: Product) {
    setEditItem(p);
    setEditPrice(String(p.price));
    setEditStatus(p.status);
    setError(null);
  }

  async function handleSaveVariantEdit() {
    if (!editItem) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from("products")
        .update({ price: Number(editPrice) || 0, status: editStatus })
        .eq("id", editItem.id);
      if (error) throw error;
      setEditItem(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVariant(p: Product) {
    if (!confirm(`Xóa biến thể "${p.code}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  async function handleDeleteMasterGroup(group: MasterProductGroup) {
    if (!confirm(`Xóa sản phẩm chung "${group.master_name}" cùng toàn bộ ${group.variants.length} biến thể?`)) return;
    const ids = group.variants.map((v) => v.id);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  const hasFilters = filterType || filterColor || filterSize || filterTheme || filterStatus;

  return (
    <div className="animate-fade-in space-y-4 sm:space-y-5">
      <PageHeader
        title="Sản phẩm & Biến thể"
        subtitle="Quản lý sản phẩm chung, tạo biến thể tự động từ phôi + hình in, album ảnh & video"
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã, tên, màu, size..." />
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors ${
                  showFilters || hasFilters
                    ? "border-brand-500/30 bg-brand-500/10 text-brand-400"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Filter size={15} /> Lọc
              </button>
              
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
                <button
                  onClick={() => setViewMode("grouped")}
                  className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === "grouped"
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Xem theo sản phẩm chung"
                >
                  <LayoutGrid size={14} /> <span className="hidden sm:inline">Nhóm SP</span>
                </button>
                <button
                  onClick={() => setViewMode("flat")}
                  className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === "flat"
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Xem tất cả biến thể"
                >
                  <List size={14} /> <span className="hidden sm:inline">Biến thể</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setCreateModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl bg-brand-500 text-white text-xs sm:text-sm font-semibold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus size={17} /> Tạo sản phẩm chung
            </button>
          </div>
        }
      />

      {showFilters && (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <Select label="Loại phôi" value={filterType} onChange={setFilterType}
            options={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="Tất cả" />
          <Select label="Màu" value={filterColor} onChange={setFilterColor}
            options={colors.map((c) => ({ value: c, label: c }))} placeholder="Tất cả" />
          <Select label="Size" value={filterSize} onChange={setFilterSize}
            options={sizes.map((s) => ({ value: s, label: s }))} placeholder="Tất cả" />
          <Select label="Chủ đề" value={filterTheme} onChange={setFilterTheme}
            options={themes.map((t) => ({ value: t, label: t }))} placeholder="Tất cả" />
          <Select label="Trạng thái" value={filterStatus} onChange={setFilterStatus}
            options={[{ value: "active", label: "Đang bán" }, { value: "inactive", label: "Tạm dừng" }]}
            placeholder="Tất cả" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden">
          <EmptyState message="Chưa có sản phẩm nào. Tạo sản phẩm chung mới để bắt đầu." />
        </div>
      ) : viewMode === "grouped" ? (
        /* Grouped Master Product View */
        <div className="space-y-3.5 sm:space-y-4">
          {masterGroups.map((group) => {
            const isExpanded = expandedGroups[group.key] ?? true;
            const mainImage =
              group.images && group.images.length > 0
                ? group.images[0]
                : group.variants[0]?.blanks?.image_url || null;
            const printPng = group.print_design?.png_url;

            return (
              <div
                key={group.key}
                className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg transition-all"
              >
                {/* Master Product Header Card */}
                <div className="p-3.5 sm:p-5 flex flex-col md:flex-row gap-3.5 sm:gap-5 items-start md:items-center justify-between border-b border-slate-800/80">
                  <div className="flex gap-3 sm:gap-4 items-start sm:items-center w-full md:w-auto">
                    {/* Media Preview Box */}
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center">
                      {mainImage ? (
                        <img src={mainImage} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Boxes size={24} className="text-slate-600" />
                      )}
                      {printPng && (
                        <img
                          src={printPng}
                          alt=""
                          className="absolute w-[60%] h-[60%] object-contain pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                      )}
                      {group.images && group.images.length > 1 && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] sm:text-[10px] font-medium text-white flex items-center gap-0.5">
                          <ImageIcon size={9} /> +{group.images.length - 1}
                        </span>
                      )}
                      {group.video_url && (
                        <span className="absolute top-1 left-1 p-0.5 sm:p-1 rounded-full bg-brand-500/80 text-white">
                          <Play size={9} className="fill-white" />
                        </span>
                      )}
                    </div>

                    {/* Master Info */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {group.master_code}
                        </span>
                        {group.blank_type && (
                          <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50 truncate max-w-[120px] sm:max-w-none">
                            Phôi: {group.blank_type.name}
                          </span>
                        )}
                        {group.print_design && (
                          <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50 truncate max-w-[120px] sm:max-w-none">
                            Hình in: {group.print_design.name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-100 leading-snug truncate">
                        {group.master_name}
                      </h3>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 pt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs sm:text-sm">
                          {group.minPrice === group.maxPrice
                            ? formatCurrency(group.minPrice)
                            : `${formatCurrency(group.minPrice)} - ${formatCurrency(group.maxPrice)}`}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px] font-medium">
                          {group.variants.length} biến thể
                        </span>
                        {group.video_url && (
                          <span className="text-indigo-400 flex items-center gap-1 text-[11px]">
                            <Video size={12} /> Video
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Accordion Button (Mobile Friendly) */}
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-between md:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <button
                        onClick={() => setPreviewGroup(group)}
                        className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-xs font-medium flex items-center gap-1 border border-slate-700/50"
                        title="Xem album media"
                      >
                        <Eye size={14} /> Media ({group.images?.length || 0})
                      </button>
                      <button
                        onClick={() => setEditMasterGroup(group)}
                        className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-medium flex items-center gap-1 border border-amber-500/20"
                        title="Sửa sản phẩm chung"
                      >
                        <Pencil size={14} /> <span className="hidden sm:inline">Sửa SP</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMasterGroup(group)}
                        className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors border border-slate-700/50"
                        title="Xóa nhóm sản phẩm này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700/60"
                    >
                      {isExpanded ? (
                        <>
                          Thu gọn <ChevronUp size={15} />
                        </>
                      ) : (
                        <>
                          Biến thể ({group.variants.length}) <ChevronDown size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Variants Table */}
                {isExpanded && (
                  <div className="bg-slate-950/30 overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[600px] sm:min-w-full">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase font-medium bg-slate-900/40">
                          <th className="px-3.5 sm:px-5 py-2.5">Mã biến thể</th>
                          <th className="px-3.5 sm:px-5 py-2.5">Màu sắc</th>
                          <th className="px-3.5 sm:px-5 py-2.5">Kích thước</th>
                          <th className="px-3.5 sm:px-5 py-2.5 text-right">Giá phôi</th>
                          <th className="px-3.5 sm:px-5 py-2.5 text-right">Giá bán</th>
                          <th className="px-3.5 sm:px-5 py-2.5 text-center">Trạng thái</th>
                          <th className="px-3.5 sm:px-5 py-2.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {group.variants.map((v) => {
                          const blank = v.blanks;
                          return (
                            <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-3.5 sm:px-5 py-2.5 font-mono text-brand-400 font-medium whitespace-nowrap">
                                {v.code}
                              </td>
                              <td className="px-3.5 sm:px-5 py-2.5 text-slate-200 font-medium">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                  {blank?.color || "-"}
                                </span>
                              </td>
                              <td className="px-3.5 sm:px-5 py-2.5 text-slate-200 font-medium">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                  {blank?.size || "-"}
                                </span>
                              </td>
                              <td className="px-3.5 sm:px-5 py-2.5 text-right text-slate-400 font-mono whitespace-nowrap">
                                {formatCurrency(Number(blank?.price || 0))}
                              </td>
                              <td className="px-3.5 sm:px-5 py-2.5 text-right text-slate-100 font-bold font-mono whitespace-nowrap">
                                {formatCurrency(Number(v.price))}
                              </td>
                              <td className="px-3.5 sm:px-5 py-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                    v.status === "active"
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-slate-800 text-slate-400 border border-slate-700"
                                  }`}
                                >
                                  {v.status === "active" ? "Đang bán" : "Tạm dừng"}
                                </span>
                              </td>
                              <td className="px-3.5 sm:px-5 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setPreviewItem(v)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10"
                                    title="Xem preview biến thể"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => openEditVariant(v)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                                    title="Sửa giá / trạng thái"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVariant(v)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                    title="Xóa biến thể này"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Table View for all variants */
        <div className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[650px] sm:min-w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30 text-xs text-slate-400 uppercase">
                  <th className="text-left font-semibold px-4 sm:px-5 py-3">Mã Biến thể</th>
                  <th className="text-left font-semibold px-4 sm:px-5 py-3">Sản phẩm chung</th>
                  <th className="text-left font-semibold px-4 sm:px-5 py-3">Màu / Size</th>
                  <th className="text-left font-semibold px-4 sm:px-5 py-3 hidden md:table-cell">Hình in</th>
                  <th className="text-right font-semibold px-4 sm:px-5 py-3">Giá</th>
                  <th className="text-center font-semibold px-4 sm:px-5 py-3">Trạng thái</th>
                  <th className="text-right font-semibold px-4 sm:px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 sm:px-5 py-3">
                      <span className="font-mono text-xs font-medium text-brand-400">{p.code}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <span className="text-xs sm:text-sm font-medium text-slate-200">{p.master_name || p.name}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <span className="text-xs text-slate-400">
                        {p.blanks?.color} - {p.blanks?.size}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 hidden md:table-cell">
                      <span className="text-xs text-slate-400">{p.print_designs?.code} — {p.print_designs?.name}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <span className="text-xs sm:text-sm font-bold text-slate-200">{formatCurrency(Number(p.price))}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        p.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/50 text-slate-400"
                      }`}>
                        {p.status === "active" ? "Đang bán" : "Tạm dừng"}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreviewItem(p)} className="p-1.5 rounded-lg text-slate-500 hover:bg-brand-500/10 hover:text-brand-400" title="Xem preview">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => openEditVariant(p)} className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-500/10 hover:text-amber-400" title="Sửa">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDeleteVariant(p)} className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" title="Xóa">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Master Product Creation Modal */}
      <CreateMasterProductModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        blanks={blanks}
        designs={designs}
        types={types}
        onCreated={load}
      />

      {/* Master Product Edit Modal */}
      {editMasterGroup && (
        <EditMasterProductGroupModal
          group={editMasterGroup}
          onClose={() => setEditMasterGroup(null)}
          onSaved={load}
        />
      )}

      {/* Single Variant Preview Modal */}
      <Modal open={!!previewItem} onClose={() => setPreviewItem(null)} title="Xem trước biến thể" size="lg">
        {previewItem && <ProductPreview product={previewItem} />}
      </Modal>

      {/* Master Group Media Preview Modal */}
      {previewGroup && (
        <MasterGroupMediaModal group={previewGroup} onClose={() => setPreviewGroup(null)} />
      )}

      {/* Edit Single Variant Price & Status Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Sửa thông tin biến thể">
        {editItem && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs">
              <p className="text-slate-500">Mã biến thể</p>
              <p className="font-mono text-sm font-semibold text-brand-400">{editItem.code}</p>
              <p className="text-slate-300 mt-1">{editItem.name}</p>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">Giá bán (VND)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <Select label="Trạng thái" value={editStatus} onChange={setEditStatus}
              options={[{ value: "active", label: "Đang bán" }, { value: "inactive", label: "Tạm dừng" }]} />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex gap-2.5 pt-2">
              <button onClick={() => setEditItem(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800">Hủy</button>
              <button onClick={handleSaveVariantEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />} Lưu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface VariantSelectionItem {
  blank_id: string;
  code: string;
  color: string;
  size: string;
  blank_code: string;
  blank_price: number;
  blank_image: string | null;
  price: string;
  selected: boolean;
}

/* Modal Tạo Sản Phẩm Chung & Tự Động Sinh Biến Thể có Checkbox */
function CreateMasterProductModal({
  open,
  onClose,
  blanks,
  designs,
  types,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  blanks: Blank[];
  designs: PrintDesign[];
  types: BlankType[];
  onCreated: () => void;
}) {
  const [masterName, setMasterName] = useState("");
  const [masterCode, setMasterCode] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("250000");
  const [blankTypeId, setBlankTypeId] = useState("");
  const [printDesignId, setPrintDesignId] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [variantItems, setVariantItems] = useState<VariantSelectionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBlankType = types.find((t) => t.id === blankTypeId);
  const selectedDesign = designs.find((d) => d.id === printDesignId);

  // Auto populate master code recommendation when name changes
  useEffect(() => {
    if (masterName && !masterCode) {
      const codeSuggestion = "SP-" + masterName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").slice(0, 10);
      setMasterCode(codeSuggestion);
    }
  }, [masterName]);

  // When Blank Type or Print Design changes, auto generate variants from blanks under that Blank Type
  useEffect(() => {
    if (!blankTypeId || !selectedDesign) {
      setVariantItems([]);
      return;
    }

    const availableBlanks = blanks.filter((b) => b.blank_type_id === blankTypeId);

    const generated: VariantSelectionItem[] = availableBlanks.map((b) => {
      const basePrefix = masterCode.trim() || selectedBlankType?.code || "SP";
      const vCode = `${basePrefix}-${b.color}-${b.size}-${selectedDesign.code}`;
      return {
        blank_id: b.id,
        code: vCode,
        color: b.color,
        size: b.size,
        blank_code: b.code,
        blank_price: Number(b.price) || 0,
        blank_image: b.image_url,
        price: defaultPrice || String(b.price || 0),
        selected: true,
      };
    });

    setVariantItems(generated);
  }, [blankTypeId, printDesignId, masterCode, defaultPrice, blanks, selectedDesign, selectedBlankType]);

  // Handle file uploads for gallery images
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i], "products/images");
        if (url) uploadedUrls.push(url);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      alert("Lỗi tải lên hình ảnh: " + (err as Error).message);
    } finally {
      setUploadingMedia(false);
    }
  }

  // Handle video upload
  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const url = await uploadFile(file, "products/videos");
      if (url) setVideoUrl(url);
    } catch (err) {
      alert("Lỗi tải lên video: " + (err as Error).message);
    } finally {
      setUploadingMedia(false);
    }
  }

  function addImageUrl() {
    if (!imageUrlInput.trim()) return;
    setImages((prev) => [...prev, imageUrlInput.trim()]);
    setImageUrlInput("");
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleAllVariants(check: boolean) {
    setVariantItems((prev) => prev.map((v) => ({ ...v, selected: check })));
  }

  function toggleVariantItem(blankId: string) {
    setVariantItems((prev) =>
      prev.map((v) => (v.blank_id === blankId ? { ...v, selected: !v.selected } : v))
    );
  }

  function updateVariantPrice(blankId: string, val: string) {
    setVariantItems((prev) =>
      prev.map((v) => (v.blank_id === blankId ? { ...v, price: val } : v))
    );
  }

  const selectedCount = variantItems.filter((v) => v.selected).length;

  async function handleCreateMasterProduct() {
    setError(null);
    if (!masterName.trim()) {
      setError("Vui lòng nhập tên sản phẩm chung.");
      return;
    }
    if (!blankTypeId || !printDesignId) {
      setError("Vui lòng chọn Loại phôi và Hình in.");
      return;
    }
    const toCreate = variantItems.filter((v) => v.selected);
    if (toCreate.length === 0) {
      setError("Vui lòng tích chọn ít nhất 1 biến thể để tạo.");
      return;
    }

    setSaving(true);
    try {
      const rows = toCreate.map((v) => ({
        master_name: masterName.trim(),
        master_code: masterCode.trim() || `${selectedBlankType?.code}-${selectedDesign?.code}`,
        code: v.code,
        name: `${masterName.trim()} (${v.color} ${v.size})`,
        blank_id: v.blank_id,
        print_design_id: printDesignId,
        price: Number(v.price) || 0,
        images: images,
        video_url: videoUrl.trim() || null,
        status: "active",
      }));

      const { error: insertErr } = await supabase.from("products").insert(rows);
      if (insertErr) {
        if (insertErr.code === "23505") {
          setError("Mã sản phẩm hoặc biến thể bị trùng lặp trong hệ thống.");
        } else {
          throw insertErr;
        }
        return;
      }

      onClose();
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo sản phẩm chung & các Biến thể" size="2xl">
      <div className="space-y-4 sm:space-y-5">
        {/* Step 1: Base Product Info & Media */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sparkles size={16} className="text-brand-400 shrink-0" />
            <h4 className="text-xs sm:text-sm font-semibold text-slate-200">1. Thông tin Sản phẩm chung & Media</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tên sản phẩm chung <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder="VD: Áo T-Shirt Oversize Graphic Vintage"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 text-xs sm:text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Mã sản phẩm chung (Prefix)
              </label>
              <input
                type="text"
                value={masterCode}
                onChange={(e) => setMasterCode(e.target.value)}
                placeholder="VD: SP-SKULL-01"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 text-xs sm:text-sm font-mono outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              label="Chọn Loại Phôi *"
              value={blankTypeId}
              onChange={setBlankTypeId}
              options={types.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
              placeholder="-- Chọn loại phôi --"
            />
            <Select
              label="Chọn Hình In *"
              value={printDesignId}
              onChange={setPrintDesignId}
              options={designs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
              placeholder="-- Chọn hình in --"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Giá bán mặc định (VND)</label>
            <input
              type="number"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              placeholder="250000"
              className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 text-xs sm:text-sm outline-none focus:border-brand-500"
            />
          </div>

          {/* Media upload: Gallery Images */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-medium text-slate-300">
              Album Hình ảnh sản phẩm (Nhiều ảnh)
            </label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden group">
                  <img src={img} alt="" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 p-1 rounded-full bg-rose-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              <label className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 border-dashed border-slate-700 hover:border-brand-500 bg-slate-800/40 flex flex-col items-center justify-center text-slate-400 hover:text-brand-400 cursor-pointer transition-colors shrink-0">
                <Upload size={16} />
                <span className="text-[10px] mt-0.5">Tải ảnh</span>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </label>

              <div className="flex-1 flex gap-1.5 min-w-[180px] w-full sm:w-auto">
                <input
                  type="text"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Dán URL ảnh..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-200 outline-none"
                />
                <button
                  type="button"
                  onClick={addImageUrl}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 shrink-0"
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>

          {/* Media upload: Video */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-medium text-slate-300">Video giới thiệu sản phẩm</label>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Nhập URL video (.mp4, youtube embed...)"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-200 outline-none"
              />
              <label className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                <Video size={14} /> Tải Video
                <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
              </label>
            </div>
          </div>
          {uploadingMedia && (
            <p className="text-xs text-brand-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Đang tải file phương tiện lên...
            </p>
          )}
        </div>

        {/* Step 2: Auto Generated Variant Table */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-brand-400 shrink-0" />
              <h4 className="text-xs sm:text-sm font-semibold text-slate-200">
                2. Danh sách biến thể tự động từ Phôi & Hình in
              </h4>
            </div>
            {variantItems.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">
                  Đã chọn: <strong className="text-brand-400">{selectedCount}</strong> / {variantItems.length}
                </span>
                <button
                  type="button"
                  onClick={() => toggleAllVariants(true)}
                  className="text-brand-400 hover:underline font-medium"
                >
                  Chọn tất cả
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => toggleAllVariants(false)}
                  className="text-slate-400 hover:underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            )}
          </div>

          {!blankTypeId || !printDesignId ? (
            <div className="py-6 sm:py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl px-3">
              Vui lòng chọn <strong>Loại phôi</strong> và <strong>Hình in</strong> ở trên để hiển thị danh sách biến thể.
            </div>
          ) : variantItems.length === 0 ? (
            <div className="py-6 sm:py-8 text-center text-xs text-amber-400/90 border border-dashed border-amber-500/20 bg-amber-500/5 rounded-xl px-3">
              Chưa tìm thấy phôi nào thuộc loại <strong>"{selectedBlankType?.name}"</strong>. Bạn hãy vào mục <strong>Quản lý Phôi</strong> để thêm phôi màu & size trước.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left min-w-[500px] sm:min-w-full">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-2.5 py-2 text-center w-10">Tích</th>
                    <th className="px-2.5 py-2">Mã biến thể</th>
                    <th className="px-2.5 py-2">Màu sắc</th>
                    <th className="px-2.5 py-2">Size</th>
                    <th className="px-2.5 py-2 text-right">Giá phôi</th>
                    <th className="px-2.5 py-2 w-28 sm:w-32">Giá bán biến thể</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                  {variantItems.map((v) => (
                    <tr
                      key={v.blank_id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        v.selected ? "bg-brand-500/5" : "opacity-50"
                      }`}
                    >
                      <td className="px-2.5 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={v.selected}
                          onChange={() => toggleVariantItem(v.blank_id)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-500 focus:ring-brand-500/20 bg-slate-800 cursor-pointer"
                        />
                      </td>
                      <td className="px-2.5 py-2 font-mono font-medium text-brand-400 whitespace-nowrap">
                        {v.code}
                      </td>
                      <td className="px-2.5 py-2 font-medium text-slate-200">
                        <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
                          {v.color}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 font-medium text-slate-200">
                        <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
                          {v.size}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right text-slate-400 font-mono whitespace-nowrap">
                        {formatCurrency(v.blank_price)}
                      </td>
                      <td className="px-2.5 py-2">
                        <input
                          type="number"
                          value={v.price}
                          onChange={(e) => updateVariantPrice(v.blank_id, e.target.value)}
                          className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-right text-slate-100 font-bold focus:border-brand-500 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-rose-400 font-medium px-1">{error}</p>}

        {/* Modal footer buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm font-medium hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleCreateMasterProduct}
            disabled={saving || selectedCount === 0}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-xs sm:text-sm font-semibold hover:bg-brand-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Tạo {selectedCount > 0 ? `${selectedCount} ` : ""}Sản Phẩm & Biến Thể
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* Modal Chỉnh Sửa Thông Tin Sản Phẩm Chung */
function EditMasterProductGroupModal({
  group,
  onClose,
  onSaved,
}: {
  group: MasterProductGroup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [masterName, setMasterName] = useState(group.master_name);
  const [masterCode, setMasterCode] = useState(group.master_code);
  const [images, setImages] = useState<string[]>(group.images || []);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [videoUrl, setVideoUrl] = useState(group.video_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!masterName.trim()) {
      setError("Tên sản phẩm chung không được để trống.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const variantIds = group.variants.map((v) => v.id);
      const { error: err } = await supabase
        .from("products")
        .update({
          master_name: masterName.trim(),
          master_code: masterCode.trim(),
          images: images,
          video_url: videoUrl.trim() || null,
        })
        .in("id", variantIds);

      if (err) throw err;

      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function addImage() {
    if (!imageUrlInput.trim()) return;
    setImages((prev) => [...prev, imageUrlInput.trim()]);
    setImageUrlInput("");
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <Modal open={true} onClose={onClose} title="Sửa Thông tin Sản phẩm chung">
      <div className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-300 font-medium mb-1">Tên sản phẩm chung</label>
          <input
            type="text"
            value={masterName}
            onChange={(e) => setMasterName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-slate-300 font-medium mb-1">Mã sản phẩm chung</label>
          <input
            type="text"
            value={masterCode}
            onChange={(e) => setMasterCode(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono outline-none focus:border-brand-500"
          />
        </div>

        {/* Album Images */}
        <div className="space-y-2">
          <label className="block text-slate-300 font-medium">Album ảnh gallery ({images.length} ảnh)</label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden group">
                <img src={img} alt="" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="Thêm URL ảnh..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 outline-none"
            />
            <button
              type="button"
              onClick={addImage}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium hover:bg-slate-700"
            >
              Thêm
            </button>
          </div>
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-slate-300 font-medium mb-1">URL Video giới thiệu</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="URL video..."
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 outline-none focus:border-brand-500"
          />
        </div>

        {error && <p className="text-rose-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Lưu thay đổi
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* Modal Xem Album & Media Sản Phẩm Chung */
function MasterGroupMediaModal({
  group,
  onClose,
}: {
  group: MasterProductGroup;
  onClose: () => void;
}) {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(
    group.images?.[0] || group.variants[0]?.blanks?.image_url || null
  );

  return (
    <Modal open={true} onClose={onClose} title={`Media Sản Phẩm: ${group.master_name}`} size="lg">
      <div className="space-y-4">
        {/* Display screen */}
        <div className="aspect-video w-full rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center relative">
          {selectedMedia ? (
            selectedMedia.endsWith(".mp4") || selectedMedia.includes("video") ? (
              <video src={selectedMedia} controls autoPlay className="w-full h-full object-contain" />
            ) : (
              <img src={selectedMedia} alt="" className="w-full h-full object-contain" />
            )
          ) : (
            <Boxes size={48} className="text-slate-700" />
          )}
        </div>

        {/* Media items thumbnails */}
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Hình ảnh & Video album</p>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {group.images?.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedMedia(img)}
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-800 border overflow-hidden shrink-0 ${
                  selectedMedia === img ? "border-brand-500 ring-2 ring-brand-500/30" : "border-slate-700 opacity-70 hover:opacity-100"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-contain" />
              </button>
            ))}

            {group.video_url && (
              <button
                onClick={() => setSelectedMedia(group.video_url!)}
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-indigo-950/60 border overflow-hidden shrink-0 flex flex-col items-center justify-center text-indigo-300 ${
                  selectedMedia === group.video_url ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-indigo-800 opacity-80 hover:opacity-100"
                }`}
              >
                <Play size={20} className="fill-indigo-400" />
                <span className="text-[9px] sm:text-[10px] font-semibold mt-0.5">Video</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* Component Preview Biến thể đơn lẻ */
function ProductPreview({ product }: { product: Product }) {
  const blank = product.blanks;
  const design = product.print_designs;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Ảnh phôi</p>
          <div className="aspect-square rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center overflow-hidden">
            {blank?.image_url ? (
              <img src={blank.image_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <Boxes size={32} className="text-slate-700" />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Hình in (PNG)</p>
          <div className="aspect-square rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center overflow-hidden">
            {design?.png_url ? (
              <img src={design.png_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <LayersIcon size={32} className="text-slate-700" />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Preview (Phôi + Hình)</p>
          <div className="aspect-square rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center overflow-hidden relative">
            {blank?.image_url ? (
              <img src={blank.image_url} alt="" className="w-full h-full object-contain absolute inset-0" />
            ) : (
              <Boxes size={32} className="text-slate-700 absolute" />
            )}
            {design?.png_url && (
              <img src={design.png_url} alt="" className="w-[60%] h-[60%] object-contain absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2 p-3.5 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs sm:text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Sản phẩm chung</span>
          <span className="font-semibold text-slate-200">{product.master_name || product.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Mã biến thể</span>
          <span className="font-mono font-semibold text-brand-400">{product.code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Phôi</span>
          <span className="text-slate-300">{blank?.code} ({blank?.color} {blank?.size})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Hình in</span>
          <span className="text-slate-300">{design?.code} — {design?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Giá bán</span>
          <span className="font-bold text-slate-100">{formatCurrency(Number(product.price))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Trạng thái</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
            product.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/50 text-slate-400"
          }`}>
            {product.status === "active" ? "Đang bán" : "Tạm dừng"}
          </span>
        </div>
      </div>
    </div>
  );
}
