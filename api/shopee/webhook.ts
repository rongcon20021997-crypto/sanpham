import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://iwtgbtrdztgkrwbkwrza.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_6YeCPmKiElJQmSAxcS9juA_0j5M8vKa";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SHOPEE_PUSH_TOPICS: Record<number, string> = {
  0: "Test Push / Ping Verification (Kiểm tra kết nối)",
  1: "Shop Authorization (Cấp quyền gian hàng)",
  2: "Shop Deauthorization (Hủy cấp quyền gian hàng)",
  3: "Order Status Update (Cập nhật trạng thái đơn hàng)",
  4: "Tracking Number Update (Cập nhật mã vận đơn)",
  5: "Buyer Webchat Message (Tin nhắn chat khách hàng)",
  6: "Item Status / Banned Update (Cập nhật trạng thái sản phẩm / duyệt)",
  7: "Reserved Stock Change (Thay đổi tồn kho giữ chỗ)",
  8: "Item Promotion Update (Cập nhật khuyến mãi sản phẩm)",
  9: "Order Tracking No Update (Mã theo dõi đơn hàng)",
  10: "Brand Registration Result (Kết quả duyệt thương hiệu)",
  11: "Shopee Open API Test (Test đẩy thông báo từ Shopee Console)",
  12: "Shop Performance Update (Hiệu suất vận hành shop)",
  15: "Video / Live Status Update (Trạng thái Video & Live)",
};

export default async function handler(req: any, res: any) {
  // CORS Headers cho Shopee
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopee-Signature");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const timestamp = new Date().toISOString();
  let payload: any = req.body || {};
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = { raw: payload };
    }
  }

  const query = req.query || {};
  const code = payload?.code ?? query?.code ?? (req.body ? 11 : 0);
  const shopId = String(payload?.shop_id ?? query?.shop_id ?? payload?.data?.shop_id ?? "");
  const topic = SHOPEE_PUSH_TOPICS[Number(code)] || `Event Code: ${code}`;
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";

  console.log(`[Shopee Webhook] [${timestamp}] Code: ${code} (${topic}) | Shop: ${shopId}`);

  // Lưu log vào Supabase bất đồng bộ (không làm chậm phản hồi Shopee)
  try {
    await supabase.from("shopee_webhook_logs").insert({
      shop_id: shopId || null,
      code: Number(code) || 0,
      topic: topic,
      payload: {
        body: payload,
        query: query,
        method: req.method,
      },
      ip: String(ip),
      created_at: timestamp,
    });
  } catch (dbErr) {
    console.warn("Không thể lưu webhook log vào Supabase:", dbErr);
  }

  // Luôn phản hồi HTTP 200 OK ngay lập tức theo chuẩn Shopee Push Mechanism
  return res.status(200).json({
    code: 0,
    message: "success",
    received_at: timestamp,
  });
}
