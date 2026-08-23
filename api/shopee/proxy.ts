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

const FASHION_ATTR_SYNONYMS: Record<string, string[]> = {
  "thương hiệu": ["thương hiệu", "brand"],
  "chất liệu": ["chất liệu", "material", "fabric", "vật liệu", "thành phần"],
  "xuất xứ": ["xuất xứ", "origin", "country of origin", "nơi sản xuất", "quốc gia sản xuất"],
  "cổ áo": ["cổ áo", "neckline", "collar", "cổ"],
  "dịp": ["dịp", "occasion", "hoàn cảnh"],
  "mẫu": ["mẫu", "pattern", "họa tiết", "kẻ/sọc", "hoa văn", "graphic"],
  "mùa": ["mùa", "season"],
  "chiều dài tay áo": ["chiều dài tay áo", "tay áo", "sleeve length", "sleeve"],
  "phong cách": ["phong cách", "style"],
  "chiều dài áo": ["chiều dài áo", "top length", "length", "dáng áo"],
  "cropped top": ["cropped top", "crop top", "áo croptop", "croptop", "áo lửng"],
  "petite": ["petite", "dáng người nhỏ", "ngoại cỡ", "plus size"],
};

const FASHION_VAL_SYNONYMS: Record<string, string[]> = {
  "cotton": ["cotton", "100% cotton", "thun cotton", "cotton compact", "cotton 100%"],
  "việt nam": ["việt nam", "vietnam", "trong nước", "viet nam", "vn"],
  "cổ tròn": ["cổ tròn", "round neck", "crew neck", "round"],
  "cổ v": ["cổ v", "v neck", "v-neck", "cổ tim"],
  "cổ bẻ": ["cổ bẻ", "cổ polo", "polo", "collar", "cổ gập"],
  "hàng ngày": ["hàng ngày", "thường ngày", "dạo phố", "casual", "daily", "đi chơi"],
  "in hình": ["in hình", "graphic", "print", "họa tiết", "chữ", "printed"],
  "trơn": ["trơn", "plain", "solid", "basic"],
  "bốn mùa": ["bốn mùa", "all seasons", "mùa hè", "summer", "four seasons", "all season"],
  "tay ngắn": ["tay ngắn", "ngắn tay", "short sleeve", "short", "short sleeves"],
  "tay lỡ": ["tay lỡ", "tay lửng", "3/4 sleeve", "half sleeve"],
  "tay dài": ["tay dài", "dài tay", "long sleeve", "long", "long sleeves"],
  "đường phố": ["đường phố", "streetwear", "street style", "cơ bản", "basic", "unisex", "hàn quốc", "korean", "tối giản"],
  "tiêu chuẩn": ["tiêu chuẩn", "standard", "regular", "dài vừa", "oversize", "dáng rộng"],
  "không": ["không", "no", "false", "không có", "n/a"],
  "có": ["có", "yes", "true", "có sẵn"],
};

// Bảng thuộc tính cứng cho các danh mục phổ biến trên Shopee VN
// Lấy từ sản phẩm mẫu đã cấu hình thủ công trên Seller Center (SP 55666504846, category 100352)
// Vì API get_attributes đã bị Shopee tạm ngưng (api_suspended), đây là cách duy nhất để có attribute_id thật
interface CategoryAttrDef {
  attribute_id: number;
  original_attribute_name: string;
  user_keys: string[]; // Các tên tiếng Việt & tiếng Anh để khớp với giá trị từ form
  known_values: Record<string, number>; // value_name (lowercase) -> value_id
}

