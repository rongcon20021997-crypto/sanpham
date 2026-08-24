import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType, Color } from "@/lib/types";
import { PageHeader, SearchInput } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import {
  getShopeeShops,
  fetchShopeeShops,
  getShopeePresetCategories,
  fetchShopeePresetCategories,
  getShopeeDefaultLogisticsConfig,
  fetchShopeeDefaultLogisticsConfig,
  fetchShopeePublishedProducts,
  publishProductToShopeeComplete,
  deleteShopeePublishedProduct,
  getShopeeSizeChartUrl,
  fetchShopeeAppConfig,
  fetchShopeeLogisticsChannels,
  SHOPEE_STANDARD_FASHION_ATTRIBUTES,
  getDefaultFashionAttributes,
  type ShopeeShop,
  type ShopeePresetCategory,
  type ShopeeDefaultLogisticsConfig,
  type ShopeePublishedProduct,
  type ShopeeLogisticsChannel,
  type PublishShopeeProductInput,
} from "@/lib/shopee";
import { formatCurrency, formatColorName, uploadFile } from "@/lib/helpers";
import {
  ShoppingBag,
  Store,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
  ChevronRight,
  Loader2,
  Trash2,
  Eye,
  Sliders,
  Tag,
  Package,
  Truck,
  Box,
  Image as ImageIcon,
  CheckSquare,
  Square,
  HelpCircle,
  Save,
  Rocket,
  Check,
  RotateCcw,
  Star,
  Plus,
  Upload,
  Ruler,
} from "lucide-react";

interface MasterProductGroup {
  key: string;
  master_code: string;
  master_name: string;
  shopee_name?: string | null;
  shopee_description?: string | null;
  is_optimized: boolean;
  images: string[];
  blank_type?: BlankType;
  print_designs: PrintDesign[];
  colors: string[];
  sizes: string[];
  variants: Product[];
  minPrice: number;
  maxPrice: number;
  publishedRecord?: ShopeePublishedProduct | null;
}

