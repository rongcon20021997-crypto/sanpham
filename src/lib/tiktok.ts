import { supabase } from "./supabase";

export interface TikTokAppConfig {
  appKey: string;
  appSecret: string;
  serviceId: string;
  environment: "live" | "sandbox";
  redirectUrl: string;
}

export interface TikTokShop {
  id: string; // ID định danh nội bộ trong hệ thống
  shopCipher: string; // Mã shop_cipher từ TikTok Shop Open API
  shopCode: string; // Mã shop_code (ID gian hàng hiển thị)
  shopName: string;
  region: string; // VD: 'VN', 'TH', 'MY', 'US'
  sellerType?: string; // 'CROSS_BORDER' | 'LOCAL'
  openId?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number | null; // Timestamp (ms)
  refreshTokenExpiresAt: number | null; // Timestamp (ms)
  status: "connected" | "expired" | "disconnected";
  isDefault: boolean;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY_TIKTOK_CONFIG = "tiktok_app_config";
const STORAGE_KEY_TIKTOK_SHOPS = "tiktok_shops_list";

/**
 * Lấy cấu hình TikTok App từ LocalStorage (đồng bộ tức thì cho giao diện)
 */
export function getTikTokAppConfig(): TikTokAppConfig {
  if (typeof window === "undefined") {
    return {
      appKey: "",
      appSecret: "",
      serviceId: "",
      environment: "live",
      redirectUrl: "",
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIKTOK_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Lỗi đọc cấu hình TikTok Shop từ LocalStorage:", err);
  }
  return {
    appKey: "",
    appSecret: "",
    serviceId: "",
    environment: "live",
    redirectUrl: "",
  };
}

/**
 * Lưu cấu hình TikTok App vào LocalStorage và cập nhật lên Supabase
 */
export async function setTikTokAppConfig(config: TikTokAppConfig): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_TIKTOK_CONFIG, JSON.stringify(config));
  }

  try {
    const { error } = await supabase
      .from("tiktok_app_configs")
      .upsert({
        id: 1,
        app_key: config.appKey.trim(),
        app_secret: config.appSecret.trim(),
        service_id: config.serviceId?.trim() || "",
        environment: config.environment,
        redirect_url: config.redirectUrl?.trim() || "",
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Lỗi lưu cấu hình TikTok App lên Supabase:", error);
    }
  } catch (err) {
    console.error("Không thể kết nối Supabase để lưu cấu hình TikTok:", err);
  }
}

/**
 * Tải cấu hình TikTok App mới nhất từ Supabase (nếu có)
 */
export async function fetchTikTokAppConfig(): Promise<TikTokAppConfig> {
  const localConfig = getTikTokAppConfig();
  try {
    const { data, error } = await supabase
      .from("tiktok_app_configs")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn("Không thể lấy cấu hình TikTok từ Supabase:", error);
      return localConfig;
    }

    if (data) {
      const config: TikTokAppConfig = {
        appKey: data.app_key || "",
        appSecret: data.app_secret || "",
        serviceId: data.service_id || "",
        environment: (data.environment as "live" | "sandbox") || "live",
        redirectUrl: data.redirect_url || "",
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIKTOK_CONFIG, JSON.stringify(config));
      }
      return config;
    }
  } catch (err) {
    console.warn("Lỗi fetch cấu hình TikTok từ Supabase:", err);
  }
  return localConfig;
}

/**
 * Lấy danh sách các Shop TikTok từ LocalStorage
 */
export function getTikTokShops(): TikTokShop[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIKTOK_SHOPS);
    if (!raw) return [];

    const list: TikTokShop[] = JSON.parse(raw);
    const now = Date.now();
    return list.map((shop) => {
      if (shop.accessToken && shop.tokenExpiresAt && now > shop.tokenExpiresAt) {
        return { ...shop, status: "expired" };
      }
      return shop;
    });
  } catch (err) {
    console.error("Lỗi đọc danh sách TikTok Shops:", err);
    return [];
  }
}

