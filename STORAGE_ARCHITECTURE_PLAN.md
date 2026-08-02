# 📐 KIẾN TRÚC LƯU TRỮ & QUY TRÌNH XỬ LÝ HÌNH ÁNH (STORAGE & IMAGE WORKFLOW PLAN)

Tài liệu quy định giải pháp lưu trữ, nén ảnh, quy tắc đặt tên và quản lý lịch sử thay thế file cho **Hình phôi (Blank Types)** và **Hình in (Print Designs)**.

---

## 🚀 1. Tổng Quan Mô Hình Lưu Trữ 3 Lớp (Hybrid 3-Tier Storage)

Khi người dùng upload **Hình phôi** hoặc **Hình in**:

```text
               [ Nguời Dùng Upload Hình Phôi / Hình In Gốc (15MB - 30MB) ]
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
      1. Client Nén Ảnh (WebP ~100KB)             2. Giữ Nguyên File Gốc (PNG/PSD 300DPI)
                      │                                           │
                      ▼                         ┌─────────────────┴─────────────────┐
            [ Supabase Storage ]                ▼                                   ▼
          (Hiển thị UI System nhanh)    [ Cloudflare R2 ]                   [ Google Drive ]
                                     (Kho lưu trữ gốc chính)             (Kho backup xưởng in)
```

---

## 🏷️ 2. Quy Tắc Đặt Tên File (Naming Convention)

Tất cả các file lưu trữ **PHẢI** được đặt tên chuẩn hóa theo **Mã Phôi** hoặc **Mã Hình In**:

* **Đối với Hình phôi:** `PHOI_{MA_PHOI}.ext` (Ví dụ: `PHOI_TSHIRT_OVERSIZE_BLK.png` hoặc `.webp`)
* **Đối với Hình in:** `HINHIN_{MA_HINH_IN}.ext` (Ví dụ: `HINHIN_DRAGON_V1.png` hoặc `.webp`)

---

## 🔄 3. Quy Trình Xử Lý Khi Thêm Mới vs. Cập Nhật (Add vs. Update Workflow)

### 🟢 A. Trường hợp THÊM MỚI (Create / New Upload)
1. **Client (React):** Tự động nén ảnh gốc thành dạng WebP (rộng 800px, quality 82%, dung lượng ~100KB).
2. **Supabase Storage:** Upload file nén `PHOI_TSHIRT_OVERSIZE_BLK.webp` ➔ Dùng hiển thị trên UI Web.
3. **Cloudflare R2:** Upload file gốc `PHOI_TSHIRT_OVERSIZE_BLK.png` vào thư mục chính `/blanks/` (hoặc `/prints/`).
4. **Google Drive:** Upload file gốc `PHOI_TSHIRT_OVERSIZE_BLK.png` vào thư mục backup xưởng `/GoogleDrive/XuongIn/Blanks/`.

---

### 🟡 B. Trường hợp CẬP NHẬT / UPLOAD HÌNH KHÁC THAY THẾ (Update / Replace)

Khi người dùng đổi hình phôi/hình in mới cho mã đã tồn tại:

1. **Di chuyển (Move) & Lưu vết file cũ trên Cloudflare R2 và Google Drive:**
   * File gốc cũ đang tồn tại ở thư mục chính sẽ được tự động **di chuyển (Move)** sang thư mục lưu trữ lịch sử `/archive/` (hoặc `/history/`).
   * **Đổi tên file cũ khi archive:** Thêm mốc thời gian xóa/thay thế vào cuối tên file:
     $$\text{Tên\_File\_Cũ} + \text{\_} + \text{Timestamp}$$
     *(Ví dụ file cũ từ `PHOI_TSHIRT_OVERSIZE_BLK.png` ➔ Đổi tên thành `PHOI_TSHIRT_OVERSIZE_BLK_20260802_213600.png` nằm trong thư mục `/archive/`)*.

2. **Ghi đè file mới ở thư mục chính:**
   * File gốc mới tải lên sẽ được lưu vào vị trí chính đúng với tên gốc mặc định: `PHOI_TSHIRT_OVERSIZE_BLK.png`.
   * **Trên Supabase Storage:** Nén ảnh mới và ghi đè (`upsert: true`) lên file `.webp` hiện tại để giao diện Web hiển thị ngay lập tức hình ảnh mới nhất.

---

## 💻 4. Luồng Code Logic Xử Lý Thay Thế File (Pseudo Code)

```javascript
// Minh họa hàm Update File Hình Phôi / Hình In
async function handleUpdateImage({ itemCode, itemType, newOriginalFile }) {
  const fileExt = newOriginalFile.name.split('.').pop(); // png, jpg...
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14); // YYYYMMDDHHmmss
  
  const baseFileName = `${itemType.toUpperCase()}_${itemCode}`; // VD: PHOI_A01
  const mainFileName = `${baseFileName}.${fileExt}`;            // PHOI_A01.png
  const archiveFileName = `${baseFileName}_${timestamp}.${fileExt}`; // PHOI_A01_20260802213600.png

  // Step 1: Kiểm tra xem File cũ đã tồn tại trên Cloudflare R2 / Drive chưa
  const hasOldFile = await checkFileExistsOnR2(mainFileName);
  
  if (hasOldFile) {
    // Di chuyển (Move/Rename) file cũ sang thư mục Archive
    await moveR2File(`/main/${mainFileName}`, `/archive/${archiveFileName}`);
    await moveGoogleDriveFile(`/main/${mainFileName}`, `/archive/${archiveFileName}`);
  }

  // Step 2: Upload file gốc MỚI vào vị trí chính (Main Folder)
  await uploadToR2(`/main/${mainFileName}`, newOriginalFile);
  await uploadToGoogleDrive(`/main/${mainFileName}`, newOriginalFile);

  // Step 3: Nén ảnh nhỏ gửi lên Supabase Storage (Hiển thị UI)
  const compressedWebpBlob = await compressImageForPreview(newOriginalFile);
  await supabase.storage
    .from('system-previews')
    .upload(`${baseFileName}.webp`, compressedWebpBlob, { upsert: true });

  console.log("Cập nhật và lưu vết lịch sử ảnh thành công!");
}
```

---

## 🎨 5. Hàm Nén Ảnh Phía Client (Browser)

```javascript
async function compressImageForPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Chiều rộng tối đa cho ảnh xem trên UI System
        const scaleSize = MAX_WIDTH / img.width;
        
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Nén sang định dạng WebP với chất lượng 82% (không vỡ nét)
        canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.82);
      };
    };
  });
}
```

---

*Tài liệu này được cập nhật bổ sung quy chuẩn quản lý lịch sử file (Versioning/Archive) theo yêu cầu hệ thống.*
