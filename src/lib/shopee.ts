/**
 * Shopee Open Platform API v2 Multi-Shop Integration Client with Supabase & LocalStorage Sync
 * Tài liệu: https://open.shopee.com/documents/v2/v2.shop.auth_partner
 */

import { supabase } from "@/lib/supabase";
import { formatColorName } from "@/lib/helpers";

export interface ShopeeAppConfig {
  partnerId: string;
  partnerKey: string;
  environment: "live" | "test";
  redirectUrl: string;
  sizeChartUrl?: string;
}

export interface ShopeeShop {
  id: string; // Unique internal ID (UUID/timestamp)
  shopId: string; // Mã gian hàng Shopee (Shopee Shop ID)
  shopName: string; // Tên gian hàng
  country: string; // Mã quốc gia (VN, SG, TH, MY...)
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number | null; // Timestamp (ms)
  status: "connected" | "expired" | "disconnected";
  isDefault: boolean; // Đánh dấu gian hàng chính
  note?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_SHOPEE_APP = "sanpham_shopee_app_config_v2";
const STORAGE_KEY_SHOPEE_SHOPS = "sanpham_shopee_shops_v2";
export const STORAGE_KEY_SHOPEE_SIZE_CHART = "sanpham_shopee_size_chart_url";

export function getCurrentRedirectUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/shopee-callback`;
  }
  return "http://localhost:5173/shopee-callback";
}

export function getCurrentWebhookUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}/api/shopee/webhook`;
  }
  return "http://localhost:5173/api/shopee/webhook";
}

export const DEFAULT_SHOPEE_APP_CONFIG: ShopeeAppConfig = {
  partnerId: "",
  partnerKey: "",
  environment: "live",
  redirectUrl: "",
  sizeChartUrl: "",
};

/**
 * Lấy cấu hình URL ảnh Bảng quy đổi kích cỡ Shopee
 */
export function getShopeeSizeChartUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_SHOPEE_SIZE_CHART) || "";
}

/**
 * Lưu URL ảnh Bảng quy đổi kích cỡ Shopee vào LocalStorage và Supabase
 */
export async function setShopeeSizeChartUrl(url: string): Promise<void> {
  const cleanUrl = url ? url.trim() : "";
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_SIZE_CHART, cleanUrl);
  }
  try {
    await supabase.from("shopee_app_configs").upsert({
      id: 1,
      size_chart_url: cleanUrl,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Lỗi lưu Size Chart URL lên Supabase:", err);
  }
}

/**
 * Lấy cấu hình Partner App Shopee (Đọc nhanh từ LocalStorage)
 */
export function getShopeeAppConfig(): ShopeeAppConfig {
  if (typeof window === "undefined") return DEFAULT_SHOPEE_APP_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_APP);
    const sizeChart = getShopeeSizeChartUrl();
    if (!raw) return { ...DEFAULT_SHOPEE_APP_CONFIG, sizeChartUrl: sizeChart };
    return { ...DEFAULT_SHOPEE_APP_CONFIG, ...JSON.parse(raw), sizeChartUrl: sizeChart || JSON.parse(raw).sizeChartUrl || "" };
  } catch (err) {
    console.error("Lỗi đọc App Config Shopee:", err);
    return DEFAULT_SHOPEE_APP_CONFIG;
  }
}

/**
 * Lấy cấu hình Partner App từ Supabase (Đồng bộ vào LocalStorage)
 */
export async function fetchShopeeAppConfig(): Promise<ShopeeAppConfig> {
  const local = getShopeeAppConfig();
  try {
    const { data, error } = await supabase
      .from("shopee_app_configs")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return local;
    }

    const sizeChart = data.size_chart_url || local.sizeChartUrl || getShopeeSizeChartUrl() || "";

    const fetched: ShopeeAppConfig = {
      partnerId: data.partner_id || "",
      partnerKey: data.partner_key || "",
      environment: (data.environment as "live" | "test") || "live",
      redirectUrl: data.redirect_url || local.redirectUrl || DEFAULT_SHOPEE_APP_CONFIG.redirectUrl,
      sizeChartUrl: sizeChart,
    };

    if (sizeChart) {
      localStorage.setItem(STORAGE_KEY_SHOPEE_SIZE_CHART, sizeChart);
    }
    localStorage.setItem(STORAGE_KEY_SHOPEE_APP, JSON.stringify(fetched));
    return fetched;
  } catch (err) {
    console.warn("Lỗi tải App Config từ Supabase:", err);
    return local;
  }
}

/**
 * Lưu cấu hình Partner App Shopee vào cả Supabase và LocalStorage
 */
export async function setShopeeAppConfig(config: Partial<ShopeeAppConfig>): Promise<ShopeeAppConfig> {
  const current = getShopeeAppConfig();
  const updated: ShopeeAppConfig = { ...current, ...config };
  
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_APP, JSON.stringify(updated));
    if (updated.sizeChartUrl !== undefined) {
      localStorage.setItem(STORAGE_KEY_SHOPEE_SIZE_CHART, updated.sizeChartUrl);
    }
  }

  try {
    await supabase.from("shopee_app_configs").upsert({
      id: 1,
      partner_id: (updated.partnerId || "").trim(),
      partner_key: (updated.partnerKey || "").trim(),
      environment: updated.environment,
      redirect_url: (updated.redirectUrl || "").trim(),
      size_chart_url: (updated.sizeChartUrl || "").trim(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Lỗi lưu App Config lên Supabase:", err);
  }

  return updated;
}

/**
 * Lấy danh sách tất cả các Shop Shopee (Đọc nhanh từ LocalStorage)
 */
export function getShopeeShops(): ShopeeShop[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_SHOPS);
    if (!raw) return [];

    const list: ShopeeShop[] = JSON.parse(raw);
    const now = Date.now();
    return list.map((shop) => {
      if (shop.accessToken && shop.tokenExpiresAt && now > shop.tokenExpiresAt) {
        return { ...shop, status: "expired" };
      }
      return shop;
    });
  } catch (err) {
    console.error("Lỗi đọc danh sách Shops Shopee:", err);
    return [];
  }
}

/**
 * Lấy danh sách tất cả các Shop Shopee từ Supabase (Đồng bộ vào LocalStorage)
 */
export async function fetchShopeeShops(): Promise<ShopeeShop[]> {
  const localList = getShopeeShops();
  try {
    const { data, error } = await supabase
      .from("shopee_shops")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      return localList;
    }

    const now = Date.now();
    const fetchedList: ShopeeShop[] = data.map((d: any) => {
      let status: "connected" | "expired" | "disconnected" = d.status || "connected";
      if (!d.access_token) {
        status = "disconnected";
      } else if (d.token_expires_at && now > Number(d.token_expires_at)) {
        status = "expired";
      }

      return {
        id: String(d.id),
        shopId: String(d.shop_id),
        shopName: d.shop_name || `Shop ${d.shop_id}`,
        country: d.country || "VN",
        accessToken: d.access_token || "",
        refreshToken: d.refresh_token || "",
        tokenExpiresAt: d.token_expires_at ? Number(d.token_expires_at) : null,
        status: status,
        isDefault: Boolean(d.is_default),
        note: d.note || "",
        createdAt: d.created_at || new Date().toISOString(),
        updatedAt: d.updated_at || new Date().toISOString(),
      };
    });

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(fetchedList));
    }

    return fetchedList;
  } catch (err) {
    console.warn("Lỗi tải danh sách Shops từ Supabase:", err);
    return localList;
  }
}

/**
 * Lưu hoặc cập nhật một Shop trong danh sách (Lưu đồng thời Supabase & LocalStorage)
 */