const CATEGORY_ATTR_TEMPLATES: Record<number, CategoryAttrDef[]> = {
  // Category 100352: Thời trang > Áo thun (T-Shirts / Tops)
  100352: [
    {
      attribute_id: 100134,
      original_attribute_name: "Material",
      user_keys: ["chất liệu", "material", "fabric"],
      known_values: { "cotton": 1149, "polyester": 1150, "linen": 1153, "silk": 1154, "nylon": 1156 },
    },
    {
      attribute_id: 100037,
      original_attribute_name: "Region of Origin",
      user_keys: ["xuất xứ", "origin", "region of origin", "nơi sản xuất"],
      known_values: { "vietnam": 136, "china": 44, "japan": 100, "korea": 107, "thailand": 194 },
    },
    {
      attribute_id: 100154,
      original_attribute_name: "Neckline",
      user_keys: ["cổ áo", "neckline", "collar"],
      known_values: { "round neck": 1434, "v-neck": 1437, "crew neck": 1431, "polo": 1435, "turtleneck": 1438 },
    },
    {
      attribute_id: 100155,
      original_attribute_name: "Occasion",
      user_keys: ["dịp", "occasion"],
      known_values: { "casual": 1387, "formal": 1388, "party": 1389, "sports": 1390, "travel": 1391 },
    },
    {
      attribute_id: 100162,
      original_attribute_name: "Pattern",
      user_keys: ["mẫu", "pattern", "họa tiết"],
      known_values: { "print": 1486, "plain": 1484, "striped": 1488, "graphic": 1483, "plaid": 1485, "letter": 1487 },
    },
    {
      attribute_id: 100161,
      original_attribute_name: "Petite",
      user_keys: ["petite"],
      known_values: { "no": 1446, "yes": 1445 },
    },
    {
      attribute_id: 100168,
      original_attribute_name: "Sleeve Length",
      user_keys: ["chiều dài tay áo", "tay áo", "sleeve length", "sleeve"],
      known_values: { "short sleeves": 1500, "long sleeves": 1498, "sleeveless": 1501, "3/4 sleeves": 1497, "half sleeves": 1499 },
    },
    {
      attribute_id: 100169,
      original_attribute_name: "Style",
      user_keys: ["phong cách", "style"],
      known_values: { "basic": 1504, "streetwear": 1511, "korean": 1507, "vintage": 1513, "minimalist": 1508, "unisex": 1512 },
    },
    {
      attribute_id: 100170,
      original_attribute_name: "Top Length",
      user_keys: ["chiều dài áo", "top length", "length"],
      known_values: { "regular": 1514, "long": 1515, "short": 1516, "cropped": 1517 },
    },
    {
      attribute_id: 100150,
      original_attribute_name: "Cropped Top",
      user_keys: ["cropped top", "crop top"],
      known_values: { "no": 1359, "yes": 1358 },
    },
  ],
};

