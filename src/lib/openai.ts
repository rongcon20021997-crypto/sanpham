/**
 * OpenAI API Client & Shopee Optimization Engine
 */

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  customPrompt?: string;
}

export interface ShopeeOptimizationResult {
  shopee_name: string;
  shopee_description: string;
  keywords: string[];
  hashtags: string[];
}

export interface ProductOptimizationInput {
  masterName: string;
  masterCode?: string;
  blankTypeName?: string;
  designNames?: string[];
  designThemes?: string[];
  colors?: string[];
  sizes?: string[];
  price?: number;
  printPositionType?: string; // "front" | "back" | "both"
}

const STORAGE_KEY_API_KEY = "meobao_openai_api_key";
const STORAGE_KEY_MODEL = "meobao_openai_model";
const STORAGE_KEY_CUSTOM_PROMPT = "meobao_openai_custom_prompt";

export function getOpenAiApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_API_KEY) || "";
}

export function setOpenAiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
}

export function getOpenAiModel(): string {
  if (typeof window === "undefined") return "gpt-4o-mini";
  return localStorage.getItem(STORAGE_KEY_MODEL) || "gpt-4o-mini";
}

export function setOpenAiModel(model: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_MODEL, model.trim());
}

export function getOpenAiCustomPrompt(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_CUSTOM_PROMPT) || "";
}

export function setOpenAiCustomPrompt(prompt: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_CUSTOM_PROMPT, prompt.trim());
}

/**
 * Kiểm tra tính hợp lệ của OpenAI API Key
 */
export async function testOpenAiConnection(apiKey?: string): Promise<{ success: boolean; message: string; models?: string[] }> {
  const key = apiKey || getOpenAiApiKey();
  if (!key) {
    return { success: false, message: "Chưa nhập OpenAI API Key." };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `Lỗi kết nối OpenAI (${res.status})`;
      return { success: false, message: errMsg };
    }

    const data = await res.json();
    const modelIds = Array.isArray(data.data) ? data.data.map((m: any) => m.id).slice(0, 10) : [];
    return {
      success: true,
      message: "Kết nối OpenAI API thành công! API Key hoàn toàn hợp lệ.",
      models: modelIds,
    };
  } catch (err) {
    return {
      success: false,
      message: `Không thể kết nối tới OpenAI API: ${(err as Error).message}`,
    };
  }
}

/**
 * Tối ưu Tên & Mô tả sản phẩm chuẩn SEO Shopee bằng OpenAI AI
 */
export async function generateShopeeOptimization(
  input: ProductOptimizationInput,
  options?: { apiKey?: string; model?: string; customPrompt?: string }
): Promise<ShopeeOptimizationResult> {
  const apiKey = options?.apiKey || getOpenAiApiKey();
  const model = options?.model || getOpenAiModel() || "gpt-4o-mini";
  const customPrompt = options?.customPrompt || getOpenAiCustomPrompt();

  if (!apiKey) {
    throw new Error("Chưa cấu hình OpenAI API Key. Vui lòng vào Cài đặt -> AI OpenAI để thiết lập.");
  }

  const systemPrompt = `Bạn là chuyên gia E-Commerce hàng đầu chuyên tối ưu SEO và viết nội dung bán hàng trên sàn thương mại điện tử Shopee Việt Nam cho thương hiệu thời trang local brand "MEO BAO".

Nhiệm vụ của bạn: Dựa vào thông tin phôi áo, hình in, màu sắc, size và phong cách, hãy tạo ra:
1. "shopee_name": Tên sản phẩm chuẩn SEO Shopee.
   - Cấu trúc: [Loại sản phẩm] [Tên hình in / Họa tiết nổi bật] [Chất liệu & Form dáng] MEO BAO [Từ khóa Hot Trends]
   - Quy định: Độ dài từ 80 đến 120 ký tự (tối đa 120 ký tự), viết hoa chữ cái đầu mỗi từ chính, KHÔNG dùng icon hay ký tự đặc biệt lạ trong tiêu đề.
   - Luôn chứa từ khóa thương hiệu "MEO BAO".
   - Ví dụ mẫu: Áo Thun Tay Lỡ Unisex In Hình Mèo Phi Hành Gia Cotton 100% 250gsm Form Rộng MEO BAO Streetwear Vintage

2. "shopee_description": Mô tả sản phẩm chuẩn Shopee cực kỳ cuốn hút, phân chia bố cục rõ ràng bằng các biểu tượng icon:
   - 🌟 ĐIỂM NỔI BẬT & PHONG CÁCH THIẾT KẾ
   - 🧵 CHẤT LIỆU VẢI & CÔNG NGHỆ IN (Nêu rõ vải cotton dày dặn, thấm hút mồ hôi, hình in sắc nét bền màu, không bong tróc)
   - 📐 HƯỚNG DẪN CHỌN SIZE (Liệt kê các size S, M, L, XL, XXL kèm chiều cao & cân nặng gợi ý)
   - 🧼 HƯỚNG DẪN GIẶT & BẢO QUẢN
   - 🎁 CHÍNH SÁCH CAM KẾT & ĐỔI TRẢ CỦA SHOP MEO BAO
   - 🏷️ BỘ HASHTAGS PHÙ HỢP

3. "keywords": Danh sách 5-8 từ khóa tìm kiếm chính.
4. "hashtags": Danh sách 10-15 hashtags phù hợp dạng #tag.

YÊU CẦU ĐẶC BIỆT: Phải trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc:
{
  "shopee_name": "Tên sản phẩm tối ưu dưới 120 ký tự",
  "shopee_description": "Nội dung mô tả đầy đủ với các icon",
  "keywords": ["từ khóa 1", "từ khóa 2"],
  "hashtags": ["#aothun", "#meobao", "#aothununisex"]
}`;

  const userContent = `Hãy tối ưu sản phẩm sau để đăng lên Shopee:
- Tên sản phẩm hiện tại: ${input.masterName}
- Mã sản phẩm: ${input.masterCode || "SP"}
- Loại phôi áo: ${input.blankTypeName || "Áo Thun Cotton Oversize"}
- Tên hình in: ${(input.designNames || []).join(", ") || "Họa tiết đồ họa"}
- Chủ đề / Phong cách: ${(input.designThemes || []).join(", ") || "Streetwear, Thời trang giới trẻ"}
- Các màu sắc có sẵn: ${(input.colors || []).join(", ") || "Đen, Trắng"}
- Bảng size có sẵn: ${(input.sizes || []).join(", ") || "S, M, L, XL, XXL"}
- Giá bán tham khảo: ${input.price ? input.price.toLocaleString("vi-VN") + " VND" : "250.000 VND"}
${customPrompt ? `\nLƯU Ý THÊM TỪ NGƯỜI DÙNG: ${customPrompt}` : ""}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Lỗi từ OpenAI API (Mã lỗi ${response.status})`
    );
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(rawText) as ShopeeOptimizationResult;
    return {
      shopee_name: parsed.shopee_name || input.masterName,
      shopee_description: parsed.shopee_description || "",
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
  } catch (parseErr) {
    throw new Error("Không thể đọc định dạng JSON trả về từ OpenAI.");
  }
}