export async function saveShopeeShop(shopData: Partial<ShopeeShop> & { shopId: string }): Promise<ShopeeShop> {
  const list = getShopeeShops();
  const now = new Date().toISOString();
  const existingIndex = list.findIndex(
    (s) => s.id === shopData.id || s.shopId === shopData.shopId
  );

  let status: "connected" | "expired" | "disconnected" = "connected";
  if (!shopData.accessToken) {
    status = "disconnected";
  } else if (shopData.tokenExpiresAt && Date.now() > shopData.tokenExpiresAt) {
    status = "expired";
  }

  let updatedShop: ShopeeShop;

  if (existingIndex >= 0) {
    // Cập nhật shop cũ
    const existing = list[existingIndex];
    updatedShop = {
      ...existing,
      ...shopData,
      status,
      updatedAt: now,
    };
    list[existingIndex] = updatedShop;
  } else {
    // Thêm shop mới
    const isFirstShop = list.length === 0;
    updatedShop = {
      id: shopData.id || `shop_${shopData.shopId}_${Date.now()}`,
      shopId: String(shopData.shopId).trim(),
      shopName: shopData.shopName?.trim() || `Gian hàng ${shopData.shopId}`,
      country: shopData.country || "VN",
      accessToken: shopData.accessToken?.trim() || "",
      refreshToken: shopData.refreshToken?.trim() || "",
      tokenExpiresAt: shopData.tokenExpiresAt || null,
      status,
      isDefault: shopData.isDefault ?? isFirstShop,
      note: shopData.note || "",
      createdAt: now,
      updatedAt: now,
    };
    if (updatedShop.isDefault) {
      list.forEach((s) => (s.isDefault = false));
    }
    list.push(updatedShop);
  }

  // Cập nhật LocalStorage
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(list));
  }

  // Lưu Supabase
  try {
    if (updatedShop.isDefault) {
      await supabase.from("shopee_shops").update({ is_default: false }).neq("id", "none");
    }

    await supabase.from("shopee_shops").upsert({
      id: updatedShop.id,
      shop_id: updatedShop.shopId,
      shop_name: updatedShop.shopName,
      country: updatedShop.country,
      access_token: updatedShop.accessToken,
      refresh_token: updatedShop.refreshToken,
      token_expires_at: updatedShop.tokenExpiresAt,
      status: updatedShop.status,
      is_default: updatedShop.isDefault,
      note: updatedShop.note,
      updated_at: now,
    });
  } catch (err) {
    console.warn("Lỗi lưu Shop lên Supabase:", err);
  }

  return updatedShop;
}

/**
 * Xóa một Shop khỏi danh sách
 */
export async function deleteShopeeShop(id: string): Promise<ShopeeShop[]> {
  const list = getShopeeShops().filter((s) => s.id !== id && s.shopId !== id);
  if (list.length > 0 && !list.some((s) => s.isDefault)) {
    list[0].isDefault = true;
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(list));
  }

  try {
    await supabase.from("shopee_shops").delete().or(`id.eq.${id},shop_id.eq.${id}`);
  } catch (err) {
    console.warn("Lỗi xóa Shop trên Supabase:", err);
  }

  return list;
}

/**
 * Đặt một Shop làm Shop Mặc Định
 */
export async function setDefaultShopeeShop(id: string): Promise<ShopeeShop[]> {
  const list = getShopeeShops().map((s) => ({
    ...s,
    isDefault: s.id === id || s.shopId === id,
  }));

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(list));
  }

  try {
    await supabase.from("shopee_shops").update({ is_default: false }).neq("id", "none");
    await supabase.from("shopee_shops").update({ is_default: true }).or(`id.eq.${id},shop_id.eq.${id}`);
  } catch (err) {
    console.warn("Lỗi cập nhật Shop mặc định trên Supabase:", err);
  }

  return list;
}

/**
 * Lấy Shop Mặc Định hiện tại
 */
export function getDefaultShopeeShop(): ShopeeShop | null {
  const list = getShopeeShops();
  if (list.length === 0) return null;
  return list.find((s) => s.isDefault) || list[0];
}

/**
 * Lấy Base URL của Shopee Open API theo môi trường
 */
export function getShopeeBaseUrl(environment: "live" | "test" = "live"): string {
  return environment === "test"
    ? "https://partner.test-stable.shopeemobile.com"
    : "https://partner.shopeemobile.com";
}

/**
 * Tính mã băm HMAC-SHA256 bằng Web Crypto API tiêu chuẩn
 */
export async function calculateHmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sinh chữ ký API Signature chuẩn của Shopee Open API v2
 */
export async function generateShopeeSignature(
  partnerId: string,
  partnerKey: string,
  apiPath: string,
  timestamp: number,
  accessToken: string = "",
  shopId: string = ""
): Promise<string> {
  let baseString = `${partnerId}${apiPath}${timestamp}`;
  if (accessToken) {
    baseString += accessToken;
  }
  if (shopId) {
    baseString += shopId;
  }
  return await calculateHmacSha256(partnerKey, baseString);
}

/**
 * Sinh đường link ủy quyền Shop (Shopee Shop Authorization URL)
 */
