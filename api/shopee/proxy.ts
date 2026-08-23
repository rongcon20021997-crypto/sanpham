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

    // 2.5 ACTION: TỰ ĐỘNG LÀM MỚI TẤT CẢ TOKEN HẾT HẠN (CRONJOB REFRESH ALL)
    if (action === "cron_refresh" || action === "refresh_all_tokens") {
      const { data: shops } = await supabase
        .from("shopee_shops")
        .select("id, shop_id, shop_name, refresh_token, token_expires_at")
        .not("refresh_token", "is", null);

      const results: any[] = [];
      const now = Date.now();
      const threshold = 2.5 * 60 * 60 * 1000; // 2.5 hours

      for (const s of shops || []) {
        const expiresAt = Number(s.token_expires_at || 0);
        const isExpiring = !expiresAt || expiresAt - now < threshold || body.force;

        if (!isExpiring) {
          results.push({ shopId: s.shop_id, shopName: s.shop_name, status: "skipped" });
          continue;
        }

        try {
          const apiPath = "/api/v2/auth/access_token/get";
          const timestamp = Math.floor(Date.now() / 1000);
          const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
          const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&sign=${sign}`;

          const refreshRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partner_id: Number(partnerId),
              shop_id: Number(s.shop_id),
              refresh_token: s.refresh_token,
            }),
          });

          const refreshData = await safeFetchJson(refreshRes);
          if (refreshData.access_token) {
            const newAcc = refreshData.access_token;
            const newRef = refreshData.refresh_token || s.refresh_token;
            const expIn = refreshData.expire_in || 14400;
            const newExp = Date.now() + expIn * 1000;

            await supabase.from("shopee_shops").update({
              access_token: newAcc,
              refresh_token: newRef,
              token_expires_at: newExp,
              status: "connected",
              updated_at: new Date().toISOString(),
            }).eq("id", s.id);

            results.push({ shopId: s.shop_id, shopName: s.shop_name, status: "success", expiresAt: newExp });
          } else {
            results.push({ shopId: s.shop_id, shopName: s.shop_name, status: "failed", error: refreshData.message || refreshData.error });
          }
        } catch (e: any) {
          results.push({ shopId: s.shop_id, shopName: s.shop_name, status: "error", error: e.message });
        }
      }

      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        total: shops?.length || 0,
        refreshed: results.filter((r) => r.status === "success").length,
        results,
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

    // 7. ACTION: TẢI ẢNH LÊN SHOPEE MEDIA SPACE (UPLOAD IMAGE - PUBLIC API)
    if (action === "upload_image" || action === "upload_media_image") {
      const imageUrl = String(body.image_url || body.imageUrl || "").trim();
      const imageBase64 = String(body.image_base64 || body.imageBase64 || "").trim();
      const scene = String(body.scene || req.query.scene || "normal").trim();

      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ error: "Thiếu image_url hoặc image_base64 để tải lên." });
      }

      // Lấy Buffer ảnh
      let fileBuffer: Buffer;
      let contentType = "image/jpeg";

      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        fileBuffer = Buffer.from(cleanBase64, "base64");
      } else {
        const imgFetchRes = await fetch(imageUrl);
        if (!imgFetchRes.ok) {
          return res.status(400).json({ error: `Không thể tải ảnh nguồn từ: ${imageUrl} (Status: ${imgFetchRes.status})` });
        }
        const arrayBuf = await imgFetchRes.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuf);
        contentType = imgFetchRes.headers.get("content-type") || "image/jpeg";
      }

      const apiPath = "/api/v2/media_space/upload_image";
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Shopee Media Space là Public API (chỉ cần partner_id, timestamp, sign)
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&sign=${sign}`;

      // Tạo FormData multipart upload
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: contentType });
      formData.append("image", blob, "image.jpg");
      if (scene) {
        formData.append("scene", scene);
      }

      const uploadRes = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const uploadData = await safeFetchJson(uploadRes);

      if (uploadData.error) {
        return res.status(400).json({
          error: uploadData.message || uploadData.error,
          detail: uploadData,
        });
      }

      const imageInfo = uploadData.response?.image_info || {};
      return res.status(200).json({
        success: true,
        imageId: imageInfo.image_id,
        imageUrlList: imageInfo.image_url_list || [],
      });
    }

    // 8. ACTION: TẠO SẢN PHẨM SHOPEE CƠ BẢN (ADD ITEM)
    if (action === "add_item" || action === "create_product") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();

      const { data: shops } = await supabase.from("shopee_shops").select("*");
      let shop = shopId
        ? shops?.find((s: any) => String(s.shop_id) === shopId)
        : shops?.find((s: any) => s.is_default) || shops?.[0];

      if (shop) {
        shopId = String(shop.shop_id);
        accessToken = shop.access_token;
      }

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Thiếu shop_id hoặc access_token để tạo sản phẩm Shopee." });
      }

      const baseStockVal = Number(body.normal_stock || body.stock || 100);
      const sellerStock = body.seller_stock || [
        {
          stock: baseStockVal,
        },
      ];

      let logisticInfo: any[] = [];
      const userProvidedList = Array.isArray(body.logistic_info) ? body.logistic_info : [];

      try {
        const logApiPath = "/api/v2/logistics/get_channel_list";
        const logTimestamp = Math.floor(Date.now() / 1000);
        const logSign = generateShopeeSignature(partnerId, partnerKey, logApiPath, logTimestamp, accessToken, shopId);
        const logUrl = `${host}${logApiPath}?partner_id=${Number(partnerId)}&timestamp=${logTimestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${logSign}`;
        const logRes = await fetch(logUrl);
        const logData = await safeFetchJson(logRes);
        const rawChannels = logData.response?.logistics_channel_list || [];

        if (userProvidedList.length > 0) {
          const userMap = new Map<number, boolean>();
          for (const item of userProvidedList) {
            const chId = Number(item.logistic_id || item.channel_id || item.channelId);
            if (chId) {
              userMap.set(chId, Boolean(item.enabled));
            }
          }

          if (rawChannels.length > 0) {
            logisticInfo = rawChannels.map((ch: any) => {
              const chId = Number(ch.logistics_channel_id);
              // Nếu người dùng đã chọn / bỏ chọn thì lấy theo cấu hình người dùng, ngược lại mặc định false nếu không được chọn
              const isEnabled = userMap.has(chId) ? userMap.get(chId)! : false;
              return {
                logistic_id: chId,
                enabled: isEnabled,
              };
            });
          } else {
            logisticInfo = userProvidedList;
          }
        } else if (rawChannels.length > 0) {
          logisticInfo = rawChannels
            .filter((ch: any) => ch.enabled || ch.force_enable)
            .map((ch: any) => ({
              logistic_id: ch.logistics_channel_id,
              enabled: true,
            }));
        }
      } catch (logErr) {
        console.warn("Không thể đồng bộ logistics channels:", logErr);
        if (userProvidedList.length > 0) logisticInfo = userProvidedList;
      }

      const imageIdList = body.image?.image_id_list || body.image_id_list || [];
      const sizeChartId = String(body.size_chart || body.sizeChart || "").trim();

      const payload: any = {
        original_price: Number(body.original_price || body.price || 0),
        description: String(body.description || "").trim(),
        weight: Number(body.weight || 0.2),
        item_name: String(body.item_name || body.name || "").trim(),
        item_status: body.item_status || "NORMAL",
        dimension: {
          package_height: Number(body.dimension?.package_height || body.package_height || 5),
          package_length: Number(body.dimension?.package_length || body.package_length || 20),
          package_width: Number(body.dimension?.package_width || body.package_width || 15),
        },
        logistic_info: logisticInfo,
        category_id: Number(body.category_id || body.categoryId),
        image: {
          image_id_list: imageIdList,
        },
        brand: body.brand || {
          brand_id: 0,
          original_brand_name: "NoBrand",
        },
        attribute_list: body.attribute_list || [],
        item_sku: String(body.item_sku || body.master_code || "").trim(),
        seller_stock: sellerStock,
      };

      // Gắn size_chart_info nếu có ảnh bảng kích cỡ
      if (sizeChartId) {
        payload.size_chart_info = {
          size_chart: sizeChartId,
        };
      }

      const apiPath = "/api/v2/product/add_item";
      let timestamp = Math.floor(Date.now() / 1000);
      let sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      let url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}`;

      let addItemRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let addItemData = await safeFetchJson(addItemRes);

      // Nếu token hết hạn, tự động refresh token và thử lại
      if (
        addItemData.error &&
        (addItemData.error.includes("access_token") ||
          addItemData.message?.includes("access_token") ||
          addItemData.error === "error_auth") &&
        shop?.refresh_token
      ) {
        console.info("⚡ [Shopee Auto-Refresh]: Token hết hạn, đang tự động làm mới...");
        try {
          const refreshApiPath = "/api/v2/auth/access_token/get";
          const refTimestamp = Math.floor(Date.now() / 1000);
          const refSign = generateShopeeSignature(partnerId, partnerKey, refreshApiPath, refTimestamp);
          const refUrl = `${host}${refreshApiPath}?partner_id=${partnerId}&timestamp=${refTimestamp}&sign=${refSign}`;

          const refRes = await fetch(refUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              refresh_token: shop.refresh_token,
              partner_id: Number(partnerId),
              shop_id: Number(shopId),
            }),
          });
          const refData = await safeFetchJson(refRes);
          if (refData.access_token) {
            accessToken = refData.access_token;
            await supabase.from("shopee_shops").update({
              access_token: refData.access_token,
              refresh_token: refData.refresh_token,
              token_expires_at: Date.now() + (refData.expire_in || 14400) * 1000,
              updated_at: new Date().toISOString(),
            }).eq("shop_id", shopId);

            // Thử lại add_item với token mới
            timestamp = Math.floor(Date.now() / 1000);
            sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}`;

            addItemRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            addItemData = await safeFetchJson(addItemRes);
          }
        } catch (rfErr) {
          console.warn("Lỗi auto-refresh token:", rfErr);
        }
      }

      if (addItemData.error) {
        return res.status(400).json({
          error: addItemData.message || addItemData.error,
          detail: addItemData,
        });
      }

      const itemId = addItemData.response?.item_id;

      return res.status(200).json({
        success: true,
        itemId,
        response: addItemData.response,
      });
    }

    // 8b. ACTION: CẬP NHẬT SẢN PHẨM ĐÃ CÓ TRÊN SHOPEE (UPDATE ITEM)
    if (action === "update_item") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();
      const itemId = Number(body.item_id || body.itemId);

      if (!itemId) {
        return res.status(400).json({ error: "Thiếu item_id để cập nhật sản phẩm." });
      }

      const { data: shops } = await supabase.from("shopee_shops").select("*");
      const shop = shopId
        ? shops?.find((s: any) => String(s.shop_id) === shopId)
        : shops?.find((s: any) => s.is_default) || shops?.[0];

      if (shop) {
        shopId = String(shop.shop_id);
        accessToken = shop.access_token;
      }

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Thiếu shop_id hoặc access_token." });
      }

      const imageIdList = body.image?.image_id_list || body.image_id_list || [];
      const sizeChartId = String(body.size_chart || body.sizeChart || "").trim();

      const payload: any = {
        item_id: itemId,
        item_name: String(body.item_name || body.name || "").trim() || undefined,
        description: String(body.description || "").trim() || undefined,
        category_id: body.category_id ? Number(body.category_id) : undefined,
        original_price: body.original_price ? Number(body.original_price) : undefined,
        weight: body.weight ? Number(body.weight) : undefined,
        dimension: body.dimension ? {
          package_height: Number(body.dimension.package_height || 5),
          package_length: Number(body.dimension.package_length || 20),
          package_width: Number(body.dimension.package_width || 15),
        } : undefined,
        item_sku: body.item_sku ? String(body.item_sku).trim() : undefined,
        attribute_list: body.attribute_list || undefined,
      };

      if (imageIdList.length > 0) {
        payload.image = { image_id_list: imageIdList };
      }

      if (sizeChartId) {
        payload.size_chart_info = { size_chart: sizeChartId };
      }

      // Loại bỏ các field undefined
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      const apiPath = "/api/v2/product/update_item";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}`;

      const updateRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const updateData = await safeFetchJson(updateRes);

      if (updateData.error) {
        return res.status(400).json({
          error: updateData.message || updateData.error,
          detail: updateData,
        });
      }

      return res.status(200).json({
        success: true,
        itemId,
        response: updateData.response,
      });
    }

    // 9. ACTION: KHỞI TẠO PHÂN LOẠI 2 TẦNG SHOPEE (INIT TIER VARIATION)
    if (action === "init_tier_variation" || action === "init_tier") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();
      const itemId = Number(body.item_id || body.itemId);

      if (!itemId) {
        return res.status(400).json({ error: "Thiếu item_id để tạo phân loại biến thể." });
      }

      const { data: shops } = await supabase.from("shopee_shops").select("*");
      const shop = shopId
        ? shops?.find((s: any) => String(s.shop_id) === shopId)
        : shops?.find((s: any) => s.is_default) || shops?.[0];

      if (shop) {
        shopId = String(shop.shop_id);
        accessToken = shop.access_token;
      }

      if (!shopId || !accessToken) {
        return res.status(400).json({ error: "Thiếu shop_id hoặc access_token." });
      }

      const apiPath = "/api/v2/product/init_tier_variation";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}`;

      const modelPayload = (body.model || []).map((m: any) => ({
        tier_index: m.tier_index,
        original_price: Number(m.original_price || m.price || 0),
        model_sku: String(m.model_sku || m.sku || "").trim(),
        seller_stock: m.seller_stock || [
          {
            stock: Number(m.normal_stock || m.stock || 100),
          },
        ],
      }));

      const payload = {
        item_id: itemId,
        tier_variation: body.tier_variation || [],
        model: modelPayload,
      };

      const tierRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const tierData = await safeFetchJson(tierRes);

      if (tierData.error) {
        return res.status(400).json({
          error: tierData.message || tierData.error,
          detail: tierData,
        });
      }

      return res.status(200).json({
        success: true,
        itemId,
        response: tierData.response,
      });
    }

    // 10. ACTION: LẤY THÔNG TIN SẢN PHẨM TRÊN SÀN (GET ITEM BASE INFO)
    if (action === "get_item_base_info" || action === "get_item_info") {
      let shopId = String(body.shop_id || body.shopId || req.query.shop_id || "").trim();
      let accessToken = String(body.access_token || body.accessToken || "").trim();
      const itemIdList = body.item_id_list || [Number(body.item_id || body.itemId || req.query.item_id)];

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
        return res.status(400).json({ error: "Thiếu shop_id hoặc access_token." });
      }

      const apiPath = "/api/v2/product/get_item_base_info";
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeeSignature(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
      const itemParam = itemIdList.map((id: any) => `item_id_list=${Number(id)}`).join("&");
      const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}&${itemParam}`;

      const itemRes = await fetch(url);
      const itemData = await safeFetchJson(itemRes);

      if (itemData.error) {
        return res.status(400).json({
          error: itemData.message || itemData.error,
          detail: itemData,
        });
      }

      return res.status(200).json({
        success: true,
        itemList: itemData.response?.item_list || [],
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("Shopee Proxy Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
