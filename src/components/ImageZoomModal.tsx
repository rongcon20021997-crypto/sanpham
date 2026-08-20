import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/Modal";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { getHdImageUrl } from "@/lib/r2Storage";

export interface ZoomImageItem {
  url: string;
  title?: string;
  label?: string;
  color?: string;
}

interface ImageZoomModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  images?: ZoomImageItem[];
  initialIndex?: number;
}

export function ImageZoomModal({
  open,
  onClose,
  imageUrl,
  title = "Xem ảnh phóng to HD",
  images = [],
  initialIndex = 0,
}: ImageZoomModalProps) {
  // Chuẩn hóa danh sách ảnh (nếu truyền imageUrl đơn lẻ hoặc mảng images)
  const allImages: ZoomImageItem[] =
    images.length > 0
      ? images
      : imageUrl
      ? [{ url: imageUrl, title }]
      : [];

  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      const idx = initialIndex >= 0 && initialIndex < allImages.length ? initialIndex : 0;
      setCurrentIndex(idx);
      setZoomLevel(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, initialIndex, imageUrl, images.length]);

  // Reset zoom khi chuyển ảnh
  function handleSelectImage(idx: number) {
    if (idx >= 0 && idx < allImages.length) {
      setCurrentIndex(idx);
      setZoomLevel(1);
      setOffset({ x: 0, y: 0 });
    }
  }

  function handlePrev() {
    if (allImages.length <= 1) return;
    const prevIdx = (currentIndex - 1 + allImages.length) % allImages.length;
    handleSelectImage(prevIdx);
  }

  function handleNext() {
    if (allImages.length <= 1) return;
    const nextIdx = (currentIndex + 1) % allImages.length;
    handleSelectImage(nextIdx);
  }

  // Bắt phím mũi tên Trái / Phải để chuyển ảnh
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, allImages.length]);

  function handleZoomIn() {
    setZoomLevel((prev) => Math.min(prev + 0.5, 4));
  }

  function handleZoomOut() {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function handleReset() {
    setZoomLevel(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel((prev) => Math.min(prev + 0.25, 4));
    } else {
      setZoomLevel((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setOffset({ x: 0, y: 0 });
        return next;
      });
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - startPosRef.current.x,
      y: e.clientY - startPosRef.current.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  if (!open || allImages.length === 0) return null;

  const currentItem = allImages[currentIndex] || allImages[0];
  const modalTitle = currentItem?.title || title;
  const r2DirectUrl = getHdImageUrl(currentItem?.url) || currentItem?.url || "#";

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="xl">
      <div className="space-y-3 select-none">
        {/* Toolbar điều khiển Thu phóng HD & Chỉ số ảnh */}
        <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="flex items-center gap-1.5">
              <Eye size={15} className="text-brand-400" />
              <span className="font-medium">Phóng to:</span>
              <span className="font-mono font-bold text-brand-400">{Math.round(zoomLevel * 100)}%</span>
            </div>
            {allImages.length > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                Ảnh {currentIndex + 1} / {allImages.length}
              </span>
            )}
            {currentItem?.label && (
              <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 font-semibold text-[11px] border border-brand-500/20">
                {currentItem.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
              title="Thu nhỏ (-)"
            >
              <ZoomOut size={15} />
            </button>
            <input
              type="range"
              min="1"
              max="4"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-20 sm:w-28 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 4}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
              title="Phóng to (+)"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1 px-2 font-medium"
              title="Đặt lại 100%"
            >
              <RotateCcw size={13} /> <span>100%</span>
            </button>

            {/* Nút Mở tab mới xem ảnh gốc R2 */}
            <a
              href={r2DirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 transition-colors flex items-center gap-1.5 px-2.5 font-semibold"
              title="Mở ảnh gốc trong tab mới để xem siêu rõ (Link R2 / Supabase)"
            >
              <ExternalLink size={13} />
              <span>Mở tab mới (Link R2)</span>
            </a>
          </div>
        </div>

        {/* Khung hiển thị ảnh lớn có hỗ trợ nút Next/Prev */}
        <div className="relative">
          {/* Nút mở tab mới nổi trên ảnh */}
          <a
            href={r2DirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/85 hover:bg-slate-900 text-brand-400 hover:text-brand-300 border border-slate-700/80 shadow-lg backdrop-blur-sm transition-all flex items-center gap-1.5 text-[11px] font-semibold z-10"
            title="Mở link ảnh gốc R2 trong tab mới"
          >
            <ExternalLink size={12} />
            <span>Mở link R2</span>
          </a>

          <div
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative aspect-square w-full max-h-[480px] mx-auto rounded-2xl bg-slate-950 border-2 border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-2xl ${
              zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
            }`}
          >
            <img
              src={currentItem.url}
              alt={currentItem.title || ""}
              style={{
                transform: `scale(${zoomLevel}) translate(${offset.x / zoomLevel}px, ${offset.y / zoomLevel}px)`,
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-2xl"
            />
          </div>

          {/* Nút lùi ảnh (Prev) */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-xl backdrop-blur-sm transition-all hover:scale-110"
              title="Ảnh trước (Phím ←)"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Nút tiến ảnh (Next) */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-xl backdrop-blur-sm transition-all hover:scale-110"
              title="Ảnh tiếp theo (Phím →)"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* DẢI THUMBNAIL TẤT CẢ CÁC BIẾN THỂ */}
        {allImages.length > 1 && (
          <div className="space-y-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="font-semibold text-slate-300">
                Toàn bộ ảnh biến thể & media ({allImages.length} ảnh):
              </span>
              <span>Bấm vào ảnh để chuyển nhanh</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
              {allImages.map((img, idx) => {
                const isSelected = idx === currentIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectImage(idx)}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all p-0.5 flex flex-col items-center justify-center ${
                      isSelected
                        ? "border-brand-500 bg-brand-500/10 shadow-md scale-105"
                        : "border-slate-800 hover:border-slate-600 bg-slate-900 opacity-70 hover:opacity-100"
                    }`}
                    title={img.label || img.title || `Ảnh ${idx + 1}`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-contain" />
                    {img.label && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] sm:text-[9px] font-bold text-slate-200 truncate px-0.5 text-center">
                        {img.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-400 pt-1">
          <span>💡 Dùng phím mũi tên ← / → để duyệt ảnh, lăn con trỏ chuột để soi chi tiết HD.</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={r2DirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink size={13} />
              <span>Mở tab mới (Link R2)</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
