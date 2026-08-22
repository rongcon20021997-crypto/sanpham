export default async function handler(req: any, res: any) {
  // Thiết lập Headers CORS cho Shopee
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopee-Signature");

  // Xử lý preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const payload = req.body;
    console.log("Shopee Webhook / Push Notification Received:", {
      method: req.method,
      query: req.query,
      body: payload,
    });

    // Shopee yêu cầu bắt buộc phản hồi HTTP 200 OK
    return res.status(200).json({
      code: 0,
      message: "success",
    });
  } catch (error) {
    console.error("Shopee Webhook Handler Error:", error);
    return res.status(200).json({
      code: 0,
      message: "received",
    });
  }
}