export async function generateShopeeAuthUrl(customRedirect?: string): Promise<string> {
  const appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    throw new Error("Vui lòng cấu hình Partner ID và Partner Key trước khi tạo link ủy quyền.");
  }

  const partnerId = appConfig.partnerId.trim();
  const partnerKey = appConfig.partnerKey.trim();
  const apiPath = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const redirectUrl = (customRedirect || appConfig.redirectUrl || getCurrentRedirectUrl()).trim();

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(appConfig.environment);

  return `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;
}

/**
 * Đổi Mã ủy quyền (Auth Code) lấy Token và thêm/cập nhật Shop vào danh sách
 */
/**
 * Đổi Mã ủy quyền (Auth Code) lấy Token và thêm/cập nhật Shop vào danh sách
 */
export async function exchangeShopeeAuthCode(
  code: string,
  shopId: string,
  customShopName?: string
): Promise<ShopeeShop> {
  // 1. Thử gọi qua Serverless API Proxy (Không bị chặn CORS, tự động đọc Key từ Supabase)
  try {
    const proxyRes = await fetch("/api/shopee/proxy?action=exchange_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        shop_id: shopId.trim(),
        shopName: customShopName,
      }),
    });

    if (proxyRes.ok) {
      const text = await proxyRes.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data?.shop) {
            const saved = await saveShopeeShop(data.shop);
            return saved;
          }
        } catch {
          // ignore non-json
        }
      }
    }
  } catch (proxyErr: any) {
    console.warn("Proxy exchange failed, falling back to direct:", proxyErr);
  }

  // 2. Fallback trực tiếp nếu không qua proxy
  let appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    appConfig = await fetchShopeeAppConfig();
  }
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    throw new Error("Chưa cấu hình Partner ID và Partner Key trong Cài đặt.");
  }

  const partnerId = appConfig.partnerId.trim();
  const partnerKey = appConfig.partnerKey.trim();
  const apiPath = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(appConfig.environment);
  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: code.trim(),
      partner_id: Number(partnerId),
      shop_id: Number(shopId),
    }),
  });

  const resText = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    throw new Error("Phản hồi không hợp lệ từ máy chủ Shopee");
  }

  if (data.error) {
    throw new Error(data.message || `Lỗi từ Shopee: ${data.error}`);
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expireIn = data.expire_in || 14400;
  const tokenExpiresAt = Date.now() + expireIn * 1000;

  let shopName = customShopName || `Shop ${shopId}`;
  let country = "VN";

  try {
    const shopInfoPath = "/api/v2/shop/get_shop_info";
    const shopInfoSign = await generateShopeeSignature(partnerId, partnerKey, shopInfoPath, timestamp, accessToken, String(shopId));
    const shopInfoUrl = `${host}${shopInfoPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${shopInfoSign}`;
    const infoRes = await fetch(shopInfoUrl);
    const infoText = await infoRes.text();
    if (infoText) {
      try {
        const infoData = JSON.parse(infoText);
        if (infoData.shop_name) shopName = infoData.shop_name;
        if (infoData.country) country = infoData.country;
      } catch {
        // ignore
      }
    }
  } catch (infoErr) {
    console.warn("Không thể lấy thông tin tên shop chi tiết:", infoErr);
  }

  const savedShop = await saveShopeeShop({
    shopId: String(shopId),
    shopName,
    country,
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });

  return savedShop;
}

/**
 * Làm mới Access Token cho một Shop cụ thể
 */
export async function refreshShopeeShopToken(shopIdOrInternalId: string): Promise<ShopeeShop> {
  const shops = getShopeeShops();
  const shop = shops.find((s) => s.id === shopIdOrInternalId || s.shopId === shopIdOrInternalId);

  if (!shop) {
    throw new Error("Không tìm thấy thông tin Shop trong danh sách.");
  }
  if (!shop.refreshToken) {
    throw new Error(`Shop "${shop.shopName}" chưa có Refresh Token. Vui lòng ủy quyền lại.`);
  }

  // 1. Thử gọi qua Serverless API Proxy
  try {
    const proxyRes = await fetch("/api/shopee/proxy?action=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shop.shopId,
        refresh_token: shop.refreshToken,
      }),
    });

    const text = await proxyRes.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (proxyRes.ok && data && data.success) {
          const updatedShop = await saveShopeeShop({
            id: shop.id,
            shopId: shop.shopId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tokenExpiresAt: data.tokenExpiresAt,
            status: "connected",
          });
          return updatedShop;
        }
        if (data.error) {
          throw new Error(data.error + (data.detail?.message ? ` (${data.detail.message})` : ""));
        }
      } catch (parseErr: any) {
        if (parseErr.message && !parseErr.message.includes("JSON")) {
          throw parseErr;
        }
      }
    }
  } catch (proxyErr: any) {
    if (proxyErr?.message && !proxyErr.message.includes("Failed to fetch")) {
      throw proxyErr;
    }
    console.warn("Proxy refresh failed, falling back to direct:", proxyErr);
  }

  // 2. Direct Fallback
  let appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    appConfig = await fetchShopeeAppConfig();
  }

  const partnerId = appConfig.partnerId.trim();
  const partnerKey = appConfig.partnerKey.trim();
  const apiPath = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(appConfig.environment);
  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: shop.refreshToken.trim(),
      partner_id: Number(partnerId),
      shop_id: Number(shop.shopId),
    }),
  });

  const resText = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    throw new Error("Phản hồi không hợp lệ từ máy chủ Shopee");
  }

  if (data.error) {
    throw new Error(data.message || `Lỗi làm mới token: ${data.error}`);
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expireIn = data.expire_in || 14400;
  const tokenExpiresAt = Date.now() + expireIn * 1000;

  const updatedShop = await saveShopeeShop({
    id: shop.id,
    shopId: shop.shopId,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    status: "connected",
  });

  return updatedShop;
}

/**
 * Tự động làm mới tất cả các token Shopee sắp hết hạn (hoặc gọi qua proxy cronjob)
 */
export async function refreshAllShopeeTokens(force: boolean = false): Promise<{
  total: number;
  refreshed: number;
  results: any[];
}> {
  try {
    const res = await fetch("/api/shopee/proxy?action=cron_refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    if (res.ok) {
      const data = await res.json();
      // Đồng bộ lại local shops
      await fetchShopeeShops();
      return data;
    }
  } catch (err) {
    console.warn("Proxy cron_refresh error, falling back to direct shop iteration:", err);
  }

  // Fallback nếu chạy local không qua serverless
  const shops = getShopeeShops();
  const results: any[] = [];
  let refreshed = 0;
  const now = Date.now();
  const threshold = 2.5 * 60 * 60 * 1000;

  for (const shop of shops) {
    if (!shop.refreshToken) continue;
    const isExpiring = !shop.tokenExpiresAt || shop.tokenExpiresAt - now < threshold || force;
    if (isExpiring) {
      try {
        await refreshShopeeShopToken(shop.id);
        refreshed++;
        results.push({ shopId: shop.shopId, status: "success" });
      } catch (err: any) {
        results.push({ shopId: shop.shopId, status: "error", error: err.message });
      }
    }
  }

  return { total: shops.length, refreshed, results };
}

/**
 * Kiểm tra kết nối tới một Shop cụ thể và cập nhật trạng thái
 */
export async function testShopeeShopConnection(shopIdOrInternalId: string): Promise<{
  success: boolean;
  message: string;
  shop?: ShopeeShop;
}> {
  const shops = getShopeeShops();
  const shop = shops.find((s) => s.id === shopIdOrInternalId || s.shopId === shopIdOrInternalId);

  if (!shop) {
    return { success: false, message: "Không tìm thấy Shop trong danh sách." };
  }

  if (!shop.accessToken) {
    return { success: false, message: `Shop "${shop.shopName}" chưa có Access Token. Hãy ủy quyền gian hàng để lấy token.` };
  }

  // 1. Thử gọi qua Serverless API Proxy
  try {
    const proxyRes = await fetch("/api/shopee/proxy?action=test_connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shop.shopId,
        access_token: shop.accessToken,
      }),
    });

    if (proxyRes.ok) {
      const text = await proxyRes.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data && data.success) {
            const updated = await saveShopeeShop({
              id: shop.id,
              shopId: shop.shopId,
              shopName: data.shopName || shop.shopName,
              country: data.country || shop.country || "VN",
              status: "connected",
            });
            return {
              success: true,
              message: `Kết nối thành công tới gian hàng: "${updated.shopName}" (${updated.country})!`,
              shop: updated,
            };
          }
        } catch {
          // ignore non-json
        }
      }
    }
  } catch (proxyErr) {
    console.warn("Proxy test failed, falling back to direct:", proxyErr);
  }

  // 2. Direct Fallback
  let appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    appConfig = await fetchShopeeAppConfig();
  }

  try {
    const partnerId = appConfig.partnerId.trim();
    const partnerKey = appConfig.partnerKey.trim();
    const accessToken = shop.accessToken.trim();
    const shopId = shop.shopId.trim();
    const apiPath = "/api/v2/shop/get_shop_info";
    const timestamp = Math.floor(Date.now() / 1000);

    const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
    const host = getShopeeBaseUrl(appConfig.environment);
    const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();

    if (data.error) {
      return {
        success: false,
        message: `Shopee phản hồi lỗi: ${data.message || data.error}`,
      };
    }

    const shopName = data.shop_name || shop.shopName;
    const country = data.country || shop.country || "VN";

    const updated = await saveShopeeShop({
      id: shop.id,
      shopId: shop.shopId,
      shopName,
      country,
      status: "connected",
    });

    return {
      success: true,
      message: `Kết nối thành công tới gian hàng: "${shopName}" (${country})!`,
      shop: updated,
    };
  } catch (err) {
    return {
      success: false,
      message: `Không thể kết nối tới Shopee API: ${(err as Error).message}`,
    };
  }
}

export interface ShopeeLogisticsChannel {
  channelId: number;
  channelName: string;
  enabled: boolean;
  codEnabled: boolean;
  forceEnable: boolean;
  feeType?: string;
  maxWeight: number;
  minWeight: number;
  maxDimension: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  maskChannelId?: number;
}

export interface ShopeeDefaultLogisticsConfig {
  defaultWeightKg: number; // vd: 0.2 kg (200g)
  defaultLengthCm: number; // vd: 25 cm
  defaultWidthCm: number;  // vd: 20 cm
  defaultHeightCm: number; // vd: 3 cm
  daysToShip: number;      // 2 ngày
  isPreOrder: boolean;     // Hàng đặt trước
  selectedChannelIds: number[]; // ID các kênh bật mặc định
  coverShippingFeeChannelIds: number[]; // ID các kênh người bán chịu phí ship
}

export const DEFAULT_LOGISTICS_CONFIG: ShopeeDefaultLogisticsConfig = {
  defaultWeightKg: 0.2,
  defaultLengthCm: 25,
  defaultWidthCm: 20,
  defaultHeightCm: 3,
  daysToShip: 2,
  isPreOrder: false,
  selectedChannelIds: [],
  coverShippingFeeChannelIds: [],
};

const STORAGE_KEY_SHOPEE_LOGISTICS = "sanpham_shopee_default_logistics_v1";

/**
 * Kéo danh sách kênh vận chuyển thực tế từ Shopee Open API (Chỉ lấy dữ liệu thật 100% từ gian hàng Shopee)
 */
export async function fetchShopeeLogisticsChannels(shopId?: string): Promise<{
  channels: ShopeeLogisticsChannel[];
  shopId: string;
}> {
  let proxyErrorMsg = "";

  // 1. Thử gọi qua Serverless API Proxy (/api/shopee/proxy?action=get_logistics)
  try {
    const proxyRes = await fetch("/api/shopee/proxy?action=get_logistics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId }),
    });

    const text = await proxyRes.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (proxyRes.ok && data && Array.isArray(data.channels) && data.channels.length > 0) {
          return {
            channels: data.channels,
            shopId: data.shopId || shopId || "",
          };
        }
        if (data && data.error) {
          proxyErrorMsg = data.error;
        }
      } catch {
        // Non-JSON response
      }
    }
  } catch (proxyErr: any) {
    console.warn("Proxy get_logistics không khả dụng, chuyển sang gọi trực tiếp Shopee API:", proxyErr);
    proxyErrorMsg = proxyErr?.message || "";
  }

  // 2. Fallback: Gọi trực tiếp Shopee Open API từ trình duyệt nếu proxy không khả dụng
  let appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    appConfig = await fetchShopeeAppConfig();
  }

  const shops = getShopeeShops();
  const targetShop = shopId
    ? shops.find((s) => s.shopId === shopId || s.id === shopId)
    : shops.find((s) => s.isDefault) || shops[0];

  if (!targetShop) {
    throw new Error("Chưa có gian hàng Shopee nào được kết nối. Vui lòng ủy quyền gian hàng trước khi kéo kênh vận chuyển.");
  }

  if (!targetShop.accessToken) {
    throw new Error(`Gian hàng "${targetShop.shopName}" chưa có Access Token hoặc Token đã hết hạn. Vui lòng làm mới token hoặc ủy quyền lại.`);
  }

  if (!appConfig.partnerId || !appConfig.partnerKey) {
    throw new Error("Chưa cấu hình Partner ID và Partner Key trên hệ thống.");
  }

  const partnerId = appConfig.partnerId.trim();
  const partnerKey = appConfig.partnerKey.trim();
  const actualShopId = targetShop.shopId.trim();
  const accessToken = targetShop.accessToken.trim();
  const apiPath = "/api/v2/logistics/get_channel_list";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, actualShopId);
  const host = getShopeeBaseUrl(appConfig.environment);
  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${actualShopId}&sign=${sign}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(proxyErrorMsg || "Không thể đọc phản hồi từ máy chủ Shopee");
  }

  if (data.error || data.message) {
    throw new Error(data.message || `Lỗi Shopee API: ${data.error}`);
  }

  if (data.response?.logistics_channel_list && Array.isArray(data.response.logistics_channel_list)) {
    const channels: ShopeeLogisticsChannel[] = data.response.logistics_channel_list.map((ch: any) => ({
      channelId: ch.logistics_channel_id,
      channelName: ch.logistics_channel_name,
      enabled: Boolean(ch.enabled),
      codEnabled: Boolean(ch.cod_enabled),
      forceEnable: Boolean(ch.force_enable),
      feeType: ch.fee_type,
      maxWeight: ch.weight_limit?.item_max_weight || 0,
      minWeight: ch.weight_limit?.item_min_weight || 0,
      maxDimension: {
        length: ch.item_max_dimension?.length || 0,
        width: ch.item_max_dimension?.width || 0,
        height: ch.item_max_dimension?.height || 0,
        unit: ch.item_max_dimension?.unit || "cm",
      },
      maskChannelId: ch.mask_channel_id,
    }));

    return {
      channels,
      shopId: actualShopId,
    };
  }

  throw new Error(proxyErrorMsg || "Không tìm thấy danh sách kênh vận chuyển nào từ Shopee.");
}

/**
 * Đọc cấu hình vận chuyển mặc định (Đọc nhanh từ LocalStorage)
 */
export function getShopeeDefaultLogisticsConfig(): ShopeeDefaultLogisticsConfig {
  if (typeof window === "undefined") return DEFAULT_LOGISTICS_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_LOGISTICS);
    if (!raw) return DEFAULT_LOGISTICS_CONFIG;
    return { ...DEFAULT_LOGISTICS_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LOGISTICS_CONFIG;
  }
}

/**
 * Lấy cấu hình vận chuyển mặc định từ Supabase
 */
export async function fetchShopeeDefaultLogisticsConfig(): Promise<ShopeeDefaultLogisticsConfig> {
  const local = getShopeeDefaultLogisticsConfig();
  try {
    const { data } = await supabase
      .from("shopee_app_configs")
      .select("logistics_config")
      .eq("id", 1)
      .maybeSingle();

    if (data?.logistics_config) {
      const fetched = { ...DEFAULT_LOGISTICS_CONFIG, ...data.logistics_config };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_SHOPEE_LOGISTICS, JSON.stringify(fetched));
      }
      return fetched;
    }
    return local;
  } catch (err) {
    console.warn("Lỗi tải logistics config từ Supabase:", err);
    return local;
  }
}

/**
 * Lưu cấu hình vận chuyển mặc định vào Supabase và LocalStorage
 */
export async function saveShopeeDefaultLogisticsConfig(
  config: Partial<ShopeeDefaultLogisticsConfig>
): Promise<ShopeeDefaultLogisticsConfig> {
  const current = getShopeeDefaultLogisticsConfig();
  const updated: ShopeeDefaultLogisticsConfig = { ...current, ...config };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_LOGISTICS, JSON.stringify(updated));
  }

  try {
    await supabase.from("shopee_app_configs").update({
      logistics_config: updated,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
  } catch (err) {
    console.warn("Lỗi lưu logistics config vào Supabase:", err);
  }

  return updated;
}

/* ==========================================================================
   SHOPEE PRODUCT CATEGORIES & ATTRIBUTES PRESETS
   ========================================================================== */

export interface ShopeeCategory {
  categoryId: number;
  parentCategoryId: number;
  originalCategoryName: string;
  displayCategoryName: string;
  hasChildren: boolean;
}

export interface ShopeeCategoryAttributeValue {
  valueId: number;
  originalValueName: string;
  displayValueName: string;
  valueUnit?: string;
}

export interface ShopeeCategoryAttribute {
  attributeId: number;
  originalAttributeName: string;
  displayAttributeName: string;
  isMandatory: boolean;
  inputType: string; // "DROP_DOWN" | "MULTIPLE_SELECT" | "TEXT_FILED" | "COMBO_BOX"
  attributeType?: string;
  attributeUnit?: string[];
  attributeValueList?: ShopeeCategoryAttributeValue[];
}

export interface ShopeePresetCategory {
  id: string; // ID duy nhất nội bộ (UUID / timestamp)
  name: string; // Tên cấu hình gợi nhớ (vd: "Áo Thun Nam Cao Cấp", "Áo Thun Nữ Cotton")
  categoryId: number; // ID danh mục lá Shopee (Leaf Category ID)
  categoryNamePath: string; // Đường dẫn danh mục (vd: "Thời Trang Nam > Áo > Áo Thun")
  isDefault: boolean; // Đặt làm cấu hình danh mục mặc định
  attributes: Record<string, any>; // Giá trị thuộc tính mặc định: { [attributeId]: value } hoặc { [attrName]: value }
  note?: string; // Ghi chú thêm
  createdAt: string;
  updatedAt: string;
}

export const SHOPEE_STANDARD_FASHION_ATTRIBUTES: {
  key: string;
  label: string;
  options: string[];
  defaultValue: string;
}[] = [
  {
    key: "Thương hiệu",
    label: "Thương hiệu",
    defaultValue: "No brand",
    options: ["No brand", "OEM", "Khác"],
  },
  {
    key: "Xuất xứ",
    label: "Xuất xứ",
    defaultValue: "Việt Nam",
    options: ["Việt Nam", "Trong nước", "Nhập khẩu", "Trung Quốc", "Hàn Quốc", "Thái Lan", "Khác"],
  },
  {
    key: "Chất liệu",
    label: "Chất liệu",
    defaultValue: "Cotton",
    options: ["Cotton", "Thun cotton", "Cotton 100%", "Cotton Compact 2C", "Polyester", "Spandex", "Nỉ", "Lụa", "Khác"],
  },
  {
    key: "Cropped Top",
    label: "Cropped Top",
    defaultValue: "Không",
    options: ["Không", "Có"],
  },
  {
    key: "Cổ áo",
    label: "Cổ áo",
    defaultValue: "Cổ tròn",
    options: ["Cổ tròn", "Cổ V", "Cổ bẻ", "Cổ polo", "Cổ tim", "Cổ lọ", "Cổ thuyền", "Khác"],
  },
  {
    key: "Dịp",
    label: "Dịp",
    defaultValue: "Hàng ngày",
    options: ["Hàng ngày", "Thường ngày", "Dạo phố", "Đi chơi", "Thể thao", "Công sở", "Tiệc tùng", "Khác"],
  },
  {
    key: "Petite",
    label: "Petite",
    defaultValue: "Không",
    options: ["Không", "Có"],
  },
  {
    key: "Mẫu",
    label: "Mẫu",
    defaultValue: "In hình",
    options: ["In hình", "Trơn", "Chữ", "Họa tiết", "Sọc / Kẻ", "Graphic", "Khác"],
  },
  {
    key: "Mùa",
    label: "Mùa",
    defaultValue: "Bốn mùa",
    options: ["Bốn mùa", "Mùa hè", "Mùa thu", "Mùa đông", "Mùa xuân"],
  },
  {
    key: "Chiều dài tay áo",
    label: "Chiều dài tay áo",
    defaultValue: "Tay ngắn",
    options: ["Tay ngắn", "Tay lỡ", "Tay dài", "Không tay", "Tay lửng", "Khác"],
  },
  {
    key: "Phong cách",
    label: "Phong cách",
    defaultValue: "Đường phố",
    options: ["Đường phố", "Cơ bản", "Hàn Quốc", "Tối giản", "Unisex", "Cổ điển", "Thể thao", "Retro", "Khác"],
  },
  {
    key: "Chiều dài áo",
    label: "Chiều dài áo",
    defaultValue: "Tiêu chuẩn",
    options: ["Tiêu chuẩn", "Dài vừa", "Dáng dài", "Dáng ngắn", "Oversize", "Khác"],
  },
];

export function getDefaultFashionAttributes(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of SHOPEE_STANDARD_FASHION_ATTRIBUTES) {
    result[item.key] = item.defaultValue;
  }
  return result;
}

const STORAGE_KEY_SHOPEE_CATEGORIES_PRESETS = "sanpham_shopee_preset_categories_v1";

/**
 * Đọc danh sách cấu hình danh mục lưu sẵn (Đọc nhanh từ LocalStorage)
 */
export function getShopeePresetCategories(): ShopeePresetCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_CATEGORIES_PRESETS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Lỗi đọc danh sách preset categories từ LocalStorage:", err);
    return [];
  }
}

/**
 * Lấy danh sách cấu hình danh mục lưu sẵn từ Supabase
 */
export async function fetchShopeePresetCategories(): Promise<ShopeePresetCategory[]> {
  const local = getShopeePresetCategories();
  try {
    const { data } = await supabase
      .from("shopee_app_configs")
      .select("categories_config")
      .eq("id", 1)
      .maybeSingle();

    if (data?.categories_config && Array.isArray(data.categories_config)) {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_SHOPEE_CATEGORIES_PRESETS, JSON.stringify(data.categories_config));
      }
      return data.categories_config;
    }
    return local;
  } catch (err) {
    console.warn("Lỗi tải preset categories từ Supabase:", err);
    return local;
  }
}

/**
 * Lưu hoặc cập nhật một cấu hình danh mục lưu sẵn
 */
export async function saveShopeePresetCategory(
  preset: Partial<ShopeePresetCategory>
): Promise<ShopeePresetCategory> {
  const currentList = getShopeePresetCategories();
  const now = new Date().toISOString();

  const id = preset.id || `cat_preset_${Date.now()}`;
  const isDefault = Boolean(preset.isDefault);

  const updatedItem: ShopeePresetCategory = {
    id,
    name: preset.name?.trim() || "Cấu hình danh mục",
    categoryId: Number(preset.categoryId) || 0,
    categoryNamePath: preset.categoryNamePath || "",
    isDefault: isDefault || (currentList.length === 0),
    attributes: preset.attributes || {},
    note: preset.note || "",
    createdAt: preset.createdAt || now,
    updatedAt: now,
  };

  let newList: ShopeePresetCategory[] = [];
  const existingIdx = currentList.findIndex((p) => p.id === id);

  if (existingIdx >= 0) {
    newList = currentList.map((p) => (p.id === id ? updatedItem : p));
  } else {
    newList = [updatedItem, ...currentList];
  }

  if (updatedItem.isDefault) {
    newList = newList.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_CATEGORIES_PRESETS, JSON.stringify(newList));
  }

  try {
    await supabase.from("shopee_app_configs").upsert({
      id: 1,
      categories_config: newList,
      updated_at: now,
    });
  } catch (err) {
    console.warn("Lỗi lưu preset categories lên Supabase:", err);
  }

  return updatedItem;
}

/**
 * Xóa một cấu hình danh mục lưu sẵn
 */
export async function deleteShopeePresetCategory(id: string): Promise<ShopeePresetCategory[]> {
  const currentList = getShopeePresetCategories();
  let newList = currentList.filter((p) => p.id !== id);

  if (newList.length > 0 && !newList.some((p) => p.isDefault)) {
    newList[0].isDefault = true;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_CATEGORIES_PRESETS, JSON.stringify(newList));
  }

  try {
    await supabase.from("shopee_app_configs").upsert({
      id: 1,
      categories_config: newList,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Lỗi xóa preset category trên Supabase:", err);
  }

  return newList;
}

/**
 * Đặt một cấu hình danh mục làm Mặc Định
 */
export async function setDefaultShopeePresetCategory(id: string): Promise<ShopeePresetCategory[]> {
  const currentList = getShopeePresetCategories();
  const newList = currentList.map((p) => ({
    ...p,
    isDefault: p.id === id,
  }));

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SHOPEE_CATEGORIES_PRESETS, JSON.stringify(newList));
  }

  try {
    await supabase.from("shopee_app_configs").upsert({
      id: 1,
      categories_config: newList,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Lỗi cập nhật default preset category trên Supabase:", err);
  }

  return newList;
}

/**
 * Lấy cấu hình danh mục mặc định hiện tại
 */
export function getDefaultShopeePresetCategory(): ShopeePresetCategory | null {
  const list = getShopeePresetCategories();
  if (list.length === 0) return null;
  return list.find((p) => p.isDefault) || list[0];
}

/**
 * Kéo danh sách danh mục thực tế từ Shopee Open API (Chỉ lấy dữ liệu thật từ Shopee)
 */
export async function fetchShopeeCategories(shopId?: string, language: string = "vi"): Promise<{
  categories: ShopeeCategory[];
  shopId: string;
}> {
  let proxyErrorMsg = "";

  // 1. Thử gọi qua Serverless API Proxy
  try {
    const proxyRes = await fetch(`/api/shopee/proxy?action=get_categories&language=${language}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, language }),
    });

    const text = await proxyRes.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (proxyRes.ok && data && Array.isArray(data.categories) && data.categories.length > 0) {
          return {
            categories: data.categories,
            shopId: data.shopId || shopId || "",
          };
        }
        if (data && data.error) {
          proxyErrorMsg = data.error;
        }
      } catch {
        // non-json
      }
    }
  } catch (proxyErr: any) {
    console.warn("Proxy get_categories không khả dụng, chuyển sang gọi trực tiếp Shopee API:", proxyErr);
    proxyErrorMsg = proxyErr?.message || "";
  }

  // 2. Direct Fallback
  let appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    appConfig = await fetchShopeeAppConfig();
  }

  const shops = getShopeeShops();
  const targetShop = shopId
    ? shops.find((s) => s.shopId === shopId || s.id === shopId)
    : shops.find((s) => s.isDefault) || shops[0];

  if (!targetShop) {
    throw new Error("Chưa có gian hàng Shopee nào được kết nối. Vui lòng ủy quyền gian hàng trước khi kéo danh mục.");
  }

  if (!targetShop.accessToken) {
    throw new Error(`Gian hàng "${targetShop.shopName}" chưa có Access Token hoặc Token đã hết hạn. Vui lòng ủy quyền lại.`);
  }

  if (!appConfig.partnerId || !appConfig.partnerKey) {
    throw new Error("Chưa cấu hình Partner ID và Partner Key trên hệ thống.");
  }

  const partnerId = appConfig.partnerId.trim();
  const partnerKey = appConfig.partnerKey.trim();
  const actualShopId = targetShop.shopId.trim();
  const accessToken = targetShop.accessToken.trim();
  const apiPath = "/api/v2/product/get_category";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, actualShopId);
  const host = getShopeeBaseUrl(appConfig.environment);
  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${actualShopId}&sign=${sign}&language=${language}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(proxyErrorMsg || "Không thể đọc phản hồi từ máy chủ Shopee");
  }

  if (data.error || data.message) {
    throw new Error(data.message || `Lỗi Shopee API: ${data.error}`);
  }

  if (data.response?.category_list && Array.isArray(data.response.category_list)) {
    const categories: ShopeeCategory[] = data.response.category_list.map((cat: any) => ({
      categoryId: cat.category_id,
      parentCategoryId: cat.parent_category_id,
      originalCategoryName: cat.original_category_name,
      displayCategoryName: cat.display_category_name || cat.original_category_name,
      hasChildren: Boolean(cat.has_children),
    }));

    return {
      categories,
      shopId: actualShopId,
    };
  }

  throw new Error(proxyErrorMsg || "Không tìm thấy danh sách danh mục nào từ Shopee.");
}

