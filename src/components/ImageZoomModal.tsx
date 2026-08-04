import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { ZoomIn, ZoomOut, RotateCcw, Eye } from "lucide-react";

interface ImageZoomModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export function ImageZoomModal({ open, onClose, imageUrl, title = "Xem ảnh phóng to HD" }: ImageZoomModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      setZoomLevel(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, imageUrl]);

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

  if (!open || !imageUrl) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-3">
        {/* Toolbar điều khiển Thu phóng HD */}
        <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Eye size={15} className="text-brand-400" />
            <span className="font-medium">Mức phóng to:</span>
            <span className="font-mono font-bold text-brand-400">{Math.round(zoomLevel * 100)}%</span>
          </div>

          <div className="flex items-center gap-2">
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
              className="w-24 sm:w-32 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
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
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1 px-2.5 font-medium"
              title="Đặt lại 100%"
            >
              <RotateCcw size={13} /> <span>100%</span>
            </button>
          </div>
        </div>

        {/* Khung hiển thị ảnh và kéo rê khi zoom */}
        <div
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative aspect-square w-full max-h-[460px] mx-auto rounded-2xl bg-slate-950 border-2 border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-2xl ${
            zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
        >
          <img
            src={imageUrl}
            alt=""
            style={{
              transform: `scale(${zoomLevel}) translate(${offset.x / zoomLevel}px, ${offset.y / zoomLevel}px)`,
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
            className="max-h-full max-w-full object-contain pointer-events-none drop-shadow-2xl"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-400 pt-1">
          <span>💡 Lăn con trỏ chuột hoặc di chuyển thanh trượt để soi chi tiết nét in HD.</span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
