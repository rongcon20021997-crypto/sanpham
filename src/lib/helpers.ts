import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./types";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function compressImageForPreview(
  file: File,
  maxWidth = 600,
  quality = 0.70
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
            const compressedFile = new File([blob], `${cleanName}.webp`, {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export async function uploadFile(
  file: File,
  folder: string,
  customCode?: string,
  oldUrl?: string | null
): Promise<string | null> {
  try {
    const originalFile = file; // Giữ nguyên file GỐC độ phân giải HD chưa nén

    // 1. Nén ảnh siêu nhẹ (WebP 600px, quality 0.70) dành riêng cho Supabase Storage để xem trước mượt mà
    const compressedFile = await compressImageForPreview(file, 600, 0.70);

    let fileName = "";
    const sanitizedCode = customCode ? customCode.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase() : "";

    if (sanitizedCode) {
      const ext = compressedFile.name.split(".").pop() || "webp";
      fileName = `${folder}/${sanitizedCode}.${ext}`;
    } else {
      const ext = compressedFile.name.split(".").pop() || "webp";
      fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    }

    // 2. Upload file nén siêu nhẹ vào Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("tshirt-assets")
      .upload(fileName, compressedFile, { cacheControl: "3600", upsert: true });

    let publicUrl: string | null = null;
    if (!uploadError) {
      const { data } = supabase.storage
        .from("tshirt-assets")
        .getPublicUrl(fileName);
      if (data?.publicUrl) publicUrl = data.publicUrl;
    }

    // 3. Đồng thời gửi file GỐC (chưa nén) tới Node.js Worker Service (nếu có) để đẩy sang Cloudflare R2 & Google Drive
    syncOriginalFileToR2AndDrive(originalFile, folder, sanitizedCode).catch((err) => {
      console.info("Node.js Worker status (Cloudflare R2 & Google Drive sync):", (err as Error).message);
    });

    if (publicUrl) return `${publicUrl}?t=${Date.now()}`;

    console.warn("Supabase Storage error, falling back to Data URL:", uploadError?.message);
    return await fileToDataUrl(compressedFile);
  } catch (err) {
    console.error("Upload error, using fallback Data URL:", err);
    try {
      return await fileToDataUrl(file);
    } catch {
      return null;
    }
  }
}

import { uploadOriginalToR2 } from "./r2Storage";
import { uploadOriginalToGoogleDrive } from "./googleDriveStorage";
import { getSyncSettingsState } from "@/context/SyncContext";

async function syncOriginalFileToR2AndDrive(
  file: File,
  folder: string,
  code?: string
): Promise<void> {
  const { enableR2, enableDrive } = getSyncSettingsState();

  // 1. Upload trực tiếp từ trình duyệt React lên Cloudflare R2 (nếu đang BẬT)
  if (enableR2) {
    await uploadOriginalToR2(file, folder, code);
  } else {
    console.info("⚡ [Sync]: Đã bỏ qua R2 vì đồng bộ Cloudflare R2 đang TẮT.");
  }

  // 2. Upload trực tiếp từ trình duyệt React lên Google Drive (nếu đang BẬT)
  if (enableDrive) {
    await uploadOriginalToGoogleDrive(file, folder, code);
  } else {
    console.info("⚡ [Sync]: Đã bỏ qua Google Drive vì đồng bộ Google Drive đang TẮT.");
  }

  // 3. Nếu có Node.js server phụ trợ, đồng bộ thêm nếu cần
  const nodeServerUrl = import.meta.env.VITE_NODE_SERVER_URL;
  if (nodeServerUrl && (enableR2 || enableDrive)) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      if (code) formData.append("code", code);

      await fetch(`${nodeServerUrl}/api/storage/upload-original`, {
        method: "POST",
        body: formData,
      });
    } catch {
      // Bỏ qua nếu Node server chưa bật
    }
  }
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    });
}

export function usernameToEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@gmail.com`;
}

export function emailToUsername(email: string): string {
  if (!email) return "";
  if (email.endsWith("@gmail.com")) return email.slice(0, -10);
  if (email.endsWith("@app.com")) return email.slice(0, -8);
  if (email.endsWith("@app.local")) return email.slice(0, -10);
  if (email.includes("@")) return email.split("@")[0];
  return email;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function callUserManagement<T>(payload: Record<string, unknown>): Promise<T> {
  const action = payload.action as string;

  if (action === "list") {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data } as unknown as T;
  }

  if (action === "update") {
    const userId = payload.userId as string;
    const updates: Record<string, unknown> = {};
    if (payload.fullName !== undefined) updates.full_name = payload.fullName;
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.role !== undefined) updates.role = payload.role;
    if (payload.status !== undefined) updates.status = payload.status;

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return { data } as unknown as T;
  }

  if (action === "delete") {
    const userId = payload.userId as string;
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (error) throw error;
    return { data: { id: userId } } as unknown as T;
  }

  if (action === "create") {
    const email = payload.email as string;
    const password = payload.password as string;
    const fullName = (payload.fullName as string) || "";
    const phone = (payload.phone as string) || "";
    const role = (payload.role as string) || "staff";

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authErr } = await tempClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (authErr) throw authErr;

    if (authData.user) {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          phone: phone || null,
          role: role || "staff",
        })
        .eq("id", authData.user.id);

      return { data: { id: authData.user.id, email } } as unknown as T;
    }
  }

  throw new Error("Action không hợp lệ");
}

export function formatColorName(colorCode: string | null | undefined): string {
  if (!colorCode) return "Chưa xác định";
  const code = colorCode.trim().toUpperCase();

  const colorMap: Record<string, string> = {
    D: "Đen",
    DEN: "Đen",
    BLACK: "Đen",
    T: "Trắng",
    TRANG: "Trắng",
    WHITE: "Trắng",
    DO: "Đỏ",
    RED: "Đỏ",
    V: "Vàng",
    YELLOW: "Vàng",
    XD: "Xanh Dương",
    BLUE: "Xanh Dương",
    XL: "Xanh Lá",
    GREEN: "Xanh Lá",
    X: "Xám",
    GREY: "Xám",
    GRAY: "Xám",
    H: "Hồng",
    PINK: "Hồng",
    C: "Cam",
    ORANGE: "Cam",
    K: "Kem",
    BEIGE: "Kem",
    KM: "Khoai Môn",
  };

  return colorMap[code] || colorCode;
}