/**
 * Kéo danh sách thuộc tính của một danh mục cụ thể từ Shopee Open API
 */
export async function fetchShopeeCategoryAttributes(
  categoryId: number,
  shopId?: string,
  language: string = "vi"
): Promise<{
  attributes: ShopeeCategoryAttribute[];
  categoryId: number;
  shopId: string;
}> {
  let proxyErrorMsg = "";

  // 1. Thử gọi qua Serverless API Proxy
  try {
    const proxyRes = await fetch(`/api/shopee/proxy?action=get_attributes&category_id=${categoryId}&language=${language}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, category_id: categoryId, language }),
    });

    const text = await proxyRes.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        if (proxyRes.ok && data && Array.isArray(data.attributes)) {
          return {
            attributes: data.attributes,
            categoryId,
            shopId: data.shopId || shopId || "",
          };
        }
        if (data && data.error) {
          proxyErrorMsg = data.error;
        }
      } catch {
        // non-json
      }
    }
  } catch (proxyErr: any) {
    console.warn("Proxy get_attributes không khả dụng, chuyển sang gọi trực tiếp Shopee API:", proxyErr);
    proxyErrorMsg = proxyErr?.message || "";
  }

  // 2. Direct Fallback
  let appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    appConfig = await fetchShopeeAppConfig();
  }

  const shops = getShopeeShops();
  const targetShop = shopId
    ? shops.find((s) => s.shopId === shopId || s.id === shopId)
    : shops.find((s) => s.isDefault) || shops[0];

  if (!targetShop) {
    throw new Error("Chưa có gian hàng Shopee nào được kết nối.");
  }

  if (!targetShop.accessToken) {
    throw new Error(`Gian hàng "${targetShop.shopName}" chưa có Access Token.`);
  }

  if (!appConfig.partnerId || !appConfig.partnerKey) {
    throw new Error("Chưa cấu hình Partner ID và Partner Key trên hệ thống.");
  }

  const partnerId = appConfig.partnerId.trim();
  const partnerKey = appConfig.partnerKey.trim();
  const actualShopId = targetShop.shopId.trim();
  const accessToken = targetShop.accessToken.trim();
  const apiPath = "/api/v2/product/get_attributes";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, actualShopId);
  const host = getShopeeBaseUrl(appConfig.environment);
  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${actualShopId}&sign=${sign}&category_id=${categoryId}&language=${language}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(proxyErrorMsg || "Không thể đọc phản hồi thuộc tính từ máy chủ Shopee");
  }

  if (data.error || data.message) {
    throw new Error(data.message || `Lỗi Shopee API: ${data.error}`);
  }

  if (data.response?.attribute_list && Array.isArray(data.response.attribute_list)) {
    const attributes: ShopeeCategoryAttribute[] = data.response.attribute_list.map((attr: any) => ({
      attributeId: attr.attribute_id,
      originalAttributeName: attr.original_attribute_name,
      displayAttributeName: attr.display_attribute_name || attr.original_attribute_name,
      isMandatory: Boolean(attr.is_mandatory),
      inputType: attr.input_type,
      attributeType: attr.attribute_type,
      attributeUnit: attr.attribute_unit || [],
      attributeValueList: (attr.attribute_value_list || []).map((val: any) => ({
        valueId: val.value_id,
        originalValueName: val.original_value_name,
        displayValueName: val.display_value_name || val.original_value_name,
        valueUnit: val.value_unit,
      })),
    }));

    return {
      attributes,
      categoryId,
      shopId: actualShopId,
    };
  }

  throw new Error(proxyErrorMsg || "Không tìm thấy danh sách thuộc tính nào cho danh mục này.");
}

export interface ShopeePublishedProduct {
  id: string;
  master_code: string;
  master_name: string;
  shop_id: string;
  shop_name: string;
  shopee_item_id: number | null;
  item_name: string;
  category_id: number | null;
  price: number;
  status: "draft" | "publishing" | "published" | "failed";
  shopee_url?: string;
  error_message?: string;
  payload?: any;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchShopeePublishedProducts(): Promise<ShopeePublishedProduct[]> {
  try {
    const { data, error } = await supabase
      .from("shopee_published_products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Lỗi fetch shopee_published_products từ Supabase:", error);
      return [];
    }
    return (data as ShopeePublishedProduct[]) || [];
  } catch (err) {
    console.error("Lỗi fetchShopeePublishedProducts:", err);
    return [];
  }
}

export async function saveShopeePublishedProduct(record: Partial<ShopeePublishedProduct> & { master_code: string; shop_id: string }): Promise<ShopeePublishedProduct> {
  const now = new Date().toISOString();
  const payload = {
    ...record,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("shopee_published_products")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data as ShopeePublishedProduct;
}

export async function deleteShopeePublishedProduct(id: string): Promise<void> {
  const { error } = await supabase.from("shopee_published_products").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Tự động tạo ảnh Bảng Kích Cỡ (Size Chart) chuẩn Shopee bằng Canvas.
 * Shopee AI sẽ kiểm tra xem ảnh có giống bảng đo thật hay không.
 * Hàm này tạo 1 bảng đo chuẩn áo thun với các thông số phổ biến.
 */
export function generateSizeChartImage(sizes: string[]): string {
  const activeSizes = sizes.length > 0 ? sizes : ["S", "M", "L", "XL", "2XL"];

  // Dữ liệu đo chuẩn áo thun unisex oversize (cm)
  const sizeDataMap: Record<string, { chest: string; length: string; shoulder: string; sleeve: string }> = {
    "S":    { chest: "51",  length: "69", shoulder: "46", sleeve: "21" },
    "M":    { chest: "53",  length: "71", shoulder: "48", sleeve: "22" },
    "L":    { chest: "55",  length: "73", shoulder: "50", sleeve: "23" },
    "XL":   { chest: "57",  length: "75", shoulder: "52", sleeve: "24" },
    "2XL":  { chest: "59",  length: "77", shoulder: "54", sleeve: "25" },
    "3XL":  { chest: "61",  length: "79", shoulder: "56", sleeve: "26" },
    "4XL":  { chest: "63",  length: "81", shoulder: "58", sleeve: "27" },
    "Freesize": { chest: "55", length: "73", shoulder: "50", sleeve: "23" },
    "Tiêu chuẩn": { chest: "55", length: "73", shoulder: "50", sleeve: "23" },
  };

  const headers = ["Size", "Rộng ngực (cm)", "Dài áo (cm)", "Vai (cm)", "Tay (cm)"];
  const colCount = headers.length;
  const rowCount = activeSizes.length + 1; // +1 for header

  const cellW = 160;
  const cellH = 48;
  const padX = 40;
  const padY = 80;
  const tableW = colCount * cellW;
  const tableH = rowCount * cellH;
  const canvasW = tableW + padX * 2;
  const canvasH = tableH + padY + 60;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Title
  ctx.fillStyle = "#222222";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BẢNG QUY ĐỔI KÍCH CỠ", canvasW / 2, 38);
  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#888888";
  ctx.fillText("(Sai số ±1-2 cm tùy phương pháp đo)", canvasW / 2, 60);

  // Draw table
  const startX = padX;
  const startY = padY;

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const x = startX + col * cellW;
      const y = startY + row * cellH;

      // Cell background
      if (row === 0) {
        ctx.fillStyle = "#EE4D2D"; // Shopee orange header
      } else {
        ctx.fillStyle = row % 2 === 0 ? "#FFF5F0" : "#FFFFFF";
      }
      ctx.fillRect(x, y, cellW, cellH);

      // Cell border
      ctx.strokeStyle = row === 0 ? "#D94420" : "#E0E0E0";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellW, cellH);

      // Cell text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (row === 0) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 16px Arial, sans-serif";
        ctx.fillText(headers[col], x + cellW / 2, y + cellH / 2);
      } else {
        const sizeName = activeSizes[row - 1];
        const data = sizeDataMap[sizeName] || sizeDataMap["M"] || { chest: "54", length: "72", shoulder: "49", sleeve: "22" };

        ctx.fillStyle = "#333333";
        ctx.font = col === 0 ? "bold 16px Arial, sans-serif" : "15px Arial, sans-serif";

        let value = "";
        switch (col) {
          case 0: value = sizeName; break;
          case 1: value = data.chest; break;
          case 2: value = data.length; break;
          case 3: value = data.shoulder; break;
          case 4: value = data.sleeve; break;
        }
        ctx.fillText(value, x + cellW / 2, y + cellH / 2);
      }
    }
  }

  // Footer note
  ctx.fillStyle = "#999999";
  ctx.font = "12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Đơn vị: cm | Đo áo trải phẳng", canvasW / 2, startY + tableH + 28);

  return canvas.toDataURL("image/jpeg", 0.95);
}

import { loadImageWithR2Priority, getHdImageUrl } from "@/lib/r2Storage";

/**
 * Chuyển đổi bất kỳ URL hình ảnh nào thành base64 chuẩn JPEG (RGB, nền trắng)
 * với ƯU TIÊN lấy ảnh GỐC chất lượng cao nhất (Full HD) từ Cloudflare R2.
 */
export async function convertImageUrlToJpegBase64(imageUrl: string): Promise<string> {
  return new Promise(async (resolve) => {
    try {
      // 1. Ưu tiên tải ảnh gốc HD từ Cloudflare R2 (fallback tự động về Supabase)
      const img = await loadImageWithR2Priority(imageUrl, "products/images").catch(() => {
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = "anonymous";
        fallbackImg.src = imageUrl;
        return fallbackImg;
      });

      const performConvert = (loadedImg: HTMLImageElement) => {
        try {
          const canvas = document.createElement("canvas");
          let width = loadedImg.naturalWidth || loadedImg.width || 1000;
          let height = loadedImg.naturalHeight || loadedImg.height || 1000;

          if (width > 2400 || height > 2400) {
            const ratio = Math.min(2400 / width, 2400 / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve(imageUrl);
          }

          // Vẽ nền trắng (nếu ảnh gốc PNG/WebP có nền trong suốt)
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);

          // Vẽ ảnh gốc chất lượng cao lên canvas
          ctx.drawImage(loadedImg, 0, 0, width, height);

          // Xuất ra chuẩn JPEG chất lượng cao 0.95
          const jpegBase64 = canvas.toDataURL("image/jpeg", 0.95);
          resolve(jpegBase64);
        } catch (err) {
          console.warn("Lỗi canvas convert to JPEG:", err);
          resolve(imageUrl);
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        performConvert(img);
      } else {
        img.onload = () => performConvert(img);
        img.onerror = () => resolve(imageUrl);
      }
    } catch {
      resolve(imageUrl);
    }
  });
}

/**
 * Tải 1 hình ảnh lên Shopee Media Space để nhận Image ID
 */
export async function uploadShopeeMediaImage(
  shopId: string,
  imageUrl: string,
  scene: "normal" | "size_chart" = "normal"
): Promise<{ imageId: string; imageUrlList: string[] }> {
  // Tự động chuyển đổi WebP/PNG sang JPEG chuẩn Shopee trước khi gửi
  let payloadBody: any = { shop_id: shopId, scene };
  if (imageUrl.startsWith("data:image/")) {
    payloadBody.image_base64 = imageUrl;
  } else {
    try {
      const jpegData = await convertImageUrlToJpegBase64(imageUrl);
      if (jpegData.startsWith("data:image/")) {
        payloadBody.image_base64 = jpegData;
      } else {
        payloadBody.image_url = imageUrl;
      }
    } catch {
      payloadBody.image_url = imageUrl;
    }
  }

  const res = await fetch("/api/shopee/proxy?action=upload_image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadBody),
  });

  const data = await res.json();
  if (!res.ok || data.error || !data.imageId) {
    throw new Error(data.error || "Lỗi tải ảnh lên Shopee Media Space.");
  }
  return {
    imageId: data.imageId,
    imageUrlList: data.imageUrlList || [],
  };
}

export interface ShopeeTierVariationOption {
  option: string;
  image?: { image_id: string };
}

export interface ShopeeTierVariation {
  name: string;
  option_list: ShopeeTierVariationOption[];
}

export interface ShopeeModelItem {
  tier_index: number[];
  normal_stock: number;
  original_price: number;
  model_sku: string;
}

export interface PublishShopeeProductInput {
  shopId: string;
  masterCode: string;
  masterName: string;
  itemName: string;
  description: string;
  categoryId: number;
  images: string[]; // URLs of images to upload
  existingItemId?: number; // Nếu đã có trên sàn → update thay vì tạo mới
  sizeChartImage?: string; // URL of size chart image
  colorMockupMap?: Record<string, string>; // colorName -> imageUrl
  weight: number; // kg
  dimension: {
    package_height: number;
    package_length: number;
    package_width: number;
  };
  logisticInfo: {
    logistic_id: number;
    enabled: boolean;
  }[];
  attributeList?: {
    attribute_id: number;
    attribute_value_list: { value_id: number; original_value_name?: string }[];
  }[];
  colors: string[];
  sizes: string[];
  models: {
    color: string;
    size: string;
    price: number;
    stock: number;
    sku: string;
  }[];
}

/**
 * Toàn bộ quy trình đẩy 1 sản phẩm lên Shopee (Tải ảnh -> Tạo Item -> Tạo 2-tier variations -> Lưu DB)
 */
export async function publishProductToShopeeComplete(
  input: PublishShopeeProductInput,
  onProgress?: (step: string, percent: number) => void
): Promise<{ itemId: number; shopeeUrl: string }> {
  onProgress?.("1/3 Đang tải hình ảnh và mockup phôi lên Shopee Media Space...", 20);

  // 1. Upload main images
  const uploadedImageIds: string[] = [];
  let lastUploadError = "";

  for (let i = 0; i < input.images.length; i++) {
    const url = input.images[i];
    if (!url) continue;
    try {
      const upRes = await uploadShopeeMediaImage(input.shopId, url, "normal");
      if (upRes.imageId) {
        uploadedImageIds.push(upRes.imageId);
      }
    } catch (e: any) {
      console.warn(`Lỗi upload ảnh ${i} (${url}):`, e);
      lastUploadError = e.message || String(e);
    }
  }

  if (uploadedImageIds.length === 0) {
    throw new Error(lastUploadError || "Không thể tải ảnh sản phẩm lên máy chủ Shopee Media Space.");
  }

  // Upload color images if any
  const colorImageIdMap: Record<string, string> = {};
  if (input.colorMockupMap) {
    for (const color of input.colors) {
      const formattedColor = formatColorName(color);
      const colUrl = input.colorMockupMap[color] || input.colorMockupMap[formattedColor];
      if (colUrl) {
        try {
          const colUpRes = await uploadShopeeMediaImage(input.shopId, colUrl, "normal");
          if (colUpRes.imageId) {
            colorImageIdMap[color] = colUpRes.imageId;
            colorImageIdMap[formattedColor] = colUpRes.imageId;
          }
        } catch (colErr) {
          console.warn(`Lỗi upload ảnh màu ${color} (${formattedColor}):`, colErr);
        }
      }
    }
  }

  onProgress?.("2/3 Đang tạo thông tin sản phẩm cơ sở trên Shopee...", 55);

  // Default base price
  const basePrice = input.models.length > 0 ? Math.min(...input.models.map((m) => m.price)) : 100000;

  // Tải ảnh Bảng quy đổi kích cỡ chuẩn Shopee (Ưu tiên ảnh người dùng chọn hoặc ảnh đã cấu hình trong Cài đặt)
  let sizeChartImageId = "";
  const sizeChartToUse = (input.sizeChartImage || getShopeeSizeChartUrl() || "").trim();
  if (sizeChartToUse) {
    try {
      const scRes = await uploadShopeeMediaImage(input.shopId, sizeChartToUse, "size_chart");
      if (scRes.imageId) sizeChartImageId = scRes.imageId;
    } catch (scErr) {
      console.warn("Lỗi upload custom size chart image lên Shopee Media:", scErr);
    }
  }

  if (!sizeChartImageId) {
    // Tự động sinh ảnh bảng kích cỡ chuẩn (Size Chart) bằng Canvas nếu không có ảnh tùy chỉnh
    try {
      const sizeChartBase64 = generateSizeChartImage(input.sizes);
      const scRes = await uploadShopeeMediaImage(input.shopId, sizeChartBase64, "size_chart");
      if (scRes.imageId) sizeChartImageId = scRes.imageId;
    } catch (scGenErr) {
      console.warn("Lỗi tạo/upload size chart tự động:", scGenErr);
    }
  }

  // 2. Tạo mới hoặc cập nhật sản phẩm trên Shopee
  let itemId: number;

  if (input.existingItemId) {
    // Cập nhật sản phẩm đã có trên sàn (update_item)
    const updateRes = await fetch("/api/shopee/proxy?action=update_item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: input.shopId,
        item_id: input.existingItemId,
        item_name: input.itemName,
        description: input.description,
        category_id: input.categoryId,
        original_price: basePrice,
        weight: input.weight,
        dimension: input.dimension,
        image: {
          image_id_list: uploadedImageIds,
        },
        size_chart: sizeChartImageId,
        item_sku: input.masterCode,
        attribute_list: input.attributeList || [],
      }),
    });

    const updateData = await updateRes.json();
    if (!updateRes.ok || updateData.error) {
      throw new Error(updateData.error || "Lỗi cập nhật sản phẩm trên Shopee.");
    }
    itemId = input.existingItemId;
  } else {
    // Tạo mới sản phẩm (add_item)
    const addItemRes = await fetch("/api/shopee/proxy?action=add_item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: input.shopId,
        item_name: input.itemName,
        description: input.description,
        category_id: input.categoryId,
        original_price: basePrice,
        weight: input.weight,
        dimension: input.dimension,
        logistic_info: input.logisticInfo,
        image: {
          image_id_list: uploadedImageIds,
        },
        size_chart: sizeChartImageId,
        item_sku: input.masterCode,
        attribute_list: input.attributeList || [],
      }),
    });

    const addItemData = await addItemRes.json();
    if (!addItemRes.ok || addItemData.error || !addItemData.itemId) {
      throw new Error(addItemData.error || "Lỗi tạo sản phẩm cơ sở trên Shopee.");
    }
    itemId = addItemData.itemId;
  }

  // 3. Init Tier Variations if product has colors and sizes
  if (input.colors.length > 0 && input.sizes.length > 0) {
    onProgress?.("3/3 Đang khởi tạo bảng phân loại Màu sắc x Size trên Shopee...", 80);

    const formattedColors = input.colors.map((c) => formatColorName(c));

    const tierVariation: ShopeeTierVariation[] = [
      {
        name: "Màu sắc",
        option_list: formattedColors.map((colorName, idx) => {
          const rawColor = input.colors[idx];
          const imgId = colorImageIdMap[colorName] || colorImageIdMap[rawColor];
          return {
            option: colorName,
            image: imgId ? { image_id: imgId } : undefined,
          };
        }),
      },
      {
        name: "Kích cỡ",
        option_list: input.sizes.map((s) => ({
          option: s,
        })),
      },
    ];

    const modelList: ShopeeModelItem[] = [];
    for (let cIdx = 0; cIdx < input.colors.length; cIdx++) {
      const rawColor = input.colors[cIdx];
      const colorName = formattedColors[cIdx];
      for (let sIdx = 0; sIdx < input.sizes.length; sIdx++) {
        const sizeName = input.sizes[sIdx];
        const matchModel = input.models.find(
          (m) =>
            (m.color === colorName || m.color === rawColor || formatColorName(m.color) === colorName) &&
            m.size === sizeName
        );
        const stockVal = matchModel ? matchModel.stock : 100;
        modelList.push({
          tier_index: [cIdx, sIdx],
          normal_stock: stockVal,
          seller_stock: [{ stock: stockVal }],
          original_price: matchModel ? matchModel.price : basePrice,
          model_sku: matchModel ? matchModel.sku : `${input.masterCode}-${colorName}-${sizeName}`,
        } as any);
      }
    }

    const tierRes = await fetch("/api/shopee/proxy?action=init_tier_variation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: input.shopId,
        item_id: itemId,
        tier_variation: tierVariation,
        model: modelList,
      }),
    });

    const tierData = await tierRes.json();
    if (!tierRes.ok || tierData.error) {
      console.warn("Lỗi tạo phân loại tier variations:", tierData.error);
      // Vẫn giữ sản phẩm cơ sở đã tạo
    }
  }

  const shopeeUrl = `https://shopee.vn/product/${input.shopId}/${itemId}`;

  // 4. Lưu vết vào database Supabase
  try {
    const shops = getShopeeShops();
    const shop = shops.find((s) => s.shopId === input.shopId || s.id === input.shopId);
    await saveShopeePublishedProduct({
      master_code: input.masterCode,
      master_name: input.masterName,
      shop_id: input.shopId,
      shop_name: shop?.shopName || "Gian hàng Shopee",
      shopee_item_id: itemId,
      item_name: input.itemName,
      category_id: input.categoryId,
      price: basePrice,
      status: "published",
      shopee_url: shopeeUrl,
      payload: {
        images: uploadedImageIds,
        colors: input.colors,
        sizes: input.sizes,
      },
      published_at: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.error("Lỗi lưu shopee_published_products vào Supabase:", dbErr);
  }

  onProgress?.("🎉 Đăng sản phẩm lên Shopee thành công!", 100);
  return { itemId, shopeeUrl };
}