/**
 * Lấy danh sách tất cả các Shop TikTok từ Supabase (Đồng bộ vào LocalStorage)
 */
export async function fetchTikTokShops(): Promise<TikTokShop[]> {
  const localList = getTikTokShops();
  try {
    const { data, error } = await supabase
      .from("tiktok_shops")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Không thể lấy danh sách TikTok Shops từ Supabase:", error);
      return localList;
    }

    if (data && Array.isArray(data)) {
      const now = Date.now();
      const mappedShops: TikTokShop[] = data.map((d) => {
        const tokenExpires = d.token_expires_at ? Number(d.token_expires_at) : null;
        let st: TikTokShop["status"] = (d.status as TikTokShop["status"]) || "disconnected";
        if (d.access_token && tokenExpires && now > tokenExpires) {
          st = "expired";
        }
        return {
          id: d.id,
          shopCipher: d.shop_cipher || "",
          shopCode: d.shop_code || "",
          shopName: d.shop_name || "Gian hàng TikTok",
          region: d.region || "VN",
          sellerType: d.seller_type || "CROSS_BORDER",
          openId: d.open_id || "",
          accessToken: d.access_token || "",
          refreshToken: d.refresh_token || "",
          tokenExpiresAt: tokenExpires,
          refreshTokenExpiresAt: d.refresh_token_expires_at ? Number(d.refresh_token_expires_at) : null,
          status: st,
          isDefault: Boolean(d.is_default),
          note: d.note || "",
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      });

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIKTOK_SHOPS, JSON.stringify(mappedShops));
      }
      return mappedShops;
    }
  } catch (err) {
    console.warn("Lỗi fetch danh sách TikTok Shops từ Supabase:", err);
  }
  return localList;
}

/**
 * Lưu hoặc cập nhật thông tin Shop TikTok
 */
export async function saveTikTokShop(shopData: Partial<TikTokShop> & { shopName: string }): Promise<TikTokShop> {
  const currentShops = getTikTokShops();
  const id = shopData.id || `tiktok_shop_${Date.now()}`;
  const now = new Date().toISOString();

  let initialStatus: TikTokShop["status"] = shopData.status || "disconnected";
  if (shopData.accessToken) {
    initialStatus = "connected";
    if (shopData.tokenExpiresAt && Date.now() > shopData.tokenExpiresAt) {
      initialStatus = "expired";
    }
  }

  const isDefault = shopData.isDefault !== undefined ? shopData.isDefault : currentShops.length === 0;

  const newShop: TikTokShop = {
    id,
    shopCipher: shopData.shopCipher?.trim() || "",
    shopCode: shopData.shopCode?.trim() || "",
    shopName: shopData.shopName.trim(),
    region: shopData.region || "VN",
    sellerType: shopData.sellerType || "CROSS_BORDER",
    openId: shopData.openId || "",
    accessToken: shopData.accessToken?.trim() || "",
    refreshToken: shopData.refreshToken?.trim() || "",
    tokenExpiresAt: shopData.tokenExpiresAt || null,
    refreshTokenExpiresAt: shopData.refreshTokenExpiresAt || null,
    status: initialStatus,
    isDefault,
    note: shopData.note || "",
    createdAt: shopData.createdAt || now,
    updatedAt: now,
  };

  let updatedList: TikTokShop[];
  const existingIndex = currentShops.findIndex((s) => s.id === id);

  if (existingIndex >= 0) {
    updatedList = [...currentShops];
    updatedList[existingIndex] = { ...currentShops[existingIndex], ...newShop };
  } else {
    updatedList = [...currentShops, newShop];
  }

  if (newShop.isDefault) {
    updatedList = updatedList.map((s) => ({
      ...s,
      isDefault: s.id === id,
    }));
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_TIKTOK_SHOPS, JSON.stringify(updatedList));
  }

  try {
    await supabase.from("tiktok_shops").upsert({
      id: newShop.id,
      shop_cipher: newShop.shopCipher,
      shop_code: newShop.shopCode,
      shop_name: newShop.shopName,
      region: newShop.region,
      seller_type: newShop.sellerType,
      open_id: newShop.openId,
      access_token: newShop.accessToken,
      refresh_token: newShop.refreshToken,
      token_expires_at: newShop.tokenExpiresAt,
      refresh_token_expires_at: newShop.refreshTokenExpiresAt,
      status: newShop.status,
      is_default: newShop.isDefault,
      note: newShop.note,
      updated_at: now,
    });
  } catch (err) {
    console.error("Lỗi sync shop TikTok lên Supabase:", err);
  }

  return newShop;
}

