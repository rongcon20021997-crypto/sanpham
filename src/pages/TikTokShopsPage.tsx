import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import {
  getTikTokAppConfig,
  fetchTikTokAppConfig,
  getTikTokShops,
  fetchTikTokShops,
  saveTikTokShop,
  deleteTikTokShop,
  setDefaultTikTokShop,
  generateTikTokAuthUrl,
  exchangeTikTokAuthCode,
  refreshTikTokShopToken,
  testTikTokShopConnection,
  type TikTokAppConfig,
  type TikTokShop,
} from "@/lib/tiktok";
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
  Key,
  Shield,
  Layers,
  Globe,
  Radio,
} from "lucide-react";

interface TikTokShopsPageProps {
  onNavigateToSettings?: () => void;
}

export function TikTokShopsPage({ onNavigateToSettings }: TikTokShopsPageProps) {
  const [appConfig, setAppConfig] = useState<TikTokAppConfig>(getTikTokAppConfig());
  const [shops, setShops] = useState<TikTokShop[]>(getTikTokShops());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"shops" | "guide">("shops");

  // Modal Thêm / Sửa Shop thủ công
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Partial<TikTokShop>>({
    shopName: "",
    shopCode: "",
    shopCipher: "",
    region: "VN",
    sellerType: "CROSS_BORDER",
    accessToken: "",
    refreshToken: "",
    note: "",
  });

  // Modal Ủy quyền TikTok
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [customShopNameInput, setCustomShopNameInput] = useState("");
  const [exchanging, setExchanging] = useState(false);

  // Trạng thái kiểm tra & làm mới
  const [loadingActionShopId, setLoadingActionShopId] = useState<string | null>(null);
  const [shopTestResults, setShopTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Toast / Copy
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // Load danh sách shops & app config từ Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [remoteConfig, remoteShops] = await Promise.all([
          fetchTikTokAppConfig(),
          fetchTikTokShops(),
        ]);
        setAppConfig(remoteConfig);
        setShops(remoteShops);
      } catch (err) {
        console.error("Lỗi tải dữ liệu TikTok Shop:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function refreshShopList() {
    const updated = await fetchTikTokShops();
    setShops(updated);
  }

  // Mở modal thêm shop
  function openAddShopModal() {
    setEditingShop({
      id: `tiktok_shop_${Date.now()}`,
      shopName: "",
      shopCode: "",
      shopCipher: "",
      region: "VN",
      sellerType: "CROSS_BORDER",
      accessToken: "",
      refreshToken: "",
      note: "",
    });
    setIsEditModalOpen(true);
  }

  // Mở modal sửa shop
  function openEditShopModal(shop: TikTokShop) {
    setEditingShop({ ...shop });
    setIsEditModalOpen(true);
  }

  // Lưu shop thủ công
  async function handleSaveShop() {
    if (!editingShop.shopName?.trim()) {
      alert("Vui lòng nhập Tên gian hàng TikTok.");
      return;
    }

    try {
      await saveTikTokShop({
        ...editingShop,
        shopName: editingShop.shopName.trim(),
        shopCode: editingShop.shopCode?.trim() || "",
        shopCipher: editingShop.shopCipher?.trim() || "",
        region: editingShop.region || "VN",
        sellerType: editingShop.sellerType || "CROSS_BORDER",
        accessToken: editingShop.accessToken?.trim() || "",
        refreshToken: editingShop.refreshToken?.trim() || "",
        note: editingShop.note?.trim() || "",
      });

      setIsEditModalOpen(false);
      await refreshShopList();
      showToast("✅ Đã lưu thông tin gian hàng TikTok thành công!");
    } catch (err) {
      alert(`Lỗi lưu gian hàng: ${(err as Error).message}`);
    }
  }

  // Xóa shop
  async function handleDeleteShop(shop: TikTokShop) {
    if (window.confirm(`Bạn có chắc chắn muốn ngắt kết nối và xóa gian hàng "${shop.shopName}" khỏi hệ thống?`)) {
      await deleteTikTokShop(shop.id);
      await refreshShopList();
      showToast(`🗑️ Đã xóa gian hàng "${shop.shopName}".`);
    }
  }

  // Đặt làm shop chính
  async function handleSetDefaultShop(shop: TikTokShop) {
    await setDefaultTikTokShop(shop.id);
    await refreshShopList();
    showToast(`⭐ Đã đặt "${shop.shopName}" làm gian hàng chính!`);
  }

  // Test kết nối shop
  async function handleTestShop(shop: TikTokShop) {
    setLoadingActionShopId(shop.id);
    try {
      const res = await testTikTokShopConnection(shop.id);
      setShopTestResults((prev) => ({ ...prev, [shop.id]: res }));
      await refreshShopList();
      if (res.success) {
        showToast(`✅ Gian hàng "${shop.shopName}" hoạt động bình thường!`);
      } else {
        alert(`❌ Kiểm tra kết nối thất bại: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoadingActionShopId(null);
    }
  }

  // Làm mới token shop
  async function handleRefreshShopToken(shop: TikTokShop) {
    setLoadingActionShopId(shop.id);
    try {
      await refreshTikTokShopToken(shop.id);
      await refreshShopList();
      showToast(`✅ Đã làm mới Access Token cho "${shop.shopName}"!`);
    } catch (err) {
      alert(`Lỗi làm mới token: ${(err as Error).message}`);
    } finally {
      setLoadingActionShopId(null);
    }
  }

  // Đổi mã ủy quyền lấy token
  async function handleExchangeAuthCode() {
    if (!authCodeInput.trim()) {
      alert("Vui lòng dán mã ủy quyền (Auth Code).");
      return;
    }

    setExchanging(true);
    try {
      const newShop = await exchangeTikTokAuthCode(
        authCodeInput.trim(),
        customShopNameInput.trim() || undefined
      );

      setIsAuthModalOpen(false);
      setAuthCodeInput("");
      setCustomShopNameInput("");
      await refreshShopList();
      showToast(`🎉 Kết nối thành công gian hàng: "${newShop.shopName}"!`);
    } catch (err) {
      alert(`Lỗi kết nối TikTok Shop: ${(err as Error).message}`);
    } finally {
      setExchanging(false);
    }
  }

  // Mở link ủy quyền
  function handleOpenAuthLink() {
    try {
      const authUrl = generateTikTokAuthUrl(appConfig);
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const isConfigured = Boolean(appConfig.appKey && appConfig.appSecret);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-rose-500/30 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up">
          <CheckCircle2 className="text-rose-400" size={20} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Gian hàng TikTok Shop"
          subtitle="Quản lý kết nối các gian hàng TikTok Shop nội bộ, ủy quyền OAuth2 và làm mới token"
        />

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Settings size={14} />
              <span>Cài đặt Khóa App</span>
            </button>
          )}

          <button
            onClick={openAddShopModal}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm Shop thủ công</span>
          </button>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-red-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
          >
            <Link2 size={14} />
            <span>+ Kết nối TikTok Shop</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo chưa cấu hình App Key / Secret */}
      {!isConfigured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-200 text-sm">
          <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Chưa cấu hình Khóa ứng dụng (App Key) & Khóa bí mật (App Secret)</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Để kết nối và làm mới token TikTok Shop, vui lòng vào tab <strong>Cài đặt &gt; Kết nối TikTok Shop</strong> để nhập <strong>Khóa ứng dụng (App Key)</strong> và <strong>Khóa bí mật (App Secret)</strong> của bạn.
            </p>
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Đến trang Cài đặt ngay</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("shops")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "shops"
              ? "bg-slate-800 text-rose-400 border border-rose-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Store size={14} />
          <span>Danh sách Gian Hàng ({shops.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("guide")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "guide"
              ? "bg-slate-800 text-rose-400 border border-rose-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <HelpCircle size={14} />
          <span>Hướng dẫn lấy Khóa ứng dụng</span>
        </button>
      </div>

      {/* Tab: Danh sách Gian Hàng */}
      {activeTab === "shops" && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-rose-500" />
              <p className="text-sm text-slate-400">Đang tải danh sách gian hàng TikTok...</p>
            </div>
          ) : shops.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-slate-900/60 border border-slate-800/80 p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                <Store size={32} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-200">Chưa có gian hàng TikTok Shop nào</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kết nối gian hàng TikTok Shop của bạn để tự động đồng bộ đơn hàng, sản phẩm và tự động làm mới token.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/20 cursor-pointer"
                >
                  <Link2 size={14} />
                  <span>+ Kết nối TikTok Shop ngay</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shops.map((shop) => {
                const isExpired =
                  shop.status === "expired" ||
                  (shop.tokenExpiresAt && Date.now() > shop.tokenExpiresAt);
                const isConnected = shop.status === "connected" && !isExpired && Boolean(shop.accessToken);
                const isActionLoading = loadingActionShopId === shop.id;
                const testResult = shopTestResults[shop.id];

                return (
                  <div
                    key={shop.id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                      shop.isDefault
                        ? "bg-slate-900/90 border-rose-500/40 shadow-lg shadow-rose-950/20"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Header card */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-base">
                            TT
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-100 text-sm leading-tight">
                                {shop.shopName}
                              </h4>
                              {shop.isDefault && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                                  Chính
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span>Mã: {shop.shopCode || shop.id}</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-300">{shop.region || "VN"}</span>
                            </p>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div>
                          {isConnected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Đã kết nối
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-semibold border border-amber-500/20">
                              <AlertCircle size={12} />
                              Hết hạn Token
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px] font-semibold border border-slate-700">
                              Chưa kết nối
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                        {shop.shopCipher && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>Shop Cipher:</span>
                            <span className="font-mono text-slate-300 truncate max-w-[150px]">
                              {shop.shopCipher}
                            </span>
                          </div>
                        )}

                        {shop.tokenExpiresAt && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              Hạn Access Token:
                            </span>
                            <span className={isExpired ? "text-amber-400 font-semibold" : "text-slate-300"}>
                              {new Date(shop.tokenExpiresAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                        )}

                        {shop.refreshTokenExpiresAt && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="flex items-center gap-1">
                              <RefreshCw size={11} />
                              Hạn Refresh Token:
                            </span>
                            <span className="text-slate-300">
                              {new Date(shop.refreshTokenExpiresAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                        )}

                        {shop.note && (
                          <p className="text-[11px] text-slate-400 italic pt-1 line-clamp-2">
                            "{shop.note}"
                          </p>
                        )}

                        {testResult && (
                          <div
                            className={`p-2 rounded-lg text-[11px] mt-2 ${
                              testResult.success
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-300 border border-red-500/20"
                            }`}
                          >
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Test connection button */}
                        <button
                          type="button"
                          onClick={() => handleTestShop(shop)}
                          disabled={isActionLoading || !shop.accessToken}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          title="Kiểm tra kết nối Shop qua TikTok Open API"
                        >
                          {isActionLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ShieldCheck size={13} className="text-emerald-400" />
                          )}
                          <span>Kiểm tra</span>
                        </button>

                        {/* Refresh token button */}
                        {shop.refreshToken && (
                          <button
                            type="button"
                            onClick={() => handleRefreshShopToken(shop)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            title="Làm mới Access Token"
                          >
                            <RefreshCw size={12} className={isActionLoading ? "animate-spin" : ""} />
                            <span>Làm mới Token</span>
                          </button>
                        )}

                        {!shop.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultShop(shop)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 cursor-pointer"
                            title="Đặt làm gian hàng chính"
                          >
                            <Star size={13} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditShopModal(shop)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 cursor-pointer"
                          title="Chỉnh sửa gian hàng"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteShop(shop)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 cursor-pointer"
                          title="Xóa gian hàng"
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
      )}

      {/* Tab: Hướng dẫn lấy Khóa ứng dụng */}
      {activeTab === "guide" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-6 max-w-4xl">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Key size={18} className="text-rose-400" />
              Hướng dẫn lấy Khóa ứng dụng (App Key) & Khóa bí mật (App Secret) TikTok Shop
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dành cho tài khoản Nhà phát triển nội bộ (Custom / In-house App) trên cổng TikTok Shop Partner Center.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h4 className="font-semibold text-slate-200 text-xs">Tạo ứng dụng nội bộ</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Đăng nhập vào <a href="https://partner.tiktokshop.com" target="_blank" rel="noreferrer" className="text-rose-400 underline inline-flex items-center gap-0.5">TikTok Shop Partner Center <ExternalLink size={10} /></a> &gt; <strong>App Management</strong> &gt; Tạo ứng dụng <strong>Custom App</strong> (Dành cho người bán nội bộ).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h4 className="font-semibold text-slate-200 text-xs">Sao chép App Key & Secret</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Trong trang chi tiết App, bạn sẽ thấy <strong>Khóa ứng dụng (App Key)</strong> và <strong>Khóa bí mật của ứng dụng (App Secret)</strong>. Sao chép và dán vào tab Cài đặt trong web này.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                3
              </div>
              <h4 className="font-semibold text-slate-200 text-xs">Ủy quyền gian hàng</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Bấm nút <strong>"+ Kết nối TikTok Shop"</strong> để ủy quyền cho gian hàng của bạn. Hệ thống sẽ tự động nhận Access Token và Refresh Token để duy trì kết nối.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Thêm / Sửa Shop thủ công */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={editingShop.id ? "Chỉnh sửa Gian Hàng TikTok" : "Thêm Gian Hàng TikTok thủ công"}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tên Gian Hàng <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editingShop.shopName || ""}
                onChange={(e) => setEditingShop({ ...editingShop, shopName: e.target.value })}
                placeholder="VD: Áo Thun In TikTok VN"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mã Shop (Shop Code)</label>
                <input
                  type="text"
                  value={editingShop.shopCode || ""}
                  onChange={(e) => setEditingShop({ ...editingShop, shopCode: e.target.value })}
                  placeholder="VD: VNLC12345"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Khu vực (Region)</label>
                <select
                  value={editingShop.region || "VN"}
                  onChange={(e) => setEditingShop({ ...editingShop, region: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="VN">Việt Nam (VN)</option>
                  <option value="TH">Thái Lan (TH)</option>
                  <option value="MY">Malaysia (MY)</option>
                  <option value="PH">Philippines (PH)</option>
                  <option value="SG">Singapore (SG)</option>
                  <option value="ID">Indonesia (ID)</option>
                  <option value="US">Hoa Kỳ (US)</option>
                  <option value="GB">Vương Quốc Anh (GB)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Shop Cipher (nếu có)</label>
              <input
                type="text"
                value={editingShop.shopCipher || ""}
                onChange={(e) => setEditingShop({ ...editingShop, shopCipher: e.target.value })}
                placeholder="Dán mã shop_cipher từ TikTok API"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-rose-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Access Token (Tùy chọn)</label>
              <textarea
                rows={2}
                value={editingShop.accessToken || ""}
                onChange={(e) => setEditingShop({ ...editingShop, accessToken: e.target.value })}
                placeholder="Dán token nếu bạn tạo token thủ công từ Partner Center"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Refresh Token (Tùy chọn)</label>
              <textarea
                rows={2}
                value={editingShop.refreshToken || ""}
                onChange={(e) => setEditingShop({ ...editingShop, refreshToken: e.target.value })}
                placeholder="Dán refresh token để tự động làm mới token"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi chú</label>
              <input
                type="text"
                value={editingShop.note || ""}
                onChange={(e) => setEditingShop({ ...editingShop, note: e.target.value })}
                placeholder="Ghi chú nội bộ cho shop này..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveShop}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-900/30"
              >
                <Save size={14} />
                <span>Lưu thông tin</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Ủy quyền kết nối TikTok Shop (OAuth2) */}
      {isAuthModalOpen && (
        <Modal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          title="Ủy quyền kết nối Gian Hàng TikTok Shop"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs space-y-1.5">
              <p className="font-semibold text-rose-300">Cách kết nối TikTok Shop:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Bấm nút <strong>"1. Mở trang đăng nhập & ủy quyền TikTok"</strong> bên dưới.</li>
                <li>Đăng nhập tài khoản TikTok Shop của bạn và bấm <strong>Authorize (Ủy quyền)</strong>.</li>
                <li>Sau khi ủy quyền xong, TikTok sẽ chuyển hướng kèm theo mã <code>auth_code</code> trên thanh địa chỉ.</li>
                <li>Sao chép mã <code>auth_code</code> hoặc toàn bộ đường link rồi dán vào ô bên dưới.</li>
              </ol>
            </div>

            <div>
              <button
                type="button"
                onClick={handleOpenAuthLink}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>1. Mở trang đăng nhập & ủy quyền TikTok</span>
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-3 text-slate-500 text-[11px] font-semibold uppercase">Bước 2</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tên gian hàng tùy chỉnh (Tùy chọn)
              </label>
              <input
                type="text"
                value={customShopNameInput}
                onChange={(e) => setCustomShopNameInput(e.target.value)}
                placeholder="VD: Shop Thời Trang TikTok"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Dán mã ủy quyền (Auth Code) hoặc URL sau khi ủy quyền <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={authCodeInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Nếu dán cả URL thì tự parse auth_code hoặc code
                  if (val.includes("code=") || val.includes("auth_code=")) {
                    try {
                      const url = new URL(val);
                      const code = url.searchParams.get("auth_code") || url.searchParams.get("code");
                      if (code) {
                        setAuthCodeInput(code);
                        return;
                      }
                    } catch {
                      // ignore
                    }
                  }
                  setAuthCodeInput(val);
                }}
                placeholder="Dán mã auth_code hoặc dán toàn bộ URL sau khi TikTok redirect..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExchangeAuthCode}
                disabled={exchanging || !authCodeInput.trim()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-900/30"
              >
                {exchanging ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                <span>{exchanging ? "Đang xác thực..." : "Xác nhận kết nối"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
