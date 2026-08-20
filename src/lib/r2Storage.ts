import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Tải file GỐC trực tiếp từ trình duyệt React lên Cloudflare R2
 * Nếu có file cũ trùng tên, tự động di chuyển (Move) sang folder /archive/ kèm timestamp.
 */
export async function uploadOriginalToR2(
  file: File,
  folder: string,
  code?: string
): Promise<string | null> {
  // Đọc động thông số từ .env (để nhận giá trị ngay sau khi người dùng vừa chỉnh file .env)
  const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
  const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || "tshirt-assets-hd";
  const publicDomain = import.meta.env.VITE_R2_PUBLIC_DOMAIN;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.info("⚡ [Cloudflare R2]: Chưa điền đủ VITE_R2_ACCOUNT_ID, VITE_R2_ACCESS_KEY_ID, VITE_R2_SECRET_ACCESS_KEY trong file .env.");
    return null;
  }

  try {
    const r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const ext = file.name.split(".").pop() || "png";
    const sanitizedCode = code ? code.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase() : "";
    const baseKey = sanitizedCode ? `${folder}/${sanitizedCode}.${ext}` : `${folder}/${Date.now()}_${file.name}`;

    // 1. Kiểm tra xem file cũ đã tồn tại ở vị trí chính chưa (nếu có thì lưu vết archive)
    if (sanitizedCode) {
      try {
        await r2Client.send(
          new HeadObjectCommand({
            Bucket: bucketName,
            Key: baseKey,
          })
        );

        // Nếu file cũ tồn tại ➔ Copy sang folder /archive/ với tên kèm Timestamp
        const nowStr = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
        const archiveKey = `${folder}/archive/${sanitizedCode}_${nowStr}.${ext}`;

        await r2Client.send(
          new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `${bucketName}/${baseKey}`,
            Key: archiveKey,
          })
        );

        // Xóa file cũ ở vị trí chính sau khi đã bảo tồn sang archive
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: baseKey,
          })
        );
        console.log(`⚡ [Cloudflare R2]: Đã di chuyển file cũ sang ${archiveKey}`);
      } catch {
        // File cũ chưa tồn tại, bỏ qua bước archive
      }
    }

    // 2. Upload file GỐC mới lên Cloudflare R2
    const arrayBuffer = await file.arrayBuffer();
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: baseKey,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
      })
    );

    console.log(`✅ [Cloudflare R2]: Tải file gốc HD thành công -> Key: ${baseKey}`);

    if (publicDomain) {
      const cleanDomain = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;
      return `${cleanDomain}/${baseKey}`;
    }
    return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${baseKey}`;
  } catch (err) {
    console.error("❌ [Cloudflare R2 Upload Error]:", err);
    console.warn(
      "💡 LƯU Ý BẢO MẬT BĂNG THÔNG R2 (CORS): Nếu trình duyệt báo lỗi NetworkError/CORS, bạn cần vào Cloudflare Dashboard -> R2 -> Bucket 'tshirt-assets-hd' -> Settings -> CORS Policy và dán cấu hình cho phép 'http://localhost:5173'."
    );
    return null;
  }
}

/**
 * Lấy URL file GỐC HD từ Cloudflare R2 để thực hiện cắt/sửa ảnh ở chất lượng gốc cao nhất
 */
export function getR2OriginalUrl(
  folder: string,
  code?: string,
  fallbackUrl?: string | null
): string | null {
  const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || "tshirt-assets-hd";
  const publicDomain = import.meta.env.VITE_R2_PUBLIC_DOMAIN;

  const sanitizedCode = code ? code.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase() : "";

  if (sanitizedCode) {
    const key = `${folder}/${sanitizedCode}.png`;
    const t = Date.now();
    if (publicDomain) {
      const cleanDomain = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;
      return `${cleanDomain}/${key}?t=${t}`;
    }
    if (accountId) {
      return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}?t=${t}`;
    }
  }

  return fallbackUrl || null;
}

/**
 * Tự động chuyển đổi bất kỳ URL ảnh (Supabase / local) sang URL ảnh GỐC HD từ Cloudflare R2
 */
export function getHdImageUrl(
  urlOrCode: string | null | undefined,
  folder: string = "designs",
  code?: string
): string | null {
  if (!urlOrCode) return null;

  const publicDomain = import.meta.env.VITE_R2_PUBLIC_DOMAIN;
  if (!publicDomain) return urlOrCode;

  const cleanDomain = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;

  // Nếu domain cấu hình là S3 API endpoint (.r2.cloudflarestorage.com) thay vì public domain (pub-xxx.r2.dev hoặc custom domain),
  // trình duyệt mở trực tiếp sẽ bị lỗi XML Authorization. Do đó trả về URL ảnh trực tiếp đang có.
  if (cleanDomain.includes(".r2.cloudflarestorage.com")) {
    return urlOrCode;
  }

  // Nếu url đã là link R2 public domain thì trả về luôn
  if (urlOrCode.includes(cleanDomain)) {
    return urlOrCode;
  }

  // 1. Nếu có code tường minh
  if (code) {
    const sanitizedCode = code.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase();
    return `${cleanDomain}/${folder}/${sanitizedCode}.png`;
  }

  // 2. Nếu là link Supabase Storage (e.g. .../tshirt-assets/designs/SKULL_01.webp or .../blanks/CT220_DEN.webp)
  const match = urlOrCode.match(/\/tshirt-assets\/([^?#]+)/);
  if (match && match[1]) {
    const assetPath = match[1];
    if (assetPath.startsWith("products/mockups/")) {
      return `${cleanDomain}/${assetPath}`;
    }
    const pathNoExt = assetPath.replace(/\.[^/.]+$/, "");
    return `${cleanDomain}/${pathNoExt}.png`;
  }

  return urlOrCode;
}

/**
 * Tải ảnh vào đối tượng HTMLImageElement với ưu tiên lấy ảnh GỐC HD từ Cloudflare R2
 * Nếu link R2 lỗi (hoặc chưa đồng bộ), tự động fallback về link ban đầu để không bao giờ bị gãy ảnh.
 */
export async function loadImageWithR2Priority(
  url: string,
  folder: string = "designs",
  code?: string
): Promise<HTMLImageElement> {
  const r2Url = getHdImageUrl(url, folder, code);
  const img = new Image();
  img.crossOrigin = "anonymous";

  return new Promise((resolve, reject) => {
    if (r2Url && r2Url !== url) {
      img.src = r2Url;
      img.onload = () => {
        console.info(`⚡ [R2 HD]: Tải ảnh gốc HD thành công từ R2: ${r2Url}`);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`⚠️ [R2 Fallback]: Không tải được từ R2 (${r2Url}), tự động chuyển về link dự phòng.`);
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = "anonymous";
        fallbackImg.src = url;
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = (e) => reject(e);
      };
    } else {
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
    }
  });
}