/**
 * Xóa một gian hàng TikTok
 */
export async function deleteTikTokShop(id: string): Promise<void> {
  const currentShops = getTikTokShops();
  const filtered = currentShops.filter((s) => s.id !== id);

  if (filtered.length > 0 && !filtered.some((s) => s.isDefault)) {
    filtered[0].isDefault = true;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_TIKTOK_SHOPS, JSON.stringify(filtered));
  }

  try {
    await supabase.from("tiktok_shops").delete().eq("id", id);
  } catch (err) {
    console.error("Lỗi xóa shop TikTok từ Supabase:", err);
  }
}

/**
 * Đặt shop TikTok làm gian hàng chính
 */
export async function setDefaultTikTokShop(id: string): Promise<void> {
  const currentShops = getTikTokShops();
  const updated = currentShops.map((s) => ({
    ...s,
    isDefault: s.id === id,
  }));

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_TIKTOK_SHOPS, JSON.stringify(updated));
  }

  try {
    for (const shop of updated) {
      await supabase
        .from("tiktok_shops")
        .update({ is_default: shop.isDefault, updated_at: new Date().toISOString() })
        .eq("id", shop.id);
    }
  } catch (err) {
    console.error("Lỗi cập nhật default shop TikTok trên Supabase:", err);
  }
}

/**
 * Lấy Base URL của TikTok Shop Open API theo môi trường
 */
export function getTikTokBaseUrl(environment: "live" | "sandbox" = "live"): string {
  return environment === "sandbox"
    ? "https://open-api-sandbox.tiktokglobalshop.com"
    : "https://open-api.tiktokglobalshop.com";
}

/**
 * Tạo liên kết xác thực ủy quyền TikTok Shop (OAuth 2.0)
 * Dành cho TikTok Shop Partner / Custom App (Ứng dụng nội bộ)
 */
