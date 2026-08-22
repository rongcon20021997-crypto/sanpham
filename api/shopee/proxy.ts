import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://iwtgbtrdztgkrwbkwrza.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_6YeCPmKiElJQmSAxcS9juA_0j5M8vKa";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getShopeeBaseUrl(environment: "live" | "test" = "live"): string {
  return environment === "test"
    ? "https://partner.test-stable.shopeemobile.com"
    : "https://partner.shopeemobile.com";
}

function calculateHmacSha256(key: string, message: string): string {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

function generateShopeeSignature(
  partnerId: string,
  partnerKey: string,
  apiPath: string,
  timestamp: number,
  accessToken: string = "",
  shopId: string = ""
): string {
  let baseString = `${partnerId}${apiPath}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;
  return calculateHmacSha256(partnerKey, baseString);
}

async function getAppConfigFromDB() {
  const { data } = await supabase
    .from("shopee_app_configs")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return {
    partnerId: data?.partner_id?.trim() || "",
    partnerKey: data?.partner_key?.trim() || "",
    environment: (data?.environment as "live" | "test") || "live",
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

  const { action } = req.query || {};
  const body = req.body || {};

  try {
    const config = await getAppConfigFromDB();
    const partnerId = body.partnerId || config.partnerId;
    const partnerKey = body.partnerKey || config.partnerKey;
    const environment = (body.environment || config.environment || "live") as "live" | "test";
    const host = getShopeeBaseUrl(environment);

    if (!partnerId || !partnerKey) {
      return res.status(400).json({
        error: "Chưa cấu hình Partner ID và Partner Key trên hệ thống.",
      });
    }

    // 1. ACTION: ĐỔI MÃ CODE LẤY TOKEN (EXCHANGE TOKEN)
    if (action === "exchange_token") {
      const code = String(body.code || "").trim();
      const shopId = String(body.shop_id || body.shopId || "").trim();
      const customShopName = body.shopName;

      if (!code || !shopId) {
        return res.status(400).json({ error: "Thiếu code hoặc shop_id." });
      }

      const apiPath = "/api/v2/auth/token/get";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
      const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

      const tokenRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code,
          partner_id: Number(partnerId),
          shop_id: Number(shopId),
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.status(400).json({
          error: tokenData.message || tokenData.error,
          detail: tokenData,
        });
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expireIn = tokenData.expire_in || 14400;
      const tokenExpiresAt = Date.now() + expireIn * 1000;

      // Lấy thông tin Shop chi tiết
      let shopName = customShopName || `Shop ${shopId}`;
      let country = "VN";

      try {
        const infoPath = "/api/v2/shop/get_shop_info";
        const infoSign = generateShopeeSignature(partnerId, partnerKey, infoPath, timestamp, accessToken, shopId);
        const infoUrl = `${host}${infoPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${infoSign}`;
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();
        if (infoData.shop_name) shopName = infoData.shop_name;
        if (infoData.country) country = infoData.country;
      } catch (err) {
        console.warn("Không thể lấy chi tiết shop_info:", err);
      }

      const shopRecord = {
        id: `shop_${shopId}`,
        shop_id: shopId,
        shop_name: shopName,
        country: country,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        status: "connected",
        updated_at: new Date().toISOString(),
      };

      // Lưu vào Supabase
      await supabase.from("shopee_shops").upsert(shopRecord);

      return res.status(200).json({
        success: true,
        shop: {
          id: shopRecord.id,
          shopId: shopRecord.shop_id,
          shopName: shopRecord.shop_name,
          country: shopRecord.country,
          accessToken: shopRecord.access_token,
          refreshToken: shopRecord.refresh_token,
          tokenExpiresAt: shopRecord.token_expires_at,
          status: "connected",
        },
      });
    }

    // 2. ACTION: LÀM MỚI TOKEN (REFRESH TOKEN)
    if (action === "refresh_token") {
      const shopId = String(body.shop_id || body.shopId || "").trim();
      const refreshToken = String(body.refresh_token || body.refreshToken || "").trim();

      if (!shopId || !refreshToken) {
        return res.status(400).json({ error: "Thiếu shop_id hoặc refresh_token." });
      }

      const apiPath = "/api/v2/auth/access_token/get";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
      const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

      const refreshRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: refreshToken,
          partner_id: Number(partnerId),
          shop_id: Number(shopId),
        }),
      });

      const refreshData = await refreshRes.json();
      if (refreshData.error) {
        return res.status(400).json({
          error: refreshData.message || refreshData.error,
          detail: refreshData,
        });
      }

      const newAccessToken = refreshData.access_token;
      const newRefreshToken = refreshData.refresh_token;
      const expireIn = refreshData.expire_in || 14400;
      const tokenExpiresAt = Date.now() + expireIn * 1000;

      await supabase.from("shopee_shops").update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_expires_at: tokenExpiresAt,
        status: "connected",
        updated_at: new Date().toISOString(),
      }).eq("shop_id", shopId);

      return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenExpiresAt: tokenExpiresAt,
      });
    }

    // 3. ACTION: KIỂM TRA KẾT NỐI (TEST CONNECTION)
    if (action === "test_connection") {
      const shopId = String(body.shop_id || body.shopId || "").trim();
      const accessToken = String(body.access_token || body.accessToken || "").trim();

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Thiếu shop_id hoặc access_token." });
      }

      const apiPath = "/api/v2/shop/get_shop_info";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}`;

      const infoRes = await fetch(url);
      const infoData = await infoRes.json();

      if (infoData.error) {
        return res.status(400).json({
          error: infoData.message || infoData.error,
          detail: infoData,
        });
      }

      await supabase.from("shopee_shops").update({
        shop_name: infoData.shop_name,
        country: infoData.country,
        status: "connected",
        updated_at: new Date().toISOString(),
      }).eq("shop_id", shopId);

      return res.status(200).json({
        success: true,
        shopName: infoData.shop_name,
        country: infoData.country,
        authTime: infoData.auth_time,
        expireTime: infoData.expire_time,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("Shopee Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
