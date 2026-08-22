/**
 * Shopee Open Platform API v2 Integration Client
 * Tài liệu: https://open.shopee.com/documents/v2/v2.shop.auth_partner
 */

export interface ShopeeConfig {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number | null; // Timestamp (ms)
  environment: "live" | "test";
  redirectUrl: string;
  shopName?: string;
  country?: string;
  status?: "connected" | "disconnected" | "expired";
}

const STORAGE_KEY_SHOPEE_CONFIG = "sanpham_shopee_config_v1";

export const DEFAULT_SHOPEE_CONFIG: ShopeeConfig = {
  partnerId: "",
  partnerKey: "",
  shopId: "",
  accessToken: "",
  refreshToken: "",
  tokenExpiresAt: null,
  environment: "live",
  redirectUrl: typeof window !== "undefined" ? `${window.location.origin}/shopee-callback` : "https://localhost:5173/shopee-callback",
  status: "disconnected",
};

/**
 * Lấy cấu hình Shopee hiện tại từ LocalStorage
 */
export function getShopeeConfig(): ShopeeConfig {
  if (typeof window === "undefined") return DEFAULT_SHOPEE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOPEE_CONFIG);
    if (!raw) return DEFAULT_SHOPEE_CONFIG;
    return { ...DEFAULT_SHOPEE_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Lỗi đọc cấu hình Shopee từ localStorage:", err);
    return DEFAULT_SHOPEE_CONFIG;
  }
}

/**
 * Lưu cấu hình Shopee vào LocalStorage
 */
export function setShopeeConfig(config: Partial<ShopeeConfig>): ShopeeConfig {
  if (typeof window === "undefined") return DEFAULT_SHOPEE_CONFIG;
  const current = getShopeeConfig();
  const updated: ShopeeConfig = { ...current, ...config };
  
  // Xác định trạng thái kết nối
  if (!updated.partnerId || !updated.partnerKey) {
    updated.status = "disconnected";
  } else if (updated.accessToken) {
    if (updated.tokenExpiresAt && Date.now() > updated.tokenExpiresAt) {
      updated.status = "expired";
    } else {
      updated.status = "connected";
    }
  } else {
    updated.status = "disconnected";
  }

  localStorage.setItem(STORAGE_KEY_SHOPEE_CONFIG, JSON.stringify(updated));
  return updated;
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
 * - Công thức chung: HMAC-SHA256(partner_key, partner_id + api_path + timestamp + access_token + shop_id)
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
 * Chủ shop bấm vào link này sẽ mở trang đăng nhập Shopee và xác nhận cấp quyền cho App
 */
export async function generateShopeeAuthUrl(customRedirect?: string): Promise<string> {
  const config = getShopeeConfig();
  if (!config.partnerId || !config.partnerKey) {
    throw new Error("Vui lòng cấu hình đầy đủ Partner ID và Partner Key trước khi tạo link ủy quyền.");
  }

  const partnerId = config.partnerId.trim();
  const partnerKey = config.partnerKey.trim();
  const apiPath = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const redirectUrl = (customRedirect || config.redirectUrl || window.location.origin).trim();

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(config.environment);

  return `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;
}

/**
 * Đổi Mã ủy quyền (Auth Code) lấy Access Token & Refresh Token
 */
export async function exchangeShopeeAuthCode(
  code: string,
  shopId: string
): Promise<{ accessToken: string; refreshToken: string; expireIn: number; shopId: string }> {
  const config = getShopeeConfig();
  const partnerId = config.partnerId.trim();
  const partnerKey = config.partnerKey.trim();
  const apiPath = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(config.environment);
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

  setShopeeConfig({
    accessToken,
    refreshToken,
    tokenExpiresAt,
    shopId: String(shopId),
    status: "connected",
  });

  return {
    accessToken,
    refreshToken,
    expireIn,
    shopId: String(shopId),
  };
}

/**
 * Làm mới Access Token bằng Refresh Token
 */
export async function refreshShopeeToken(): Promise<{ accessToken: string; refreshToken: string; expireIn: number }> {
  const config = getShopeeConfig();
  if (!config.refreshToken || !config.shopId) {
    throw new Error("Chưa có Refresh Token hoặc Shop ID. Hãy ủy quyền lại gian hàng Shopee.");
  }

  const partnerId = config.partnerId.trim();
  const partnerKey = config.partnerKey.trim();
  const apiPath = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
  const host = getShopeeBaseUrl(config.environment);
  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: config.refreshToken.trim(),
      partner_id: Number(partnerId),
      shop_id: Number(config.shopId),
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

  setShopeeConfig({
    accessToken,
    refreshToken,
    tokenExpiresAt,
    status: "connected",
  });

  return { accessToken, refreshToken, expireIn };
}

/**
 * Kiểm tra kết nối và lấy thông tin Shop từ Shopee Open API
 */
export async function testShopeeConnection(): Promise<{
  success: boolean;
  message: string;
  shopName?: string;
  country?: string;
  status?: string;
}> {
  const config = getShopeeConfig();
  if (!config.partnerId || !config.partnerKey) {
    return {
      success: false,
      message: "Chưa cấu hình Partner ID và Partner Key.",
    };
  }

  if (!config.accessToken || !config.shopId) {
    return {
      success: false,
      message: "Đã có Partner ID & Key nhưng chưa có Access Token / Shop ID. Vui lòng bấm 'Ủy quyền gian hàng' để cấp quyền.",
    };
  }

  try {
    const partnerId = config.partnerId.trim();
    const partnerKey = config.partnerKey.trim();
    const accessToken = config.accessToken.trim();
    const shopId = config.shopId.trim();
    const apiPath = "/api/v2/shop/get_shop_info";
    const timestamp = Math.floor(Date.now() / 1000);

    const sign = await generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
    const host = getShopeeBaseUrl(config.environment);
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

    const shopName = data.shop_name || "Gian hàng Shopee";
    const country = data.country || "VN";
    const shopStatus = data.status || "NORMAL";

    setShopeeConfig({
      shopName,
      country,
      status: "connected",
    });

    return {
      success: true,
      message: `Kết nối thành công tới gian hàng: ${shopName} (${country})!`,
      shopName,
      country,
      status: shopStatus,
    };
  } catch (err) {
    return {
      success: false,
      message: `Không thể kết nối tới Shopee API: ${(err as Error).message}`,
    };
  }
}
