import { Upload, X, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "@/lib/helpers";

interface ImageUploadProps {
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  accept?: string;
  heightClass?: string;
}

export function ImageUpload({
  folder,
  value,
  onChange,
  label = "Ảnh",
  accept = "image/*",
  heightClass = "h-36 sm:h-40",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file, folder);
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-900/80 text-slate-200 text-xs opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-slate-700"
          >
            Đổi ảnh
          </button>
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
    </div>
  );
}
