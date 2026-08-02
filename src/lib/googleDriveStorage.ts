// Đọc cấu hình Google Drive từ file .env
const googleScriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

/**
 * Tải file GỐC trực tiếp từ trình duyệt React lên Google Drive
 * Sử dụng Google Apps Script Web App (Miễn phí, không cần server Node.js)
 */
export async function uploadOriginalToGoogleDrive(
  file: File,
  folder: string,
  code?: string
): Promise<string | null> {
  if (!googleScriptUrl) {
    console.info("⚡ [Google Drive]: Chưa cấu hình VITE_GOOGLE_SCRIPT_URL trong .env. Bỏ qua đồng bộ Google Drive.");
    return null;
  }

  try {
    const ext = file.name.split(".").pop() || "png";
    const sanitizedCode = code ? code.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase() : "";
    const fileName = sanitizedCode ? `${sanitizedCode}.${ext}` : file.name;

    // Chuyển file thành dạng Base64 để gửi qua Google Apps Script Web App
    const base64Data = await fileToBase64(file);

    const payload = {
      action: "upload",
      fileName,
      folderName: folder,
      code: sanitizedCode || "",
      fileData: base64Data.split(",")[1] || base64Data,
      mimeType: file.type || "application/octet-stream",
    };

    const res = await fetch(googleScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`✅ [Google Drive]: Đồng bộ file lên Google Drive thành công -> ${data.fileUrl || data.id}`);
      return data.fileUrl || null;
    }
    return null;
  } catch (err) {
    console.error("❌ [Google Drive Upload Error]:", err);
    return null;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/*
====================================================================================
📄 MÃ GOOGLE APPS SCRIPT DÙNG TRÊN GOOGLE DRIVE (TẠO MIỄN PHÍ TRÊN GOOGLE DRIVE CỦA BẠN):
====================================================================================
1. Truy cập https://script.google.com -> Tạo Dự án mới (New Project)
2. Dán đoạn mã bên dưới vào:

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderName = data.folderName || "TShirtAssets";
    var fileName = data.fileName;
    var fileData = Utilities.base64Decode(data.fileData);
    var blob = Utilities.newBlob(fileData, data.mimeType, fileName);

    // Lấy hoặc tạo Thư mục trên Google Drive
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    // Nếu file đã tồn tại, move sang folder archive
    var existingFiles = folder.getFilesByName(fileName);
    if (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      var archiveFolder = folder.getFoldersByName("archive").hasNext() 
        ? folder.getFoldersByName("archive").next() 
        : folder.createFolder("archive");
      
      var timeStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
      var oldExt = fileName.substring(fileName.lastIndexOf("."));
      var baseName = fileName.substring(0, fileName.lastIndexOf("."));
      
      oldFile.setName(baseName + "_" + timeStr + oldExt);
      oldFile.moveTo(archiveFolder);
    }

    // Tạo file mới
    var newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileUrl: newFile.getUrl(),
      fileId: newFile.getId()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

3. Bấm "Triển khai" (Deploy) -> "Nhà bản mới" (New Deployment) 
   -> Chọn Loại: "Ứng dụng web" (Web App)
   -> Thực thi dưới dạng: "Tôi" (Me)
   -> Ai có quyền truy cập: "Bất kỳ ai" (Anyone)
4. Copy Web App URL thu được và dán vào VITE_GOOGLE_SCRIPT_URL trong file .env
====================================================================================
*/
