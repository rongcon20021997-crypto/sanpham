import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import {
  getShopeeAppConfig,
  getShopeeShops,
  saveShopeeShop,
  deleteShopeeShop,
  setDefaultShopeeShop,
  generateShopeeAuthUrl,
  exchangeShopeeAuthCode,
  refreshShopeeShopToken,
  testShopeeShopConnection,
  type ShopeeAppConfig,
  type ShopeeShop,
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
} from "lucide-react";

interface ShopeeShopsPageProps {
  onNavigateToSettings?: () => void;
}

export function ShopeeShopsPage({ onNavigateToSettings }: ShopeeShopsPageProps) {
  const [appConfig, setAppConfig] = useState<ShopeeAppConfig>(getShopeeAppConfig());
  const [shops, setShops] = useState<ShopeeShop[]>(getShopeeShops());

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

  function refreshShopList() {
    setShops(getShopeeShops());
    setAppConfig(getShopeeAppConfig());
  }

  const isAppConfigured = Boolean(appConfig.partnerId && appConfig.partnerKey);

  async function handleGenerateAuthUrl() {
    if (!isAppConfigured) {
      alert("Vui lòng cấu hình Partner ID và Partner Key trong Cài đặt trước khi ủy quyền gian hàng.");
      onNavigateToSettings?.();
      return;
    }
    try {
      const url = await generateShopeeAuthUrl(appConfig.redirectUrl);
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
      refreshShopList();
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
    refreshShopList();
    if (res.success) {
      showToast(`✅ Gian hàng "${shop.shopName}" hoạt động bình thường!`);
    }
  }

  async function handleRefreshShopToken(shop: ShopeeShop) {
    setLoadingActionShopId(shop.id);
    try {
      await refreshShopeeShopToken(shop.id);
      refreshShopList();
      showToast(`✅ Đã làm mới Access Token cho "${shop.shopName}"!`);
    } catch (err) {
      alert(`Lỗi làm mới token: ${(err as Error).message}`);
    } finally {
      setLoadingActionShopId(null);
    }
  }

  function handleSetDefaultShop(shop: ShopeeShop) {
    setDefaultShopeeShop(shop.id);
    refreshShopList();
    showToast(`⭐ Đã đặt "${shop.shopName}" làm gian hàng chính!`);
  }

  function handleDeleteShop(shop: ShopeeShop) {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn ngắt kết nối và xóa gian hàng "${shop.shopName}" (ID: ${shop.shopId}) khỏi hệ thống?`
      )
    ) {
      deleteShopeeShop(shop.id);
      refreshShopList();
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

  function handleSaveShopModal() {
    if (!editingShop.shopId?.trim()) {
      alert("Vui lòng nhập Shop ID (Mã gian hàng Shopee).");
      return;
    }
    saveShopeeShop({
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
    refreshShopList();
    showToast("💾 Đã lưu thông tin gian hàng!");
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
              onClick={handleExchangeAuthCode}
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
                          onClick={() => handleRefreshShopToken(shop)}
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
