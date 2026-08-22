import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import {
  getShopeeAppConfig,
  fetchShopeeAppConfig,
  getShopeeShops,
  fetchShopeeShops,
  saveShopeeShop,
  deleteShopeeShop,
  setDefaultShopeeShop,
  generateShopeeAuthUrl,
  exchangeShopeeAuthCode,
  refreshShopeeShopToken,
  testShopeeShopConnection,
  fetchShopeeLogisticsChannels,
  getShopeeDefaultLogisticsConfig,
  fetchShopeeDefaultLogisticsConfig,
  saveShopeeDefaultLogisticsConfig,
  getShopeePresetCategories,
  fetchShopeePresetCategories,
  saveShopeePresetCategory,
  deleteShopeePresetCategory,
  setDefaultShopeePresetCategory,
  fetchShopeeCategories,
  fetchShopeeCategoryAttributes,
  type ShopeeAppConfig,
  type ShopeeShop,
  type ShopeeLogisticsChannel,
  type ShopeeDefaultLogisticsConfig,
  type ShopeeCategory,
  type ShopeeCategoryAttribute,
  type ShopeePresetCategory,
} from "@/lib/shopee";
import {
  Store,
  Plus,
  Link2,
  ExternalLink,
  ShieldCheck,
  Star,
  RefreshCw,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Clock,
  Settings,
  HelpCircle,
  Loader2,
  Save,
  ShoppingBag,
  Eye,
  EyeOff,
  Truck,
  Box,
  Package,
  Info,
  Layers,
  FolderTree,
  Tag,
  Search,
  Sliders,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

interface WebhookLog {
  id: string;
  shop_id: string | null;
  code: number;
  topic: string;
  payload: any;
  ip: string;
  created_at: string;
}

interface ShopeeShopsPageProps {
  onNavigateToSettings?: () => void;
}

export function ShopeeShopsPage({ onNavigateToSettings }: ShopeeShopsPageProps) {
  const [appConfig, setAppConfig] = useState<ShopeeAppConfig>(getShopeeAppConfig());
  const [shops, setShops] = useState<ShopeeShop[]>(getShopeeShops());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"shops" | "logistics" | "categories" | "webhook-logs">("shops");

  // Logistics state
  const [logisticsConfig, setLogisticsConfig] = useState<ShopeeDefaultLogisticsConfig>(getShopeeDefaultLogisticsConfig());
  const [logisticsChannels, setLogisticsChannels] = useState<ShopeeLogisticsChannel[]>([]);
  const [loadingLogistics, setLoadingLogistics] = useState(false);
  const [savingLogistics, setSavingLogistics] = useState(false);
  const [selectedLogisticsShopId, setSelectedLogisticsShopId] = useState<string>("");

  // Preset Categories state
  const [presetCategories, setPresetCategories] = useState<ShopeePresetCategory[]>(getShopeePresetCategories());
  const [shopeeCategories, setShopeeCategories] = useState<ShopeeCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryShopId, setSelectedCategoryShopId] = useState<string>("");
  const [presetSearchTerm, setPresetSearchTerm] = useState("");

  // Modal Preset Category state
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Partial<ShopeePresetCategory>>({
    name: "",
    categoryId: 0,
    categoryNamePath: "",
    isDefault: false,
    attributes: {},
    note: "",
  });
  const [categoryAttributes, setCategoryAttributes] = useState<ShopeeCategoryAttribute[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [modalCatSearch, setModalCatSearch] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  // Webhook logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);

  // Auth link & code exchange
  const [authUrl, setAuthUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [exchangeCode, setExchangeCode] = useState("");
  const [exchangeShopId, setExchangeShopId] = useState("");
  const [exchangeShopName, setExchangeShopName] = useState("");
  const [exchanging, setExchanging] = useState(false);

  // Shop modal state (Add / Edit)
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Partial<ShopeeShop>>({
    shopId: "",
    shopName: "",
    country: "VN",
    accessToken: "",
    refreshToken: "",
    isDefault: false,
    note: "",
  });
  const [showModalToken, setShowModalToken] = useState(false);

  // Action status per shop
  const [loadingActionShopId, setLoadingActionShopId] = useState<string | null>(null);
  const [shopTestResults, setShopTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  async function loadDataFromSupabase() {
    setLoading(true);
    try {
      const [cfg, shps, logCfg, presets] = await Promise.all([
        fetchShopeeAppConfig(),
        fetchShopeeShops(),
        fetchShopeeDefaultLogisticsConfig(),
        fetchShopeePresetCategories(),
      ]);
      setAppConfig(cfg);
      setShops(shps);
      setLogisticsConfig(logCfg);
      setPresetCategories(presets);
      if (shps.length > 0 && !selectedLogisticsShopId) {
        const def = shps.find((s) => s.isDefault) || shps[0];
        setSelectedLogisticsShopId(def.shopId);
        setSelectedCategoryShopId(def.shopId);
      }
    } catch (e) {
      console.warn("Lỗi tải Shopee từ Supabase:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogisticsChannels(shopId?: string) {
    setLoadingLogistics(true);
    try {
      const res = await fetchShopeeLogisticsChannels(shopId || selectedLogisticsShopId);
      setLogisticsChannels(res.channels);
      showToast(`🚚 Đã tải thành công ${res.channels.length} kênh vận chuyển thực tế từ Shopee!`);
    } catch (err: any) {
      alert(`Lỗi kéo kênh vận chuyển: ${err.message}`);
    } finally {
      setLoadingLogistics(false);
    }
  }

  async function loadShopeeCategories(shopId?: string) {
    setLoadingCategories(true);
    try {
      const targetShopId = shopId || selectedCategoryShopId || defaultShop?.shopId;
      const res = await fetchShopeeCategories(targetShopId);
      setShopeeCategories(res.categories);
      showToast(`📁 Đã tải thành công ${res.categories.length} danh mục thực tế từ Shopee!`);
    } catch (err: any) {
      alert(`Lỗi kéo danh mục từ Shopee: ${err.message}`);
    } finally {
      setLoadingCategories(false);
    }
  }

  function getCategoryPath(catId: number, allCats: ShopeeCategory[]): string {
    const map = new Map<number, ShopeeCategory>();
    allCats.forEach((c) => map.set(c.categoryId, c));

    const parts: string[] = [];
    let curr = map.get(catId);
    while (curr) {
      parts.unshift(curr.displayCategoryName || curr.originalCategoryName);
      if (curr.parentCategoryId && curr.parentCategoryId !== 0) {
        curr = map.get(curr.parentCategoryId);
      } else {
        break;
      }
    }
    return parts.join(" > ") || `Danh mục #${catId}`;
  }

  async function handleCategorySelect(cat: ShopeeCategory) {
    const path = getCategoryPath(cat.categoryId, shopeeCategories);
    setEditingPreset((prev) => ({
      ...prev,
      categoryId: cat.categoryId,
      categoryNamePath: path,
    }));

    // Kéo thuộc tính cho danh mục đã chọn
    setLoadingAttributes(true);
    try {
      const targetShopId = selectedCategoryShopId || defaultShop?.shopId;
      const res = await fetchShopeeCategoryAttributes(cat.categoryId, targetShopId);
      setCategoryAttributes(res.attributes);
    } catch (err) {
      console.warn("Không thể kéo thuộc tính danh mục:", err);
      setCategoryAttributes([]);
    } finally {
      setLoadingAttributes(false);
    }
  }

  function openCreatePresetModal() {
    setEditingPreset({
      name: "",
      categoryId: 0,
      categoryNamePath: "",
      isDefault: presetCategories.length === 0,
      attributes: {
        "Thương hiệu": "No Brand",
        "Chất liệu": "Cotton 100%",
        "Xuất xứ": "Việt Nam",
        "Phong cách": "Basic / Unisex / Streetwear",
      },
      note: "",
    });
    setCategoryAttributes([]);
    setModalCatSearch("");
    setPresetModalOpen(true);
    if (shopeeCategories.length === 0) {
      loadShopeeCategories();
    }
  }

  async function openEditPresetModal(preset: ShopeePresetCategory) {
    setEditingPreset({ ...preset, attributes: { ...(preset.attributes || {}) } });
    setModalCatSearch("");
    setPresetModalOpen(true);

    if (shopeeCategories.length === 0) {
      loadShopeeCategories();
    }

    if (preset.categoryId) {
      setLoadingAttributes(true);
      try {
        const targetShopId = selectedCategoryShopId || defaultShop?.shopId;
        const res = await fetchShopeeCategoryAttributes(preset.categoryId, targetShopId);
        setCategoryAttributes(res.attributes);
      } catch (err) {
        console.warn("Lỗi tải thuộc tính:", err);
      } finally {
        setLoadingAttributes(false);
      }
    }
  }

  async function handleSavePreset() {
    if (!editingPreset.name?.trim()) {
      alert("Vui lòng nhập tên cấu hình danh mục.");
      return;
    }
    if (!editingPreset.categoryId) {
      alert("Vui lòng chọn một danh mục Shopee.");
      return;
    }

    setSavingPreset(true);
    try {
      const saved = await saveShopeePresetCategory(editingPreset);
      const updatedList = getShopeePresetCategories();
      setPresetCategories(updatedList);
      setPresetModalOpen(false);
      showToast(`💾 Đã lưu cấu hình danh mục "${saved.name}"!`);
    } catch (err: any) {
      alert(`Lỗi lưu danh mục: ${err.message}`);
    } finally {
      setSavingPreset(false);
    }
  }

  async function handleDeletePreset(preset: ShopeePresetCategory) {
    if (window.confirm(`Bạn có chắc muốn xóa cấu hình danh mục "${preset.name}"?`)) {
      const remaining = await deleteShopeePresetCategory(preset.id);
      setPresetCategories(remaining);
      showToast(`Đã xóa cấu hình danh mục "${preset.name}".`);
    }
  }

  async function handleSetDefaultPreset(preset: ShopeePresetCategory) {
    const updated = await setDefaultShopeePresetCategory(preset.id);
    setPresetCategories(updated);
    showToast(`⭐ Đã đặt "${preset.name}" làm cấu hình danh mục mặc định!`);
  }

  const leafCategories = useMemo(() => {
    return shopeeCategories.filter((c) => !c.hasChildren);
  }, [shopeeCategories]);

  const filteredLeafCategories = useMemo(() => {
    if (!modalCatSearch.trim()) return leafCategories.slice(0, 60);
    const q = modalCatSearch.toLowerCase().trim();
    return leafCategories
      .filter((c) => {
        const path = getCategoryPath(c.categoryId, shopeeCategories).toLowerCase();
        return (
          c.displayCategoryName.toLowerCase().includes(q) ||
          c.originalCategoryName.toLowerCase().includes(q) ||
          String(c.categoryId).includes(q) ||
          path.includes(q)
        );
      })
      .slice(0, 60);
  }, [leafCategories, modalCatSearch, shopeeCategories]);

  const filteredPresets = useMemo(() => {
    if (!presetSearchTerm.trim()) return presetCategories;
    const q = presetSearchTerm.toLowerCase().trim();
    return presetCategories.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryNamePath.toLowerCase().includes(q) ||
        String(p.categoryId).includes(q) ||
        (p.note && p.note.toLowerCase().includes(q))
    );
  }, [presetCategories, presetSearchTerm]);

  async function handleSaveLogistics() {
    setSavingLogistics(true);
    try {
      await saveShopeeDefaultLogisticsConfig(logisticsConfig);
      showToast("💾 Đã lưu cấu hình vận chuyển mặc định vào Supabase!");
    } catch (err: any) {
      alert(`Lỗi lưu cấu hình: ${err.message}`);
    } finally {
      setSavingLogistics(false);
    }
  }

  async function loadWebhookLogs() {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("shopee_webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) {
        setWebhookLogs(data as WebhookLog[]);
      }
    } catch (e) {
      console.warn("Lỗi tải logs webhook:", e);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadDataFromSupabase();
    loadWebhookLogs();
  }, []);

  async function refreshShopList() {
    await loadDataFromSupabase();
  }

  const isAppConfigured = Boolean(appConfig.partnerId && appConfig.partnerKey);

  async function handleGenerateAuthUrl() {
    if (!isAppConfigured) {
      alert("Vui lòng cấu hình Partner ID và Partner Key trong Cài đặt trước khi ủy quyền gian hàng.");
      onNavigateToSettings?.();
      return;
    }
    try {
      const url = await generateShopeeAuthUrl();
      setAuthUrl(url);
    } catch (err) {
      alert(`Lỗi tạo URL: ${(err as Error).message}`);
    }
  }

  async function handleExchangeAuthCode() {
    if (!exchangeCode.trim()) {
      alert("Vui lòng dán Mã ủy quyền (Code) do Shopee trả về.");
      return;
    }
    if (!exchangeShopId.trim()) {
      alert("Vui lòng nhập Shop ID của gian hàng bạn vừa ủy quyền.");
      return;
    }
    setExchanging(true);
    try {
      const newShop = await exchangeShopeeAuthCode(
        exchangeCode.trim(),
        exchangeShopId.trim(),
        exchangeShopName.trim() || undefined
      );
      await refreshShopList();
      setExchangeCode("");
      setExchangeShopId("");
      setExchangeShopName("");
      showToast(`🎉 Đã kết nối thành công gian hàng "${newShop.shopName}"!`);
    } catch (err) {
      alert(`Lỗi kết nối Shop: ${(err as Error).message}`);
    } finally {
      setExchanging(false);
    }
  }

  async function handleTestShop(shop: ShopeeShop) {
    setLoadingActionShopId(shop.id);
    const res = await testShopeeShopConnection(shop.id);
    setShopTestResults((prev) => ({ ...prev, [shop.id]: res }));
    setLoadingActionShopId(null);
    await refreshShopList();
    if (res.success) {
      showToast(`✅ Gian hàng "${shop.shopName}" hoạt động bình thường!`);
    }
  }

  async function handleRefreshShopToken(shop: ShopeeShop) {
    setLoadingActionShopId(shop.id);
    try {
      await refreshShopeeShopToken(shop.id);
      await refreshShopList();
      showToast(`✅ Đã làm mới Access Token cho "${shop.shopName}"!`);
    } catch (err) {
      alert(`Lỗi làm mới token: ${(err as Error).message}`);
    } finally {
      setLoadingActionShopId(null);
    }
  }

  async function handleSetDefaultShop(shop: ShopeeShop) {
    await setDefaultShopeeShop(shop.id);
    await refreshShopList();
    showToast(`⭐ Đã đặt "${shop.shopName}" làm gian hàng chính!`);
  }

  async function handleDeleteShop(shop: ShopeeShop) {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn ngắt kết nối và xóa gian hàng "${shop.shopName}" (ID: ${shop.shopId}) khỏi hệ thống?`
      )
    ) {
      await deleteShopeeShop(shop.id);
      await refreshShopList();
      showToast(`Đã xóa gian hàng "${shop.shopName}".`);
    }
  }

  function openAddShopModal() {
    setEditingShop({
      shopId: "",
      shopName: "",
      country: "VN",
      accessToken: "",
      refreshToken: "",
      isDefault: shops.length === 0,
      note: "",
    });
    setShopModalOpen(true);
  }

  function openEditShopModal(shop: ShopeeShop) {
    setEditingShop({ ...shop });
    setShopModalOpen(true);
  }

  async function handleSaveShopModal() {
    if (!editingShop.shopId?.trim()) {
      alert("Vui lòng nhập Shop ID (Mã gian hàng Shopee).");
      return;
    }
    await saveShopeeShop({
      id: editingShop.id,
      shopId: editingShop.shopId.trim(),
      shopName: editingShop.shopName?.trim() || `Gian hàng ${editingShop.shopId}`,
      country: editingShop.country || "VN",
      accessToken: editingShop.accessToken?.trim() || "",
      refreshToken: editingShop.refreshToken?.trim() || "",
      isDefault: editingShop.isDefault,
      note: editingShop.note || "",
    });
    setShopModalOpen(false);
    await refreshShopList();
    showToast("💾 Đã lưu thông tin gian hàng vào Supabase!");
  }

  const totalShops = shops.length;
  const connectedShops = shops.filter((s) => s.status === "connected" && s.accessToken).length;
  const expiredShops = shops.filter((s) => s.status === "expired").length;
  const defaultShop = shops.find((s) => s.isDefault);

  return (
    <div className="space-y-6 animate-fade-in text-xs sm:text-sm">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-3.5 px-5 rounded-2xl bg-brand-500 text-white font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <Store size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Gian hàng Shopee"
          subtitle="Quản lý danh sách các gian hàng Shopee đã kết nối, ủy quyền thêm shop và quản trị token"
        />

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings size={14} className="text-brand-400" />
              <span>Cấu hình Partner Key</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerateAuthUrl}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Link2 size={14} />
            <span>🔗 Ủy quyền thêm Shop</span>
          </button>
        </div>
      </div>

      {/* Warning banner if Partner App is not configured */}
      {!isAppConfigured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs">Chưa thiết lập Partner ID & Partner Key Shopee</h4>
            <p className="text-xs text-amber-200/80">
              Để ủy quyền và kết nối các gian hàng Shopee, bạn cần nhập Partner ID & Key trong phần Cài đặt hệ thống trước.
            </p>
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="mt-1 px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1 hover:bg-amber-400 cursor-pointer"
              >
                <span>Đến trang Cài đặt ngay</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Tổng số gian hàng</span>
          <div className="text-xl sm:text-2xl font-black text-slate-100 font-mono">{totalShops}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> Đang kết nối
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{connectedShops}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <Clock size={12} /> Token hết hạn
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">{expiredShops}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <Star size={12} /> Gian hàng chính
          </span>
          <div className="text-xs font-bold text-slate-200 truncate mt-1" title={defaultShop?.shopName || "Chưa có"}>
            {defaultShop ? defaultShop.shopName : "Chưa chọn"}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("shops")}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "shops"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Store size={15} />
          <span>Danh sách Gian hàng ({shops.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("logistics");
            if (logisticsChannels.length === 0) {
              loadLogisticsChannels();
            }
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "logistics"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Truck size={15} className="text-orange-400" />
          <span>Cấu hình Vận chuyển Mặc định (Logistics)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("categories");
            if (shopeeCategories.length === 0) {
              loadShopeeCategories();
            }
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "categories"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers size={15} className="text-purple-400" />
          <span>Lưu sẵn Danh mục ({presetCategories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("webhook-logs");
            loadWebhookLogs();
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === "webhook-logs"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20"
              : "bg-slate-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          <RefreshCw size={14} className={loadingLogs ? "animate-spin text-emerald-400" : "text-emerald-400"} />
          <span>Nhật ký Webhook ({webhookLogs.length})</span>
        </button>
      </div>

      {/* LOGISTICS CONFIGURATION TAB */}
      {activeTab === "logistics" && (
        <div className="space-y-6 animate-fade-in">
          {/* Package & Shipping Presets Card */}
          <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
                  <Box size={18} className="text-orange-400" /> Thông số Đóng Gói & Chuẩn Bị Hàng Mặc Định
                </h3>
                <p className="text-xs text-slate-400">
                  Cấu hình sẵn cân nặng, kích thước hộp đóng gói và thời gian giao hàng. Khi đăng hoặc đồng bộ sản phẩm sẽ tự động áp dụng thông số này.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedLogisticsShopId}
                  onChange={(e) => {
                    setSelectedLogisticsShopId(e.target.value);
                    loadLogisticsChannels(e.target.value);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.shopId}>
                      {s.shopName} ({s.shopId})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => loadLogisticsChannels(selectedLogisticsShopId)}
                  disabled={loadingLogistics}
                  className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingLogistics ? "animate-spin" : ""} />
                  <span>{loadingLogistics ? "Đang kéo..." : "Đồng bộ Kênh Shopee"}</span>
                </button>
              </div>
            </div>

            {/* Form Kích thước & Trọng lượng */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              {/* Trọng lượng */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Cân nặng đóng gói (Kg) *</span>
                  <span className="text-[11px] text-orange-400 font-bold">
                    {(Number(logisticsConfig.defaultWeightKg) * 1000).toFixed(0)} gram
                  </span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.01"
                  max="50"
                  value={logisticsConfig.defaultWeightKg}
                  onChange={(e) =>
                    setLogisticsConfig({ ...logisticsConfig, defaultWeightKg: parseFloat(e.target.value) || 0.2 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:border-brand-500"
                />
                {/* Gợi ý nhanh */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setLogisticsConfig({ ...logisticsConfig, defaultWeightKg: 0.2 })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    👕 Áo thun (200g)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogisticsConfig({ ...logisticsConfig, defaultWeightKg: 0.35 })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    👖 Quần / Polo (350g)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogisticsConfig({ ...logisticsConfig, defaultWeightKg: 0.5 })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    🧥 Hoodie (500g)
                  </button>
                </div>
              </div>

              {/* Chiều Dài */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Chiều Dài (Length cm) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={logisticsConfig.defaultLengthCm}
                  onChange={(e) =>
                    setLogisticsConfig({ ...logisticsConfig, defaultLengthCm: parseInt(e.target.value) || 25 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:border-brand-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Khuyên dùng: 25 cm</span>
              </div>

              {/* Chiều Rộng */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Chiều Rộng (Width cm) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={logisticsConfig.defaultWidthCm}
                  onChange={(e) =>
                    setLogisticsConfig({ ...logisticsConfig, defaultWidthCm: parseInt(e.target.value) || 20 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:border-brand-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Khuyên dùng: 20 cm</span>
              </div>

              {/* Chiều Cao */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Chiều Cao (Height cm) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={logisticsConfig.defaultHeightCm}
                  onChange={(e) =>
                    setLogisticsConfig({ ...logisticsConfig, defaultHeightCm: parseInt(e.target.value) || 3 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:border-brand-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Khuyên dùng: 3 cm</span>
              </div>
            </div>

            {/* Thời gian chuẩn bị hàng (Days to Ship) */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <label className="block font-bold text-xs text-slate-200">
                Thời gian chuẩn bị hàng (Days To Ship - DTS):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    !logisticsConfig.isPreOrder
                      ? "bg-brand-500/10 border-brand-500/40 text-slate-100"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                  onClick={() => setLogisticsConfig({ ...logisticsConfig, isPreOrder: false, daysToShip: 2 })}
                >
                  <input
                    type="radio"
                    name="dts"
                    checked={!logisticsConfig.isPreOrder}
                    onChange={() => setLogisticsConfig({ ...logisticsConfig, isPreOrder: false, daysToShip: 2 })}
                    className="mt-1 text-brand-500"
                  />
                  <div>
                    <h4 className="font-bold text-xs text-slate-100">Hàng có sẵn (Giao trong 2 ngày)</h4>
                    <p className="text-[11px] text-slate-400">
                      Chuẩn bị và giao cho đơn vị vận chuyển trong vòng 2 ngày làm việc.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    logisticsConfig.isPreOrder
                      ? "bg-brand-500/10 border-brand-500/40 text-slate-100"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                  onClick={() => setLogisticsConfig({ ...logisticsConfig, isPreOrder: true, daysToShip: 7 })}
                >
                  <input
                    type="radio"
                    name="dts"
                    checked={logisticsConfig.isPreOrder}
                    onChange={() => setLogisticsConfig({ ...logisticsConfig, isPreOrder: true, daysToShip: 7 })}
                    className="mt-1 text-brand-500"
                  />
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-100">Hàng đặt trước (Pre-Order)</h4>
                      {logisticsConfig.isPreOrder && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="7"
                            max="15"
                            value={logisticsConfig.daysToShip}
                            onChange={(e) =>
                              setLogisticsConfig({
                                ...logisticsConfig,
                                daysToShip: Math.max(7, parseInt(e.target.value) || 7),
                              })
                            }
                            className="w-14 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono"
                          />
                          <span className="text-[11px] text-slate-300">ngày</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dành cho áo thun in theo yêu cầu (Shopee quy định từ 7 đến 15 ngày).
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Logistics Channels Selection Card */}
          <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
                  <Truck size={18} className="text-emerald-400" /> Các Kênh Vận Chuyển Áp Dụng Cho Sản Phẩm
                </h3>
                <p className="text-xs text-slate-400">
                  Chọn các đơn vị vận chuyển sẽ được kích hoạt mặc định khi bạn tạo hoặc đồng bộ áo thun lên Shopee.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = logisticsChannels.map((c) => c.channelId);
                    setLogisticsConfig({ ...logisticsConfig, selectedChannelIds: allIds });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setLogisticsConfig({ ...logisticsConfig, selectedChannelIds: [] })}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  Bỏ chọn hết
                </button>
              </div>
            </div>

            {/* Channels Grid / List */}
            {logisticsChannels.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
                <Truck size={36} className="mx-auto text-slate-600" />
                <div className="text-xs text-slate-400">
                  Bấm nút bên dưới để kéo danh sách các kênh vận chuyển thực tế đang mở trên gian hàng Shopee của bạn.
                </div>
                <button
                  type="button"
                  onClick={() => loadLogisticsChannels()}
                  disabled={loadingLogistics}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  <RefreshCw size={14} className={loadingLogistics ? "animate-spin" : ""} />
                  <span>Kéo danh sách Kênh Vận Chuyển từ Shopee</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {logisticsChannels.map((channel) => {
                  const isSelected = logisticsConfig.selectedChannelIds.includes(channel.channelId);
                  const isCoverFee = logisticsConfig.coverShippingFeeChannelIds.includes(channel.channelId);

                  return (
                    <div
                      key={channel.channelId}
                      className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                        isSelected
                          ? "bg-slate-900/90 border-emerald-500/40 shadow-sm"
                          : "bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...logisticsConfig.selectedChannelIds, channel.channelId]
                                : logisticsConfig.selectedChannelIds.filter((id) => id !== channel.channelId);
                              setLogisticsConfig({ ...logisticsConfig, selectedChannelIds: next });
                            }}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/30 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <h4 className="font-bold text-xs text-slate-100">{channel.channelName}</h4>
                            <span className="text-[10px] font-mono text-slate-400">ID: {channel.channelId}</span>
                          </div>
                        </label>

                        {channel.codEnabled && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                            COD
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          Tối đa: <strong className="text-slate-300">{channel.maxWeight}kg</strong>
                        </span>

                        <label
                          className={`flex items-center gap-1.5 cursor-pointer text-[10px] ${
                            !isSelected ? "pointer-events-none opacity-40" : ""
                          }`}
                          title="Người bán sẽ trả toàn bộ phí vận chuyển thay cho khách mua"
                        >
                          <input
                            type="checkbox"
                            disabled={!isSelected}
                            checked={isCoverFee}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...logisticsConfig.coverShippingFeeChannelIds, channel.channelId]
                                : logisticsConfig.coverShippingFeeChannelIds.filter((id) => id !== channel.channelId);
                              setLogisticsConfig({ ...logisticsConfig, coverShippingFeeChannelIds: next });
                            }}
                            className="rounded border-slate-700 text-amber-500 focus:ring-amber-500/30"
                          />
                          <span className="text-slate-400 hover:text-amber-300">Bao cước ship</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Đã chọn: <strong className="text-emerald-400 font-mono">{logisticsConfig.selectedChannelIds.length}</strong> đơn vị vận chuyển
              </span>

              <button
                type="button"
                onClick={handleSaveLogistics}
                disabled={savingLogistics}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingLogistics ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>{savingLogistics ? "Đang lưu..." : "Lưu Cấu Hình Vận Chuyển Mặc Định"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOK LOGS TAB */}
      {activeTab === "webhook-logs" && (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
                <RefreshCw size={18} className="text-emerald-400" /> Nhật ký Sự kiện Webhook Shopee (Push Notifications)
              </h3>
              <p className="text-xs text-slate-400">
                Toàn bộ thông báo đẩy, thay đổi trạng thái đơn hàng, sản phẩm hoặc kiểm tra từ Shopee gửi về hệ thống.
              </p>
            </div>

            <button
              type="button"
              onClick={loadWebhookLogs}
              disabled={loadingLogs}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingLogs ? "animate-spin text-emerald-400" : ""} />
              <span>{loadingLogs ? "Đang tải..." : "Tải lại Logs"}</span>
            </button>
          </div>

          {webhookLogs.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-2">
              <RefreshCw size={32} className="mx-auto text-slate-600" />
              <div className="text-xs text-slate-400">Chưa có bản ghi Webhook nào được nhận từ Shopee.</div>
              <p className="text-[11px] text-slate-500">
                Khi Shopee gửi thông báo (đơn hàng mới, test ping, cập nhật trạng thái), dữ liệu sẽ xuất hiện ở đây ngay lập tức.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Thời gian</th>
                    <th className="py-3 px-4 font-semibold">Event Code</th>
                    <th className="py-3 px-4 font-semibold">Chủ đề sự kiện (Topic)</th>
                    <th className="py-3 px-4 font-semibold">Shop ID</th>
                    <th className="py-3 px-4 font-semibold">IP Gửi</th>
                    <th className="py-3 px-4 font-semibold text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {webhookLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[11px]">
                          Code {log.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-200 text-xs">
                        {log.topic}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        {log.shop_id || <span className="text-slate-600 italic">N/A</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-[120px]">
                        {log.ip || "Direct"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLogPayload(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans font-semibold border border-slate-700 cursor-pointer"
                        >
                          🔍 Xem JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SHOPS TAB */}
      {activeTab === "shops" && (
        <>
          {/* AUTH LINK & CODE EXCHANGE BOX */}
          {authUrl && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-orange-500/40 space-y-4 animate-fade-in shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-orange-400 flex items-center gap-1.5">
                  <ExternalLink size={16} /> Link ủy quyền gian hàng Shopee (OAuth2 Authorization):
                </span>
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-orange-500/20"
                >
                  <span>Mở trang Shopee để cấp quyền</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              <p className="text-xs text-slate-400">
                1. Bấm nút màu cam bên trên để mở cửa sổ Shopee đăng nhập tài khoản Shop và nhấn <strong>Xác nhận</strong>.<br />
                2. Sau khi Shopee cấp quyền thành công, copy mã <strong>Code</strong> & <strong>Shop ID</strong> dán vào form bên dưới:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={authUrl}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 text-slate-300 text-xs font-mono border border-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(authUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLink ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>

              {/* Form đổi Code */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Nhập mã ủy quyền từ Shopee để thêm Shop vào hệ thống:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={exchangeShopId}
                    onChange={(e) => setExchangeShopId(e.target.value.trim())}
                    placeholder="Shop ID (Mã gian hàng) *"
                    className="px-3.5 py-2 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono border border-slate-800 outline-none focus:border-brand-500"
                  />
                  <input
                    type="text"
                    value={exchangeShopName}
                    onChange={(e) => setExchangeShopName(e.target.value)}
                    placeholder="Tên shop gợi nhớ (Tùy chọn)"
                    className="px-3.5 py-2 rounded-xl bg-slate-950 text-slate-100 text-xs border border-slate-800 outline-none focus:border-brand-500"
                  />
                  <input
                    type="text"
                    value={exchangeCode}
                    onChange={(e) => setExchangeCode(e.target.value.trim())}
                    placeholder="Mã Code từ Shopee *"
                    className="px-3.5 py-2 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono border border-slate-800 outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExchangeCode}
                  disabled={exchanging || !exchangeCode.trim() || !exchangeShopId.trim()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer mt-2"
                >
                  {exchanging ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  <span>{exchanging ? "Đang đổi Token..." : "⚡ Đổi Token & Thêm Ngay Shop Vào Danh Sách"}</span>
                </button>
              </div>
            </div>
          )}

      {/* SHOPEE SHOPS LIST */}
      <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
              <Store size={18} className="text-emerald-400" /> Danh sách Gian hàng Shopee ({shops.length})
            </h3>
            <p className="text-xs text-slate-400">
              Quản lý đồng thời nhiều gian hàng Shopee. Bạn có thể đặt gian hàng chính để đồng bộ sản phẩm tự động.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddShopModal}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={14} className="text-emerald-400" />
            <span>Thêm Shop thủ công</span>
          </button>
        </div>

        {shops.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-4">
            <ShoppingBag size={40} className="mx-auto text-slate-600" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-200">Chưa có gian hàng Shopee nào</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Kết nối các gian hàng Shopee của bạn để tối ưu SEO sản phẩm và đồng bộ tự động một cách dễ dàng.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateAuthUrl}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              <Link2 size={15} />
              <span>Ủy quyền gian hàng Shopee đầu tiên</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map((shop) => {
              const isConnected = shop.status === "connected" && shop.accessToken;
              const isExpired = shop.status === "expired";
              const isActionLoading = loadingActionShopId === shop.id;
              const testRes = shopTestResults[shop.id];

              return (
                <div
                  key={shop.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    shop.isDefault
                      ? "bg-slate-900/90 border-brand-500/40 shadow-lg shadow-brand-500/5"
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Shop Info */}
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleSetDefaultShop(shop)}
                        title={shop.isDefault ? "Gian hàng mặc định" : "Bấm để đặt làm Gian hàng mặc định"}
                        className={`p-2 rounded-xl border transition-colors mt-0.5 cursor-pointer ${
                          shop.isDefault
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-sm"
                            : "bg-slate-800 border-slate-700 text-slate-500 hover:text-amber-400"
                        }`}
                      >
                        <Star size={16} fill={shop.isDefault ? "currentColor" : "none"} />
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-100">{shop.shopName}</h4>
                          <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                            Shop ID: {shop.shopId}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold">
                            {shop.country || "VN"}
                          </span>
                          {shop.isDefault && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                              GIAN HÀNG CHÍNH
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isConnected
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : isExpired
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            }`}
                          >
                            {isConnected ? "CONNECTED" : isExpired ? "TOKEN EXPIRED" : "NO TOKEN"}
                          </span>
                        </div>

                        {shop.note && <p className="text-xs text-slate-400 italic">"{shop.note}"</p>}

                        <div className="flex items-center gap-4 text-[11px] text-slate-400">
                          {shop.tokenExpiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              Hạn token: {new Date(shop.tokenExpiresAt).toLocaleString("vi-VN")}
                            </span>
                          )}
                          <span>Cập nhật: {new Date(shop.updatedAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleTestShop(shop)}
                        disabled={isActionLoading || !shop.accessToken}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        title="Kiểm tra kết nối Shop qua Shopee API"
                      >
                        {isActionLoading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={13} className="text-emerald-400" />}
                        <span>Kiểm tra</span>
                      </button>

                      {shop.refreshToken && (
                        <button
                          type="button"
                          onClick={() => handleRefreshToken(shop)}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          title="Làm mới token"
                        >
                          <RefreshCw size={12} />
                          <span>Làm mới Token</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditShopModal(shop)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 cursor-pointer"
                        title="Chỉnh sửa Shop"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteShop(shop)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 cursor-pointer"
                        title="Xóa / Ngắt kết nối Shop"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Test result alert */}
                  {testRes && (
                    <div
                      className={`mt-3 p-2.5 rounded-xl border flex items-center gap-2 text-xs animate-fade-in ${
                        testRes.success
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      }`}
                    >
                      {testRes.success ? (
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle size={14} className="shrink-0 text-rose-400" />
                      )}
                      <span>{testRes.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guide Card */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2">
          <HelpCircle size={16} className="text-brand-400" /> Quy trình kết nối thêm gian hàng Shopee:
        </h4>
        <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1.5 leading-relaxed">
          <li>Đảm bảo bạn đã nhập <strong>Partner ID</strong> và <strong>Partner Key</strong> trong mục Cài đặt.</li>
          <li>Bấm nút <strong>"🔗 Ủy quyền thêm Shop"</strong> ở góc trên ➡️ Mở link Shopee đăng nhập tài khoản Shop của bạn.</li>
          <li>Sau khi đồng ý cấp quyền trên Shopee, copy <strong>Mã Code</strong> và <strong>Shop ID</strong> dán vào form để lưu token.</li>
          <li>Bạn có thể kết nối không giới hạn số lượng gian hàng và bấm vào <strong>⭐ Ngôi sao</strong> để chọn Shop chính.</li>
        </ol>
      </div>
      </>
      )}

        {/* PRESET CATEGORIES CONFIGURATION TAB */}
      {activeTab === "categories" && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Card & Actions */}
          <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
                  <Layers size={18} className="text-purple-400" /> Cấu Hình Danh Mục Sản Phẩm Lưu Sẵn (Categories Preset)
                </h3>
                <p className="text-xs text-slate-400">
                  Lưu sẵn các ngành hàng Shopee (ID & Tên phân cấp) cùng thuộc tính mặc định để áp dụng nhanh khi đồng bộ sản phẩm/áo thun lên Shopee.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Shop selector */}
                {shops.length > 0 && (
                  <select
                    value={selectedCategoryShopId}
                    onChange={(e) => setSelectedCategoryShopId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.shopId}>
                        Shop: {s.shopName} {s.isDefault ? "⭐ (Chính)" : ""}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => loadShopeeCategories()}
                  disabled={loadingCategories}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Đồng bộ danh sách cây danh mục thật từ Shopee Open API"
                >
                  <RefreshCw size={13} className={loadingCategories ? "animate-spin text-purple-400" : "text-purple-400"} />
                  <span>{loadingCategories ? "Đang kéo..." : "Đồng bộ Danh mục Shopee"}</span>
                </button>

                <button
                  type="button"
                  onClick={openCreatePresetModal}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>+ Thêm Cấu Hình Danh Mục</span>
                </button>
              </div>
            </div>

            {/* Filter Search Bar */}
            <div className="flex items-center gap-3 pt-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={presetSearchTerm}
                  onChange={(e) => setPresetSearchTerm(e.target.value)}
                  placeholder="Tìm nhanh cấu hình danh mục theo tên, đường dẫn danh mục hoặc ID..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-700/60 bg-slate-900/90 text-slate-100 text-xs outline-none focus:border-purple-500"
                />
              </div>

              {shopeeCategories.length > 0 && (
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
                  📦 Đã nạp <strong>{shopeeCategories.length}</strong> danh mục Shopee
                </span>
              )}
            </div>

            {/* Presets Cards Grid */}
            {presetCategories.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
                <FolderTree size={36} className="mx-auto text-purple-400/60" />
                <h4 className="font-semibold text-slate-200 text-sm">Chưa có Cấu hình Danh mục lưu sẵn nào</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tạo các cấu hình danh mục sẵn (như Áo Thun Nam, Áo Thun Nữ, Hoodie) để khi đồng bộ sản phẩm, hệ thống tự động điền đúng danh mục và thuộc tính lên Shopee!
                </p>
                <button
                  type="button"
                  onClick={openCreatePresetModal}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg shadow-purple-600/20 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Tạo Cấu Hình Danh Mục Đầu Tiên</span>
                </button>
              </div>
            ) : filteredPresets.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/30 border border-slate-800 text-xs text-slate-400">
                Không tìm thấy cấu hình danh mục nào khớp với từ khóa "{presetSearchTerm}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPresets.map((preset) => {
                  const isDefault = preset.isDefault;
                  const attrEntries = Object.entries(preset.attributes || {});

                  return (
                    <div
                      key={preset.id}
                      className={`p-5 rounded-2xl border transition-all space-y-3.5 relative flex flex-col justify-between ${
                        isDefault
                          ? "bg-slate-900/90 border-purple-500/50 shadow-md shadow-purple-500/5 ring-1 ring-purple-500/30"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Top row */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Tag size={16} />
                            </span>
                            <div>
                              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                                <span>{preset.name}</span>
                                {isDefault && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] flex items-center gap-1">
                                    <Star size={10} className="fill-purple-400 text-purple-400" /> Mặc định
                                  </span>
                                )}
                              </h4>
                              <span className="text-[10px] font-mono text-purple-400 font-bold">
                                Category ID: #{preset.categoryId}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Category Path */}
                        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 flex items-center gap-1.5">
                          <FolderTree size={13} className="shrink-0 text-slate-400" />
                          <span className="truncate font-semibold" title={preset.categoryNamePath}>
                            {preset.categoryNamePath || `Danh mục #${preset.categoryId}`}
                          </span>
                        </div>

                        {/* Preset Attributes Badges */}
                        {attrEntries.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Thuộc tính mặc định ({attrEntries.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {attrEntries.map(([key, val]) => (
                                <span
                                  key={key}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80 font-medium"
                                  title={`${key}: ${String(val)}`}
                                >
                                  <strong className="text-slate-400">{key}:</strong> {String(val)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {preset.note && (
                          <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60">
                            📝 {preset.note}
                          </p>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        {!isDefault ? (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultPreset(preset)}
                            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-purple-950 hover:text-purple-300 text-slate-400 font-semibold border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Star size={12} />
                            <span>Đặt mặc định</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Đang áp dụng chính
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditPresetModal(preset)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 cursor-pointer"
                            title="Xóa cấu hình"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WEBHOOK LOGS TAB */}
      {activeTab === "webhook-logs" && (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
                <RefreshCw size={18} className="text-emerald-400" /> Nhật ký Sự kiện Webhook Shopee (Push Notifications)
              </h3>
              <p className="text-xs text-slate-400">
                Toàn bộ thông báo đẩy, thay đổi trạng thái đơn hàng, sản phẩm hoặc kiểm tra từ Shopee gửi về hệ thống.
              </p>
            </div>

            <button
              type="button"
              onClick={loadWebhookLogs}
              disabled={loadingLogs}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingLogs ? "animate-spin text-emerald-400" : ""} />
              <span>{loadingLogs ? "Đang tải..." : "Tải lại Logs"}</span>
            </button>
          </div>

          {webhookLogs.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-2">
              <RefreshCw size={32} className="mx-auto text-slate-600" />
              <div className="text-xs text-slate-400">Chưa có bản ghi Webhook nào được nhận từ Shopee.</div>
              <p className="text-[11px] text-slate-500">
                Khi Shopee gửi thông báo (đơn hàng mới, test ping, cập nhật trạng thái), dữ liệu sẽ xuất hiện ở đây ngay lập tức.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Thời gian</th>
                    <th className="py-3 px-4 font-semibold">Event Code</th>
                    <th className="py-3 px-4 font-semibold">Chủ đề sự kiện (Topic)</th>
                    <th className="py-3 px-4 font-semibold">Shop ID</th>
                    <th className="py-3 px-4 font-semibold">IP Gửi</th>
                    <th className="py-3 px-4 font-semibold text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {webhookLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 font-bold text-orange-400">
                        Code: {log.code}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {log.topic || "Unknown Topic"}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {log.shop_id || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {log.ip || "Direct"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLogPayload(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-sans font-semibold cursor-pointer"
                        >
                          Xem Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT WEBHOOK LOG */}
      {selectedLogPayload && (
        <Modal
          open={true}
          onClose={() => setSelectedLogPayload(null)}
          title={`Chi tiết Webhook: ${selectedLogPayload.topic} (Code: ${selectedLogPayload.code})`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">Thời gian:</span>{" "}
                <strong className="text-slate-300">{new Date(selectedLogPayload.created_at).toLocaleString("vi-VN")}</strong>
              </div>
              <div>
                <span className="text-slate-500">Shop ID:</span>{" "}
                <strong className="text-slate-300">{selectedLogPayload.shop_id || "N/A"}</strong>
              </div>
              <div>
                <span className="text-slate-500">IP Nguồn:</span>{" "}
                <strong className="text-slate-300">{selectedLogPayload.ip || "N/A"}</strong>
              </div>
              <div>
                <span className="text-slate-500">Code:</span>{" "}
                <strong className="text-orange-400">{selectedLogPayload.code}</strong>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300">
                Dữ liệu nhận (Payload JSON):
              </label>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-96">
                {JSON.stringify(selectedLogPayload.payload, null, 2)}
              </pre>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLogPayload(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL THÊM / CHỈNH SỬA CẤU HÌNH DANH MỤC LƯU SẴN */}
      {presetModalOpen && (
        <Modal
          open={true}
          onClose={() => setPresetModalOpen(false)}
          title={editingPreset.id ? "Chỉnh sửa Cấu hình Danh mục Shopee" : "Tạo Cấu hình Danh mục Shopee lưu sẵn"}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Tên Preset */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Tên Cấu hình Gợi nhớ <span className="text-rose-400 font-bold">*</span>
              </label>
              <input
                type="text"
                value={editingPreset.name || ""}
                onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                placeholder="VD: Áo Thun Nam Unisex Cao Cấp, Áo Polo Nam, Áo Hoodie..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-purple-500"
              />
            </div>

            {/* Chọn Danh Mục Shopee */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <FolderTree size={15} className="text-purple-400" /> Chọn Danh Mục Shopee Thực Tế <span className="text-rose-400 font-bold">*</span>
                </label>
                {editingPreset.categoryId ? (
                  <span className="text-[11px] font-mono text-purple-300 font-bold px-2 py-0.5 rounded-md bg-purple-500/20">
                    ID đã chọn: #{editingPreset.categoryId}
                  </span>
                ) : null}
              </div>

              {editingPreset.categoryNamePath && (
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-200 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-purple-400 shrink-0" />
                  <span>{editingPreset.categoryNamePath}</span>
                </div>
              )}

              {/* Tìm kiếm danh mục */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalCatSearch}
                  onChange={(e) => setModalCatSearch(e.target.value)}
                  placeholder="Gõ từ khóa để lọc ngành hàng (vd: áo thun, thời trang nam, t-shirt, quần, váy...)"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs outline-none focus:border-purple-500"
                />
              </div>

              {/* Danh sách danh mục lựa chọn */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800/60 bg-slate-950/60">
                {shopeeCategories.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 space-y-2">
                    <p className="text-[11px]">Chưa có dữ liệu danh mục từ Shopee.</p>
                    <button
                      type="button"
                      onClick={() => loadShopeeCategories()}
                      disabled={loadingCategories}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={12} className={loadingCategories ? "animate-spin" : ""} />
                      <span>{loadingCategories ? "Đang tải..." : "Kéo danh mục từ Shopee ngay"}</span>
                    </button>
                  </div>
                ) : filteredLeafCategories.length === 0 ? (
                  <div className="p-3 text-center text-slate-500 text-[11px]">
                    Không tìm thấy danh mục nào khớp với "{modalCatSearch}".
                  </div>
                ) : (
                  filteredLeafCategories.map((cat) => {
                    const isSelected = editingPreset.categoryId === cat.categoryId;
                    const path = getCategoryPath(cat.categoryId, shopeeCategories);

                    return (
                      <button
                        key={cat.categoryId}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        className={`w-full text-left p-2.5 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? "bg-purple-500/20 text-purple-200 font-bold"
                            : "hover:bg-slate-800 text-slate-300 text-[11px]"
                        }`}
                      >
                        <div className="truncate">
                          <span className="block font-semibold">{path}</span>
                          <span className="text-[10px] font-mono text-slate-500">ID: #{cat.categoryId}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-purple-400 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cấu hình Thuộc tính mặc định (Attributes) */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sliders size={15} className="text-purple-400" /> Thiết lập Thuộc tính Sản phẩm Mặc định
                </label>
                {loadingAttributes && (
                  <span className="text-[11px] text-purple-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Đang tải thuộc tính...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Các giá trị này sẽ tự động được gán khi bạn đồng bộ áo thun vào Shopee.
              </p>

              {/* Dynamic or Custom Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Thương hiệu */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Thương hiệu (Brand)
                  </label>
                  <input
                    type="text"
                    value={editingPreset.attributes?.["Thương hiệu"] || "No Brand"}
                    onChange={(e) =>
                      setEditingPreset({
                        ...editingPreset,
                        attributes: { ...editingPreset.attributes, "Thương hiệu": e.target.value },
                      })
                    }
                    placeholder="No Brand / Tên Brand của bạn"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs outline-none focus:border-purple-500"
                  />
                </div>

                {/* Chất liệu */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Chất liệu (Material)
                  </label>
                  <input
                    type="text"
                    value={editingPreset.attributes?.["Chất liệu"] || "Cotton 100%"}
                    onChange={(e) =>
                      setEditingPreset({
                        ...editingPreset,
                        attributes: { ...editingPreset.attributes, "Chất liệu": e.target.value },
                      })
                    }
                    placeholder="VD: Cotton 100%, Cotton Compact 2C..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs outline-none focus:border-purple-500"
                  />
                </div>

                {/* Xuất xứ */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Xuất xứ (Origin)
                  </label>
                  <input
                    type="text"
                    value={editingPreset.attributes?.["Xuất xứ"] || "Việt Nam"}
                    onChange={(e) =>
                      setEditingPreset({
                        ...editingPreset,
                        attributes: { ...editingPreset.attributes, "Xuất xứ": e.target.value },
                      })
                    }
                    placeholder="Việt Nam"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs outline-none focus:border-purple-500"
                  />
                </div>

                {/* Phong cách */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Phong cách (Style)
                  </label>
                  <input
                    type="text"
                    value={editingPreset.attributes?.["Phong cách"] || "Streetwear / Unisex"}
                    onChange={(e) =>
                      setEditingPreset({
                        ...editingPreset,
                        attributes: { ...editingPreset.attributes, "Phong cách": e.target.value },
                      })
                    }
                    placeholder="Streetwear, Basic, Hàn Quốc, Cổ điển..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-xs outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Shopee Category Attributes Loaded (if available) */}
              {categoryAttributes.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-bold text-purple-300 block">
                    Các thuộc tính Shopee bổ sung cho ngành hàng này:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto p-1">
                    {categoryAttributes.slice(0, 8).map((attr) => {
                      const attrKey = attr.displayAttributeName || attr.originalAttributeName;
                      const currentValue = editingPreset.attributes?.[attrKey] || "";

                      return (
                        <div key={attr.attributeId}>
                          <label className="block text-[11px] font-medium text-slate-400 mb-0.5 truncate" title={attrKey}>
                            {attrKey} {attr.isMandatory && <span className="text-rose-400 font-bold">*</span>}
                          </label>

                          {attr.attributeValueList && attr.attributeValueList.length > 0 ? (
                            <select
                              value={currentValue}
                              onChange={(e) =>
                                setEditingPreset({
                                  ...editingPreset,
                                  attributes: {
                                    ...editingPreset.attributes,
                                    [attrKey]: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs outline-none focus:border-purple-500 cursor-pointer"
                            >
                              <option value="">-- Chọn {attrKey} --</option>
                              {attr.attributeValueList.map((val) => (
                                <option key={val.valueId} value={val.displayValueName || val.originalValueName}>
                                  {val.displayValueName || val.originalValueName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={currentValue}
                              onChange={(e) =>
                                setEditingPreset({
                                  ...editingPreset,
                                  attributes: {
                                    ...editingPreset.attributes,
                                    [attrKey]: e.target.value,
                                  },
                                })
                              }
                              placeholder={`Nhập ${attrKey}`}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs outline-none focus:border-purple-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Ghi chú cấu hình (Tùy chọn)
              </label>
              <input
                type="text"
                value={editingPreset.note || ""}
                onChange={(e) => setEditingPreset({ ...editingPreset, note: e.target.value })}
                placeholder="VD: Dành cho bộ sưu tập T-shirt mùa hè 2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-purple-500"
              />
            </div>

            {/* Mặc định checkbox */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={editingPreset.isDefault || false}
                onChange={(e) => setEditingPreset({ ...editingPreset, isDefault: e.target.checked })}
                className="rounded border-slate-700 text-purple-500 focus:ring-purple-500/30"
              />
              <span className="font-semibold text-slate-200">Đặt làm Cấu hình Danh mục Mặc định</span>
            </label>

            {/* Modal Buttons */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPresetModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={savingPreset}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingPreset ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>{savingPreset ? "Đang lưu..." : "Lưu Cấu Hình Danh Mục"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL THÊM / SỬA SHOP */}
      {shopModalOpen && (
        <Modal
          open={true}
          onClose={() => setShopModalOpen(false)}
          title={editingShop.id ? "Chỉnh sửa Gian hàng Shopee" : "Thêm Gian hàng Shopee thủ công"}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Shop ID (Mã gian hàng) <span className="text-rose-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={editingShop.shopId}
                  onChange={(e) => setEditingShop({ ...editingShop, shopId: e.target.value.trim() })}
                  placeholder="VD: 10485923"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 font-mono outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Quốc gia (Country)
                </label>
                <select
                  value={editingShop.country || "VN"}
                  onChange={(e) => setEditingShop({ ...editingShop, country: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="VN">Việt Nam (VN)</option>
                  <option value="SG">Singapore (SG)</option>
                  <option value="TH">Thái Lan (TH)</option>
                  <option value="MY">Malaysia (MY)</option>
                  <option value="PH">Philippines (PH)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Tên Gian Hàng (Hiển thị)
              </label>
              <input
                type="text"
                value={editingShop.shopName}
                onChange={(e) => setEditingShop({ ...editingShop, shopName: e.target.value })}
                placeholder="VD: MEO BAO Official Store"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Access Token</span>
                <button
                  type="button"
                  onClick={() => setShowModalToken(!showModalToken)}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
                >
                  {showModalToken ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showModalToken ? "Ẩn" : "Hiện"}</span>
                </button>
              </label>
              <input
                type={showModalToken ? "text" : "password"}
                value={editingShop.accessToken || ""}
                onChange={(e) => setEditingShop({ ...editingShop, accessToken: e.target.value.trim() })}
                placeholder="Dán access token (nếu có)"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 font-mono outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Refresh Token
              </label>
              <input
                type={showModalToken ? "text" : "password"}
                value={editingShop.refreshToken || ""}
                onChange={(e) => setEditingShop({ ...editingShop, refreshToken: e.target.value.trim() })}
                placeholder="Dán refresh token (nếu có)"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 font-mono outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Ghi chú nội bộ
              </label>
              <input
                type="text"
                value={editingShop.note || ""}
                onChange={(e) => setEditingShop({ ...editingShop, note: e.target.value })}
                placeholder="VD: Shop chuyên áo thun Local Brand Unisex"
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-brand-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={editingShop.isDefault || false}
                onChange={(e) => setEditingShop({ ...editingShop, isDefault: e.target.checked })}
                className="rounded border-slate-700 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="font-semibold text-slate-200">Đặt làm Gian hàng mặc định</span>
            </label>

            <div className="flex gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShopModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveShopModal}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/20 flex items-center justify-center gap-1.5"
              >
                <Save size={15} />
                <span>Lưu thông tin Shop</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
