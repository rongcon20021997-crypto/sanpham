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

async function safeFetchJson(response: any) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Phản hồi không hợp lệ từ máy chủ Shopee." };
  }
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

  const body = req.body || {};
  const action = String(req.query?.action || body.action || "").trim();

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

      const tokenData = await safeFetchJson(tokenRes);
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
        const infoData = await safeFetchJson(infoRes);
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

      const refreshData = await safeFetchJson(refreshRes);
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
      const infoData = await safeFetchJson(infoRes);

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

    // 4. ACTION: KÉO DANH SÁCH KÊNH VẬN CHUYỂN (GET LOGISTICS CHANNEL LIST)
    if (action === "get_logistics") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || req.query.shopId || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();

      if (!shopId || !accessToken) {
        // Tự động tìm token từ database nếu chỉ truyền shop_id hoặc lấy shop mặc định
        const { data: shops } = await supabase.from("shopee_shops").select("*");
        const shop = shopId
          ? shops?.find((s: any) => String(s.shop_id) === shopId)
          : shops?.find((s: any) => s.is_default) || shops?.[0];

        if (shop) {
          shopId = String(shop.shop_id);
          accessToken = shop.access_token;
        }
      }

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Không tìm thấy gian hàng Shopee nào có token để kéo logistics." });
      }

      const apiPath = "/api/v2/logistics/get_channel_list";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}`;

      const logRes = await fetch(url);
      const logData = await safeFetchJson(logRes);

      if (logData.error) {
        return res.status(400).json({
          error: logData.message || logData.error,
          detail: logData,
        });
      }

      const rawList = logData.response?.logistics_channel_list || [];
      const channels = rawList.map((ch: any) => ({
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

      return res.status(200).json({
        success: true,
        shopId,
        channels,
      });
    }

    // 5. ACTION: KÉO DANH MỤC SẢN PHẨM (GET CATEGORY LIST)
    if (action === "get_categories" || action === "get_category") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || req.query.shopId || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();
      const language = String(body.language || req.query.language || "vi").trim();

      if (!shopId || !accessToken) {
        const { data: shops } = await supabase.from("shopee_shops").select("*");
        const shop = shopId
          ? shops?.find((s: any) => String(s.shop_id) === shopId)
          : shops?.find((s: any) => s.is_default) || shops?.[0];

        if (shop) {
          shopId = String(shop.shop_id);
          accessToken = shop.access_token;
        }
      }

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Không tìm thấy gian hàng Shopee nào có token để kéo danh mục." });
      }

      const apiPath = "/api/v2/product/get_category";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}&language=${language}`;

      const catRes = await fetch(url);
      const catData = await safeFetchJson(catRes);

      if (catData.error) {
        return res.status(400).json({
          error: catData.message || catData.error,
          detail: catData,
        });
      }

      const rawList = catData.response?.category_list || [];
      const categories = rawList.map((cat: any) => ({
        categoryId: cat.category_id,
        parentCategoryId: cat.parent_category_id,
        originalCategoryName: cat.original_category_name,
        displayCategoryName: cat.display_category_name || cat.original_category_name,
        hasChildren: Boolean(cat.has_children),
      }));

      return res.status(200).json({
        success: true,
        shopId,
        categories,
      });
    }

    // 6. ACTION: KÉO THUỘC TÍNH DANH MỤC (GET ATTRIBUTES LIST)
    if (action === "get_attributes" || action === "get_attribute") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || req.query.shopId || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();
      const categoryId = String(body.category_id || body.categoryId || req.query.category_id || req.query.categoryId || "").trim();
      const language = String(body.language || req.query.language || "vi").trim();

      if (!categoryId) {
        return res.status(400).json({ error: "Thiếu category_id để lấy thuộc tính." });
      }

      if (!shopId || !accessToken) {
        const { data: shops } = await supabase.from("shopee_shops").select("*");
        const shop = shopId
          ? shops?.find((s: any) => String(s.shop_id) === shopId)
          : shops?.find((s: any) => s.is_default) || shops?.[0];

        if (shop) {
          shopId = String(shop.shop_id);
          accessToken = shop.access_token;
        }
      }

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Không tìm thấy gian hàng Shopee nào có token để lấy thuộc tính." });
      }

      const apiPath = "/api/v2/product/get_attributes";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}&category_id=${Number(categoryId)}&language=${language}`;

      const attrRes = await fetch(url);
      const attrData = await safeFetchJson(attrRes);

      if (attrData.error) {
        return res.status(400).json({
          error: attrData.message || attrData.error,
          detail: attrData,
        });
      }

      const rawList = attrData.response?.attribute_list || [];
      const attributes = rawList.map((attr: any) => ({
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

      return res.status(200).json({
        success: true,
        shopId,
        categoryId: Number(categoryId),
        attributes,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("Shopee Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
