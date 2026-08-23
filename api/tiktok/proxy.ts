import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://iwtgbtrdztgkrwbkwrza.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_6YeCPmKiElJQmSAxcS9juA_0j5M8vKa";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getTikTokApiBaseUrl(environment: "live" | "sandbox" = "live"): string {
  return environment === "sandbox"
    ? "https://open-api-sandbox.tiktokglobalshop.com"
    : "https://open-api.tiktokglobalshop.com";
}

function calculateHmacSha256(key: string, message: string): string {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

/**
 * Tạo chữ ký TikTok Shop Open API (v2 / 202309)
 * Quy tắc:
 * 1. Lấy tất cả query parameters (trừ sign và access_token nếu không yêu cầu, hoặc sắp xếp theo alphabet a-z)
 * 2. Ghép chuỗi: app_secret + path + key1 + val1 + key2 + val2 + ... + app_secret (hoặc kèm request body json nếu POST)
 */
function generateTikTokSignature(
  appSecret: string,
  apiPath: string,
  queryParams: Record<string, string | number>,
  bodyStr: string = ""
): string {
  const sortedKeys = Object.keys(queryParams)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();

  let signString = apiPath;
  for (const key of sortedKeys) {
    signString += `${key}${queryParams[key]}`;
  }

  if (bodyStr && bodyStr !== "{}") {
    signString += bodyStr;
  }

  const baseString = `${appSecret}${signString}${appSecret}`;
  return calculateHmacSha256(appSecret, baseString);
}

async function safeFetchJson(response: any) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Phản hồi không hợp lệ từ máy chủ TikTok Shop." };
  }
}

