/**
 * Shopee Open Platform API v2 Multi-Shop Integration Client
 * Tài liệu: https://open.shopee.com/documents/v2/v2.shop.auth_partner
 */

export interface ShopeeAppConfig {
  partnerId: string;
  partnerKey: string;
  environment: "live" | "test";
  redirectUrl: string;
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

export const DEFAULT_SHOPEE_APP_CONFIG: ShopeeAppConfig = {
  partnerId: "",
  partnerKey: "",
  environment: "live",
  redirectUrl: typeof window !== "undefined" ? `${window.location.origin}/shopee-callback` : "https://localhost:5173/shopee-callback",
};

/**
 * Lấy cấu hình Partner App Shopee
 */
export function getShopeeAppConfig(): ShopeeAppConfig {
  if (typeof window === "undefined") return DEFAULT_SHOPEE_APP_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_APP);
    if (!raw) {
      // Tương thích ngược với bản v1 nếu có
      const legacyRaw = localStorage.getItem("sanpham_shopee_config_v1");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        return {
          partnerId: legacy.partnerId || "",
          partnerKey: legacy.partnerKey || "",
          environment: legacy.environment || "live",
          redirectUrl: legacy.redirectUrl || DEFAULT_SHOPEE_APP_CONFIG.redirectUrl,
        };
      }
      return DEFAULT_SHOPEE_APP_CONFIG;
    }
    return { ...DEFAULT_SHOPEE_APP_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Lỗi đọc App Config Shopee:", err);
    return DEFAULT_SHOPEE_APP_CONFIG;
  }
}

/**
 * Lưu cấu hình Partner App Shopee
 */
export function setShopeeAppConfig(config: Partial<ShopeeAppConfig>): ShopeeAppConfig {
  if (typeof window === "undefined") return DEFAULT_SHOPEE_APP_CONFIG;
  const current = getShopeeAppConfig();
  const updated: ShopeeAppConfig = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY_SHOPEE_APP, JSON.stringify(updated));
  return updated;
}

/**
 * Lấy danh sách tất cả các Shop Shopee đã kết nối
 */
export function getShopeeShops(): ShopeeShop[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_SHOPS);
    if (!raw) {
      // Migrate từ v1 nếu có shop cũ
      const legacyRaw = localStorage.getItem("sanpham_shopee_config_v1");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (legacy.shopId && (legacy.accessToken || legacy.shopName)) {
          const migratedShop: ShopeeShop = {
            id: `shop_${legacy.shopId}_${Date.now()}`,
            shopId: String(legacy.shopId),
            shopName: legacy.shopName || `Shop ${legacy.shopId}`,
            country: legacy.country || "VN",
            accessToken: legacy.accessToken || "",
            refreshToken: legacy.refreshToken || "",
            tokenExpiresAt: legacy.tokenExpiresAt || null,
            status: legacy.status || "connected",
            isDefault: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify([migratedShop]));
          return [migratedShop];
        }
      }
      return [];
    }

    const list: ShopeeShop[] = JSON.parse(raw);
    const now = Date.now();
    // Cập nhật trạng thái expired nếu quá hạn
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
 * Lưu hoặc cập nhật một Shop trong danh sách
 */
export function saveShopeeShop(shopData: Partial<ShopeeShop> & { shopId: string }): ShopeeShop {
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

  localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(list));
  return updatedShop;
}

/**
 * Xóa một Shop khỏi danh sách
 */
export function deleteShopeeShop(id: string): ShopeeShop[] {
  const list = getShopeeShops().filter((s) => s.id !== id && s.shopId !== id);
  if (list.length > 0 && !list.some((s) => s.isDefault)) {
    list[0].isDefault = true;
  }
  localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(list));
  return list;
}

/**
 * Đặt một Shop làm Shop Mặc Định
 */
export function setDefaultShopeeShop(id: string): ShopeeShop[] {
  const list = getShopeeShops().map((s) => ({
    ...s,
    isDefault: s.id === id || s.shopId === id,
  }));
  localStorage.setItem(STORAGE_KEY_SHOPEE_SHOPS, JSON.stringify(list));
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
  const redirectUrl = (customRedirect || appConfig.redirectUrl || window.location.origin).trim();

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(appConfig.environment);

  return `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;
}

/**
 * Đổi Mã ủy quyền (Auth Code) lấy Token và thêm/cập nhật Shop vào danh sách
 */
export async function exchangeShopeeAuthCode(
  code: string,
  shopId: string,
  customShopName?: string
): Promise<ShopeeShop> {
  const appConfig = getShopeeAppConfig();
  if (!appConfig.partnerId || !appConfig.partnerKey) {
    throw new Error("Chưa cấu hình Partner ID và Partner Key.");
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

  const data = await res.json();
  if (data.error) {
    throw new Error(data.message || `Lỗi từ Shopee: ${data.error}`);
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expireIn = data.expire_in || 14400; // 4 giờ
  const tokenExpiresAt = Date.now() + expireIn * 1000;

  // Thử gọi lấy tên Shop
  let shopName = customShopName || `Shop ${shopId}`;
  let country = "VN";

  try {
    const shopInfoPath = "/api/v2/shop/get_shop_info";
    const shopInfoSign = await generateShopeeSignature(partnerId, partnerKey, shopInfoPath, timestamp, accessToken, String(shopId));
    const shopInfoUrl = `${host}${shopInfoPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${shopInfoSign}`;
    const infoRes = await fetch(shopInfoUrl);
    const infoData = await infoRes.json();
    if (infoData.shop_name) {
      shopName = infoData.shop_name;
    }
    if (infoData.country) {
      country = infoData.country;
    }
  } catch (infoErr) {
    console.warn("Không thể lấy thông tin tên shop chi tiết:", infoErr);
  }

  const savedShop = saveShopeeShop({
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
  const appConfig = getShopeeAppConfig();
  const shops = getShopeeShops();
  const shop = shops.find((s) => s.id === shopIdOrInternalId || s.shopId === shopIdOrInternalId);

  if (!shop) {
    throw new Error("Không tìm thấy thông tin Shop trong danh sách.");
  }
  if (!shop.refreshToken) {
    throw new Error(`Shop "${shop.shopName}" chưa có Refresh Token. Vui lòng ủy quyền lại.`);
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

  const data = await res.json();
  if (data.error) {
    throw new Error(data.message || `Lỗi làm mới token: ${data.error}`);
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expireIn = data.expire_in || 14400;
  const tokenExpiresAt = Date.now() + expireIn * 1000;

  const updatedShop = saveShopeeShop({
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
 * Kiểm tra kết nối tới một Shop cụ thể và cập nhật trạng thái
 */
export async function testShopeeShopConnection(shopIdOrInternalId: string): Promise<{
  success: boolean;
  message: string;
  shop?: ShopeeShop;
}> {
  const appConfig = getShopeeAppConfig();
  const shops = getShopeeShops();
  const shop = shops.find((s) => s.id === shopIdOrInternalId || s.shopId === shopIdOrInternalId);

  if (!shop) {
    return { success: false, message: "Không tìm thấy Shop trong danh sách." };
  }

  if (!appConfig.partnerId || !appConfig.partnerKey) {
    return { success: false, message: "Chưa cấu hình Partner ID và Partner Key cho Partner App." };
  }

  if (!shop.accessToken) {
    return { success: false, message: `Shop "${shop.shopName}" chưa có Access Token. Hãy ủy quyền gian hàng để lấy token.` };
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

    const updated = saveShopeeShop({
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
