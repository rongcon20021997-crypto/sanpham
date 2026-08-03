import { Upload, X, Loader2, Crop } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "@/lib/helpers";
import { ImageCropperModal } from "./ImageCropperModal";

interface ImageUploadProps {
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  accept?: string;
  heightClass?: string;
  customCode?: string;
  oldUrl?: string | null;
}

export function ImageUpload({
  folder,
  value,
  onChange,
  label = "Ảnh",
  accept = "image/*",
  heightClass = "h-36 sm:h-40",
  customCode,
  oldUrl,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file, folder, customCode, oldUrl || value);
      if (url) {
        onChange(url);
      } else {
        setError("Tải ảnh thất bại. Vui lòng thử lại.");
      }
    } catch (err) {
      setError((err as Error).message || "Lỗi tải ảnh");
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <div
        className={`relative ${heightClass} w-full rounded-xl border-2 border-dashed border-slate-700/50 overflow-hidden bg-slate-800/30 group transition-all`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-contain p-2" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 p-1 rounded-lg bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center text-slate-500 hover:text-brand-400 hover:bg-brand-500/5 transition-colors p-3"
          >
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-brand-400" />
            ) : (
              <>
                <Upload size={22} />
                <span className="text-xs mt-1.5 font-medium">Tải ảnh lên</span>
              </>
            )}
          </button>
        )}
        {value && !uploading && (
          <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setCropperOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500/90 text-white text-xs font-medium backdrop-blur-sm border border-brand-400/30 hover:bg-brand-600 transition-colors shadow-md"
            >
              <Crop size={13} /> Sửa & Cắt
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-slate-200 text-xs backdrop-blur-sm border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              Đổi ảnh
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}

      {value && (
        <ImageCropperModal
          open={cropperOpen}
          onClose={() => setCropperOpen(false)}
          imageUrl={value}
          onSave={(newUrl) => onChange(newUrl)}
          folder={folder}
          customCode={customCode}
          oldUrl={oldUrl || value}
        />
      )}
    </div>
  );
}