async function normalizeShopeeAttributes(
  rawAttributes: any,
  categoryId: number,
  partnerId: string,
  partnerKey: string,
  accessToken: string,
  shopId: string,
  host: string
): Promise<{ attributeList: any[]; brand: any; debug?: any }> {
  let brandObj: any = { brand_id: 0, original_brand_name: "NoBrand" };
  const resultList: any[] = [];
  const debugInfo: any = { userAttrMap: {}, shopeeAttrNames: [], matchResults: [], rawShopeeResponse: null, rawShopeeError: null };

  if (!categoryId || !rawAttributes) {
    debugInfo.earlyReturn = "Missing categoryId or rawAttributes";
    return { attributeList: resultList, brand: brandObj, debug: debugInfo };
  }

  // Chuyển rawAttributes thành map key -> value
  const userAttrMap = new Map<string, string>();
  if (Array.isArray(rawAttributes)) {
    for (const item of rawAttributes) {
      if (item && typeof item === "object") {
        const name = String(item.attribute_name || item.name || item.key || item.original_attribute_name || "").trim();
        const val = String(item.attribute_value || item.value || item.value_name || "").trim();
        if (name && val) {
          userAttrMap.set(name.toLowerCase(), val);
        }
      }
    }
  } else if (typeof rawAttributes === "object") {
    for (const [k, v] of Object.entries(rawAttributes)) {
      if (v && String(v).trim()) {
        userAttrMap.set(k.toLowerCase().trim(), String(v).trim());
      }
    }
  }

  // Save debug
  for (const [k, v] of userAttrMap.entries()) {
    debugInfo.userAttrMap[k] = v;
  }

  // Xử lý Brand riêng
  for (const [uKey, uVal] of userAttrMap.entries()) {
    if (uKey === "thương hiệu" || uKey === "brand") {
      brandObj = { brand_id: 0, original_brand_name: uVal || "NoBrand" };
    }
  }

  // Kéo danh sách thuộc tính chuẩn của ngành hàng từ Shopee API
  try {
    const attrPath = "/api/v2/product/get_attributes";
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSignature(partnerId, partnerKey, attrPath, timestamp, accessToken, shopId);
    const url = `${host}${attrPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign}&category_id=${Number(categoryId)}&language=vi`;
    const res = await fetch(url);
    const data = await safeFetchJson(res);
    let shopeeAttrs = data.response?.attribute_list || [];

    debugInfo.rawShopeeResponse = {
      error: data.error || null,
      message: data.message || null,
      attrCount: shopeeAttrs.length,
      categoryId,
    };

    // Retry without language param if empty
    if (shopeeAttrs.length === 0) {
      const ts2 = Math.floor(Date.now() / 1000);
      const sign2 = generateShopeeSignature(partnerId, partnerKey, attrPath, ts2, accessToken, shopId);
      const url2 = `${host}${attrPath}?partner_id=${Number(partnerId)}&timestamp=${ts2}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${sign2}&category_id=${Number(categoryId)}`;
      const res2 = await fetch(url2);
      const data2 = await safeFetchJson(res2);
      shopeeAttrs = data2.response?.attribute_list || [];
      debugInfo.rawShopeeResponse.retryAttrCount = shopeeAttrs.length;
      debugInfo.rawShopeeResponse.retryError = data2.error || null;
    }

    // Log tất cả tên thuộc tính Shopee trả về
    for (const sAttr of shopeeAttrs) {
      debugInfo.shopeeAttrNames.push({
        id: sAttr.attribute_id,
        orig: sAttr.original_attribute_name,
        disp: sAttr.display_attribute_name,
        mandatory: sAttr.is_mandatory,
        inputType: sAttr.input_type,
        valueCount: (sAttr.attribute_value_list || []).length,
      });
    }

    for (const sAttr of shopeeAttrs) {
      const origName = (sAttr.original_attribute_name || "").toLowerCase().trim();
      const dispName = (sAttr.display_attribute_name || "").toLowerCase().trim();
      const attrId = Number(sAttr.attribute_id);
      if (!attrId) continue;

      // Tìm xem người dùng có gán giá trị cho thuộc tính này không
      let userVal = "";
      let matchMethod = "";
      for (const [uKey, uVal] of userAttrMap.entries()) {
        // Kiểm tra khớp trực tiếp
        if (uKey === origName || uKey === dispName) {
          userVal = uVal;
          matchMethod = `exact: uKey="${uKey}" == origName="${origName}" or dispName="${dispName}"`;
          break;
        }
        if (origName.includes(uKey) || dispName.includes(uKey) || uKey.includes(origName) || uKey.includes(dispName)) {
          userVal = uVal;
          matchMethod = `substring: uKey="${uKey}" <> origName="${origName}" / dispName="${dispName}"`;
          break;
        }

        // Kiểm tra qua từ điển đồng nghĩa (Synonyms)
        for (const [standardKey, synList] of Object.entries(FASHION_ATTR_SYNONYMS)) {
          const isUKeyMatch = uKey === standardKey || synList.includes(uKey);
          const isShopeeMatch = synList.some((syn) => origName === syn || dispName === syn || origName.includes(syn) || dispName.includes(syn) || syn.includes(origName) || syn.includes(dispName));
          if (isUKeyMatch && isShopeeMatch) {
            userVal = uVal;
            matchMethod = `synonym: standardKey="${standardKey}", uKey="${uKey}", origName="${origName}", dispName="${dispName}"`;
            break;
          }
        }
        if (userVal) break;
      }

      // Bỏ qua Brand trong attribute_list nếu Shopee yêu cầu truyền qua brand object
      if ((origName === "brand" || dispName === "thương hiệu") && sAttr.input_type !== "DROP_DOWN") {
        debugInfo.matchResults.push({ attrId, origName, dispName, skipped: "brand", userVal });
        continue;
      }

      if (userVal) {
        // Tìm value_id chính xác trong danh sách giá trị của Shopee
        let matchedValueId = 0;
        let finalValueName = userVal;
        const uValLower = userVal.toLowerCase().trim();
        let valueMatchMethod = "none";

        if (Array.isArray(sAttr.attribute_value_list) && sAttr.attribute_value_list.length > 0) {
          // 1. Khớp chính xác tên
          let valMatch = sAttr.attribute_value_list.find(
            (v: any) =>
              (v.original_value_name && v.original_value_name.toLowerCase().trim() === uValLower) ||
              (v.display_value_name && v.display_value_name.toLowerCase().trim() === uValLower)
          );

          // 2. Khớp qua từ điển giá trị đồng nghĩa
          if (!valMatch) {
            for (const [stdVal, valSyns] of Object.entries(FASHION_VAL_SYNONYMS)) {
              if (uValLower === stdVal || valSyns.includes(uValLower)) {
                valMatch = sAttr.attribute_value_list.find((v: any) => {
                  const oName = (v.original_value_name || "").toLowerCase().trim();
                  const dName = (v.display_value_name || "").toLowerCase().trim();
                  return valSyns.some((syn) => oName === syn || dName === syn || oName.includes(syn) || dName.includes(syn));
                });
                if (valMatch) {
                  valueMatchMethod = `synonym: stdVal="${stdVal}"`;
                  break;
                }
              }
            }
          } else {
            valueMatchMethod = "exact";
          }

          // 3. Khớp chuỗi con
          if (!valMatch) {
            valMatch = sAttr.attribute_value_list.find(
              (v: any) =>
                (v.original_value_name && (v.original_value_name.toLowerCase().includes(uValLower) || uValLower.includes(v.original_value_name.toLowerCase()))) ||
                (v.display_value_name && (v.display_value_name.toLowerCase().includes(uValLower) || uValLower.includes(v.display_value_name.toLowerCase())))
            );
            if (valMatch) valueMatchMethod = "substring";
          }

          if (valMatch) {
            matchedValueId = Number(valMatch.value_id || 0);
            finalValueName = valMatch.original_value_name || valMatch.display_value_name || userVal;
          }
        }

        resultList.push({
          attribute_id: attrId,
          attribute_value_list: [
            {
              value_id: matchedValueId,
              original_value_name: finalValueName,
            },
          ],
        });

        debugInfo.matchResults.push({
          attrId,
          origName,
          dispName,
          userVal,
          matchMethod,
          matchedValueId,
          finalValueName,
          valueMatchMethod,
        });
      } else {
        // Nếu là thuộc tính bắt buộc mà không match, vẫn ghi lại debug
        debugInfo.matchResults.push({
          attrId,
          origName,
          dispName,
          mandatory: sAttr.is_mandatory,
          noMatch: true,
        });
      }
    }
  } catch (err: any) {
    debugInfo.rawShopeeError = err.message || String(err);
    console.warn("Lỗi chuẩn hóa Shopee attributes:", err);
  }

  return { attributeList: resultList, brand: brandObj, debug: debugInfo };
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
      const catId = Number(body.category_id || body.categoryId || 0);
      const { attributeList: validAttributeList, brand: resolvedBrand } = await normalizeShopeeAttributes(
        body.attribute_list,
        catId,
        partnerId,
        partnerKey,
        accessToken,
        shopId,
        host
      );

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
        category_id: catId,
        image: {
          image_id_list: imageIdList,
        },
        brand: body.brand || resolvedBrand,
        item_sku: String(body.item_sku || body.master_code || "").trim(),
        seller_stock: sellerStock,
      };

      if (validAttributeList && validAttributeList.length > 0) {
        payload.attribute_list = validAttributeList;
      }

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
      let catId = body.category_id ? Number(body.category_id) : 0;

      // Lấy thông tin sản phẩm hiện có từ Shopee (bao gồm attribute_list thực tế)
      let existingItem: any = null;
      try {
        const infoPath = "/api/v2/product/get_item_base_info";
        const infoTimestamp = Math.floor(Date.now() / 1000);
        const infoSign = generateShopeeSignature(partnerId, partnerKey, infoPath, infoTimestamp, accessToken, shopId);
        const infoUrl = `${host}${infoPath}?partner_id=${Number(partnerId)}&timestamp=${infoTimestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${infoSign}&item_id_list=${itemId}`;
        const infoRes = await fetch(infoUrl);
        const infoData = await safeFetchJson(infoRes);
        existingItem = infoData.response?.item_list?.[0] || null;
        if (existingItem?.category_id && !catId) {
          catId = Number(existingItem.category_id);
        }
      } catch (infoErr) {
        console.warn("Không thể lấy thông tin item hiện có:", infoErr);
      }

      // Xây dựng attribute_list bằng cách ghép giá trị user vào attribute_id thực của sản phẩm
      let validAttributeList: any[] | undefined = undefined;
      let resolvedBrand: any = undefined;
      let attrDebug: any = { method: "get_item_base_info_merge" };

      // Chuyển rawAttributes từ body thành map key -> value
      const userAttrMap = new Map<string, string>();
      const rawAttrs = body.attribute_list;
      if (Array.isArray(rawAttrs)) {
        for (const item of rawAttrs) {
          if (item && typeof item === "object") {
            const name = String(item.attribute_name || item.name || item.key || item.original_attribute_name || "").trim();
            const val = String(item.attribute_value || item.value || item.value_name || "").trim();
            if (name && val) {
              userAttrMap.set(name.toLowerCase(), val);
            }
          }
        }
      } else if (rawAttrs && typeof rawAttrs === "object") {
        for (const [k, v] of Object.entries(rawAttrs)) {
          if (v && String(v).trim()) {
            userAttrMap.set(k.toLowerCase().trim(), String(v).trim());
          }
        }
      }

      attrDebug.userAttrMap = Object.fromEntries(userAttrMap);

      // Xử lý Brand
      for (const [uKey, uVal] of userAttrMap.entries()) {
        if (uKey === "thương hiệu" || uKey === "brand") {
          resolvedBrand = { brand_id: 0, original_brand_name: uVal || "NoBrand" };
        }
      }
      if (!resolvedBrand) {
        resolvedBrand = { brand_id: 0, original_brand_name: "NoBrand" };
      }

      // Lấy attribute_list hiện có từ sản phẩm và ghép giá trị mới
      const existingAttrs = existingItem?.attribute_list || [];
      attrDebug.existingAttrCount = existingAttrs.length;
      attrDebug.existingAttrs = existingAttrs.map((a: any) => ({
        id: a.attribute_id,
        name: a.attribute_name,
        values: (a.attribute_value_list || []).map((v: any) => ({ id: v.value_id, name: v.original_value_name })),
      }));

      if (existingAttrs.length > 0 && userAttrMap.size > 0) {
        const mergedList: any[] = [];
        const matchResults: any[] = [];

        for (const eAttr of existingAttrs) {
          const attrId = Number(eAttr.attribute_id);
          const attrName = (eAttr.attribute_name || "").toLowerCase().trim();
          if (!attrId) continue;

          // Tìm giá trị user cho thuộc tính này
          let userVal = "";
          let matchMethod = "";

          // 1. Khớp trực tiếp theo tên
          for (const [uKey, uVal] of userAttrMap.entries()) {
            if (uKey === attrName || attrName.includes(uKey) || uKey.includes(attrName)) {
              userVal = uVal;
              matchMethod = `direct: uKey="${uKey}" <> attrName="${attrName}"`;
              break;
            }
          }

          // 2. Khớp qua từ điển đồng nghĩa
          if (!userVal) {
            for (const [uKey, uVal] of userAttrMap.entries()) {
              for (const [standardKey, synList] of Object.entries(FASHION_ATTR_SYNONYMS)) {
                const isUKeyMatch = uKey === standardKey || synList.includes(uKey);
                const isAttrMatch = synList.some((syn) => attrName === syn || attrName.includes(syn) || syn.includes(attrName));
                if (isUKeyMatch && isAttrMatch) {
                  userVal = uVal;
                  matchMethod = `synonym: standardKey="${standardKey}", uKey="${uKey}", attrName="${attrName}"`;
                  break;
                }
              }
              if (userVal) break;
            }
          }

          if (userVal) {
            // Sử dụng giá trị hiện có của attribute (nếu có) để lấy value_id, hoặc dùng value_id=0
            const existingValues = eAttr.attribute_value_list || [];
            let matchedValueId = 0;
            let finalValueName = userVal;
            const uValLower = userVal.toLowerCase().trim();

            // Tìm value_id từ danh sách giá trị hiện có
            if (existingValues.length > 0) {
              const valMatch = existingValues.find((v: any) => {
                const oName = (v.original_value_name || "").toLowerCase().trim();
                return oName === uValLower || oName.includes(uValLower) || uValLower.includes(oName);
              });
              if (valMatch) {
                matchedValueId = Number(valMatch.value_id || 0);
                finalValueName = valMatch.original_value_name || userVal;
              }
            }

            // Kiểm tra qua từ điển giá trị đồng nghĩa
            if (!matchedValueId && existingValues.length > 0) {
              for (const [stdVal, valSyns] of Object.entries(FASHION_VAL_SYNONYMS)) {
                if (uValLower === stdVal || valSyns.includes(uValLower)) {
                  const valMatch = existingValues.find((v: any) => {
                    const oName = (v.original_value_name || "").toLowerCase().trim();
                    return valSyns.some((syn) => oName === syn || oName.includes(syn) || syn.includes(oName));
                  });
                  if (valMatch) {
                    matchedValueId = Number(valMatch.value_id || 0);
                    finalValueName = valMatch.original_value_name || userVal;
                    break;
                  }
                }
              }
            }

            mergedList.push({
              attribute_id: attrId,
              attribute_value_list: [
                {
                  value_id: matchedValueId,
                  original_value_name: finalValueName,
                },
              ],
            });

            matchResults.push({ attrId, attrName, userVal, matchMethod, matchedValueId, finalValueName });
          } else {
            // Giữ nguyên giá trị cũ cho thuộc tính không thay đổi
            if (eAttr.attribute_value_list && eAttr.attribute_value_list.length > 0) {
              mergedList.push({
                attribute_id: attrId,
                attribute_value_list: eAttr.attribute_value_list.map((v: any) => ({
                  value_id: Number(v.value_id || 0),
                  original_value_name: v.original_value_name || "",
                })),
              });
              matchResults.push({ attrId, attrName, kept: "existing", existingValue: eAttr.attribute_value_list[0]?.original_value_name });
            }
          }
        }

        if (mergedList.length > 0) {
          validAttributeList = mergedList;
        }
        attrDebug.matchResults = matchResults;
      } else {
        // Fallback: dùng bảng thuộc tính cứng (CATEGORY_ATTR_TEMPLATES) cho danh mục này
        attrDebug.fallback = "using CATEGORY_ATTR_TEMPLATES";
        const template = CATEGORY_ATTR_TEMPLATES[catId];
        if (template && userAttrMap.size > 0) {
          const templateList: any[] = [];
          const templateResults: any[] = [];

          for (const tAttr of template) {
            // Tìm giá trị user cho thuộc tính này
            let userVal = "";
            let matchMethod = "";

            for (const [uKey, uVal] of userAttrMap.entries()) {
              if (tAttr.user_keys.some(k => uKey === k || uKey.includes(k) || k.includes(uKey))) {
                userVal = uVal;
                matchMethod = `template: uKey="${uKey}" matched user_keys=[${tAttr.user_keys.join(",")}]`;
                break;
              }
            }

            // Nếu không khớp trực tiếp, thử qua từ điển đồng nghĩa
            if (!userVal) {
              for (const [uKey, uVal] of userAttrMap.entries()) {
                for (const [standardKey, synList] of Object.entries(FASHION_ATTR_SYNONYMS)) {
                  const isUKeyMatch = uKey === standardKey || synList.includes(uKey);
                  const isAttrMatch = tAttr.user_keys.some(k => synList.includes(k) || synList.some(syn => k.includes(syn) || syn.includes(k)));
                  if (isUKeyMatch && isAttrMatch) {
                    userVal = uVal;
                    matchMethod = `template+synonym: standardKey="${standardKey}", uKey="${uKey}"`;
                    break;
                  }
                }
                if (userVal) break;
              }
            }

            if (userVal) {
              const uValLower = userVal.toLowerCase().trim();

              // Tìm value_id từ bảng known_values
              let matchedValueId = 0;
              let finalValueName = userVal;

              // 1. Khớp trực tiếp trong known_values
              if (tAttr.known_values[uValLower] !== undefined) {
                matchedValueId = tAttr.known_values[uValLower];
                // Lấy tên chính xác (giữ case gốc)
                for (const [vName, vId] of Object.entries(tAttr.known_values)) {
                  if (vName === uValLower) {
                    // Capitalize first letter of each word
                    finalValueName = vName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                    break;
                  }
                }
              }

              // 2. Khớp qua từ điển giá trị đồng nghĩa (FASHION_VAL_SYNONYMS)
              if (!matchedValueId) {
                for (const [stdVal, valSyns] of Object.entries(FASHION_VAL_SYNONYMS)) {
                  if (uValLower === stdVal || valSyns.includes(uValLower)) {
                    // Tìm giá trị chuẩn trong known_values qua synonym
                    for (const syn of valSyns) {
                      if (tAttr.known_values[syn] !== undefined) {
                        matchedValueId = tAttr.known_values[syn];
                        finalValueName = syn.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                        break;
                      }
                    }
                    if (matchedValueId) break;
                  }
                }
              }

              templateList.push({
                attribute_id: tAttr.attribute_id,
                attribute_value_list: [
                  {
                    value_id: matchedValueId,
                    original_value_name: finalValueName,
                  },
                ],
              });

              templateResults.push({
                attrId: tAttr.attribute_id,
                attrName: tAttr.original_attribute_name,
                userVal,
                matchMethod,
                matchedValueId,
                finalValueName,
              });
            }
          }

          if (templateList.length > 0) {
            validAttributeList = templateList;
          }
          attrDebug.templateMatchResults = templateResults;
        } else {
          attrDebug.noTemplate = `No template for category ${catId}`;
        }
      }

      const payload: any = {
        item_id: itemId,
        item_name: String(body.item_name || body.name || "").trim() || undefined,
        description: String(body.description || "").trim() || undefined,
        category_id: catId > 0 ? catId : undefined,
        original_price: body.original_price ? Number(body.original_price) : undefined,
        weight: body.weight ? Number(body.weight) : undefined,
        dimension: body.dimension ? {
          package_height: Number(body.dimension.package_height || 5),
          package_length: Number(body.dimension.package_length || 20),
          package_width: Number(body.dimension.package_width || 15),
        } : undefined,
        brand: body.brand || resolvedBrand,
        item_sku: body.item_sku ? String(body.item_sku).trim() : undefined,
        attribute_list: validAttributeList,
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
          _attrDebug: attrDebug,
          _payloadSent: { attribute_list: payload.attribute_list, category_id: payload.category_id, brand: payload.brand },
        });
      }

      return res.status(200).json({
        success: true,
        itemId,
        response: updateData.response,
        _attrDebug: attrDebug,
        _payloadSent: { attribute_list: payload.attribute_list, category_id: payload.category_id, brand: payload.brand },
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

      let tierRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let tierData = await safeFetchJson(tierRes);

      // Nếu sản phẩm đã tồn tại phân loại (update thay vì tạo mới), tự động gọi update_tier_variation
      if (tierData.error) {
        console.warn("init_tier_variation failed, attempting update_tier_variation:", tierData.message || tierData.error);
        const updateApiPath = "/api/v2/product/update_tier_variation";
        const updateSign = generateShopeeSignature(partnerId, partnerKey, updateApiPath, timestamp, accessToken, shopId);
        const updateUrl = `${host}${updateApiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${Number(shopId)}&sign=${updateSign}`;

        tierRes = await fetch(updateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: itemId,
            tier_variation: body.tier_variation || [],
          }),
        });
        const updateTierData = await safeFetchJson(tierRes);

        if (!updateTierData.error) {
          tierData = updateTierData;
        }
      }

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
