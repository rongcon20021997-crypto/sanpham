import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType, LogoItem } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { ImageZoomModal } from "@/components/ImageZoomModal";
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
import { formatCurrency, uploadFile, formatColorName } from "@/lib/helpers";

export interface MasterProductGroup {
  key: string;
  master_code: string;
  master_name: string;
  images: string[];
  video_url: string | null;
  blank_type?: BlankType;
  print_design?: PrintDesign;
  print_designs_list?: PrintDesign[];
  variants: Product[];
  minPrice: number;
  maxPrice: number;
}

import { MockupEditorModal, PrintDesignItem } from "@/components/MockupEditorModal";
import type { PrintPositionData } from "@/lib/types";

export interface MockupEditorTarget {
  masterCode: string;
  colorName: string;
  blankImageUrl: string | null;
  blankImageBackUrl?: string | null;
  printDesignUrl?: string | null;
  printDesigns: PrintDesignItem[];
  variantIds: string[];
  initialPosition?: PrintPositionData | null;
  initialPositions?: Record<string, PrintPositionData> | null;
  initialImageType?: string | null;
}

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [designs, setDesigns] = useState<PrintDesign[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [logos, setLogos] = useState<LogoItem[]>([]);
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
  const [mockupEditorTarget, setMockupEditorTarget] = useState<MockupEditorTarget | null>(null);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [pr, bl, pd, bt, lg] = await Promise.all([
        supabase
          .from("products")
          .select("*, blanks(*, blank_types(*)), print_designs(*)")
          .order("created_at", { ascending: false }),
        supabase.from("blanks").select("*, blank_types(*)").order("code"),
        supabase.from("print_designs").select("*").order("code"),
        supabase.from("blank_types").select("*").order("name"),
        supabase.from("logos").select("*").order("code"),
      ]);

      if (pr.error) console.error("Error loading products:", pr.error);
      if (bl.error) console.error("Error loading blanks:", bl.error);
      if (pd.error) console.error("Error loading print_designs:", pd.error);

      const rawProducts = (pr.data as Product[]) || [];
      const rawDesigns = (pd.data as PrintDesign[]) || [];
      const designMap = new Map<string, PrintDesign>();
      rawDesigns.forEach((d) => {
        if (d && d.id) designMap.set(d.id, d);
      });

      const enrichedProducts = rawProducts.map((p) => {
        const designIds = p.print_design_ids && p.print_design_ids.length > 0
          ? p.print_design_ids
          : [p.print_design_id].filter(Boolean);

        const allDesigns = designIds
          .map((id) => designMap.get(id))
          .filter((d): d is PrintDesign => Boolean(d));

        return {
          ...p,
          all_print_designs: allDesigns.length > 0 ? allDesigns : p.print_designs ? [p.print_designs] : [],
        };
      });

      setItems(enrichedProducts);
      setBlanks((bl.data as Blank[]) || []);
      setDesigns(rawDesigns);
      setTypes((bt.data as BlankType[]) || []);
      setLogos((lg.data as LogoItem[]) || []);
    } catch (err) {
      console.error("Error in load():", err);
    } finally {
      setLoading(false);
    }
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
      if (!p) return false;
      const blank = p.blanks;
      const design = p.print_designs;
      const matchSearch =
        (p.code || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
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
      if (!p) return;
      const blankType = p.blanks?.blank_types;
      const primaryDesign = p.print_designs;
      const allDesigns = (p.all_print_designs && p.all_print_designs.length > 0
        ? p.all_print_designs
        : primaryDesign
        ? [primaryDesign]
        : []
      ).filter(Boolean);

      const designKeyStr = allDesigns.map((d) => d?.id).filter(Boolean).sort().join("+") || p.print_design_id || "design";

      // Key phân nhóm duy nhất kết hợp cả master_code (hoặc blank_type_id) và tổ hợp danh sách hình in
      const key = p.master_code
        ? `${p.master_code}_${designKeyStr}`
        : `${p.blanks?.blank_type_id || "type"}_${designKeyStr}`;

      if (!map.has(key)) {
        const designNames = allDesigns.map((d) => d?.name).filter(Boolean).join(" + ") || primaryDesign?.name || "Hình in";
        const designCodes = allDesigns.map((d) => d?.code).filter(Boolean).join("+") || primaryDesign?.code || "PRINT";

        const fallbackName = p.master_name
          ? p.master_name
          : `${blankType?.name || "Sản phẩm"} - ${designNames}`;
        const fallbackCode = p.master_code
          ? p.master_code
          : `${blankType?.code || "SP"}-${designCodes}`;

        map.set(key, {
          key,
          master_code: fallbackCode,
          master_name: fallbackName,
          images: p.images || [],
          video_url: p.video_url || null,
          blank_type: blankType,
          print_design: primaryDesign,
          print_designs_list: allDesigns,
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
        subtitle="Quản lý sản phẩm chung & biến thể"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã, tên, màu, size..." />
            
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "flat"
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Xem tất cả biến thể"
              >
                <List size={14} /> <span className="hidden sm:inline">Biến thể</span>
              </button>
            </div>

            <button
              onClick={() => setCreateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Plus size={16} /> Tạo SP mới
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

            // Nhóm tất cả các biến thể thuộc sản phẩm này theo PHÔI MÀU (Color Sub-groups)
            const colorSubGroupsMap: Record<
              string,
              {
                color: string;
                blank_image: string | null;
                blank_image_back: string | null;
                preview_url: string | null;
                blank_image_type?: string | null;
                variants: Product[];
              }
            > = {};

            group.variants.forEach((v) => {
              const colorKey = v.blanks?.color || "Khác";
              if (!colorSubGroupsMap[colorKey]) {
                colorSubGroupsMap[colorKey] = {
                  color: colorKey,
                  blank_image: v.blanks?.image_url || null,
                  blank_image_back: v.blanks?.image_back_url || null,
                  preview_url: v.preview_url || null,
                  blank_image_type: v.blank_image_type || null,
                  variants: [],
                };
              }
              colorSubGroupsMap[colorKey].variants.push(v);
              if (!colorSubGroupsMap[colorKey].blank_image && v.blanks?.image_url) {
                colorSubGroupsMap[colorKey].blank_image = v.blanks.image_url;
              }
              if (!colorSubGroupsMap[colorKey].blank_image_back && v.blanks?.image_back_url) {
                colorSubGroupsMap[colorKey].blank_image_back = v.blanks.image_back_url;
              }
              if (!colorSubGroupsMap[colorKey].preview_url && v.preview_url) {
                colorSubGroupsMap[colorKey].preview_url = v.preview_url;
              }
              if (!colorSubGroupsMap[colorKey].blank_image_type && v.blank_image_type) {
                colorSubGroupsMap[colorKey].blank_image_type = v.blank_image_type;
              }
            });

            const colorSubGroups = Object.values(colorSubGroupsMap);

            // Tập hợp tất cả ảnh đại diện đại diện cho các Phôi màu của sản phẩm này
            const colorMockupImages = colorSubGroups
              .map((cg) => cg.preview_url || cg.blank_image || cg.blank_image_back)
              .filter(Boolean) as string[];

            const mainImage = colorMockupImages[0] || null;
            const hasRenderedMockup = colorSubGroups.some((cg) => cg.preview_url);
            const printPng = hasRenderedMockup ? null : group.print_design?.png_url;

            return (
              <div
                key={group.key}
                className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg transition-all"
              >
                {/* Master Product Header Card */}
                <div className="p-3.5 sm:p-5 flex flex-col md:flex-row gap-3.5 sm:gap-5 items-start md:items-center justify-between border-b border-slate-800/80">
                  <div className="flex gap-3 sm:gap-4 items-start sm:items-center min-w-0 flex-1">
                    {/* BÊN TRÁI: Box Ảnh sản phẩm chính */}
                    <div
                      onClick={() =>
                        mainImage &&
                        setZoomImage({
                          url: mainImage,
                          title: `Sản phẩm: ${group.master_name}`,
                        })
                      }
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center cursor-zoom-in group/img"
                      title="Nhấp chuột để xem ảnh phóng to"
                    >
                      {mainImage ? (
                        <img src={mainImage} alt="" className="w-full h-full object-contain group-hover/img:scale-105 transition-transform" />
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
                      {colorMockupImages.length > 1 && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] sm:text-[10px] font-medium text-white flex items-center gap-0.5">
                          <ImageIcon size={9} /> {colorSubGroups.length} màu
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
                        {(group.print_designs_list && group.print_designs_list.length > 0
                          ? group.print_designs_list
                          : group.print_design
                          ? [group.print_design]
                          : []
                        )
                          .filter((pd): pd is PrintDesign => Boolean(pd && pd.name))
                          .map((pd, idx) => (
                            <span
                              key={pd.id || idx}
                              className="text-[11px] sm:text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-none"
                            >
                              {pd.png_url && (
                                <img
                                  src={pd.png_url}
                                  alt=""
                                  onClick={() =>
                                    setZoomImage({
                                      url: pd.png_url!,
                                      title: `Hình in ${idx + 1}: ${pd.name}`,
                                    })
                                  }
                                  className="w-5 h-5 object-contain rounded bg-slate-900 border border-slate-700 p-0.5 shrink-0 cursor-zoom-in hover:scale-125 transition-transform"
                                  title="Nhấp chuột để phóng to hình in"
                                />
                              )}
                              <span>
                                Hình {idx + 1}: <strong>{pd.name}</strong>
                              </span>
                            </span>
                          ))}
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
                          {colorSubGroups.length} phôi màu ({group.variants.length} size)
                        </span>
                        {group.video_url && (
                          <span className="text-indigo-400 flex items-center gap-1 text-[11px]">
                            <Video size={12} /> Video
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BÊN PHẢI: Cụm Nút Thao tác (Media, Sửa, Xóa, Mở rộng Accordion) */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto pt-2 md:pt-0">
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
                      <Pencil size={14} /> Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteMasterGroup(group)}
                      className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-medium flex items-center gap-1 border border-rose-500/20"
                      title="Xóa sản phẩm chung này"
                    >
                      <Trash2 size={14} /> Xóa
                    </button>
                    <button
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [group.key]: !isExpanded,
                        }))
                      }
                      className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors border border-slate-700/50 ml-1"
                      title={isExpanded ? "Thu gọn danh sách" : "Mở rộng danh sách phôi màu"}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Color Sub-groups Section */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 bg-slate-950/40 space-y-4">
                    {colorSubGroups.map((cg) => {
                      const rawBlankImage =
                        cg.blank_image_type === "combined" && cg.blank_image_back
                          ? cg.blank_image_back
                          : cg.blank_image || cg.blank_image_back;
                      const colorMockupImage = cg.preview_url || rawBlankImage;
                      const isColorMockupDone = !!cg.preview_url;

                      return (
                        <div
                          key={cg.color}
                          className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm transition-all"
                        >
                          {/* Header Phôi Màu */}
                          <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {/* Thumbnail Phôi Màu (Nhấp chuột phóng to) */}
                              <div
                                onClick={() =>
                                  colorMockupImage &&
                                  setZoomImage({
                                    url: colorMockupImage,
                                    title: `${group.master_name} - Phôi Màu ${formatColorName(cg.color)}`,
                                  })
                                }
                                className="relative w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/80 overflow-hidden shrink-0 flex items-center justify-center cursor-zoom-in group/subimg"
                                title="Nhấp chuột xem ảnh phóng to phôi màu này"
                              >
                                {colorMockupImage ? (
                                  <img src={colorMockupImage} alt="" className="w-full h-full object-contain group-hover/subimg:scale-105 transition-transform" />
                                ) : (
                                  <Boxes size={20} className="text-slate-600" />
                                )}
                                {!isColorMockupDone && group.print_design?.png_url && (
                                  <img
                                    src={group.print_design.png_url}
                                    alt=""
                                    className="absolute w-[60%] h-[60%] object-contain pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                  />
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  {rawBlankImage && (
                                    <img
                                      src={rawBlankImage}
                                      alt=""
                                      onClick={() =>
                                        setZoomImage({
                                          url: rawBlankImage,
                                          title: `Phôi áo gốc: Màu ${formatColorName(cg.color)} (${cg.blank_image_type === "combined" ? "Hình 2: 2 Mặt" : "Hình 1: Mặt trước"})`,
                                        })
                                      }
                                      className="w-5 h-5 object-contain rounded bg-slate-800 border border-slate-700 p-0.5 shrink-0 cursor-zoom-in hover:scale-125 transition-transform"
                                      title="Nhấp chuột để phóng to phôi áo gốc"
                                    />
                                  )}
                                  <span className="font-bold text-sm text-slate-100">Phôi Màu: {formatColorName(cg.color)}</span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                                    {cg.variants.length} size
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Các size: {cg.variants.map((v) => v.blanks?.size).join(", ")}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const list = group.print_designs_list && group.print_designs_list.length > 0
                                  ? group.print_designs_list
                                  : group.print_design
                                  ? [group.print_design]
                                  : [];

                                const targetDesigns = list.map((d) => ({
                                  id: d.id,
                                  code: d.code,
                                  name: d.name,
                                  url: d.png_url,
                                }));

                                setMockupEditorTarget({
                                  masterCode: `${group.master_code}-${cg.color}`,
                                  colorName: formatColorName(cg.color),
                                  blankImageUrl: cg.blank_image,
                                  blankImageBackUrl: cg.blank_image_back,
                                  printDesignUrl: group.print_design?.png_url || null,
                                  printDesigns: targetDesigns,
                                  variantIds: cg.variants.map((v) => v.id),
                                  initialPosition: cg.variants.find((v) => v.print_position)?.print_position || cg.variants[0]?.print_position || null,
                                  initialPositions: cg.variants.find((v) => v.print_positions)?.print_positions || null,
                                  initialImageType: cg.blank_image_type || "front",
                                });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors text-xs font-semibold flex items-center gap-1.5 border border-brand-500/30"
                              title={`Kéo thả & Chỉnh vị trí hình in riêng cho áo màu ${formatColorName(cg.color)}`}
                            >
                              <Sparkles size={14} /> Chỉnh vị trí (Màu {formatColorName(cg.color)})
                            </button>
                          </div>

                          {/* Bảng danh sách Size của phôi màu này */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs min-w-[500px]">
                              <thead>
                                <tr className="border-b border-slate-800/60 text-slate-400 uppercase font-medium bg-slate-950/20">
                                  <th className="px-4 py-2">Mã biến thể</th>
                                  <th className="px-4 py-2">Kích thước</th>
                                  <th className="px-4 py-2 text-right">Giá phôi</th>
                                  <th className="px-4 py-2 text-right">Giá bán</th>
                                  <th className="px-4 py-2 text-center">Trạng thái</th>
                                  <th className="px-4 py-2 text-right">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {cg.variants.map((v) => (
                                  <tr key={v.id} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-4 py-2 font-mono text-brand-400 font-medium whitespace-nowrap">
                                      {v.code}
                                    </td>
                                    <td className="px-4 py-2 text-slate-200">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-medium">
                                        {v.blanks?.size || "-"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right text-slate-400 font-mono whitespace-nowrap">
                                      {formatCurrency(Number(v.blanks?.price || 0))}
                                    </td>
                                    <td className="px-4 py-2 text-right text-slate-100 font-bold font-mono whitespace-nowrap">
                                      {formatCurrency(Number(v.price))}
                                    </td>
                                    <td className="px-4 py-2 text-center">
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
                                    <td className="px-4 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          onClick={() => setPreviewItem(v)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10"
                                          title="Xem preview biến thể"
                                        >
                                          <Eye size={14} />
                                        </button>
                                        <button
                                          onClick={() => openEditVariant(v)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                                          title="Sửa giá"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteVariant(v)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                          title="Xóa"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Master Group Media Preview & Upload Modal */}
      {previewGroup && (
        <MasterGroupMediaModal group={previewGroup} onClose={() => setPreviewGroup(null)} onSaved={load} />
      )}

      {/* Modal Phóng To Xem Chi Tiết Ảnh HD (Interactive Image Zoom) */}
      <ImageZoomModal
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        imageUrl={zoomImage?.url || null}
        title={zoomImage?.title}
      />

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

      {/* Modal Kéo Thả & Co Giãn Vị Trí Hình In theo từng Phôi Màu */}
      <MockupEditorModal
        open={!!mockupEditorTarget}
        onClose={() => setMockupEditorTarget(null)}
        blankImageUrl={mockupEditorTarget?.blankImageUrl || null}
        blankImageBackUrl={mockupEditorTarget?.blankImageBackUrl || null}
        printDesignUrl={mockupEditorTarget?.printDesignUrl || null}
        printDesigns={mockupEditorTarget?.printDesigns || []}
        availableLogos={logos}
        masterCode={mockupEditorTarget?.masterCode}
        initialPosition={mockupEditorTarget?.initialPosition || undefined}
        initialPositions={mockupEditorTarget?.initialPositions || undefined}
        initialImageType={mockupEditorTarget?.initialImageType || "front"}
        onSaveMockup={async (newMockupUrl, position, imageType, positionsMap) => {
          if (!mockupEditorTarget) return;

          // Cập nhật preview_url, print_position, print_positions và blank_image_type cho toàn bộ biến thể thuộc Phôi màu này
          await supabase
            .from("products")
            .update({
              preview_url: newMockupUrl,
              print_position: position,
              print_positions: positionsMap || null,
              blank_image_type: imageType,
            })
            .in("id", mockupEditorTarget.variantIds);

          await load();
        }}
      />
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
  const [printDesignId2, setPrintDesignId2] = useState("");
  const [printDesignId3, setPrintDesignId3] = useState("");
  const [blankImageType, setBlankImageType] = useState<"front" | "combined">("front");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [variantItems, setVariantItems] = useState<VariantSelectionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBlankType = types.find((t) => t.id === blankTypeId);
  const selectedDesign = designs.find((d) => d.id === printDesignId);
  const selectedDesign2 = designs.find((d) => d.id === printDesignId2);
  const selectedDesign3 = designs.find((d) => d.id === printDesignId3);

  const selectedDesigns = [selectedDesign, selectedDesign2, selectedDesign3].filter(
    (d): d is PrintDesign => Boolean(d)
  );

  // Tự động gợi ý Tên & Mã sản phẩm chung khi chọn Loại phôi & các Hình in
  useEffect(() => {
    if (selectedBlankType && selectedDesigns.length > 0) {
      const designNames = selectedDesigns.map((d) => d.name).join(" + ");
      const designCodes = selectedDesigns.map((d) => d.code).join("+");
      setMasterName(`${selectedBlankType.name} - ${designNames}`);
      setMasterCode(`${selectedBlankType.code}-${designCodes}`);
    }
  }, [blankTypeId, printDesignId, printDesignId2, printDesignId3]);

  // When Blank Type or Print Design changes, auto generate variants from blanks under that Blank Type
  useEffect(() => {
    if (!blankTypeId || selectedDesigns.length === 0) {
      setVariantItems([]);
      return;
    }

    const availableBlanks = blanks.filter((b) => b.blank_type_id === blankTypeId);
    const designCodesStr = selectedDesigns.map((d) => d.code).join("+");

    const generated: VariantSelectionItem[] = availableBlanks.map((b) => {
      const basePrefix = masterCode.trim() || `${selectedBlankType?.code}-${designCodesStr}` || "SP";
      const vCode = `${basePrefix}-${b.color}-${b.size}`;
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
  }, [blankTypeId, printDesignId, printDesignId2, printDesignId3, masterCode, defaultPrice, blanks, selectedBlankType]);

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

  function toggleColorGroup(colorName: string, check: boolean) {
    setVariantItems((prev) =>
      prev.map((v) => (v.color === colorName ? { ...v, selected: check } : v))
    );
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
      const targetMasterCode = masterCode.trim() || `${selectedBlankType?.code}-${selectedDesign?.code}`;

      // 1. Kiểm tra xem Mã sản phẩm chung (master_code) đã được sử dụng ở sản phẩm khác chưa
      const { data: existingMaster } = await supabase
        .from("products")
        .select("id, master_code")
        .eq("master_code", targetMasterCode)
        .limit(1);

      if (existingMaster && existingMaster.length > 0) {
        setError(`Mã sản phẩm chung "${targetMasterCode}" đã tồn tại trên hệ thống. Vui lòng thay đổi Mã sản phẩm chung (Prefix).`);
        setSaving(false);
        return;
      }

      // 2. Kiểm tra xem các Mã biến thể có bị trùng trong hệ thống không
      const variantCodes = toCreate.map((v) => v.code);
      const { data: existingVariants } = await supabase
        .from("products")
        .select("code")
        .in("code", variantCodes)
        .limit(1);

      if (existingVariants && existingVariants.length > 0) {
        setError(`Mã biến thể "${existingVariants[0].code}" đã tồn tại trên hệ thống. Vui lòng thay đổi Mã sản phẩm chung.`);
        setSaving(false);
        return;
      }

      const defaultPosition =
        blankImageType === "combined"
          ? { posX: 28, posY: 38, scale: 35 }
          : { posX: 50, posY: 38, scale: 45 };

      const selectedDesignIds = [printDesignId, printDesignId2, printDesignId3].filter(Boolean);

      const rows = toCreate.map((v) => ({
        master_name: masterName.trim(),
        master_code: targetMasterCode,
        code: v.code,
        name: `${masterName.trim()} (${v.color} ${v.size})`,
        blank_id: v.blank_id,
        print_design_id: printDesignId,
        print_design_ids: selectedDesignIds,
        blank_image_type: blankImageType,
        print_position: defaultPosition,
        price: Number(v.price) || 0,
        images: images,
        video_url: videoUrl.trim() || null,
        status: "active",
      }));

      const { error: insertErr } = await supabase.from("products").insert(rows);
      if (insertErr) {
        if (insertErr.code === "23505") {
          setError("Mã sản phẩm chung hoặc Mã biến thể đã bị trùng lặp trong hệ thống. Vui lòng đổi Mã sản phẩm chung khác.");
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

          {/* Chọn từ 1 đến 3 Hình In */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300">
              Chọn các Hình In cho Sản phẩm (Cho phép chọn từ 1 đến 3 hình in):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Hình in 1 (Chính) *"
                value={printDesignId}
                onChange={setPrintDesignId}
                options={designs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                placeholder="-- Hình in 1 (Bắt buộc) --"
              />
              <Select
                label="Hình in 2 (Mặt sau/Ngực...)"
                value={printDesignId2}
                onChange={setPrintDesignId2}
                options={designs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                placeholder="-- Không dùng Hình 2 --"
              />
              <Select
                label="Hình in 3 (Tay áo/Cổ...)"
                value={printDesignId3}
                onChange={setPrintDesignId3}
                options={designs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                placeholder="-- Không dùng Hình 3 --"
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
          </div>

          {/* Chọn Loại Hình Phôi dùng làm Mockup Mặc Định */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300">
              Chọn Loại Hình Phôi làm Mockup sản phẩm:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBlankImageType("front")}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2.5 ${
                  blankImageType === "front"
                    ? "bg-brand-500/10 border-brand-500/40 text-brand-400 font-semibold"
                    : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className="text-base">👕</span>
                <div>
                  <div className="font-semibold text-slate-200">Hình 1: 1 Áo phía trước</div>
                  <div className="text-[10px] text-slate-400">Hình đơn chỉ mặt trước (Căn vị trí giữa ngực)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBlankImageType("combined")}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2.5 ${
                  blankImageType === "combined"
                    ? "bg-brand-500/10 border-brand-500/40 text-brand-400 font-semibold"
                    : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <span className="text-base">👕👕</span>
                <div>
                  <div className="font-semibold text-slate-200">Hình 2: Trước & sau của áo</div>
                  <div className="text-[10px] text-slate-400">Hình ghép 2 mặt (Mặt trước áo nằm bên trái)</div>
                </div>
              </button>
            </div>
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
          ) : variantItems.length === 0 ? (
            <div className="py-6 sm:py-8 text-center text-xs text-amber-400/90 border border-dashed border-amber-500/20 bg-amber-500/5 rounded-xl px-3">
              Chưa tìm thấy phôi nào thuộc loại <strong>"{selectedBlankType?.name}"</strong>. Bạn hãy vào mục <strong>Quản lý Phôi</strong> để thêm phôi màu & size trước.
            </div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {Object.entries(
                variantItems.reduce<Record<string, VariantSelectionItem[]>>((acc, v) => {
                  if (!acc[v.color]) acc[v.color] = [];
                  acc[v.color].push(v);
                  return acc;
                }, {})
              ).map(([colorName, colorVariants]) => {
                const isAllColorSelected = colorVariants.every((cv) => cv.selected);
                const isSomeColorSelected = colorVariants.some((cv) => cv.selected);

                return (
                  <div key={colorName} className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2.5">
                    {/* Header chọn cả Phôi Màu */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs sm:text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={isAllColorSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = isSomeColorSelected && !isAllColorSelected;
                          }}
                          onChange={(e) => toggleColorGroup(colorName, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-500 focus:ring-brand-500/20 bg-slate-800 cursor-pointer"
                        />
                        <span>🎨 Phôi Màu: <strong className="text-brand-400">{formatColorName(colorName)}</strong></span>
                        <span className="text-[11px] font-normal text-slate-400">({colorVariants.length} size)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleColorGroup(colorName, !isAllColorSelected)}
                        className="text-[11px] text-brand-400 hover:underline font-medium"
                      >
                        {isAllColorSelected ? "Bỏ chọn màu này" : "Chọn màu này"}
                      </button>
                    </div>

                    {/* Danh sách size thuộc phôi màu này */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {colorVariants.map((v) => (
                        <div
                          key={v.blank_id}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                            v.selected ? "bg-brand-500/10 border-brand-500/30" : "bg-slate-900/40 border-slate-800/60 opacity-60"
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer text-xs min-w-0">
                            <input
                              type="checkbox"
                              checked={v.selected}
                              onChange={() => toggleVariantItem(v.blank_id)}
                              className="w-3.5 h-3.5 rounded border-slate-700 text-brand-500 focus:ring-brand-500/20 bg-slate-800 cursor-pointer"
                            />
                            <span className="font-mono text-slate-300 truncate">{v.size}</span>
                            <span className="text-[10px] text-slate-500">({formatCurrency(v.blank_price)})</span>
                          </label>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Giá:</span>
                            <input
                              type="number"
                              value={v.price}
                              onChange={(e) => updateVariantPrice(v.blank_id, e.target.value)}
                              className="w-20 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-right text-xs text-slate-100 font-bold focus:border-brand-500 outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
      const newCode = masterCode.trim();
      if (newCode && newCode !== group.master_code) {
        const { data: existing } = await supabase
          .from("products")
          .select("id, master_code")
          .eq("master_code", newCode)
          .not("id", "in", `(${group.variants.map((v) => v.id).join(",")})`)
          .limit(1);

        if (existing && existing.length > 0) {
          setError(`Mã sản phẩm chung "${newCode}" đã được sử dụng bởi một sản phẩm khác. Vui lòng chọn mã khác.`);
          setSaving(false);
          return;
        }
      }

      const variantIds = group.variants.map((v) => v.id);
      const { error: err } = await supabase
        .from("products")
        .update({
          master_name: masterName.trim(),
          master_code: newCode,
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

/* Modal Quản Lý & Tải Thêm Media / Video Sản Phẩm Chung */
function MasterGroupMediaModal({
  group,
  onClose,
  onSaved,
}: {
  group: MasterProductGroup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [images, setImages] = useState<string[]>(group.images || []);
  const [videoUrl, setVideoUrl] = useState<string>(group.video_url || "");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<string | null>(
    group.images?.[0] || group.video_url || null
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload thêm nhiều hình ảnh
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i], "products/images");
        if (url) uploadedUrls.push(url);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
      if (uploadedUrls.length > 0) setSelectedMedia(uploadedUrls[0]);
    } catch (err) {
      alert("Lỗi tải lên hình ảnh: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Upload 1 Video
  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFile(file, "products/videos");
      if (url) {
        setVideoUrl(url);
        setSelectedMedia(url);
      }
    } catch (err) {
      alert("Lỗi tải lên video: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function addImageUrl() {
    if (!imageUrlInput.trim()) return;
    const url = imageUrlInput.trim();
    setImages((prev) => [...prev, url]);
    setSelectedMedia(url);
    setImageUrlInput("");
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // Lưu thay đổi Album ảnh & Video vào tất cả biến thể của sản phẩm này
  async function handleSaveMedia() {
    setSaving(true);
    try {
      const variantIds = group.variants.map((v) => v.id);
      const { error } = await supabase
        .from("products")
        .update({
          images: images,
          video_url: videoUrl.trim() || null,
        })
        .in("id", variantIds);

      if (error) throw error;

      onSaved();
      onClose();
    } catch (err) {
      alert("Lỗi lưu Media: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Album Media & Video: ${group.master_name}`} size="md">
      <div className="space-y-3.5">
        {/* Màn hình phát / Xem trước Media đang chọn */}
        <div className="aspect-video w-full max-h-[220px] sm:max-h-[260px] rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center relative shadow-inner mx-auto">
          {selectedMedia ? (
            selectedMedia.endsWith(".mp4") || selectedMedia.includes("video") ? (
              <video src={selectedMedia} controls autoPlay className="w-full h-full object-contain" />
            ) : (
              <img src={selectedMedia} alt="" className="w-full h-full object-contain" />
            )
          ) : (
            <Boxes size={40} className="text-slate-700" />
          )}
        </div>

        {/* Danh sách ảnh & video hiện tại */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-300 uppercase">
              🖼️ Danh sách Ảnh chung ({images.length} ảnh)
            </label>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setImages([]);
                  setSelectedMedia(videoUrl || null);
                }}
                className="text-[10px] text-rose-400 hover:underline font-medium"
              >
                Xóa tất cả ảnh
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMedia(img)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-slate-800 border overflow-hidden cursor-pointer group shrink-0 ${
                  selectedMedia === img ? "border-brand-500 ring-2 ring-brand-500/40" : "border-slate-700 opacity-80 hover:opacity-100"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-rose-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Xóa ảnh này"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {/* Nút Tải ảnh mới */}
            <label className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-dashed border-slate-700 hover:border-brand-500 bg-slate-800/40 flex flex-col items-center justify-center text-slate-400 hover:text-brand-400 cursor-pointer transition-colors shrink-0">
              <Upload size={16} />
              <span className="text-[10px] mt-0.5 font-medium">Tải ảnh</span>
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
            </label>

            {/* Ô nhập URL ảnh trực tiếp */}
            <div className="flex-1 flex gap-1.5 min-w-[200px] w-full sm:w-auto">
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Dán link URL ảnh..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-200 outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={addImageUrl}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 shrink-0"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>

        {/* Video sản phẩm */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="block text-xs font-semibold text-slate-300 uppercase">
            🎬 Video giới thiệu sản phẩm (Tối đa 1 video)
          </label>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Nhập URL video (.mp4, youtube embed...)"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-200 outline-none focus:border-brand-500"
            />
            <label className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
              <Video size={14} className="text-indigo-400" /> Tải Video
              <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
            </label>
            {videoUrl && (
              <button
                type="button"
                onClick={() => setVideoUrl("")}
                className="px-3 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-medium hover:bg-rose-500/20 shrink-0"
              >
                Xóa Video
              </button>
            )}
          </div>
        </div>

        {uploading && (
          <p className="text-xs text-brand-400 flex items-center gap-1">
            <Loader2 size={13} className="animate-spin" /> Đang tải file phương tiện lên...
          </p>
        )}

        <div className="flex gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm font-medium hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSaveMedia}
            disabled={saving || uploading}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-xs sm:text-sm font-semibold hover:bg-brand-600 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} Lưu Album Media
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* Component Preview Biến thể đơn lẻ */
function ProductPreview({ product }: { product: Product }) {
  const blank = product.blanks;
  const design = product.print_designs;
  const targetBlankImage =
    product.blank_image_type === "combined" && blank?.image_back_url
      ? blank.image_back_url
      : blank?.image_url || blank?.image_back_url;

  const mockupImage =
    product.preview_url ||
    (product.images && product.images.length > 0 ? product.images[0] : null) ||
    targetBlankImage;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
      {/* BÊN TRÁI: Ảnh Mockup Hoàn Chỉnh */}
      <div className="aspect-square w-full rounded-2xl bg-slate-900 border border-slate-700/80 overflow-hidden flex items-center justify-center relative shadow-xl">
        {mockupImage ? (
          <img src={mockupImage} alt={product.code} className="w-full h-full object-contain p-2" />
        ) : (
          <Boxes size={48} className="text-slate-700" />
        )}
      </div>

      {/* BÊN PHẢI: Bảng thông tin chi tiết & trạng thái */}
      <div className="space-y-2.5 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs sm:text-sm">
        <div className="flex justify-between border-b border-slate-700/50 pb-2">
          <span className="text-slate-400">Sản phẩm chung</span>
          <span className="font-semibold text-slate-200 text-right">{product.master_name || product.name}</span>
        </div>
        <div className="flex justify-between border-b border-slate-700/50 pb-2">
          <span className="text-slate-400">Mã biến thể</span>
          <span className="font-mono font-semibold text-brand-400">{product.code}</span>
        </div>
        <div className="flex justify-between border-b border-slate-700/50 pb-2">
          <span className="text-slate-400">Phôi màu & size</span>
          <span className="text-slate-300">{blank?.code} ({blank?.color} {blank?.size})</span>
        </div>
        <div className="flex justify-between border-b border-slate-700/50 pb-2">
          <span className="text-slate-400">Hình in</span>
          <span className="text-slate-300">{design?.code} — {design?.name}</span>
        </div>
        <div className="flex justify-between border-b border-slate-700/50 pb-2">
          <span className="text-slate-400">Giá bán</span>
          <span className="font-bold text-slate-100">{formatCurrency(Number(product.price))}</span>
        </div>
        <div className="flex justify-between pt-1">
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
