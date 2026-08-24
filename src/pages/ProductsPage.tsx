import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType, LogoItem, Color, AIPrompt } from "@/lib/types";
import { DEFAULT_AI_PROMPTS } from "@/lib/defaultPrompts";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { ImageZoomModal, type ZoomImageItem } from "@/components/ImageZoomModal";
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
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Check,
  Copy,
  Bot,
  ZoomIn,
  Users,
  User,
} from "lucide-react";
import { formatCurrency, uploadFile, formatColorName } from "@/lib/helpers";
import { loadImageWithR2Priority } from "@/lib/r2Storage";

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

export interface ColorSubGroupItem {
  color: string;
  blank_image: string | null;
  blank_image_back: string | null;
  blank_image_type?: string | null;
  variantIds: string[];
}

export interface MockupEditorTarget {
  masterCode: string;
  masterGroupCode?: string;
  colorName: string;
  blankImageUrl: string | null;
  blankImageBackUrl?: string | null;
  printDesignUrl?: string | null;
  printDesigns: PrintDesignItem[];
  variantIds: string[];
  allColorSubGroups?: ColorSubGroupItem[];
  initialPosition?: PrintPositionData | null;
  initialPositions?: Record<string, PrintPositionData> | null;
  initialImageType?: string | null;
}

// Helper tự động render canvas & upload mockup cho các phôi màu khác trong nhóm
async function generateAndUploadMockupForBlank({
  masterCode,
  colorName,
  blankImageUrl,
  blankImageBackUrl,
  printDesigns,
  positionsMap,
  imageType,
}: {
  masterCode: string;
  colorName: string;
  blankImageUrl: string | null;
  blankImageBackUrl?: string | null;
  printDesigns: PrintDesignItem[];
  positionsMap?: Record<string, PrintPositionData> | null;
  imageType: string;
}): Promise<string | null> {
  const targetBlankImage =
    imageType === "combined" && blankImageBackUrl
      ? blankImageBackUrl
      : blankImageUrl || blankImageBackUrl || null;
  if (!targetBlankImage || printDesigns.length === 0) return null;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imgBlank = await loadImageWithR2Priority(targetBlankImage, "blanks");

    canvas.width = 1200;
    canvas.height = 1200;
    ctx.drawImage(imgBlank, 0, 0, 1200, 1200);

    for (const design of printDesigns) {
      const isLogo = design.id === "logo" || design.code?.toLowerCase().includes("logo");
      const defaultX = imageType === "combined" ? (isLogo ? 21 : 28) : (isLogo ? 38 : 50);
      const defaultY = isLogo ? 28 : 38;
      const defaultScale = isLogo ? 16 : (imageType === "combined" ? 35 : 45);

      const pos =
        positionsMap?.[design.id] ||
        (isLogo ? positionsMap?.["logo"] : null) ||
        (printDesigns.indexOf(design) === 0 && positionsMap
          ? Object.entries(positionsMap).find(([k]) => k !== "logo")?.[1]
          : null) || {
          posX: defaultX,
          posY: defaultY,
          scale: defaultScale,
          visible: true,
        };
      if (pos.visible === false) continue;

      const imgDesign = await loadImageWithR2Priority(
        design.url,
        isLogo ? "logos" : "designs",
        design.code
      );

      const designWidth = (pos.scale / 100) * 1200;
      const designAspect = imgDesign.height / imgDesign.width;
      const designHeight = designWidth * designAspect;

      const drawX = (pos.posX / 100) * 1200 - designWidth / 2;
      const drawY = (pos.posY / 100) * 1200 - designHeight / 2;

      ctx.drawImage(imgDesign, drawX, drawY, designWidth, designHeight);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.88)
    );
    if (!blob) return null;

    const file = new File([blob], `MOCKUP_${masterCode}_${colorName}.webp`, { type: "image/webp" });
    const uploadedUrl = await uploadFile(file, "products/mockups", `MOCKUP_${masterCode}_${colorName}`);
    return uploadedUrl;
  } catch (err) {
    console.error("Lỗi tự động sinh mockup cho màu", colorName, err);
    return null;
  }
}