export function generateTikTokAuthUrl(customConfig?: TikTokAppConfig): string {
  const config = customConfig || getTikTokAppConfig();
  const appKey = config.appKey.trim();
  const serviceId = config.serviceId.trim();

  if (!appKey && !serviceId) {
    throw new Error("Vui lòng cấu hình Khóa ứng dụng (App Key) hoặc Service ID trước khi tạo liên kết ủy quyền.");
  }

  const redirectUrl =
    config.redirectUrl.trim() ||
    (typeof window !== "undefined" ? window.location.origin + "/tiktok-auth-callback" : "");

  const state = `tiktok_auth_${Date.now()}`;

  // Nếu có serviceId dùng link TikTok Shop Partner Services
  if (serviceId) {
    return `https://services.tiktokshop.com/open/authorize?service_id=${serviceId}&state=${state}`;
  }

  // Dùng link xác thực TikTok Shop App Key
  return `https://auth.tiktok-shops.com/oauth/authorize?app_key=${appKey}&state=${state}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
}

/**
 * Đổi mã ủy quyền (auth_code) lấy Access Token & Refresh Token của TikTok Shop
 */
export async function exchangeTikTokAuthCode(
  authCode: string,
  customShopName?: string
): Promise<TikTokShop> {
  const config = getTikTokAppConfig();
  if (!config.appKey || !config.appSecret) {
    throw new Error("Chưa cấu hình Khóa ứng dụng (App Key) và Khóa bí mật (App Secret) trong Cài đặt.");
  }

  // Gọi qua API Proxy Serverless
  const proxyRes = await fetch("/api/tiktok/proxy?action=exchange_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_code: authCode,
      appKey: config.appKey,
      appSecret: config.appSecret,
      shopName: customShopName,
    }),
  });

  const resText = await proxyRes.text();
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    throw new Error("Phản hồi không hợp lệ từ máy chủ TikTok Shop Proxy.");
  }

  if (!proxyRes.ok || data.error) {
    throw new Error(data.error || data.message || "Không thể đổi mã ủy quyền TikTok Shop.");
  }

  const shopRecord = await saveTikTokShop({
    id: data.id || `tiktok_shop_${Date.now()}`,
    shopCipher: data.shopCipher || "",
    shopCode: data.shopCode || "",
    shopName: customShopName || data.shopName || "Gian hàng TikTok",
    region: data.region || "VN",
    sellerType: data.sellerType || "CROSS_BORDER",
    openId: data.openId || "",
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    tokenExpiresAt: data.tokenExpiresAt,
    refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    status: "connected",
  });

  return shopRecord;
}

/**
 * Làm mới Access Token cho gian hàng TikTok Shop
 */
export async function refreshTikTokShopToken(shopIdOrInternalId: string): Promise<TikTokShop> {
  const shops = getTikTokShops();
  const shop = shops.find((s) => s.id === shopIdOrInternalId || s.shopCipher === shopIdOrInternalId || s.shopCode === shopIdOrInternalId);

  if (!shop) {
    throw new Error("Không tìm thấy thông tin Shop TikTok trong danh sách.");
  }
  if (!shop.refreshToken) {
    throw new Error(`Shop "${shop.shopName}" chưa có Refresh Token. Vui lòng ủy quyền lại.`);
  }

  const proxyRes = await fetch("/api/tiktok/proxy?action=refresh_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shop_cipher: shop.shopCipher,
      shop_id: shop.id,
      refresh_token: shop.refreshToken,
    }),
  });

  const text = await proxyRes.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Phản hồi không hợp lệ từ máy chủ TikTok Proxy.");
  }

  if (!proxyRes.ok || data.error) {
    throw new Error(data.error || data.message || "Lỗi làm mới token TikTok Shop.");
  }

  const updatedShop = await saveTikTokShop({
    id: shop.id,
    shopCipher: shop.shopCipher,
    shopCode: shop.shopCode,
    shopName: shop.shopName,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || shop.refreshToken,
    tokenExpiresAt: data.tokenExpiresAt,
    refreshTokenExpiresAt: data.refreshTokenExpiresAt || shop.refreshTokenExpiresAt,
    status: "connected",
  });

  return updatedShop;
}

/**
 * Kiểm tra kết nối tới Shop TikTok cụ thể
 */
export async function testTikTokShopConnection(shopIdOrInternalId: string): Promise<{
  success: boolean;
  message: string;
  detail?: any;
}> {
  const shops = getTikTokShops();
  const shop = shops.find((s) => s.id === shopIdOrInternalId || s.shopCipher === shopIdOrInternalId || s.shopCode === shopIdOrInternalId);

  if (!shop) {
    return { success: false, message: "Không tìm thấy Shop trong danh sách." };
  }
  if (!shop.accessToken) {
    return { success: false, message: "Shop chưa có Access Token. Vui lòng ủy quyền lại." };
  }

  try {
    const proxyRes = await fetch("/api/tiktok/proxy?action=test_connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shop.id,
        shop_cipher: shop.shopCipher,
        access_token: shop.accessToken,
      }),
    });

    const data = await proxyRes.json();
    if (!proxyRes.ok || data.error) {
      await saveTikTokShop({ id: shop.id, shopName: shop.shopName, status: "expired" });
      return {
        success: false,
        message: data.error || "Token hết hạn hoặc không có quyền truy cập.",
        detail: data.detail,
      };
    }

    await saveTikTokShop({ id: shop.id, shopName: shop.shopName, status: "connected" });
    return {
      success: true,
      message: `Kết nối thành công! ${data.shopName ? `Shop: ${data.shopName}` : ""}`,
      detail: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi kiểm tra kết nối: ${err.message || "Mất kết nối"}`,
    };
  }
}
