import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function generateShopeeSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number): Promise<string> {
  const baseString = `${partnerId}${apiPath}${timestamp}`;
  const enc = new TextEncoder();
  const keyData = enc.encode(partnerKey);
  const msgData = enc.encode(baseString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const results: any[] = [];
  const errors: any[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Lấy cấu hình Shopee Partner ID & Key
    const { data: configData, error: configError } = await supabase
      .from("shopee_app_configs")
      .select("partner_id, partner_key, environment")
      .eq("id", 1)
      .maybeSingle();

    if (configError || !configData?.partner_id || !configData?.partner_key) {
      return new Response(
        JSON.stringify({ error: "Chưa cấu hình Shopee Partner ID hoặc Partner Key trong database." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const partnerId = configData.partner_id.trim();
    const partnerKey = configData.partner_key.trim();
    const host =
      configData.environment === "production"
        ? "https://partner.shopeemobile.com"
        : "https://partner.test-stable.shopeemobile.com";

    // 2. Lấy danh sách tất cả các Shop đang kết nối có refresh_token
    const { data: shops, error: shopsError } = await supabase
      .from("shopee_shops")
      .select("id, shop_id, shop_name, refresh_token, token_expires_at, status")
      .not("refresh_token", "is", null);

    if (shopsError) {
      throw shopsError;
    }

    if (!shops || shops.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Không có Shop nào cần làm mới token.", refreshedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = Date.now();
    // Làm mới nếu token hết hạn trong vòng 2.5 giờ (hoặc đã hết hạn)
    const REFRESH_THRESHOLD_MS = 2.5 * 60 * 60 * 1000;

    for (const shop of shops) {
      const expiresAt = shop.token_expires_at ? Number(shop.token_expires_at) : 0;
      const isExpiringSoon = !expiresAt || expiresAt - now < REFRESH_THRESHOLD_MS;

      // Cho phép ép làm mới nếu url có query force=true
      const urlObj = new URL(req.url);
      const isForce = urlObj.searchParams.get("force") === "true";

      if (!isExpiringSoon && !isForce) {
        results.push({
          shopId: shop.shop_id,
          shopName: shop.shop_name,
          status: "skipped",
          reason: `Token vẫn còn hạn tới ${new Date(expiresAt).toLocaleString("vi-VN")}`,
        });
        continue;
      }

      try {
        const apiPath = "/api/v2/auth/access_token/get";
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = await generateShopeeSign(partnerId, partnerKey, apiPath, timestamp);
        const url = `${host}${apiPath}?partner_id=${Number(partnerId)}&timestamp=${timestamp}&sign=${sign}`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partner_id: Number(partnerId),
            shop_id: Number(shop.shop_id),
            refresh_token: shop.refresh_token,
          }),
        });

        const data = await resp.json();

        if (data.error || !data.access_token) {
          const errDetail = data.message || data.error || "Shopee API error";
          errors.push({ shopId: shop.shop_id, shopName: shop.shop_name, error: errDetail });
          // Cập nhật trạng thái shop nếu refresh token bị thu hồi
          if (data.error === "error_auth" || data.error === "error_permission") {
            await supabase.from("shopee_shops").update({
              status: "expired",
              updated_at: new Date().toISOString(),
            }).eq("id", shop.id);
          }
          continue;
        }

        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token || shop.refresh_token;
        const expireIn = data.expire_in || 14400; // 4h
        const tokenExpiresAt = Date.now() + expireIn * 1000;

        await supabase.from("shopee_shops").update({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_expires_at: tokenExpiresAt,
          status: "connected",
          updated_at: new Date().toISOString(),
        }).eq("id", shop.id);

        results.push({
          shopId: shop.shop_id,
          shopName: shop.shop_name,
          status: "success",
          expiresAt: new Date(tokenExpiresAt).toLocaleString("vi-VN"),
        });
      } catch (shopErr: any) {
        errors.push({
          shopId: shop.shop_id,
          shopName: shop.shop_name,
          error: shopErr.message || "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        totalShops: shops.length,
        refreshedCount: results.filter((r) => r.status === "success").length,
        results,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