// Helper nhóm các biến thể theo phôi màu
export function getColorSubGroups(variants?: Product[] | null) {
  if (!variants || !Array.isArray(variants)) return [];
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

  variants.forEach((v) => {
    if (!v) return;
    const colorKey = v.blanks?.color || v.color || "Khác";
    if (!colorSubGroupsMap[colorKey]) {
      colorSubGroupsMap[colorKey] = {
        color: colorKey,
        blank_image: v.blanks?.image_url || v.raw_blank_image_url || null,
        blank_image_back: v.blanks?.image_back_url || null,
        preview_url: v.preview_url || null,
        blank_image_type: v.blank_image_type || null,
        variants: [],
      };
    }
    colorSubGroupsMap[colorKey].variants.push(v);
    if (!colorSubGroupsMap[colorKey].blank_image && (v.blanks?.image_url || v.raw_blank_image_url)) {
      colorSubGroupsMap[colorKey].blank_image = v.blanks?.image_url || v.raw_blank_image_url || null;
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

  return Object.values(colorSubGroupsMap);
}

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [designs, setDesigns] = useState<PrintDesign[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [colorsList, setColorsList] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterImage, setFilterImage] = useState("");
  const [filterVideo, setFilterVideo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  const [createModal, setCreateModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<Product | null>(null);
  const [previewGroup, setPreviewGroup] = useState<MasterProductGroup | null>(null);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [editMasterGroup, setEditMasterGroup] = useState<MasterProductGroup | null>(null);
  const [mockupEditorTarget, setMockupEditorTarget] = useState<MockupEditorTarget | null>(null);
  const [zoomImage, setZoomImage] = useState<{
    url?: string;
    title?: string;
    images?: ZoomImageItem[];
    initialIndex?: number;
  } | null>(null);
  const [detailGroupKey, setDetailGroupKey] = useState<string | null>(null);

  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [pr, bl, pd, bt, lg, cl] = await Promise.all([
        supabase
          .from("products")
          .select("*, blanks(*, blank_types(*)), print_designs(*)")
          .order("created_at", { ascending: false }),
        supabase.from("blanks").select("*, blank_types(*)").order("code"),
        supabase.from("print_designs").select("*").order("code"),
        supabase.from("blank_types").select("*").order("name"),
        supabase.from("logos").select("*").order("code"),
        supabase.from("colors").select("*").order("name"),
      ]);

      if (pr.error) console.error("Error loading products:", pr.error);
      if (bl.error) console.error("Error loading blanks:", bl.error);
      if (pd.error) console.error("Error loading print_designs:", pd.error);

      setColorsList((cl.data as Color[]) || []);

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
      const matchImage =
        !filterImage ||
        filterImage === "all" ||
        (filterImage === "has_images" && Array.isArray(p.images) && p.images.length > 0) ||
        (filterImage === "no_images" && (!p.images || p.images.length === 0));
      const matchVideo =
        !filterVideo ||
        filterVideo === "all" ||
        (filterVideo === "has_video" && Boolean(p.video_url && p.video_url.trim())) ||
        (filterVideo === "no_video" && (!p.video_url || !p.video_url.trim()));

      return (
        matchSearch &&
        matchType &&
        matchColor &&
        matchSize &&
        matchTheme &&
        matchStatus &&
        matchImage &&
        matchVideo
      );
    });
  }, [items, search, filterType, filterColor, filterSize, filterTheme, filterStatus, filterImage, filterVideo]);

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

  const activeDetailGroup = useMemo(() => {
    if (!detailGroupKey) return null;
    return masterGroups.find((g) => g.key === detailGroupKey) || null;
  }, [masterGroups, detailGroupKey]);

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

  // Hàm ghép lại hình mockup HD từ Cloudflare R2 cho một Phôi Màu chỉ định
  async function handleReRenderColorMockup(
    group: MasterProductGroup,
    cg: ReturnType<typeof getColorSubGroups>[0]
  ): Promise<boolean> {
    const list =
      group.print_designs_list && group.print_designs_list.length > 0
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

    const firstVar = cg.variants[0];
    const positionsMap = firstVar?.print_positions || null;
    const imageType = cg.blank_image_type || "front";

    const newMockupUrl = await generateAndUploadMockupForBlank({
      masterCode: group.master_code,
      colorName: formatColorName(cg.color),
      blankImageUrl: cg.blank_image,
      blankImageBackUrl: cg.blank_image_back,
      printDesigns: targetDesigns,
      positionsMap: positionsMap,
      imageType: imageType,
    });

    if (newMockupUrl) {
      const variantIds = cg.variants.map((v) => v.id);
      await supabase
        .from("products")
        .update({
          preview_url: newMockupUrl,
        })
        .in("id", variantIds);

      await load();
      return true;
    }
    return false;
  }

  // Hàm ghép lại hình mockup HD cho TẤT CẢ các phôi màu trong sản phẩm chung
  async function handleReRenderAllColors(
    group: MasterProductGroup,
    onProgress?: (current: number, total: number, colorName: string) => void
  ): Promise<{ total: number; success: number }> {
    const colorSubGroups = getColorSubGroups(group.variants);
    let successCount = 0;
    for (let i = 0; i < colorSubGroups.length; i++) {
      const cg = colorSubGroups[i];
      if (onProgress) {
        onProgress(i + 1, colorSubGroups.length, formatColorName(cg.color));
      }
      const ok = await handleReRenderColorMockup(group, cg);
      if (ok) successCount++;
    }
    return { total: colorSubGroups.length, success: successCount };
  }

  const hasFilters = Boolean(
    filterType ||
    filterColor ||
    filterSize ||
    filterTheme ||
    filterStatus ||
    (filterImage && filterImage !== "all") ||
    (filterVideo && filterVideo !== "all")
  );

  function resetFilters() {
    setSearch("");
    setFilterType("");
    setFilterColor("");
    setFilterSize("");
    setFilterTheme("");
    setFilterStatus("");
    setFilterImage("");
    setFilterVideo("");
  }

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
              <Filter size={15} /> Lọc {hasFilters && "•"}
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
              className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20 transition-all shrink-0 cursor-pointer"
              title="Tạo sản phẩm mới"
            >
              <Plus size={15} /> Tạo sản phẩm
            </button>
          </div>
        }
      />

      {showFilters && (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
            <Select
              label="Loại phôi"
              value={filterType}
              onChange={setFilterType}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Tất cả"
            />
            <Select
              label="Màu"
              value={filterColor}
              onChange={setFilterColor}
              options={colors.map((c) => ({ value: c, label: c }))}
              placeholder="Tất cả"
            />
            <Select
              label="Size"
              value={filterSize}
              onChange={setFilterSize}
              options={sizes.map((s) => ({ value: s, label: s }))}
              placeholder="Tất cả"
            />
            <Select
              label="Chủ đề"
              value={filterTheme}
              onChange={setFilterTheme}
              options={themes.map((t) => ({ value: t, label: t }))}
              placeholder="Tất cả"
            />
            <Select
              label="Hình ảnh"
              value={filterImage}
              onChange={setFilterImage}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "has_images", label: "🖼️ Đã up hình" },
                { value: "no_images", label: "🚫 Chưa up hình" },
              ]}
              placeholder="Tất cả"
            />
            <Select
              label="Video"
              value={filterVideo}
              onChange={setFilterVideo}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "has_video", label: "🎬 Đã up video" },
                { value: "no_video", label: "🚫 Chưa up video" },
              ]}
              placeholder="Tất cả"
            />
            <Select
              label="Trạng thái"
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "active", label: "Đang bán" },
                { value: "inactive", label: "Tạm dừng" },
              ]}
              placeholder="Tất cả"
            />
          </div>

          {hasFilters && (
            <div className="flex items-center justify-end pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <X size={13} /> Xóa tất cả bộ lọc
              </button>
            </div>
          )}
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
        /* Compact Grouped Master Product View */
        <div className="space-y-3">
          {masterGroups.map((group) => {
            const colorSubGroups = getColorSubGroups(group.variants);

            const colorMockupImages = colorSubGroups
              .map((cg) => {
                const rawBlankImage =
                  cg.blank_image_type === "combined" && cg.blank_image_back
                    ? cg.blank_image_back
                    : cg.blank_image || cg.blank_image_back;
                return cg.preview_url || rawBlankImage;
              })
              .filter(Boolean) as string[];

            const firstSubGroup = colorSubGroups[0];
            const firstVariant = group.variants[0];
            const firstRawBlankImage = firstSubGroup
              ? firstSubGroup.blank_image_type === "combined" && firstSubGroup.blank_image_back
                ? firstSubGroup.blank_image_back
                : firstSubGroup.blank_image || firstSubGroup.blank_image_back
              : null;

            const mainImage = firstSubGroup?.preview_url || firstRawBlankImage || colorMockupImages[0] || null;
            const hasRenderedMockup = !!firstSubGroup?.preview_url;
            const printPng = hasRenderedMockup ? null : group.print_design?.png_url;

            const firstPos = firstVariant?.print_position || (
              firstVariant?.blank_image_type === "combined"
                ? { posX: 28, posY: 38, scale: 35 }
                : { posX: 50, posY: 38, scale: 45 }
            );

            const designsList = (
              group.print_designs_list && group.print_designs_list.length > 0
                ? group.print_designs_list
                : group.print_design
                ? [group.print_design]
                : []
            ).filter((pd): pd is PrintDesign => Boolean(pd && pd.name));

            const variantZoomImages: ZoomImageItem[] = colorSubGroups
              .map((cg) => {
                const rawBlankImage =
                  cg.blank_image_type === "combined" && cg.blank_image_back
                    ? cg.blank_image_back
                    : cg.blank_image || cg.blank_image_back;
                const imgUrl = cg.preview_url || rawBlankImage || "";
                return {
                  url: imgUrl,
                  title: `${group.master_name} - Màu ${formatColorName(cg.color)}`,
                  label: `Màu ${formatColorName(cg.color)}`,
                  color: cg.color,
                };
              })
              .filter((i) => Boolean(i.url));

            if (group.images && group.images.length > 0) {
              group.images.forEach((url, i) => {
                variantZoomImages.push({
                  url,
                  title: `${group.master_name} - Album media ${i + 1}`,
                  label: `Media ${i + 1}`,
                });
              });
            }

            return (
              <div
                key={group.key}
                className="card-gradient rounded-2xl border border-slate-700/50 hover:border-brand-500/40 p-3 sm:p-4 transition-all duration-200 shadow-md hover:shadow-lg flex flex-col md:flex-row gap-3.5 sm:gap-4 items-start md:items-center justify-between group"
              >
                {/* Left: Thumbnail & Master Info */}
                <div className="flex gap-3 sm:gap-4 items-center min-w-0 flex-1 w-full md:w-auto">
                  {/* Image container */}
                  <div
                    onClick={() =>
                      (mainImage || variantZoomImages.length > 0) &&
                      setZoomImage({
                        url: mainImage || variantZoomImages[0]?.url,
                        title: `Sản phẩm: ${group.master_name}`,
                        images: variantZoomImages,
                        initialIndex: 0,
                      })
                    }
                    className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-800/80 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center cursor-zoom-in group/img shadow-sm"
                    title="Nhấp chuột để xem toàn bộ ảnh biến thể phóng to"
                  >
                    {mainImage ? (
                      <img src={mainImage} alt="" className="w-full h-full object-contain group-hover/img:scale-105 transition-transform" />
                    ) : (
                      <Boxes size={22} className="text-slate-600" />
                    )}
                    {printPng && (
                      <img
                        src={printPng}
                        alt=""
                        style={{
                          left: `${firstPos.posX ?? (firstVariant?.blank_image_type === "combined" ? 28 : 50)}%`,
                          top: `${firstPos.posY ?? 38}%`,
                          width: `${firstPos.scale ?? (firstVariant?.blank_image_type === "combined" ? 35 : 45)}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                        className="absolute object-contain pointer-events-none"
                      />
                    )}
                    {colorMockupImages.length > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[9px] font-medium text-white flex items-center gap-0.5">
                        <ImageIcon size={8} /> {colorSubGroups.length}
                      </span>
                    )}
                    {group.video_url && (
                      <span className="absolute top-0.5 left-0.5 p-0.5 rounded-full bg-brand-500/90 text-white">
                        <Play size={8} className="fill-white" />
                      </span>
                    )}
                  </div>

                  {/* Text info */}
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
                      {designsList.map((pd, idx) => (
                        <span
                          key={pd.id || idx}
                          className="text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/50 flex items-center gap-1 truncate max-w-[160px] sm:max-w-none"
                        >
                          {pd.png_url && (
                            <img
                              src={pd.png_url}
                              alt=""
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomImage({
                                  url: pd.png_url!,
                                  title: `Hình in ${idx + 1}: ${pd.name}`,
                                });
                              }}
                              className="w-4 h-4 object-contain rounded bg-slate-900 border border-slate-700 shrink-0 cursor-zoom-in"
                            />
                          )}
                          <span className="truncate">{pd.name}</span>
                        </span>
                      ))}
                    </div>

                    <h3
                      onClick={() => setDetailGroupKey(group.key)}
                      className="text-sm sm:text-base font-bold text-slate-100 leading-snug truncate hover:text-brand-400 cursor-pointer transition-colors"
                      title="Nhấp để xem chi tiết sản phẩm & biến thể"
                    >
                      {group.master_name}
                    </h3>

                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="text-emerald-400 font-bold text-xs sm:text-sm">
                        {group.minPrice === group.maxPrice
                          ? formatCurrency(group.minPrice)
                          : `${formatCurrency(group.minPrice)} - ${formatCurrency(group.maxPrice)}`}
                      </span>
                      <span>•</span>
                      <span className="bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-700/40">
                        🎨 {colorSubGroups.length} phôi màu • {group.variants.length} biến thể
                      </span>
                      {group.video_url && (
                        <span className="text-indigo-400 flex items-center gap-1 text-[11px]">
                          <Video size={11} /> Video
                        </span>
                      )}
                    </div>

                    {/* DẢI HIỂN THỊ TOÀN BỘ ẢNH BIẾN THỂ CỦA SẢN PHẨM CHUNG */}
                    {colorSubGroups.length > 0 && (
                      <div className="pt-1.5 flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5 custom-scrollbar">
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
                          🎨 Biến thể ({colorSubGroups.length}):
                        </span>
                        {colorSubGroups.map((cg, idx) => {
                          const rawBlankImage =
                            cg.blank_image_type === "combined" && cg.blank_image_back
                              ? cg.blank_image_back
                              : cg.blank_image || cg.blank_image_back;
                          const colorMockupImage = cg.preview_url || rawBlankImage;
                          if (!colorMockupImage) return null;

                          return (
                            <button
                              key={cg.color}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomImage({
                                  url: colorMockupImage,
                                  title: `${group.master_name} - Màu ${formatColorName(cg.color)}`,
                                  images: variantZoomImages,
                                  initialIndex: idx,
                                });
                              }}
                              className="group/vimg relative flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-brand-500 hover:bg-slate-800 transition-all shrink-0 cursor-zoom-in shadow-sm"
                              title={`Bấm xem ảnh biến thể màu ${formatColorName(cg.color)} (${cg.variants.length} size)`}
                            >
                              <div className="w-6 h-6 rounded bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 border border-slate-800/80">
                                <img
                                  src={colorMockupImage}
                                  alt=""
                                  className="w-full h-full object-contain group-hover/vimg:scale-110 transition-transform"
                                />
                              </div>
                              <span className="text-[10px] font-medium text-slate-300 group-hover/vimg:text-brand-300">
                                {formatColorName(cg.color)}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                ({cg.variants.length})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto md:ml-0 pt-2 md:pt-0 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-800/60">
                  <button
                    onClick={() => setDetailGroupKey(group.key)}
                    className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-brand-500/15 text-brand-400 hover:bg-brand-500 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 border border-brand-500/30 shadow-sm cursor-pointer"
                    title="Xem chi tiết sản phẩm và danh sách biến thể"
                  >
                    <Eye size={14} /> Xem biến thể ({group.variants.length})
                  </button>
                  <button
                    onClick={() => setPreviewGroup(group)}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-xs font-medium flex items-center gap-1 border border-slate-700/50"
                    title="Xem album media"
                  >
                    <ImageIcon size={14} /> Media ({group.images?.length || 0})
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
                </div>
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
        existingProducts={items}
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

      {/* Modal Phóng To Xem Chi Tiết Ảnh HD (Interactive Image Zoom) */}
      <ImageZoomModal
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        imageUrl={zoomImage?.url || null}
        title={zoomImage?.title}
        images={zoomImage?.images}
        initialIndex={zoomImage?.initialIndex}
      />

      {/* Master Product Detail & Variants Modal */}
      {activeDetailGroup && (
        <MasterProductDetailModal
          group={activeDetailGroup}
          onClose={() => setDetailGroupKey(null)}
          onEditMaster={(g) => setEditMasterGroup(g)}
          onMediaMaster={(g) => setPreviewGroup(g)}
          onDeleteMaster={(g) => {
            handleDeleteMasterGroup(g);
            setDetailGroupKey(null);
          }}
          onEditVariant={(v) => openEditVariant(v)}
          onDeleteVariant={(v) => handleDeleteVariant(v)}
          onPreviewVariant={(v) => setPreviewItem(v)}
          onOpenMockupEditor={(target) => setMockupEditorTarget(target)}
          onZoomImage={(data) => setZoomImage(data)}
          onReRenderColor={handleReRenderColorMockup}
          onReRenderAllColors={handleReRenderAllColors}
        />
      )}

      {/* Master Group Media Preview & Upload Modal */}
      {previewGroup && (
        <MasterGroupMediaModal
          group={previewGroup}
          colorsList={colorsList}
          onClose={() => setPreviewGroup(null)}
          onSaved={load}
        />
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
        hasOtherColors={(mockupEditorTarget?.allColorSubGroups?.length || 0) > 1}
        initialPosition={mockupEditorTarget?.initialPosition || undefined}
        initialPositions={mockupEditorTarget?.initialPositions || undefined}
        initialImageType={mockupEditorTarget?.initialImageType || "front"}
        onSaveMockup={async (newMockupUrl, position, imageType, positionsMap, applyToAllColors, activeDesigns) => {
          if (!mockupEditorTarget) return;

          // 1. Cập nhật preview_url, print_position, print_positions và blank_image_type cho toàn bộ biến thể thuộc Phôi màu này
          await supabase
            .from("products")
            .update({
              preview_url: newMockupUrl,
              print_position: position,
              print_positions: positionsMap || null,
              blank_image_type: imageType,
            })
            .in("id", mockupEditorTarget.variantIds);

          // 2. Nếu tích chọn "Đồng bộ vị trí cho tất cả phôi màu" và có nhiều phôi màu khác
          if (applyToAllColors && mockupEditorTarget.allColorSubGroups && mockupEditorTarget.allColorSubGroups.length > 1) {
            const currentFirstId = mockupEditorTarget.variantIds[0];
            const otherGroups = mockupEditorTarget.allColorSubGroups.filter(
              (g) => g.variantIds[0] !== currentFirstId
            );

            const targetDesignsToRender = activeDesigns || mockupEditorTarget.printDesigns;

            for (const other of otherGroups) {
              const otherMockupUrl = await generateAndUploadMockupForBlank({
                masterCode: mockupEditorTarget.masterGroupCode || mockupEditorTarget.masterCode,
                colorName: formatColorName(other.color),
                blankImageUrl: other.blank_image,
                blankImageBackUrl: other.blank_image_back,
                printDesigns: targetDesignsToRender,
                positionsMap: positionsMap,
                imageType: imageType,
              });

              await supabase
                .from("products")
                .update({
                  preview_url: otherMockupUrl || newMockupUrl,
                  print_position: position,
                  print_positions: positionsMap || null,
                  blank_image_type: imageType,
                })
                .in("id", other.variantIds);
            }
          }

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
  existingProducts,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  blanks: Blank[];
  designs: PrintDesign[];
  types: BlankType[];
  existingProducts: Product[];
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

  // Tìm tất cả các ID hình in chính đã từng được tạo với loại phôi đang chọn
  const usedMainDesignIdsForBlankType = useMemo(() => {
    if (!blankTypeId) return new Set<string>();
    const set = new Set<string>();
    existingProducts.forEach((p) => {
      if (!p) return;
      const bTypeId =
        p.blanks?.blank_type_id ||
        p.blanks?.blank_types?.id ||
        blanks.find((b) => b.id === p.blank_id)?.blank_type_id;

      if (bTypeId === blankTypeId) {
        if (p.print_design_id) set.add(p.print_design_id);
        if (p.print_designs?.id) set.add(p.print_designs.id);
        if (p.print_design_ids && p.print_design_ids.length > 0) {
          p.print_design_ids.forEach((id) => {
            if (id) set.add(id);
          });
        }
      }
    });
    return set;
  }, [blankTypeId, existingProducts, blanks]);

  // Tự động bỏ chọn hình 1 nếu hình đang chọn nằm trong danh sách đã tạo với phôi này
  useEffect(() => {
    if (printDesignId && usedMainDesignIdsForBlankType.has(printDesignId)) {
      setPrintDesignId("");
    }
  }, [blankTypeId, usedMainDesignIdsForBlankType]);

  // Danh sách hình in khả dụng cho Hình in chính (Hình 1): ẩn những hình in đã từng tạo với loại phôi này
  const availableMainDesigns = useMemo(() => {
    if (!blankTypeId) return designs;
    return designs.filter((d) => !usedMainDesignIdsForBlankType.has(d.id));
  }, [designs, blankTypeId, usedMainDesignIdsForBlankType]);

  const selectedDesign = designs.find((d) => d.id === printDesignId);
  const selectedDesign2 = designs.find((d) => d.id === printDesignId2);
  const selectedDesign3 = designs.find((d) => d.id === printDesignId3);

  const selectedDesigns = [selectedDesign, selectedDesign2, selectedDesign3].filter(
    (d): d is PrintDesign => Boolean(d)
  );

  // Tự động reset trắng dữ liệu cũ mỗi khi mở modal tạo sản phẩm
  useEffect(() => {
    if (open) {
      setMasterName("");
      setMasterCode("");
      setDefaultPrice("250000");
      setBlankTypeId("");
      setPrintDesignId("");
      setPrintDesignId2("");
      setPrintDesignId3("");
      setBlankImageType("front");
      setImages([]);
      setImageUrlInput("");
      setVideoUrl("");
      setUploadingMedia(false);
      setVariantItems([]);
      setSaving(false);
      setError(null);
    }
  }, [open]);

  // Tự động gợi ý Tên & Mã sản phẩm chung khi chọn Loại phôi & các Hình in
  useEffect(() => {
    if (selectedBlankType && selectedDesigns.length > 0) {
      const designNames = selectedDesigns.map((d) => d.name).join(" + ");
      const designCodes = selectedDesigns.map((d) => d.code).join("+");
      setMasterName(`MEO BAO ${selectedBlankType.name} ${designNames}`);
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
          ? { posX: selectedDesign?.is_back ? 72 : 28, posY: 38, scale: 35 }
          : { posX: 50, posY: 38, scale: 45 };

      const selectedDesignIds = [printDesignId, printDesignId2, printDesignId3].filter(Boolean);
      const posMap: Record<string, PrintPositionData> = {};
      selectedDesigns.forEach((d, idx) => {
        const posX = blankImageType === "combined" ? (d.is_back ? 72 : (idx === 1 ? 72 : 28)) : idx === 1 ? 38 : 50;
        const posY = idx === 2 ? 65 : 38;
        const scale = blankImageType === "combined" ? 35 : idx === 1 ? 25 : 45;
        posMap[d.id] = { posX, posY, scale, visible: true };
      });

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
        print_positions: posMap,
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
    <Modal open={open} onClose={onClose} title="Tạo sản phẩm chung & các Biến thể" size="lg">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch select-none text-xs">
        {/* CỘT TRÁI (7/12): THÔNG TIN SẢN PHẨM CHUNG & MEDIA */}
        <div className="lg:col-span-7 p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-800">
              <Sparkles size={14} className="text-brand-400 shrink-0" />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                1. Thông tin Sản phẩm & Media
              </h4>
            </div>

            {/* Tên & Mã SP */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
                  Tên sản phẩm chung <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={masterName}
                  onChange={(e) => setMasterName(e.target.value)}
                  placeholder="VD: Áo T-Shirt Oversize Graphic"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-none focus:border-brand-500 font-medium"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
                  Mã SP (Prefix)
                </label>
                <input
                  type="text"
                  value={masterCode}
                  onChange={(e) => setMasterCode(e.target.value)}
                  placeholder="VD: SP-SKULL-01"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Chọn Loại Phôi & Giá mặc định */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
                  Chọn Loại Phôi <span className="text-rose-400">*</span>
                </label>
                <select
                  value={blankTypeId}
                  onChange={(e) => setBlankTypeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-none focus:border-brand-500 font-medium cursor-pointer"
                >
                  <option value="">-- Chọn loại phôi --</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-medium text-slate-300 mb-0.5">
                  Giá mặc định (VND)
                </label>
                <input
                  type="number"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  placeholder="250000"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs font-bold outline-none focus:border-brand-500 text-right"
                />
              </div>
            </div>

            {/* Chọn 1 - 3 Hình In */}
            <div className="space-y-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90">
              <label className="block text-[11px] font-bold text-slate-200 uppercase tracking-wide">
                Chọn Hình In (Tối đa 3 hình):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[10px] font-medium text-slate-300">
                      Hình 1 (Chính) <span className="text-rose-400 font-bold">*</span>
                    </label>
                    {blankTypeId && usedMainDesignIdsForBlankType.size > 0 && (
                      <span className="text-[9px] text-emerald-400 font-semibold">
                        (Ẩn {usedMainDesignIdsForBlankType.size} hình đã tạo)
                      </span>
                    )}
                  </div>
                  <select
                    value={printDesignId}
                    onChange={(e) => setPrintDesignId(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-none focus:border-brand-500 cursor-pointer truncate"
                  >
                    <option value="">
                      {availableMainDesigns.length === 0
                        ? "-- Đã tạo hết hình in với phôi này --"
                        : "-- Chọn Hình 1 (Bắt buộc) --"}
                    </option>
                    {availableMainDesigns.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name} [{d.is_back ? "Mặt sau" : "Mặt trước"}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                    Hình 2 (Sau/Ngực)
                  </label>
                  <select
                    value={printDesignId2}
                    onChange={(e) => setPrintDesignId2(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-none focus:border-brand-500 cursor-pointer truncate"
                  >
                    <option value="">-- Không dùng --</option>
                    {designs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name} [{d.is_back ? "Mặt sau" : "Mặt trước"}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-0.5">
                    Hình 3 (Tay/Cổ)
                  </label>
                  <select
                    value={printDesignId3}
                    onChange={(e) => setPrintDesignId3(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-none focus:border-brand-500 cursor-pointer truncate"
                  >
                    <option value="">-- Không dùng --</option>
                    {designs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name} [{d.is_back ? "Mặt sau" : "Mặt trước"}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* KHU VỰC XEM TRƯỚC HÌNH IN CHÍNH & CÁC HÌNH IN ĐÃ CHỌN */}
              {selectedDesign ? (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ✨ Xem trước hình in chính (Hình 1):
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedDesign.is_back
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      }`}
                    >
                      {selectedDesign.is_back ? "🔙 Hình Mặt sau (In sau)" : "👕 Hình Mặt trước (In trước)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-slate-950 p-1 border border-slate-700/80 shrink-0 flex items-center justify-center overflow-hidden">
                      {selectedDesign.thumbnail_url || selectedDesign.png_url ? (
                        <img
                          src={(selectedDesign.thumbnail_url || selectedDesign.png_url) as string}
                          alt={selectedDesign.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon size={20} className="text-slate-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                      <p className="font-bold text-slate-200 truncate">{selectedDesign.name}</p>
                      <p className="font-mono text-[10px] text-brand-400">Mã: {selectedDesign.code}</p>
                      {selectedDesign.theme && (
                        <p className="text-[10px] text-slate-400">
                          Chủ đề: <span className="text-violet-300 font-medium">{selectedDesign.theme}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Xem trước hình 2 & 3 nếu có */}
                  {(selectedDesign2 || selectedDesign3) && (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
                      {selectedDesign2 && (
                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px]">
                          {selectedDesign2.thumbnail_url || selectedDesign2.png_url ? (
                            <img
                              src={(selectedDesign2.thumbnail_url || selectedDesign2.png_url) as string}
                              alt=""
                              className="w-5 h-5 object-contain rounded shrink-0 bg-slate-900"
                            />
                          ) : null}
                          <span className="text-slate-400 font-semibold">Hình 2:</span>
                          <span className="font-medium text-slate-200 truncate max-w-[100px]">
                            {selectedDesign2.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              selectedDesign2.is_back ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/20 text-sky-300"
                            }`}
                          >
                            {selectedDesign2.is_back ? "Mặt sau" : "Mặt trước"}
                          </span>
                        </div>
                      )}
                      {selectedDesign3 && (
                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px]">
                          {selectedDesign3.thumbnail_url || selectedDesign3.png_url ? (
                            <img
                              src={(selectedDesign3.thumbnail_url || selectedDesign3.png_url) as string}
                              alt=""
                              className="w-5 h-5 object-contain rounded shrink-0 bg-slate-900"
                            />
                          ) : null}
                          <span className="text-slate-400 font-semibold">Hình 3:</span>
                          <span className="font-medium text-slate-200 truncate max-w-[100px]">
                            {selectedDesign3.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              selectedDesign3.is_back ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/20 text-sky-300"
                            }`}
                          >
                            {selectedDesign3.is_back ? "Mặt sau" : "Mặt trước"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 text-center text-[10px] text-slate-500 italic">
                  💡 Chọn Hình 1 (Chính) để xem trước ảnh và nhận biết phân loại hình in mặt trước / mặt sau.
                </div>
              )}
            </div>

            {/* Kiểu Mockup */}
            <div className="space-y-1 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <label className="block text-[10px] font-semibold text-slate-300">
                Loại hình mockup:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setBlankImageType("front")}
                  className={`p-1.5 rounded-lg border text-left text-xs transition-all flex items-center gap-1.5 ${
                    blankImageType === "front"
                      ? "bg-brand-500/10 border-brand-500/40 text-brand-400 font-semibold"
                      : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <span>👕</span>
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 text-[11px]">Mặt trước (1 Áo)</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBlankImageType("combined")}
                  className={`p-1.5 rounded-lg border text-left text-xs transition-all flex items-center gap-1.5 ${
                    blankImageType === "combined"
                      ? "bg-brand-500/10 border-brand-500/40 text-brand-400 font-semibold"
                      : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <span>👕👕</span>
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 text-[11px]">Trước & Sau (2 Mặt)</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Media Upload */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-300">
                  Album ảnh ({images.length}) & Video
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative w-8 h-8 rounded-md bg-slate-800 border border-slate-700 overflow-hidden group shrink-0"
                    >
                      <img src={img} alt="" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-0 right-0 p-0.5 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}

                  <label className="w-8 h-8 rounded-md border border-dashed border-slate-700 hover:border-brand-500 bg-slate-800/40 flex flex-col items-center justify-center text-slate-400 hover:text-brand-400 cursor-pointer shrink-0">
                    <Upload size={11} />
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>

                  <div className="flex-1 flex gap-1 min-w-[120px]">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Dán URL ảnh..."
                      className="flex-1 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-[11px] text-slate-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-200 border border-slate-700 shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="URL video (.mp4, youtube...)"
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-[11px] text-slate-200 outline-none"
                />
                <label className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 cursor-pointer flex items-center gap-1 shrink-0">
                  <Video size={11} /> Video
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                </label>
              </div>
            </div>
            {uploadingMedia && (
              <p className="text-[10px] text-brand-400 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> Đang tải file...
              </p>
            )}
          </div>
        </div>

        {/* CỘT PHẢI (5/12): DANH SÁCH BIẾN THỂ TỰ ĐỘNG & NÚT TẠO */}
        <div className="lg:col-span-5 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between shadow-md">
          <div className="space-y-2 flex-1 flex flex-col">
            {/* Header Cột Phải */}
            <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1">
                <Layers size={13} className="text-brand-400 shrink-0" />
                <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">
                  2. Biến thể ({variantItems.length})
                </h4>
              </div>
              {variantItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400">
                    Đã chọn: <strong className="text-brand-400">{selectedCount}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAllVariants(true)}
                    className="text-brand-400 hover:underline font-medium"
                  >
                    Tất cả
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => toggleAllVariants(false)}
                    className="text-slate-400 hover:underline"
                  >
                    Bỏ
                  </button>
                </div>
              )}
            </div>

            {/* Danh sách biến thể scrollable */}
            <div className="flex-1 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
              {!blankTypeId || !printDesignId ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl px-2 space-y-1">
                  <Sparkles size={18} className="mx-auto text-slate-600 animate-pulse" />
                  <p className="font-medium text-slate-400 text-[11px]">Chưa chọn Phôi & Hình in</p>
                  <p className="text-[10px] text-slate-500">Chọn bên trái để sinh biến thể.</p>
                </div>
              ) : variantItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-amber-400/90 border border-dashed border-amber-500/20 bg-amber-500/5 rounded-xl px-2">
                  Chưa có phôi màu & size thuộc loại này.
                </div>
              ) : (
                Object.entries(
                  variantItems.reduce<Record<string, VariantSelectionItem[]>>((acc, v) => {
                    if (!acc[v.color]) acc[v.color] = [];
                    acc[v.color].push(v);
                    return acc;
                  }, {})
                ).map(([colorName, colorVariants]) => {
                  const isAllColorSelected = colorVariants.every((cv) => cv.selected);
                  const isSomeColorSelected = colorVariants.some((cv) => cv.selected);

                  return (
                    <div key={colorName} className="rounded-lg bg-slate-900/90 border border-slate-800 p-2 space-y-1">
                      {/* Header chọn cả Phôi Màu */}
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[11px] text-slate-200">
                          <input
                            type="checkbox"
                            checked={isAllColorSelected}
                            ref={(input) => {
                              if (input) input.indeterminate = isSomeColorSelected && !isAllColorSelected;
                            }}
                            onChange={(e) => toggleColorGroup(colorName, e.target.checked)}
                            className="w-3 h-3 rounded border-slate-700 text-brand-500 focus:ring-brand-500/20 bg-slate-800 cursor-pointer"
                          />
                          <span>🎨 <strong className="text-brand-400">{formatColorName(colorName)}</strong></span>
                          <span className="text-[9px] font-normal text-slate-400">({colorVariants.length})</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => toggleColorGroup(colorName, !isAllColorSelected)}
                          className="text-[10px] text-brand-400 hover:underline"
                        >
                          {isAllColorSelected ? "Bỏ" : "Chọn"}
                        </button>
                      </div>

                      {/* Danh sách size thuộc phôi màu này */}
                      <div className="space-y-1">
                        {colorVariants.map((v) => (
                          <div
                            key={v.blank_id}
                            className={`flex items-center justify-between px-2 py-1 rounded border transition-colors ${
                              v.selected
                                ? "bg-brand-500/10 border-brand-500/30"
                                : "bg-slate-950/40 border-slate-800/60 opacity-60"
                            }`}
                          >
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] min-w-0">
                              <input
                                type="checkbox"
                                checked={v.selected}
                                onChange={() => toggleVariantItem(v.blank_id)}
                                className="w-3 h-3 rounded border-slate-700 text-brand-500 focus:ring-brand-500/20 bg-slate-800 cursor-pointer"
                              />
                              <span className="font-bold text-slate-200">{v.size}</span>
                              <span className="text-[9px] text-slate-500">({formatCurrency(v.blank_price)})</span>
                            </label>

                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <input
                                type="number"
                                value={v.price}
                                onChange={(e) => updateVariantPrice(v.blank_id, e.target.value)}
                                className="w-16 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-right text-[11px] text-slate-100 font-bold focus:border-brand-500 outline-none"
                              />
                              <span className="text-[9px] text-slate-400">đ</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 font-semibold px-1">{error}</p>}

          {/* Modal footer buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreateMasterProduct}
              disabled={saving || selectedCount === 0}
              className="flex-2 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Đang tạo...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Tạo ({selectedCount}) SP
                </>
              )}
            </button>
          </div>
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

/* Helper chuẩn hóa URL hình ảnh an toàn tuyệt đối */
function toMediaUrl(media: any): string | null {
  if (!media) return null;
  if (typeof media === "string") return media.trim();
  if (typeof media === "object") {
    if (media.url && typeof media.url === "string") return media.url.trim();
    if (media.publicUrl && typeof media.publicUrl === "string") return media.publicUrl.trim();
    if (media.src && typeof media.src === "string") return media.src.trim();
  }
  return String(media);
}

function isVideoUrl(media: any): boolean {
  const url = toMediaUrl(media);
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.includes("video") ||
    lower.includes("youtube.com") ||
    lower.includes("youtu.be")
  );
}

/* Modal Quản Lý & Tải Thêm Media / Video Sản Phẩm Chung */
function MasterGroupMediaModal({
  group,
  colorsList = [],
  onClose,
  onSaved,
}: {
  group: MasterProductGroup;
  colorsList?: Color[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const rawImages = Array.isArray(group?.images) ? group.images : [];
  const normalizedImages = rawImages
    .map((img) => toMediaUrl(img))
    .filter((u): u is string => Boolean(u));

  const [images, setImages] = useState<string[]>(normalizedImages);
  const [videoUrl, setVideoUrl] = useState<string>(toMediaUrl(group?.video_url) || "");
  const [imageUrlInput, setImageUrlInput] = useState("");

  const colorSubGroups = useMemo(() => getColorSubGroups(group?.variants || []), [group?.variants]);

  const defaultFirstMedia =
    normalizedImages[0] ||
    toMediaUrl(group?.video_url) ||
    toMediaUrl(colorSubGroups[0]?.preview_url) ||
    toMediaUrl(colorSubGroups[0]?.variants?.find((v) => v.preview_url)?.preview_url) ||
    toMediaUrl(colorSubGroups[0]?.blank_image) ||
    toMediaUrl(colorSubGroups[0]?.blank_image_back) ||
    null;

  const [selectedMedia, setSelectedMedia] = useState<string | null>(defaultFirstMedia);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Xác định sản phẩm là Mặt sau hay Mặt trước
  const isBack = Boolean(
    group?.print_design?.is_back ||
    group?.print_designs_list?.some((d) => d?.is_back) ||
    group?.variants?.[0]?.print_designs?.is_back ||
    group?.variants?.[0]?.blank_image_type === "back"
  );

  const [copyingImageIdx, setCopyingImageIdx] = useState<number | null>(null);
  const [copiedImageIdx, setCopiedImageIdx] = useState<number | null>(null);
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);
  const [copiedPromptTitle, setCopiedPromptTitle] = useState<string | null>(null);
  const [selectedPromptByVariant, setSelectedPromptByVariant] = useState<Record<number, string>>({});

  // Danh sách các mẫu AI Prompt (đồng bộ từ Supabase/localStorage hoặc mặc định)
  const [aiPromptsList, setAiPromptsList] = useState<AIPrompt[]>(() => {
    try {
      const cached = localStorage.getItem("sanpham_ai_prompts_cache_v4") || localStorage.getItem("sanpham_ai_prompts_cache_v3");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_AI_PROMPTS.map((p, i) => ({
      ...p,
      id: `default-${i}`,
      created_at: new Date().toISOString(),
    }));
  });

  useEffect(() => {
    async function loadAiPrompts() {
      try {
        const { data, error } = await supabase
          .from("ai_prompts")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: true });
        if (!error && data && data.length > 0) {
          setAiPromptsList(data as AIPrompt[]);
          localStorage.setItem("sanpham_ai_prompts_cache_v4", JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Không thể tải ai_prompts từ Supabase:", err);
      }
    }
    loadAiPrompts();
  }, []);

  // Phân loại các prompt vào các nhóm để hiển thị trong combobox
  const groupedPrompts = useMemo(() => {
    const targetSide = isBack ? "back" : "front";
    const activeList = aiPromptsList.filter(
      (p) => p.is_active !== false && (p.side === targetSide || p.side === "all")
    );
    const list = activeList.length > 0 ? activeList : aiPromptsList;

    const couples: AIPrompt[] = [];
    const females: AIPrompt[] = [];
    const males: AIPrompt[] = [];
    const others: AIPrompt[] = [];

    list.forEach((p) => {
      const t = (p.title + " " + p.prompt).toLowerCase();
      if (
        t.includes("cặp") ||
        t.includes("couple") ||
        t.includes("asian models") ||
        t.includes("both models") ||
        t.includes("two young adult")
      ) {
        couples.push(p);
      } else if (t.includes("female") || t.includes("mẫu nữ") || t.includes("nữ")) {
        females.push(p);
      } else if (t.includes("male") || t.includes("mẫu nam") || t.includes("nam")) {
        males.push(p);
      } else {
        others.push(p);
      }
    });

    return { couples, females, males, others };
  }, [aiPromptsList, isBack]);

  // Copy hình ảnh phôi vào clipboard để dán vào ChatGPT (Ctrl+V)
  async function handleCopyImage(rawImageUrl: string | null | undefined, idx: number) {
    const imageUrl = toMediaUrl(rawImageUrl);
    if (!imageUrl) {
      alert("Phôi này chưa có hình ảnh!");
      return;
    }
    setCopyingImageIdx(idx);
    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      const imgBlob = await response.blob();

      // Convert to pure PNG Blob for ChatGPT clipboard compatibility
      const pngBlob = await new Promise<Blob>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(imgBlob);
              return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => {
              if (b) resolve(b);
              else resolve(imgBlob);
            }, "image/png");
          } catch {
            resolve(imgBlob);
          }
        };
        img.onerror = () => {
          resolve(imgBlob);
        };
        img.src = URL.createObjectURL(imgBlob);
      });

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob,
        }),
      ]);

      setCopiedImageIdx(idx);
      setTimeout(() => setCopiedImageIdx(null), 3000);
    } catch (err) {
      console.warn("Clipboard API write failed, trying fallback copy url:", err);
      try {
        await navigator.clipboard.writeText(imageUrl);
        setCopiedImageIdx(idx);
        setTimeout(() => setCopiedImageIdx(null), 3000);
      } catch (e) {
        alert("Không thể copy ảnh tự động vào bộ nhớ tạm. Hãy nhấp chuột phải vào ảnh -> Sao chép hình ảnh.");
      }
    } finally {
      setCopyingImageIdx(null);
    }
  }

  // Copy câu Prompt (ngẫu nhiên hoặc từ combobox đã chọn)
  async function handleCopyPrompt(colorName: string, idx: number, specificPromptId?: string) {
    const targetSide = isBack ? "back" : "front";
    let chosenPrompt: AIPrompt | undefined;

    const promptIdToUse = specificPromptId || selectedPromptByVariant[idx];

    if (promptIdToUse && promptIdToUse !== "random") {
      chosenPrompt = aiPromptsList.find((p) => String(p.id) === String(promptIdToUse));
    }

    if (!chosenPrompt) {
      // Lọc mẫu prompt phù hợp theo side (front / back hoặc all)
      let eligible = aiPromptsList.filter(
        (p) => p.is_active !== false && (p.side === targetSide || p.side === "all")
      );

      if (eligible.length === 0) {
        eligible = aiPromptsList.filter((p) => p.is_active !== false);
      }
      if (eligible.length === 0) {
        eligible = DEFAULT_AI_PROMPTS.map((p, i) => ({
          ...p,
          id: `def-${i}`,
        }));
      }

      chosenPrompt = eligible[Math.floor(Math.random() * eligible.length)];
    }

    const rawTemplate = chosenPrompt?.prompt || "";
    if (!rawTemplate.trim()) {
      alert("Không tìm thấy mẫu prompt nào!");
      return;
    }

    let processedPrompt = rawTemplate
      .replace(/{color}/gi, colorName || "Màu tiêu chuẩn")
      .replace(/{blank_type}/gi, group?.blank_type?.name || "Áo thun")
      .replace(/{design_name}/gi, group?.print_design?.name || group?.master_name || "Họa tiết")
      .replace(/{side}/gi, isBack ? "mặt sau" : "mặt trước");

    // Nối thêm đoạn đầu câu: Asian model, Vietnamese nếu chưa có
    if (
      !processedPrompt.toLowerCase().startsWith("asian model") &&
      !processedPrompt.toLowerCase().startsWith("asian models")
    ) {
      processedPrompt = "Asian model, Vietnamese, " + processedPrompt;
    }

    try {
      await navigator.clipboard.writeText(processedPrompt);
      setCopiedPromptIdx(idx);
      setCopiedPromptTitle(chosenPrompt?.title || "Mẫu AI Prompt");
      setTimeout(() => {
        setCopiedPromptIdx(null);
        setCopiedPromptTitle(null);
      }, 3500);
    } catch (err) {
      alert("Không thể copy text tự động!");
    }
  }

  // Tải lên nhiều ảnh album
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
      if (uploadedUrls.length > 0 && !selectedMedia) {
        setSelectedMedia(uploadedUrls[0]);
      }
    } catch (err) {
      alert("Lỗi tải ảnh: " + (err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // Tải lên Video
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
      alert("Lỗi tải video: " + (err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // Thêm ảnh từ URL trực tiếp
  function addImageUrl() {
    const url = imageUrlInput.trim();
    if (!url) return;
    setImages((prev) => [...prev, url]);
    if (!selectedMedia) setSelectedMedia(url);
    setImageUrlInput("");
  }

  // Xóa ảnh khỏi album
  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // Lưu thay đổi Album ảnh & Video vào tất cả biến thể của sản phẩm này
  async function handleSaveMedia() {
    setSaving(true);
    try {
      const variantIds = (group?.variants || []).map((v) => v.id);
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

  const currentMediaUrl = toMediaUrl(selectedMedia);
  const isCurrentVideo = isVideoUrl(currentMediaUrl);

  return (
    <>
      <Modal open={true} onClose={onClose} title={`🎬 Album Media & Phôi Màu AI: ${group?.master_name || "Sản phẩm"}`} size="5xl" zIndex="z-[60]">
        <div className="space-y-4">
          {/* Top 2-Column Grid: Left is Massive Viewer, Right is Colors & Album */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* CỘT TRÁI (7 CỘT): MÀN HÌNH XEM MEDIA SIÊU TO KHỔNG LỒ & DÀI RỘNG */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Eye size={15} className="text-brand-400" /> Màn hình xem lớn (HD Preview)
                </label>
                {currentMediaUrl && !isCurrentVideo && (
                  <button
                    type="button"
                    onClick={() => setZoomModalOpen(true)}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1.5 bg-brand-500/10 hover:bg-brand-500/20 px-3 py-1.5 rounded-xl border border-brand-500/30 transition-all cursor-pointer shadow-sm"
                    title="Phóng to toàn màn hình chi tiết"
                  >
                    <ZoomIn size={14} /> Phóng to HD (Full Zoom)
                  </button>
                )}
              </div>

              {/* KHUNG ẢNH TO / VIDEO PLAYER */}
              <div className="w-full h-[450px] sm:h-[530px] lg:h-[620px] rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-700/80 overflow-hidden relative flex items-center justify-center shadow-2xl group">
                {currentMediaUrl ? (
                  isCurrentVideo ? (
                    <video src={currentMediaUrl} controls autoPlay className="w-full h-full object-contain" />
                  ) : (
                    <>
                      <img
                        src={currentMediaUrl}
                        alt="Preview"
                        onClick={() => setZoomModalOpen(true)}
                        className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
                      />
                      <div
                        onClick={() => setZoomModalOpen(true)}
                        className="absolute bottom-3 right-3 bg-slate-950/80 hover:bg-brand-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition-all shadow-lg opacity-80 group-hover:opacity-100"
                      >
                        <ZoomIn size={14} /> Bấm để phóng to
                      </div>
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Boxes size={48} className="text-slate-700 animate-pulse" />
                    <span className="text-xs">Chưa chọn hình ảnh hoặc video</span>
                  </div>
                )}
              </div>
            </div>

            {/* CỘT PHẢI (5 CỘT): PHÔI THEO MÀU & ALBUM MEDIA */}
            <div className="lg:col-span-5 space-y-3.5 max-h-[660px] overflow-y-auto pr-1">
              {/* SECTION 1: CÁC PHÔI THEO MÀU & COPY PROMPT */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-850 border border-slate-700/70 shadow-md space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={15} className="text-amber-400" />
                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                      Phôi Màu & Prompt AI
                    </h4>
                  </div>
                  <div className="text-[11px] px-2.5 py-0.5 rounded-full font-bold border bg-slate-900 border-slate-700">
                    {isBack ? <span className="text-purple-400">🔙 Mặt sau</span> : <span className="text-sky-400">👕 Mặt trước</span>}
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[350px] sm:max-h-[380px] overflow-y-auto pr-1">
                  {colorSubGroups.map((cg, idx) => {
                    const colorName = formatColorName(cg.color);
                    const colorObj = (colorsList || []).find(
                      (c) =>
                        (c?.name && c.name.toLowerCase() === (cg?.color || "").toLowerCase()) ||
                        (c?.code && c.code.toLowerCase() === (cg?.color || "").toLowerCase()) ||
                        (c?.name && c.name.toLowerCase() === (colorName || "").toLowerCase())
                    );
                    const targetBlankImg = isBack
                      ? toMediaUrl(cg.blank_image_back) || toMediaUrl(cg.blank_image)
                      : toMediaUrl(cg.blank_image) || toMediaUrl(cg.blank_image_back);
                    const targetProductImg =
                      toMediaUrl(cg.preview_url) ||
                      toMediaUrl(cg.variants?.find((v) => v.preview_url)?.preview_url) ||
                      targetBlankImg;

                    const isSelected = currentMediaUrl === targetProductImg;
                    const isCopyingImg = copyingImageIdx === idx;
                    const isCopiedImg = copiedImageIdx === idx;
                    const isCopiedPrompt = copiedPromptIdx === idx;
                    const curPromptVal = selectedPromptByVariant[idx] || "random";

                    return (
                      <div
                        key={idx}
                        onClick={() => targetProductImg && setSelectedMedia(targetProductImg)}
                        className={`flex flex-col gap-2 p-2.5 rounded-xl bg-slate-900/85 border transition-all cursor-pointer ${
                          isSelected
                            ? "border-brand-500 ring-2 ring-brand-500/30 bg-brand-950/20"
                            : "border-slate-700/80 hover:border-slate-600 hover:bg-slate-800/60"
                        }`}
                      >
                        {/* Hàng 1: Thumbnail + Tên màu + Nút Copy Ảnh & Nút Random Prompt */}
                        <div className="flex items-center gap-2.5">
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-700/80 overflow-hidden shrink-0 relative flex items-center justify-center">
                            {targetProductImg ? (
                              <img src={targetProductImg} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-slate-500">No img</span>
                            )}
                          </div>

                          {/* Thông tin màu & 2 nút thao tác chính */}
                          <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-500 shrink-0 shadow-sm"
                                  style={{ background: colorObj?.hex || "#ccc" }}
                                />
                                <span className="text-xs font-bold text-slate-200 truncate">
                                  {colorName}
                                </span>
                              </div>
                              {colorObj?.code && (
                                <span className="text-[10px] font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.2 rounded border border-brand-500/20 shrink-0">
                                  {colorObj.code}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleCopyImage(targetProductImg, idx)}
                                disabled={isCopyingImg}
                                className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                  isCopiedImg
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600"
                                }`}
                                title="Copy ảnh sản phẩm (đã ghép) để dán (Ctrl+V) vào ChatGPT"
                              >
                                {isCopyingImg ? (
                                  <Loader2 size={11} className="animate-spin text-brand-400" />
                                ) : isCopiedImg ? (
                                  <Check size={11} className="text-emerald-400" />
                                ) : (
                                  <Copy size={11} className="text-sky-400" />
                                )}
                                <span className="truncate">{isCopiedImg ? "Đã copy ảnh" : "Copy ảnh SP"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyPrompt(colorName, idx, "random")}
                                className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                  isCopiedPrompt && curPromptVal === "random"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 border border-brand-500/30 hover:border-brand-500/50"
                                }`}
                                title={
                                  isCopiedPrompt && copiedPromptTitle
                                    ? `Đã copy: ${copiedPromptTitle}`
                                    : "Bốc ngẫu nhiên 1 câu Prompt từ kho mẫu AI Prompts cho màu này"
                                }
                              >
                                {isCopiedPrompt && curPromptVal === "random" ? (
                                  <Check size={11} className="text-emerald-400" />
                                ) : (
                                  <Sparkles size={11} className="text-amber-400" />
                                )}
                                <span className="truncate">{isCopiedPrompt && curPromptVal === "random" ? "Đã chép ngẫu nhiên" : "🎲 Random AI"}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Hàng 2: COMBOBOX CHỌN MẪU PROMPT CỤ THỂ + NÚT COPY MẪU */}
                        <div
                          className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={curPromptVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedPromptByVariant((prev) => ({ ...prev, [idx]: val }));
                              if (val && val !== "random") {
                                handleCopyPrompt(colorName, idx, val);
                              }
                            }}
                            className="flex-1 bg-slate-950 text-slate-200 text-[11px] border border-slate-700/90 rounded-lg px-2 py-1 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 truncate"
                            title="Chọn mẫu Prompt cụ thể theo bối cảnh hoặc model"
                          >
                            <option value="random">🎯 Chọn mẫu Prompt cụ thể (hoặc Random)...</option>
                            
                            {groupedPrompts.couples.length > 0 && (
                              <optgroup label={`👫 Cặp Nam & Nữ (${groupedPrompts.couples.length} mẫu)`}>
                                {groupedPrompts.couples.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {groupedPrompts.females.length > 0 && (
                              <optgroup label={`👩 Mẫu Nữ / Female (${groupedPrompts.females.length} mẫu)`}>
                                {groupedPrompts.females.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {groupedPrompts.males.length > 0 && (
                              <optgroup label={`👨 Mẫu Nam / Male (${groupedPrompts.males.length} mẫu)`}>
                                {groupedPrompts.males.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {groupedPrompts.others.length > 0 && (
                              <optgroup label={`✨ Mẫu Khác (${groupedPrompts.others.length} mẫu)`}>
                                {groupedPrompts.others.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(colorName, idx, curPromptVal)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-sm ${
                              isCopiedPrompt && curPromptVal !== "random"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-brand-600 hover:bg-brand-500 text-white border border-brand-500/40"
                            }`}
                            title="Sao chép câu Prompt theo mẫu đã chọn trong combobox"
                          >
                            {isCopiedPrompt && curPromptVal !== "random" ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span>Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: ALBUM MEDIA CHUNG */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-850 border border-slate-700/70 shadow-md space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-brand-400" /> Album Ảnh Chung ({images.length})
                  </label>
                  {images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setImages([]);
                        setSelectedMedia(defaultFirstMedia);
                      }}
                      className="text-[10px] text-rose-400 hover:underline font-medium"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedMedia(img)}
                      className={`relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-slate-900 border overflow-hidden cursor-pointer group shrink-0 transition-all ${
                        currentMediaUrl === img
                          ? "border-brand-500 ring-2 ring-brand-500/40 scale-105"
                          : "border-slate-700/80 opacity-80 hover:opacity-100 hover:border-slate-600"
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
                        <X size={11} />
                      </button>
                    </div>
                  ))}

                  {/* Nút Tải ảnh mới */}
                  <label className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl border-2 border-dashed border-slate-700 hover:border-brand-500 bg-slate-900/60 flex flex-col items-center justify-center text-slate-400 hover:text-brand-400 cursor-pointer transition-all shrink-0">
                    <Upload size={18} />
                    <span className="text-[10px] mt-1 font-medium">Tải ảnh</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>

                {/* Ô URL */}
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Dán link URL ảnh..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-slate-200 outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={addImageUrl}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 shrink-0"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* SECTION 3: VIDEO */}
              <div className="p-3 rounded-2xl bg-slate-850 border border-slate-700/70 shadow-md space-y-2">
                <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                  <Video size={14} className="text-indigo-400" /> Video Giới Thiệu
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Link video (.mp4, youtube embed...)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-slate-200 outline-none focus:border-brand-500"
                  />
                  <label className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer flex items-center justify-center gap-1 shrink-0">
                    <Video size={13} className="text-indigo-400" /> Tải lên
                    <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  </label>
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={() => setVideoUrl("")}
                      className="px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-medium hover:bg-rose-500/20 shrink-0"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              {uploading && (
                <p className="text-xs text-brand-400 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> Đang tải file phương tiện lên...
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveMedia}
              disabled={saving || uploading}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-xs sm:text-sm font-semibold hover:bg-brand-600 flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-colors"
            >
              {saving && <Loader2 size={16} className="animate-spin" />} Lưu Album Media
            </button>
          </div>
        </div>
      </Modal>

      {/* Image Zoom Modal phóng to HD */}
      {zoomModalOpen && currentMediaUrl && !isCurrentVideo && (
        <ImageZoomModal
          open={zoomModalOpen}
          onClose={() => setZoomModalOpen(false)}
          imageUrl={currentMediaUrl}
          title={`Chi tiết: ${group?.master_name || "Sản phẩm"}`}
        />
      )}
    </>
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
        {mockupImage && (
          <a
            href={mockupImage}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/85 hover:bg-slate-950 text-brand-400 hover:text-brand-300 border border-slate-700/80 text-[11px] font-semibold flex items-center gap-1 shadow-md z-10"
            title="Mở ảnh gốc trong tab mới để xem siêu rõ (Link R2 / HD)"
          >
            <ExternalLink size={12} />
            <span>Mở link R2</span>
          </a>
        )}
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

/* Modal Chi Tiết Sản Phẩm & Danh Sách Biến Thể Theo Phôi Màu */
function MasterProductDetailModal({
  group,
  onClose,
  onEditMaster,
  onMediaMaster,
  onDeleteMaster,
  onEditVariant,
  onDeleteVariant,
  onPreviewVariant,
  onOpenMockupEditor,
  onZoomImage,
  onReRenderColor,
  onReRenderAllColors,
}: {
  group: MasterProductGroup;
  onClose: () => void;
  onEditMaster: (group: MasterProductGroup) => void;
  onMediaMaster: (group: MasterProductGroup) => void;
  onDeleteMaster: (group: MasterProductGroup) => void;
  onEditVariant: (v: Product) => void;
  onDeleteVariant: (v: Product) => void;
  onPreviewVariant: (v: Product) => void;
  onOpenMockupEditor: (target: MockupEditorTarget) => void;
  onZoomImage: (data: { url?: string; title?: string; images?: ZoomImageItem[]; initialIndex?: number }) => void;
  onReRenderColor: (group: MasterProductGroup, cg: ReturnType<typeof getColorSubGroups>[0]) => Promise<boolean>;
  onReRenderAllColors: (group: MasterProductGroup) => Promise<void>;
}) {
  const [reRenderingColor, setReRenderingColor] = useState<string | null>(null);
  const [reRenderingAll, setReRenderingAll] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [successAll, setSuccessAll] = useState(false);
  const [successColor, setSuccessColor] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string>("");

  const colorSubGroups = getColorSubGroups(group.variants);
  const colorMockupImages = colorSubGroups
    .map((cg) => {
      const rawBlankImage =
        cg.blank_image_type === "combined" && cg.blank_image_back
          ? cg.blank_image_back
          : cg.blank_image || cg.blank_image_back;
      return cg.preview_url || rawBlankImage;
    })
    .filter(Boolean) as string[];

  const firstSubGroup = colorSubGroups[0];
  const firstVariant = group.variants[0];
  const firstRawBlankImage = firstSubGroup
    ? firstSubGroup.blank_image_type === "combined" && firstSubGroup.blank_image_back
      ? firstSubGroup.blank_image_back
      : firstSubGroup.blank_image || firstSubGroup.blank_image_back
    : null;

  const mainImage = firstSubGroup?.preview_url || firstRawBlankImage || colorMockupImages[0] || null;
  const hasRenderedMockup = !!firstSubGroup?.preview_url;
  const printPng = hasRenderedMockup ? null : group.print_design?.png_url;

  const firstPos = firstVariant?.print_position || (
    firstVariant?.blank_image_type === "combined"
      ? { posX: 28, posY: 38, scale: 35 }
      : { posX: 50, posY: 38, scale: 45 }
  );

  const designsList = (
    group.print_designs_list && group.print_designs_list.length > 0
      ? group.print_designs_list
      : group.print_design
      ? [group.print_design]
      : []
  ).filter((pd): pd is PrintDesign => Boolean(pd && pd.name));

  const variantZoomImages: ZoomImageItem[] = colorSubGroups
    .map((cg) => {
      const rawBlankImage =
        cg.blank_image_type === "combined" && cg.blank_image_back
          ? cg.blank_image_back
          : cg.blank_image || cg.blank_image_back;
      const mockupUrl = cg.preview_url || rawBlankImage;
      if (!mockupUrl) return null;
      return {
        url: mockupUrl,
        title: `${group.master_name} - Màu ${formatColorName(cg.color)}`,
        label: `Màu ${formatColorName(cg.color)} (${cg.variants.length} size)`,
      };
    })
    .filter(Boolean) as ZoomImageItem[];

  if (group.images && group.images.length > 0) {
    group.images.forEach((url, i) => {
      variantZoomImages.push({
        url,
        title: `${group.master_name} - Album media ${i + 1}`,
        label: `Media ${i + 1}`,
      });
    });
  }

  return (
    <Modal open={true} onClose={onClose} title={`Chi tiết: ${group.master_name}`} size="2xl">
      <div className="space-y-4">
        {/* Thông báo Toast Thành Công khi Ghép Mockup */}
        {toastMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Banner Tổng Quan Sản Phẩm Chung */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-md flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            {/* Ảnh đại diện Master Product */}
            <div
              onClick={() =>
                mainImage &&
                onZoomImage({
                  url: mainImage,
                  title: `${group.master_name} - Ảnh đại diện`,
                  images: variantZoomImages,
                  initialIndex: 0,
                })
              }
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-950 border-2 border-slate-700 overflow-hidden shrink-0 flex items-center justify-center cursor-zoom-in group/img shadow-md"
              title="Nhấp chuột để xem dải ảnh toàn bộ các biến thể"
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
                  style={{
                    left: `${firstPos.posX ?? (firstVariant?.blank_image_type === "combined" ? 28 : 50)}%`,
                    top: `${firstPos.posY ?? 38}%`,
                    width: `${firstPos.scale ?? (firstVariant?.blank_image_type === "combined" ? 35 : 45)}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className="absolute object-contain pointer-events-none"
                />
              )}
            </div>

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  {group.master_code}
                </span>
                {group.blank_type && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-medium">
                    Phôi: {group.blank_type.name}
                  </span>
                )}
                {designsList.map((pd, idx) => (
                  <span
                    key={pd.id || idx}
                    className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700/60 flex items-center gap-1 font-medium"
                  >
                    {pd.png_url && (
                      <img
                        src={pd.png_url}
                        alt=""
                        onClick={() =>
                          onZoomImage({
                            url: pd.png_url!,
                            title: `Hình in ${idx + 1}: ${pd.name}`,
                          })
                        }
                        className="w-4 h-4 object-contain rounded bg-slate-900 border border-slate-700 cursor-zoom-in"
                        title="Phóng to hình in"
                      />
                    )}
                    <span>Hình {idx + 1}: <strong>{pd.name}</strong></span>
                  </span>
                ))}
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {group.master_name}
              </h2>

              <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-wrap">
                <span className="text-emerald-400 font-bold text-sm">
                  {group.minPrice === group.maxPrice
                    ? formatCurrency(group.minPrice)
                    : `${formatCurrency(group.minPrice)} - ${formatCurrency(group.maxPrice)}`}
                </span>
                <span>•</span>
                <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                  🎨 {colorSubGroups.length} phôi màu ({group.variants.length} biến thể size)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap">
            {/* Nút Ghép lại toàn bộ các phôi màu sang ảnh HD R2 */}
            <button
              type="button"
              onClick={async () => {
                setReRenderingAll(true);
                setProgressText(`Đang ghép (0/${colorSubGroups.length})...`);
                try {
                  const res = await onReRenderAllColors(group, (cur, tot, col) => {
                    setProgressText(`Đang ghép ${cur}/${tot}: ${col}...`);
                  });
                  setSuccessAll(true);
                  setToastMsg(`🎉 Đã ghép lại thành công ${res.success}/${res.total} phôi màu sang ảnh HD từ Cloudflare R2!`);
                  setTimeout(() => setSuccessAll(false), 4000);
                  setTimeout(() => setToastMsg(null), 4000);
                } catch (err) {
                  alert("Lỗi khi ghép ảnh: " + (err as Error).message);
                } finally {
                  setReRenderingAll(false);
                  setProgressText("");
                }
              }}
              disabled={reRenderingAll || !!reRenderingColor}
              className={`px-3 py-2 rounded-xl transition-all font-semibold text-xs flex items-center gap-1.5 border cursor-pointer disabled:opacity-50 shadow-sm ${
                successAll
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
                  : "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"
              }`}
              title="Tự động lấy ảnh gốc HD từ Cloudflare R2 ghép lại cho TẤT CẢ các phôi màu của sản phẩm này"
            >
              {reRenderingAll ? (
                <Loader2 size={14} className="animate-spin text-emerald-400" />
              ) : successAll ? (
                <CheckCircle2 size={14} className="text-white" />
              ) : (
                <RefreshCw size={14} className="text-emerald-400" />
              )}
              <span>
                {reRenderingAll
                  ? progressText || "Đang ghép tất cả màu..."
                  : successAll
                  ? "✅ Đã ghép xong tất cả màu!"
                  : "⚡ Ghép lại tất cả màu (HD R2)"}
              </span>
            </button>

            <button
              onClick={() => onMediaMaster(group)}
              className="px-3 py-2 rounded-xl text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <ImageIcon size={14} /> Media ({group.images?.length || 0})
            </button>
            <button
              onClick={() => onEditMaster(group)}
              className="px-3 py-2 rounded-xl text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-xs font-medium flex items-center gap-1.5 border border-amber-500/30 cursor-pointer"
            >
              <Pencil size={14} /> Sửa SP chung
            </button>
          </div>
        </div>

        {/* Danh sách biến thể theo Phôi Màu */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers size={14} className="text-brand-400" /> Các phôi màu & Biến thể size ({colorSubGroups.length} phôi màu)
            </h4>
          </div>

          <div className="space-y-3.5 max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
            {colorSubGroups.map((cg) => {
              const rawBlankImage =
                cg.blank_image_type === "combined" && cg.blank_image_back
                  ? cg.blank_image_back
                  : cg.blank_image || cg.blank_image_back;
              const colorMockupImage = cg.preview_url || rawBlankImage;

              return (
                <div
                  key={cg.color}
                  className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm transition-all"
                >
                  {/* Header Phôi Màu */}
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() =>
                          colorMockupImage &&
                          onZoomImage({
                            url: colorMockupImage,
                            title: `${group.master_name} - Phôi Màu ${formatColorName(cg.color)}`,
                            images: variantZoomImages,
                            initialIndex: colorSubGroups.findIndex((c) => c.color === cg.color),
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
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Nút Ghép Lại Hình HD (R2) Cho Màu Này */}
                      <button
                        type="button"
                        onClick={async () => {
                          setReRenderingColor(cg.color);
                          try {
                            const ok = await onReRenderColor(group, cg);
                            if (ok) {
                              setSuccessColor(cg.color);
                              setToastMsg(`✅ Đã ghép lại thành công ảnh HD (R2) cho màu ${formatColorName(cg.color)}!`);
                              setTimeout(() => setSuccessColor(null), 3000);
                              setTimeout(() => setToastMsg(null), 3000);
                            }
                          } finally {
                            setReRenderingColor(null);
                          }
                        }}
                        disabled={reRenderingColor === cg.color || reRenderingAll}
                        className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 border cursor-pointer disabled:opacity-50 ${
                          successColor === cg.color
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}
                        title={`Tự động lấy ảnh gốc HD từ Cloudflare R2 ghép lại hình theo vị trí đã lưu cho màu ${formatColorName(cg.color)}`}
                      >
                        {reRenderingColor === cg.color ? (
                          <Loader2 size={14} className="animate-spin text-emerald-400" />
                        ) : successColor === cg.color ? (
                          <Check size={14} />
                        ) : (
                          <RefreshCw size={14} className="text-emerald-400" />
                        )}
                        <span>
                          {reRenderingColor === cg.color
                            ? "Đang ghép lại..."
                            : successColor === cg.color
                            ? "Đã ghép xong!"
                            : "⚡ Ghép lại hình HD (R2)"}
                        </span>
                      </button>

                      <button
                        type="button"
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

                          onOpenMockupEditor({
                            masterCode: `${group.master_code}_${cg.color}`,
                            masterGroupCode: group.master_code,
                            colorName: formatColorName(cg.color),
                            blankImageUrl: cg.blank_image,
                            blankImageBackUrl: cg.blank_image_back,
                            printDesignUrl: group.print_design?.png_url || null,
                            printDesigns: targetDesigns,
                            variantIds: cg.variants.map((v) => v.id),
                            allColorSubGroups: colorSubGroups.map((c) => ({
                              color: c.color,
                              blank_image: c.blank_image,
                              blank_image_back: c.blank_image_back,
                              blank_image_type: c.blank_image_type,
                              variantIds: c.variants.map((v) => v.id),
                            })),
                            initialPosition: cg.variants.find((v) => v.print_position)?.print_position || cg.variants[0]?.print_position || null,
                            initialPositions: cg.variants.find((v) => v.print_positions)?.print_positions || null,
                            initialImageType: cg.blank_image_type || "front",
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors text-xs font-semibold flex items-center gap-1.5 border border-brand-500/30 cursor-pointer"
                        title={`Kéo thả & Chỉnh vị trí hình in riêng cho áo màu ${formatColorName(cg.color)}`}
                      >
                        <Sparkles size={14} /> Chỉnh vị trí in
                      </button>
                    </div>
                  </div>

                  {/* Bảng danh sách Size của phôi màu này */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-400 uppercase font-medium bg-slate-950/40">
                          <th className="px-4 py-2.5">Mã biến thể</th>
                          <th className="px-4 py-2.5">Kích thước</th>
                          <th className="px-4 py-2.5 text-right">Giá phôi</th>
                          <th className="px-4 py-2.5 text-right">Giá bán</th>
                          <th className="px-4 py-2.5 text-center">Trạng thái</th>
                          <th className="px-4 py-2.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {cg.variants.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-brand-400 font-medium whitespace-nowrap">
                              {v.code}
                            </td>
                            <td className="px-4 py-2.5 text-slate-200">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-medium">
                                {v.blanks?.size || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-400 font-mono whitespace-nowrap">
                              {formatCurrency(Number(v.blanks?.price || 0))}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-100 font-bold font-mono whitespace-nowrap">
                              {formatCurrency(Number(v.price))}
                            </td>
                            <td className="px-4 py-2.5 text-center">
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
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => onPreviewVariant(v)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                                  title="Xem preview biến thể"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => onEditVariant(v)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                  title="Sửa giá"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => onDeleteVariant(v)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  title="Xóa biến thể này"
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
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