async function getAppConfigFromDB() {
  const { data } = await supabase
    .from("tiktok_app_configs")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return {
    appKey: data?.app_key?.trim() || "",
    appSecret: data?.app_secret?.trim() || "",
    serviceId: data?.service_id?.trim() || "",
    environment: (data?.environment as "live" | "sandbox") || "live",
    redirectUrl: data?.redirect_url?.trim() || "",
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const body = req.body || {};
  const action = String(req.query?.action || body.action || "").trim();

  try {
    const config = await getAppConfigFromDB();
    const appKey = (body.appKey || config.appKey || "").trim();
    const appSecret = (body.appSecret || config.appSecret || "").trim();
    const environment = (body.environment || config.environment || "live") as "live" | "sandbox";
    const apiHost = getTikTokApiBaseUrl(environment);

    if (!appKey || !appSecret) {
      return res.status(400).json({
        error: "Chưa cấu hình Khóa ứng dụng (App Key) và Khóa bí mật (App Secret) của TikTok Shop.",
      });
    }

    // 1. ACTION: ĐỔI MÃ CODE LẤY ACCESS TOKEN (EXCHANGE TOKEN)
    if (action === "exchange_token") {
      const authCode = String(body.auth_code || body.code || "").trim();
      const customShopName = body.shopName;

      if (!authCode) {
        return res.status(400).json({ error: "Thiếu auth_code ủy quyền TikTok." });
      }

      // TikTok Auth Endpoint: https://auth.tiktok-shops.com/api/v2/token/get
      const authUrl = `https://auth.tiktok-shops.com/api/v2/token/get?app_key=${encodeURIComponent(
        appKey
      )}&app_secret=${encodeURIComponent(appSecret)}&auth_code=${encodeURIComponent(
        authCode
      )}&grant_type=authorized_code`;

      const tokenRes = await fetch(authUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const tokenData = await safeFetchJson(tokenRes);

      if (tokenData.code !== 0 || !tokenData.data?.access_token) {
        return res.status(400).json({
          error: tokenData.message || tokenData.error || "Không thể lấy Access Token từ TikTok Shop.",
          detail: tokenData,
        });
      }

      const resData = tokenData.data;
      const accessToken = resData.access_token;
      const refreshToken = resData.refresh_token;
      const expireIn = resData.access_token_expire_in || 86400; // Mặc định 24h
      const refreshExpireIn = resData.refresh_token_expire_in || 2592000; // Mặc định 30 ngày
      const tokenExpiresAt = Date.now() + expireIn * 1000;
      const refreshTokenExpiresAt = Date.now() + refreshExpireIn * 1000;
      const openId = resData.open_id || "";
      const sellerName = resData.seller_name || customShopName || "TikTok Shop";
      const region = resData.seller_base_region || "VN";

      // Thử lấy danh sách Authorized Shops để lấy shop_cipher / shop_code
      let shopCipher = "";
      let shopCode = "";
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const shopsPath = "/authorization/202309/shops";
        const sign = generateTikTokSignature(appSecret, shopsPath, {
          app_key: appKey,
          timestamp,
        });
        const shopsUrl = `${apiHost}${shopsPath}?app_key=${appKey}&timestamp=${timestamp}&sign=${sign}`;
        const shopsRes = await fetch(shopsUrl, {
          headers: {
            "x-tts-access-token": accessToken,
            "Content-Type": "application/json",
          },
        });
        const shopsData = await safeFetchJson(shopsRes);
        if (shopsData.code === 0 && shopsData.data?.shops && shopsData.data.shops.length > 0) {
          const firstShop = shopsData.data.shops[0];
          shopCipher = firstShop.cipher || "";
          shopCode = firstShop.code || firstShop.id || "";
        }
      } catch (shopFetchErr) {
        console.warn("Không lấy được shop cipher tự động:", shopFetchErr);
      }

      const shopId = shopCode ? `tiktok_${shopCode}` : `tiktok_${Date.now()}`;

      await supabase.from("tiktok_shops").upsert({
        id: shopId,
        shop_cipher: shopCipher,
        shop_code: shopCode,
        shop_name: sellerName,
        region,
        open_id: openId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        status: "connected",
        updated_at: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        id: shopId,
        shopCipher,
        shopCode,
        shopName: sellerName,
        region,
        openId,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        refreshTokenExpiresAt,
        status: "connected",
      });
    }

    // 2. ACTION: LÀM MỚI TOKEN (REFRESH TOKEN)
    if (action === "refresh_token") {
      const refreshToken = String(body.refresh_token || body.refreshToken || "").trim();
      const shopCipher = String(body.shop_cipher || body.shopCipher || "").trim();
      const shopId = String(body.shop_id || body.shopId || "").trim();

      if (!refreshToken) {
        return res.status(400).json({ error: "Thiếu refresh_token." });
      }

      // TikTok Refresh Endpoint: https://auth.tiktok-shops.com/api/v2/token/refresh
      const refreshUrl = `https://auth.tiktok-shops.com/api/v2/token/refresh?app_key=${encodeURIComponent(
        appKey
      )}&app_secret=${encodeURIComponent(appSecret)}&refresh_token=${encodeURIComponent(
        refreshToken
      )}&grant_type=refresh_token`;

      const refreshRes = await fetch(refreshUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const refreshData = await safeFetchJson(refreshRes);

      if (refreshData.code !== 0 || !refreshData.data?.access_token) {
        return res.status(400).json({
          error: refreshData.message || refreshData.error || "Lỗi làm mới token TikTok Shop.",
          detail: refreshData,
        });
      }

      const resData = refreshData.data;
      const newAccessToken = resData.access_token;
      const newRefreshToken = resData.refresh_token || refreshToken;
      const expireIn = resData.access_token_expire_in || 86400;
      const refreshExpireIn = resData.refresh_token_expire_in || 2592000;
      const tokenExpiresAt = Date.now() + expireIn * 1000;
      const refreshTokenExpiresAt = Date.now() + refreshExpireIn * 1000;

      if (shopId || shopCipher) {
        const query = supabase.from("tiktok_shops").update({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_expires_at: tokenExpiresAt,
          refresh_token_expires_at: refreshTokenExpiresAt,
          status: "connected",
          updated_at: new Date().toISOString(),
        });

        if (shopId) {
          await query.eq("id", shopId);
        } else if (shopCipher) {
          await query.eq("shop_cipher", shopCipher);
        }
      }

      return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenExpiresAt,
        refreshTokenExpiresAt,
      });
    }

    // 3. ACTION: KIỂM TRA KẾT NỐI (TEST CONNECTION)
    if (action === "test_connection") {
      let accessToken = String(body.access_token || body.accessToken || "").trim();
      const shopId = String(body.shop_id || body.shopId || "").trim();

      if (!accessToken && shopId) {
        const { data: shop } = await supabase
          .from("tiktok_shops")
          .select("access_token")
          .eq("id", shopId)
          .maybeSingle();
        accessToken = shop?.access_token || "";
      }

      if (!accessToken) {
        return res.status(400).json({ error: "Thiếu Access Token để kiểm tra kết nối." });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const apiPath = "/authorization/202309/shops";
      const sign = generateTikTokSignature(appSecret, apiPath, {
        app_key: appKey,
        timestamp,
      });

      const testUrl = `${apiHost}${apiPath}?app_key=${appKey}&timestamp=${timestamp}&sign=${sign}`;

      const testRes = await fetch(testUrl, {
        headers: {
          "x-tts-access-token": accessToken,
          "Content-Type": "application/json",
        },
      });

      const testData = await safeFetchJson(testRes);

      if (testData.code === 0) {
        const shopsList = testData.data?.shops || [];
        const shopInfo = shopsList[0] || {};
        return res.status(200).json({
          success: true,
          message: "Kết nối TikTok Shop thành công!",
          shopName: shopInfo.name,
          shopCipher: shopInfo.cipher,
          region: shopInfo.region,
          shops: shopsList,
        });
      } else {
        return res.status(400).json({
          error: testData.message || "Kiểm tra kết nối thất bại (Token có thể đã hết hạn).",
          detail: testData,
        });
      }
    }

    return res.status(400).json({ error: `Action không hợp lệ: ${action}` });
  } catch (err: any) {
    console.error("TikTok Proxy Handler Error:", err);
    return res.status(500).json({ error: err.message || "Lỗi xử lý TikTok Proxy nội bộ." });
  }
}
