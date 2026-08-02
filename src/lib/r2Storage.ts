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