export function ShopeePublishPage({ onNavigateToSettings }: { onNavigateToSettings?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [designs, setDesigns] = useState<PrintDesign[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [allColors, setAllColors] = useState<Color[]>([]);

  // Shopee settings state
  const [shops, setShops] = useState<ShopeeShop[]>(getShopeeShops());
  const [presetCategories, setPresetCategories] = useState<ShopeePresetCategory[]>(getShopeePresetCategories());
  const [logisticsConfig, setLogisticsConfig] = useState<ShopeeDefaultLogisticsConfig>(getShopeeDefaultLogisticsConfig());
  const [publishedList, setPublishedList] = useState<ShopeePublishedProduct[]>([]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterShopId, setFilterShopId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "unpublished">("all");
  const [filterBlankType, setFilterBlankType] = useState<string>("");

  // Modal Review & Publish state
  const [selectedGroup, setSelectedGroup] = useState<MasterProductGroup | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form fields inside Modal
  const [targetShopId, setTargetShopId] = useState<string>("");
  const [targetCategoryId, setTargetCategoryId] = useState<number>(0);
  const [targetAttributes, setTargetAttributes] = useState<Record<string, string>>({});
  const [targetItemName, setTargetItemName] = useState<string>("");
  const [targetDescription, setTargetDescription] = useState<string>("");
  const [targetImages, setTargetImages] = useState<string[]>([]);
  const [targetSizeChartUrl, setTargetSizeChartUrl] = useState<string>("");
  const [newImageUrl, setNewImageUrl] = useState<string>("");
  const [targetWeight, setTargetWeight] = useState<number>(200); // 200g
  const [targetLength, setTargetLength] = useState<number>(20);
  const [targetWidth, setTargetWidth] = useState<number>(15);
  const [targetHeight, setTargetHeight] = useState<number>(5);

  // Kênh vận chuyển trong Modal
  const [availableChannels, setAvailableChannels] = useState<ShopeeLogisticsChannel[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [loadingChannels, setLoadingChannels] = useState<boolean>(false);

  // Variant models matrix inside modal
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [variantModels, setVariantModels] = useState<
    {
      color: string;
      size: string;
      price: number;
      stock: number;
      sku: string;
      enabled: boolean;
    }[]
  >([]);

  // Shopee Item ID (nếu đã tồn tại trên sàn → update thay vì tạo mới)
  const [existingShopeeItemId, setExistingShopeeItemId] = useState<string>("");

  // Quick edit bulk price/stock
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkStock, setBulkStock] = useState<string>("");

  // Publishing progress state
  const [publishing, setPublishing] = useState(false);
  const [publishProgressText, setPublishProgressText] = useState<string>("");
  const [publishPercent, setPublishPercent] = useState<number>(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccessUrl, setPublishSuccessUrl] = useState<string | null>(null);

  // Load all data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [pRes, bRes, dRes, tRes, cRes, shps, presets, logCfg, pubs] = await Promise.all([
          supabase
            .from("products")
            .select("*, blanks(*, blank_types(*)), print_designs(*)")
            .order("created_at", { ascending: false }),
          supabase.from("blanks").select("*, blank_types(*)").order("code"),
          supabase.from("print_designs").select("*").order("code"),
          supabase.from("blank_types").select("*").order("name"),
          supabase.from("colors").select("*").order("name"),
          fetchShopeeShops(),
          fetchShopeePresetCategories(),
          fetchShopeeDefaultLogisticsConfig(),
          fetchShopeePublishedProducts(),
          fetchShopeeAppConfig(),
        ]);

        setProducts((pRes.data as Product[]) || []);
        setBlanks((bRes.data as Blank[]) || []);
        setDesigns((dRes.data as PrintDesign[]) || []);
        setTypes((tRes.data as BlankType[]) || []);
        setAllColors((cRes.data as Color[]) || []);
        setShops(shps);
        setPresetCategories(presets);
        setLogisticsConfig(logCfg);
        setPublishedList(pubs);

        // Default selected shop
        const defaultShop = shps.find((s) => s.isDefault) || shps[0];
        if (defaultShop && !filterShopId) {
          setFilterShopId(defaultShop.shopId);
        }
      } catch (err) {
        console.error("Lỗi load dữ liệu sản phẩm sàn:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Map master products group
  const masterGroups = useMemo(() => {
    const map = new Map<string, MasterProductGroup>();

    const blanksMap = new Map(blanks.map((b) => [b.id, b]));
    const designsMap = new Map(designs.map((d) => [d.id, d]));
    const typesMap = new Map(types.map((t) => [t.id, t]));

    for (const p of products) {
      const b = p.blank_id ? blanksMap.get(p.blank_id) || p.blanks : p.blanks;
      const d = p.print_design_id ? designsMap.get(p.print_design_id) || p.print_designs : p.print_designs;
      const bt = b?.blank_types || (b?.blank_type_id ? typesMap.get(b.blank_type_id) : undefined);

      const groupCode = p.master_code || (b && d ? `${b.code}-${d.code}` : p.code);
      const groupName = p.master_name || (b && d ? `${bt?.name || "Áo"} ${d.name}` : p.name);

      if (!map.has(groupCode)) {
        const published = publishedList.find((pub) => pub.master_code === groupCode);
        map.set(groupCode, {
          key: groupCode,
          master_code: groupCode,
          master_name: groupName,
          shopee_name: p.shopee_name,
          shopee_description: p.shopee_description,
          is_optimized: Boolean(p.is_optimized),
          images: Array.isArray(p.images) ? [...p.images] : [],
          blank_type: bt,
          print_designs: d ? [d] : [],
          colors: [],
          sizes: [],
          variants: [],
          minPrice: p.price,
          maxPrice: p.price,
          publishedRecord: published || null,
        });
      }

      const g = map.get(groupCode)!;
      g.variants.push(p);

      if (p.price < g.minPrice) g.minPrice = p.price;
      if (p.price > g.maxPrice) g.maxPrice = p.price;

      const color = b?.color || (p as any).color || "Tiêu chuẩn";
      const size = b?.size || (p as any).size || "Freesize";

      if (color && !g.colors.includes(color)) g.colors.push(color);
      if (size && !g.sizes.includes(size)) g.sizes.push(size);

      // Chỉ lấy hình ảnh media do bạn đã tải lên cho sản phẩm (p.images)
      if ((!g.images || g.images.length === 0) && Array.isArray(p.images) && p.images.length > 0) {
        g.images = [...p.images];
      } else if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (img && typeof img === "string" && !g.images.includes(img)) {
            g.images.push(img);
          }
        }
      }
    }

    return Array.from(map.values());
  }, [products, blanks, designs, types, publishedList]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return masterGroups.filter((g) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchCode = g.master_code.toLowerCase().includes(q);
        const matchName = g.master_name.toLowerCase().includes(q);
        const matchShopee = (g.shopee_name || "").toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchShopee) return false;
      }

      if (filterBlankType && g.blank_type?.id !== Number(filterBlankType)) {
        return false;
      }

      if (filterStatus === "published" && !g.publishedRecord) return false;
      if (filterStatus === "unpublished" && g.publishedRecord) return false;

      return true;
    });
  }, [masterGroups, searchTerm, filterBlankType, filterStatus]);

  // Khi người dùng bấm "Xem & Đẩy sàn", mở Modal và khởi tạo đầy đủ dữ liệu cấu hình
  function openPublishModal(group: MasterProductGroup) {
    setSelectedGroup(group);
    setPublishError(null);
    setPublishSuccessUrl(null);
    setPublishPercent(0);
    setPublishProgressText("");

    // Nếu sản phẩm đã đẩy sàn trước đó → prefill ID
    setExistingShopeeItemId(
      group.publishedRecord?.shopee_item_id ? String(group.publishedRecord.shopee_item_id) : ""
    );

    // Chọn Shop mục tiêu (mặc định là shop chính)
    const activeShop = shops.find((s) => s.shopId === filterShopId) || shops.find((s) => s.isDefault) || shops[0];
    const sId = activeShop ? activeShop.shopId : "";
    setTargetShopId(sId);

    // Chọn danh mục mẫu mặc định & nạp thuộc tính mẫu
    const defaultPreset = presetCategories.find((p) => p.isDefault) || presetCategories[0];
    const initialCatId = defaultPreset?.categoryId || 100017;
    setTargetCategoryId(initialCatId);
    setTargetAttributes(
      defaultPreset?.attributes && Object.keys(defaultPreset.attributes).length > 0
        ? { ...defaultPreset.attributes }
        : getDefaultFashionAttributes()
    );

    // Tên & mô tả Shopee
    setTargetItemName(group.shopee_name || group.master_name);
    setTargetDescription(
      group.shopee_description ||
        `Áo thun in hình thiết kế cao cấp thương hiệu MEO BAO. Chất liệu cotton mềm mịn, thoáng mát, hình in sắc nét bền màu theo thời gian.\n\n- Chất liệu: 100% Cotton cao cấp\n- Form dáng: Oversize / Chuẩn form trẻ trung\n- Hướng dẫn giặt: Giặt máy nhẹ hoặc giặt tay, lộn trái khi giặt.`
    );

    // Chỉ lấy hình ảnh media do bạn đã tải lên cho sản phẩm (p.images)
    const mediaImgs: string[] = [];
    if (Array.isArray(group.images)) {
      for (const img of group.images) {
        if (img && typeof img === "string" && !mediaImgs.includes(img)) {
          mediaImgs.push(img);
        }
      }
    }
    setTargetImages(mediaImgs.slice(0, 9));
    setNewImageUrl("");

    // Bảng quy đổi kích cỡ (Size Chart): Mặc định nạp ảnh từ Cài đặt
    setTargetSizeChartUrl(getShopeeSizeChartUrl() || "");

    // Trọng lượng & đóng gói từ cấu hình vận chuyển
    const defaultWeightGram = Math.round(Number(logisticsConfig.defaultWeightKg || logisticsConfig.packageWeight || 0.2) * 1000);
    setTargetWeight(defaultWeightGram > 0 ? defaultWeightGram : 200);
    setTargetLength(logisticsConfig.defaultLengthCm || logisticsConfig.packageLength || 20);
    setTargetWidth(logisticsConfig.defaultWidthCm || logisticsConfig.packageWidth || 15);
    setTargetHeight(logisticsConfig.defaultHeightCm || logisticsConfig.packageHeight || 5);

    // Nạp kênh vận chuyển
    const initialSelectedIds = Array.isArray(logisticsConfig.selectedChannelIds) ? [...logisticsConfig.selectedChannelIds] : [];
    setSelectedChannelIds(initialSelectedIds);

    if (sId) {
      setLoadingChannels(true);
      fetchShopeeLogisticsChannels(sId)
        .then((res) => {
          if (res?.channels && Array.isArray(res.channels)) {
            setAvailableChannels(res.channels);
            if (initialSelectedIds.length === 0) {
              // Mặc định chọn các kênh Nhanh/Tiết kiệm, tự động bỏ Hỏa tốc & Hàng cồng kềnh
              const autoIds = res.channels
                .filter((ch) => ch.enabled && !ch.channelName.toLowerCase().includes("hỏa tốc") && !ch.channelName.toLowerCase().includes("cồng kềnh"))
                .map((ch) => ch.channelId);
              setSelectedChannelIds(autoIds.length > 0 ? autoIds : res.channels.filter((c) => c.enabled).map((c) => c.channelId));
            }
          }
        })
        .catch((err) => console.warn("Lỗi tải logistics channels:", err))
        .finally(() => setLoadingChannels(false));
    }

    // Danh sách màu & size: Tự động đổi mã màu (T, D, XNV...) sang tên tiếng Việt (Trắng, Đen, Xanh Navy...)
    const availableColorNames = group.colors.length > 0
      ? Array.from(new Set(group.colors.map((c) => formatColorName(c, allColors))))
      : ["Tiêu chuẩn"];
    const availableSizes = group.sizes.length > 0 ? [...group.sizes] : ["Freesize"];
    setSelectedColors(availableColorNames);
    setSelectedSizes(availableSizes);

    const blanksMap = new Map(blanks.map((b) => [b.id, b]));

    // Tạo bảng matrix models Màu x Size
    const models: {
      color: string;
      size: string;
      price: number;
      stock: number;
      sku: string;
      enabled: boolean;
    }[] = [];

    for (const cName of availableColorNames) {
      for (const s of availableSizes) {
        const variant = group.variants.find((v) => {
          const vb = v.blank_id ? blanksMap.get(v.blank_id) || v.blanks : v.blanks;
          const vColor = vb?.color || (v as any).color || "Tiêu chuẩn";
          const vColorName = formatColorName(vColor, allColors);
          const vSize = vb?.size || (v as any).size || "Freesize";
          return vColorName === cName && vSize === s;
        });

        models.push({
          color: cName,
          size: s,
          price: variant ? variant.price : group.minPrice || 120000,
          stock: (variant as any)?.inventory_quantity ? Number((variant as any).inventory_quantity) : 100,
          sku: variant?.code || `${group.master_code}-${cName}-${s}`,
          enabled: true,
        });
      }
    }

    setVariantModels(models);
    setModalOpen(true);
  }

  // Ref và hàm tải ảnh từ máy tính
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Ref và hàm tải ảnh Bảng quy đổi kích cỡ
  const sizeChartInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingSizeChart, setUploadingSizeChart] = useState(false);

  async function handleSizeChartUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSizeChart(true);
    try {
      const url = await uploadFile(file, "products/size-charts", `SIZE_CHART_${selectedGroup?.master_code || "PRODUCT"}`);
      if (url) {
        setTargetSizeChartUrl(url);
      }
    } catch (err: any) {
      alert(`Lỗi tải ảnh bảng size: ${err.message || err}`);
    } finally {
      setUploadingSizeChart(false);
      if (sizeChartInputRef.current) sizeChartInputRef.current.value = "";
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (targetImages.length >= 9) {
      alert("Shopee chỉ cho phép tối đa 9 hình ảnh chung cho mỗi sản phẩm.");
      return;
    }

    setUploadingImage(true);
    try {
      const remainingSlots = 9 - targetImages.length;
      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      const uploadPromises = filesToUpload.map((f) => uploadFile(f, "products/images"));
      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter(Boolean) as string[];
      setTargetImages((prev) => [...prev, ...validUrls]);
    } catch (err: any) {
      alert(`Lỗi tải ảnh lên: ${err.message || err}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Thêm ảnh vào bộ sưu tập qua URL
  function handleAddImage() {
    if (!newImageUrl.trim()) return;
    if (targetImages.length >= 9) {
      alert("Shopee chỉ cho phép tối đa 9 hình ảnh chung cho mỗi sản phẩm.");
      return;
    }
    setTargetImages((prev) => [...prev, newImageUrl.trim()]);
    setNewImageUrl("");
  }

  // Đặt làm ảnh bìa (đưa lên vị trí đầu tiên)
  function handleSetAsCover(index: number) {
    if (index === 0) return;
    setTargetImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  }

  // Xóa ảnh khỏi danh sách
  function handleRemoveImage(index: number) {
    setTargetImages((prev) => prev.filter((_, i) => i !== index));
  }

  // Áp dụng giá hoặc tồn kho hàng loạt
  function applyBulkSettings() {
    const p = bulkPrice ? Number(bulkPrice) : null;
    const s = bulkStock ? Number(bulkStock) : null;

    if (p === null && s === null) return;

    setVariantModels((prev) =>
      prev.map((m) => ({
        ...m,
        price: p !== null && !isNaN(p) && p > 0 ? p : m.price,
        stock: s !== null && !isNaN(s) && s >= 0 ? s : m.stock,
      }))
    );
  }

  // Thực hiện đẩy sản phẩm lên Shopee từ Modal
  async function handleConfirmPublish() {
    if (!selectedGroup) return;
    if (!targetShopId) {
      alert("Vui lòng chọn Gian hàng Shopee đích.");
      return;
    }
    if (!targetCategoryId) {
      alert("Vui lòng chọn Danh mục ngành hàng Shopee.");
      return;
    }
    if (!targetItemName.trim()) {
      alert("Vui lòng nhập Tên sản phẩm Shopee.");
      return;
    }

    const validImages = targetImages.filter(Boolean);
    if (validImages.length === 0 && selectedGroup.images.length === 0) {
      alert("Cần ít nhất 1 hình ảnh sản phẩm để đăng lên Shopee.");
      return;
    }

    const enabledModels = variantModels.filter((m) => m.enabled);
    if (enabledModels.length === 0) {
      alert("Cần bật ít nhất 1 biến thể (Màu x Size) để đăng lên sàn.");
      return;
    }

    setPublishing(true);
    setPublishError(null);
    setPublishSuccessUrl(null);

    try {
      // Map color to mockup image (chỉ dùng hình đã ghép áo + hình in)
      const blanksMap = new Map(blanks.map((b) => [b.id, b]));
      const colorMockupMap: Record<string, string> = {};
      for (const cName of selectedColors) {
        const v = selectedGroup.variants.find((item) => {
          const vb = item.blank_id ? blanksMap.get(item.blank_id) || item.blanks : item.blanks;
          const vRawColor = vb?.color || (item as any).color || "Tiêu chuẩn";
          const vColorName = formatColorName(vRawColor, allColors);
          return (vColorName === cName || vRawColor === cName) && (item.preview_url || item.mockup_url || item.image_url);
        });
        if (v) {
          colorMockupMap[cName] = v.preview_url || v.mockup_url || v.image_url || "";
        }
      }

      // Kênh vận chuyển: Gửi danh sách toàn bộ các kênh, gán explicit enabled: true cho kênh đã tick và false cho kênh bỏ tick (như Hỏa Tốc)
      let logisticInfoList: any[] = [];
      if (availableChannels.length > 0) {
        logisticInfoList = availableChannels.map((ch) => ({
          logistic_id: Number(ch.channelId),
          enabled: selectedChannelIds.includes(Number(ch.channelId)),
        }));
      } else if (selectedChannelIds.length > 0) {
        logisticInfoList = selectedChannelIds.map((id) => ({
          logistic_id: Number(id),
          enabled: true,
        }));
      }

      // Chuyển targetAttributes thành attribute_list Shopee
      const attributeList = Object.entries(targetAttributes)
        .filter(([_, val]) => val && String(val).trim())
        .map(([key, val]) => ({
          attribute_id: 0,
          attribute_name: key,
          attribute_value: String(val).trim(),
          value_name: String(val).trim(),
        }));

      const input: PublishShopeeProductInput = {
        shopId: targetShopId,
        masterCode: selectedGroup.master_code,
        masterName: selectedGroup.master_name,
        itemName: targetItemName.trim(),
        description: targetDescription.trim(),
        categoryId: targetCategoryId,
        attributeList: attributeList as any,
        images: validImages.length > 0 ? validImages.slice(0, 9) : selectedGroup.images.slice(0, 9),
        sizeChartImage: (targetSizeChartUrl || getShopeeSizeChartUrl() || "").trim() || undefined,
        existingItemId: existingShopeeItemId.trim() ? Number(existingShopeeItemId.trim()) : undefined,
        colorMockupMap,
        weight: targetWeight / 1000, // Đổi sang kg
        dimension: {
          package_height: targetHeight,
          package_length: targetLength,
          package_width: targetWidth,
        },
        logisticInfo: logisticInfoList,
        colors: selectedColors,
        sizes: selectedSizes,
        models: enabledModels,
      };

      const result = await publishProductToShopeeComplete(input, (step, pct) => {
        setPublishProgressText(step);
        setPublishPercent(pct);
      });

      setPublishSuccessUrl(result.shopeeUrl);
      const updatedPubs = await fetchShopeePublishedProducts();
      setPublishedList(updatedPubs);
    } catch (err: any) {
      setPublishError(err.message || "Lỗi đẩy sản phẩm lên Shopee.");
    } finally {
      setPublishing(false);
    }
  }

  const publishedCount = masterGroups.filter((g) => g.publishedRecord).length;
  const readyCount = masterGroups.filter((g) => g.is_optimized).length;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Sản phẩm sàn (Shopee)"
          subtitle="Quản lý và đẩy sản phẩm từ hệ thống lên gian hàng Shopee với đầy đủ hình ảnh mockup phôi màu và phân loại 2 tầng"
        />

        <div className="flex items-center gap-2">
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Store size={14} className="text-orange-400" />
              <span>Cài đặt Gian hàng</span>
            </button>
          )}
        </div>
      </div>

      {/* Thống kê thẻ Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Tổng mẫu sản phẩm</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{masterGroups.length}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold">
            <Package size={22} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Đã tối ưu SEO AI</p>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">{readyCount}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <Sparkles size={22} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Đã đăng lên Shopee</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{publishedCount}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc & Tìm kiếm */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Tìm theo mã mẫu, tên sản phẩm hoặc tên Shopee..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc loại phôi */}
          <select
            value={filterBlankType}
            onChange={(e) => setFilterBlankType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">Tất cả loại phôi</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Lọc trạng thái đăng */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">Đã lên sàn Shopee</option>
            <option value="unpublished">Chưa đăng sàn</option>
          </select>
        </div>
      </div>

      {/* Danh sách Sản phẩm */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-brand-400" />
          <p className="text-sm text-slate-400">Đang tải danh sách sản phẩm...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-slate-900/60 border border-slate-800 p-8 space-y-3">
          <Package size={36} className="mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">Không tìm thấy sản phẩm nào phù hợp</p>
          <p className="text-xs text-slate-500">Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredGroups.map((group) => {
            const isPublished = Boolean(group.publishedRecord);
            const coverImage = group.images[0] || "https://placehold.co/400x400.png";

            return (
              <div
                key={group.key}
                className={`rounded-xl p-2.5 sm:p-3 border flex flex-col justify-between transition-all relative overflow-hidden group hover:shadow-lg ${
                  isPublished
                    ? "bg-slate-900/90 border-emerald-500/30 hover:border-emerald-500/60"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-2">
                  {/* Image & Badges */}
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                    <img
                      src={coverImage}
                      alt={group.master_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Status Badge */}
                    <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                      {isPublished ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[9px] font-bold backdrop-blur-md shadow flex items-center gap-0.5">
                          <CheckCircle2 size={10} /> Đã lên sàn
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-900/85 text-slate-300 text-[9px] font-medium backdrop-blur-md border border-slate-700">
                          Chưa đăng
                        </span>
                      )}
                    </div>

                    {/* AI Optimized Badge */}
                    {group.is_optimized && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-bold backdrop-blur-md flex items-center gap-0.5 shadow">
                          <Sparkles size={9} /> AI
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 leading-none">
                      <span className="font-mono font-bold text-brand-400 truncate max-w-[90px]">{group.master_code}</span>
                      <span className="truncate max-w-[70px] text-slate-400">{group.blank_type?.name || "Áo"}</span>
                    </div>

                    <h4 className="font-semibold text-slate-100 text-xs line-clamp-1 leading-snug" title={group.master_name}>
                      {group.shopee_name || group.master_name}
                    </h4>

                    {/* Colors & Sizes Chips */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{group.colors.length} màu</span>
                      <span className="font-mono">{group.sizes.join(", ")}</span>
                    </div>

                    <div className="pt-1 flex items-center justify-between border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-400 text-[10px]">Giá:</span>
                      <span className="font-bold text-emerald-400 text-xs">
                        {formatCurrency(group.minPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Button */}
                <div className="pt-2.5 mt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                  {isPublished && group.publishedRecord?.shopee_url && (
                    <a
                      href={group.publishedRecord.shopee_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                      title="Xem trên Shopee"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => openPublishModal(group)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-md shadow-orange-950/20 transition-all cursor-pointer truncate"
                  >
                    <UploadCloud size={12} className="shrink-0" />
                    <span className="truncate">{isPublished ? "Cập nhật" : "Đẩy Shopee"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL POPUP DUYỆT CHI TIẾT & ĐẨY LÊN SÀN SHOPEE */}
      {/* ========================================================= */}
      {modalOpen && selectedGroup && (
        <Modal
          open={modalOpen}
          onClose={() => !publishing && setModalOpen(false)}
          title={`Kiểm tra & Đẩy sản phẩm lên Shopee: ${selectedGroup.master_code}`}
          size="2xl"
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Thông báo kết quả sau khi đăng */}
            {publishSuccessUrl && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-3 text-emerald-300 text-xs animate-slide-up">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-emerald-200">Đăng sản phẩm lên Shopee thành công!</p>
                    <p className="mt-0.5 text-emerald-300/80">Sản phẩm đã được tạo và kích hoạt phân loại 2 tầng trên Shopee.</p>
                  </div>
                </div>
                <a
                  href={publishSuccessUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white font-bold inline-flex items-center gap-1 shadow hover:bg-emerald-600 shrink-0"
                >
                  <span>Xem trên Shopee</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            )}

            {publishError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs animate-slide-up">
                <AlertCircle size={18} className="text-rose-400 shrink-0" />
                <div>
                  <p className="font-bold text-rose-200">Lỗi đẩy sản phẩm lên Shopee:</p>
                  <p className="mt-0.5">{publishError}</p>
                </div>
              </div>
            )}

            {/* Thanh tiến trình khi đang đăng */}
            {publishing && (
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-orange-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-orange-400 flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    {publishProgressText}
                  </span>
                  <span className="font-mono font-bold text-slate-200">{publishPercent}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-rose-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${publishPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* 1. Thiết lập Gian hàng & Danh mục */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
              <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <Store size={15} className="text-orange-400" />
                <span>1. Chọn Gian hàng & Ngành hàng Shopee</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Chọn Shop */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gian hàng Shopee đích <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={targetShopId}
                    onChange={(e) => setTargetShopId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.shopId}>
                        {s.shopName} (ID: {s.shopId}) {s.isDefault ? "★ Chính" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn Danh mục */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Danh mục ngành hàng Shopee <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => {
                      const catId = Number(e.target.value);
                      setTargetCategoryId(catId);
                      const matched = presetCategories.find((p) => p.categoryId === catId);
                      if (matched?.attributes && Object.keys(matched.attributes).length > 0) {
                        setTargetAttributes({ ...matched.attributes });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {presetCategories.length === 0 && (
                      <option value={100017}>Thời trang Nam &gt; Áo thun (Mặc định #100017)</option>
                    )}
                    {presetCategories.map((cat) => (
                      <option key={cat.id} value={cat.categoryId}>
                        {cat.name} ({cat.categoryNamePath || `ID: ${cat.categoryId}`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gắn ID sản phẩm sàn (nếu đã tồn tại) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Shopee Item ID <span className="text-slate-500">(tùy chọn – nếu sản phẩm đã có trên sàn)</span>
                </label>
                <input
                  type="text"
                  value={existingShopeeItemId}
                  onChange={(e) => setExistingShopeeItemId(e.target.value.replace(/\D/g, ""))}
                  placeholder="Để trống = tạo mới | Nhập ID = cập nhật sản phẩm đã có trên sàn"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                />
                {existingShopeeItemId && (
                  <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                    <RefreshCw size={10} /> Sẽ cập nhật sản phẩm #{existingShopeeItemId} trên Shopee thay vì tạo mới
                  </p>
                )}
              </div>
            </div>

            {/* 2. Bộ Hình Ảnh Sản Phẩm Chung (Tối đa 9 ảnh Shopee) */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <ImageIcon size={15} className="text-blue-400" />
                  <span>2. Bộ Hình Ảnh Sản Phẩm Chung (Tối đa 9 ảnh Shopee)</span>
                </h4>
                <span className="text-[11px] font-semibold text-brand-400">
                  {targetImages.length}/9 ảnh
                </span>
              </div>

              {/* Gallery Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2.5 pt-1">
                {targetImages.map((imgUrl, index) => {
                  const isCover = index === 0;

                  return (
                    <div
                      key={`${imgUrl}-${index}`}
                      className={`relative group rounded-xl overflow-hidden aspect-square border transition-all ${
                        isCover
                          ? "border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-950/20"
                          : "border-slate-700 hover:border-slate-600 bg-slate-950"
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Ảnh ${index + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Tag badge */}
                      <div className="absolute top-1 left-1">
                        {isCover ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-bold shadow flex items-center gap-0.5">
                            <Star size={9} className="fill-slate-950" /> Bìa chính
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 text-[9px] font-bold backdrop-blur-md">
                            Ảnh {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Overlay action controls */}
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() => handleSetAsCover(index)}
                            className="px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow cursor-pointer w-full justify-center"
                            title="Đặt làm ảnh bìa chính"
                          >
                            <Star size={10} className="fill-slate-950" />
                            <span>Làm bìa</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 shadow cursor-pointer w-full justify-center"
                          title="Xóa ảnh này khỏi danh sách đẩy sàn"
                        >
                          <Trash2 size={10} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Empty slot placeholder if less than 9 */}
                {targetImages.length < 9 && (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 aspect-square flex flex-col items-center justify-center p-2 text-center text-slate-500">
                    <ImageIcon size={18} className="mb-1 opacity-50" />
                    <span className="text-[9px]">Trống</span>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Ẩn file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || targetImages.length >= 9}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50 transition-all shrink-0"
                >
                  {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>{uploadingImage ? "Đang tải ảnh lên..." : "Tải ảnh từ máy tính"}</span>
                </button>

                <div className="flex-1 flex items-center gap-1.5 min-w-[220px]">
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddImage()}
                    placeholder="Hoặc dán URL hình ảnh (https://...)..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    disabled={!newImageUrl.trim() || targetImages.length >= 9}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>Thêm</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Bảng quy đổi kích cỡ (Size Chart) Shopee */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Ruler size={15} className="text-amber-400" />
                  <span>3. Bảng quy đổi kích cỡ (Size Chart Shopee)</span>
                </h4>
                <div>
                  {targetSizeChartUrl ? (
                    targetSizeChartUrl === getShopeeSizeChartUrl() ? (
                      <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={12} /> Bảng size mặc định từ Cài đặt
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-300 bg-amber-950/70 border border-amber-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles size={12} /> Bảng size riêng cho sản phẩm này
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
                      Chưa chọn ảnh (Tự động vẽ bảng size cơ bản)
                    </span>
                  )}
                </div>
              </div>

              {/* Ẩn file input size chart */}
              <input
                type="file"
                ref={sizeChartInputRef}
                accept="image/*"
                onChange={handleSizeChartUpload}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center relative group shrink-0 shadow-inner">
                  {targetSizeChartUrl ? (
                    <>
                      <img src={targetSizeChartUrl} alt="Size Chart" className="w-full h-full object-contain p-1" />
                      <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => window.open(targetSizeChartUrl, "_blank")}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
                          title="Xem ảnh phóng to"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetSizeChartUrl("")}
                          className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
                          title="Bỏ dùng ảnh này (sẽ tự động vẽ bảng size)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-slate-500">
                      <Ruler size={24} className="opacity-40 mb-1 text-amber-400" />
                      <span className="text-[10px]">Chưa có ảnh</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2.5">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ảnh Bảng quy đổi kích cỡ sẽ được tải trực tiếp lên Shopee Media Space để người mua xem chọn size chuẩn khi mua sản phẩm.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => sizeChartInputRef.current?.click()}
                      disabled={uploadingSizeChart}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {uploadingSizeChart ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      <span>{uploadingSizeChart ? "Đang tải ảnh..." : targetSizeChartUrl ? "Thay đổi ảnh bảng size" : "Tải ảnh bảng size"}</span>
                    </button>

                    {getShopeeSizeChartUrl() && targetSizeChartUrl !== getShopeeSizeChartUrl() && (
                      <button
                        type="button"
                        onClick={() => setTargetSizeChartUrl(getShopeeSizeChartUrl())}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-emerald-800/50 flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Khôi phục ảnh bảng size mặc định trong Cài đặt"
                      >
                        <RotateCcw size={12} />
                        <span>Dùng ảnh mặc định Cài đặt</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    💡 Ảnh bảng size cài đặt trong <strong>Cài đặt &gt; Kết nối Shopee</strong> sẽ được tự động áp dụng cho tất cả sản phẩm khi đăng sàn.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Thông tin chi tiết (Thuộc tính sản phẩm Shopee) */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Sliders size={15} className="text-pink-400" />
                  <span>4. Thông tin chi tiết (Thuộc tính sản phẩm Shopee)</span>
                </h4>

                <button
                  type="button"
                  onClick={() => setTargetAttributes(getDefaultFashionAttributes())}
                  className="px-2.5 py-1 rounded-lg bg-pink-950/80 hover:bg-pink-900 text-pink-300 border border-pink-800/80 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer self-start sm:self-auto transition-colors"
                >
                  <Sparkles size={12} />
                  <span>Mẫu chuẩn Áo thun</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Thuộc tính được tự động nạp từ cấu hình mẫu danh mục để sản phẩm đạt chuẩn hiển thị 100% trên sàn Shopee.
              </p>

              {/* Grid 12 Thuộc tính chuẩn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {SHOPEE_STANDARD_FASHION_ATTRIBUTES.map((attr) => {
                  const currentValue = targetAttributes[attr.key] ?? "";

                  return (
                    <div key={attr.key} className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-300 truncate" title={attr.label}>
                        {attr.label} {attr.key === "Thương hiệu" && <span className="text-rose-400 font-bold">*</span>}
                      </label>
                      <div className="flex items-center gap-1">
                        <select
                          value={attr.options.includes(currentValue) ? currentValue : currentValue ? "custom" : ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "custom") return;
                            setTargetAttributes((prev) => ({ ...prev, [attr.key]: val }));
                          }}
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none focus:border-pink-500 cursor-pointer"
                        >
                          <option value="">-- Chọn --</option>
                          {attr.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {!attr.options.includes(currentValue) && currentValue && (
                            <option value="custom">Khác: {currentValue}</option>
                          )}
                        </select>
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => setTargetAttributes((prev) => ({ ...prev, [attr.key]: e.target.value }))}
                          placeholder="Hoặc tự nhập..."
                          className="w-24 px-1.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-[11px] outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Tiêu đề & Mô tả chuẩn SEO Shopee */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Tag size={15} className="text-purple-400" />
                  <span>5. Tiêu đề & Mô tả Sản phẩm Shopee</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {targetItemName.length}/120 ký tự
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Tên sản phẩm trên Shopee (Chuẩn SEO 10-120 ký tự) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={targetItemName}
                  onChange={(e) => setTargetItemName(e.target.value)}
                  placeholder="Nhập tên sản phẩm Shopee..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-orange-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Mô tả sản phẩm chi tiết
                </label>
                <textarea
                  rows={5}
                  value={targetDescription}
                  onChange={(e) => setTargetDescription(e.target.value)}
                  placeholder="Nhập mô tả sản phẩm Shopee..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-orange-500 font-mono leading-relaxed"
                />
              </div>
            </div>

            {/* 6. Bảng phân loại 2 tầng: Màu sắc x Size */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Layers size={15} className="text-emerald-400" />
                  <span>6. Bảng Biến Thể 2 Tầng (Màu sắc x Kích cỡ)</span>
                </h4>

                {/* Công cụ sửa giá/kho nhanh hàng loạt */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder="Giá chung..."
                    className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px]"
                  />
                  <input
                    type="number"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                    placeholder="Kho chung..."
                    className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={applyBulkSettings}
                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-semibold cursor-pointer"
                  >
                    Áp dụng tất cả
                  </button>
                </div>
              </div>

              {/* Danh sách ảnh mockup màu sắc */}
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-400">Hình ảnh mockup từng màu (hình đã ghép thiết kế):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedColors.map((colorName) => {
                    const variant = selectedGroup.variants.find((v) => {
                      const vb = v.blank_id ? blanks.find((b) => b.id === v.blank_id) || v.blanks : v.blanks;
                      const vRawColor = vb?.color || (v as any).color || "Tiêu chuẩn";
                      const vColorName = formatColorName(vRawColor, allColors);
                      return (vColorName === colorName || vRawColor === colorName) && (v.preview_url || v.mockup_url || v.image_url);
                    });
                    const imgUrl = variant?.preview_url || variant?.mockup_url || variant?.image_url || selectedGroup.images[0];

                    return (
                      <div
                        key={colorName}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700"
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                          {imgUrl ? (
                            <img src={imgUrl} alt={colorName} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={16} className="m-auto text-slate-600" />
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-200">
                          {formatColorName(colorName, allColors)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bảng chi tiết từng biến thể */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] uppercase border-b border-slate-700">
                    <tr>
                      <th className="px-3 py-2.5">Bật</th>
                      <th className="px-3 py-2.5">Màu sắc</th>
                      <th className="px-3 py-2.5">Size</th>
                      <th className="px-3 py-2.5">Mã SKU</th>
                      <th className="px-3 py-2.5">Giá bán (VND)</th>
                      <th className="px-3 py-2.5">Tồn kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {variantModels.map((model, idx) => (
                      <tr
                        key={`${model.color}-${model.size}`}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          !model.enabled ? "opacity-40" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={model.enabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setVariantModels((prev) =>
                                prev.map((m, i) => (i === idx ? { ...m, enabled: checked } : m))
                              );
                            }}
                            className="rounded text-orange-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-200">
                          {formatColorName(model.color, allColors)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-orange-400">
                          {model.size}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                          {model.sku}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={model.price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setVariantModels((prev) =>
                                prev.map((m, i) => (i === idx ? { ...m, price: val } : m))
                              );
                            }}
                            className="w-28 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={model.stock}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setVariantModels((prev) =>
                                prev.map((m, i) => (i === idx ? { ...m, stock: val } : m))
                              );
                            }}
                            className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. Cấu hình Vận chuyển & Kiện hàng */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
                  <Truck size={15} className="text-blue-400" />
                  <span>7. Thông số Đóng gói & Kênh Vận chuyển Shopee</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  Đã bật {selectedChannelIds.length} / {availableChannels.length || "tất cả"} kênh
                </span>
              </div>

              {/* Thông số kích thước & cân nặng */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Cân nặng (Gram) *
                  </label>
                  <input
                    type="number"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Dài (cm) *
                  </label>
                  <input
                    type="number"
                    value={targetLength}
                    onChange={(e) => setTargetLength(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Rộng (cm) *
                  </label>
                  <input
                    type="number"
                    value={targetWidth}
                    onChange={(e) => setTargetWidth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Cao (cm) *
                  </label>
                  <input
                    type="number"
                    value={targetHeight}
                    onChange={(e) => setTargetHeight(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Danh sách Kênh Vận Chuyển */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    Chọn các kênh vận chuyển kích hoạt cho sản phẩm này:
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const standardIds = availableChannels
                          .filter((c) => !c.channelName.toLowerCase().includes("hỏa tốc") && !c.channelName.toLowerCase().includes("cồng kềnh"))
                          .map((c) => c.channelId);
                        setSelectedChannelIds(standardIds);
                      }}
                      className="px-2 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Chuẩn Áo thun (Tắt Hỏa tốc & Cồng kềnh)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannelIds(availableChannels.map((c) => c.channelId))}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold cursor-pointer"
                    >
                      Bật tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannelIds([])}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold cursor-pointer"
                    >
                      Tắt hết
                    </button>
                  </div>
                </div>

                {loadingChannels ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin text-blue-400" />
                    <span>Đang tải danh sách kênh vận chuyển của Shop...</span>
                  </div>
                ) : availableChannels.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                    Sẽ áp dụng theo cấu hình vận chuyển đã lưu trong Cài đặt hoặc kênh mặc định của Shop.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {availableChannels.map((ch) => {
                      const isChecked = selectedChannelIds.includes(ch.channelId);
                      const isHoaToc = ch.channelName.toLowerCase().includes("hỏa tốc");
                      const isCongKenh = ch.channelName.toLowerCase().includes("cồng kềnh");

                      return (
                        <label
                          key={ch.channelId}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isChecked
                              ? "bg-slate-900/90 border-blue-500/50 shadow-sm"
                              : "bg-slate-950/40 border-slate-800/80 opacity-50 hover:opacity-80"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChannelIds((prev) => [...prev, ch.channelId]);
                                } else {
                                  setSelectedChannelIds((prev) => prev.filter((id) => id !== ch.channelId));
                                }
                              }}
                              className="rounded text-blue-500 focus:ring-0 cursor-pointer"
                            />
                            <div className="truncate">
                              <span className="block text-xs font-semibold text-slate-200 truncate">
                                {ch.channelName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Tối đa {ch.maxWeight}kg
                              </span>
                            </div>
                          </div>

                          {isHoaToc ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 shrink-0">
                              Hỏa tốc
                            </span>
                          ) : isCongKenh ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 shrink-0">
                              Cồng kềnh
                            </span>
                          ) : isChecked ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 shrink-0">
                              Bật
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-500 shrink-0">
                              Tắt
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={publishing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Hủy / Đóng
              </button>

              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={publishing}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white text-xs font-bold flex items-center gap-2 shadow-xl shadow-orange-950/40 cursor-pointer disabled:opacity-50 transition-all"
              >
                {publishing ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                <span>{publishing ? "Đang đẩy lên Shopee..." : "🚀 Xác nhận Đẩy lên Shopee"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
