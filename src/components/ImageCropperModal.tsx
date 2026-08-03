import { useState, useRef, useEffect, useCallback } from "react";
import { Modal } from "./Modal";
import {
  Crop,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Wand2,
  RefreshCw,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
} from "lucide-react";
import { uploadFile } from "@/lib/helpers";
import { getR2OriginalUrl } from "@/lib/r2Storage";

interface ImageCropperModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  onSave: (newUrl: string) => Promise<void> | void;
  title?: string;
  folder?: string;
  customCode?: string;
  oldUrl?: string | null;
}

export function ImageCropperModal({
  open,
  onClose,
  imageUrl,
  onSave,
  title = "Cắt & Chỉnh sửa hình in",
  folder = "designs-png",
  customCode,
  oldUrl,
}: ImageCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [isHdR2, setIsHdR2] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Crop rectangle in normalized (0 to 1) relative coordinates to original image size
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });

  // Drag interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null); // 'move', 'tl', 'tr', 'bl', 'br'
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });

  // Load image: Prioritize HD original from Cloudflare R2, fallback to Supabase preview URL
  useEffect(() => {
    if (!open || !imageUrl) return;
    setLoadingImg(true);
    setError(null);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    setIsHdR2(false);

    let isCancelled = false;
    const r2Url = getR2OriginalUrl(folder, customCode, null);

    const tryLoadImage = (src: string, isR2: boolean): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => {
          if (!isCancelled) {
            setImageObj(img);
            setIsHdR2(isR2);
            setLoadingImg(false);
          }
          resolve(true);
        };
        img.onerror = () => {
          resolve(false);
        };
      });
    };

    (async () => {
      // 1. Ưu tiên tải file GỐC HD từ Cloudflare R2 trước
      if (r2Url) {
        const successR2 = await tryLoadImage(r2Url, true);
        if (successR2) return;
      }
      // 2. Fallback sang file preview Supabase nếu R2 chưa có hoặc lỗi
      const successDefault = await tryLoadImage(imageUrl, false);
      if (!successDefault && !isCancelled) {
        setError("Không thể tải hình ảnh. Vui lòng kiểm tra lại kết nối.");
        setLoadingImg(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [open, imageUrl, folder, customCode]);

  // Auto Trim Transparent pixels
  const handleAutoTrim = useCallback(() => {
    if (!imageObj) return;

    // Create offscreen canvas with original image dimensions
    const offCanvas = document.createElement("canvas");
    offCanvas.width = imageObj.naturalWidth;
    offCanvas.height = imageObj.naturalHeight;
    const ctx = offCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(imageObj, 0, 0);
    const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const data = imgData.data;

    let minX = offCanvas.width;
    let minY = offCanvas.height;
    let maxX = 0;
    let maxY = 0;
    let foundPixel = false;

    // Scan pixels for non-transparent alpha (> 10)
    for (let y = 0; y < offCanvas.height; y++) {
      for (let x = 0; x < offCanvas.width; x++) {
        const alpha = data[(y * offCanvas.width + x) * 4 + 3];
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foundPixel = true;
        }
      }
    }

    if (!foundPixel) {
      setError("Không tìm thấy vùng hình ảnh hợp lệ (ảnh trống hoàn toàn).");
      return;
    }

    // Add small 2px padding if possible
    minX = Math.max(0, minX - 2);
    minY = Math.max(0, minY - 2);
    maxX = Math.min(offCanvas.width, maxX + 2);
    maxY = Math.min(offCanvas.height, maxY + 2);

    const cropX = minX / offCanvas.width;
    const cropY = minY / offCanvas.height;
    const cropW = (maxX - minX) / offCanvas.width;
    const cropH = (maxY - minY) / offCanvas.height;

    setCrop({
      x: Math.max(0, Math.min(1, cropX)),
      y: Math.max(0, Math.min(1, cropY)),
      width: Math.max(0.01, Math.min(1, cropW)),
      height: Math.max(0.01, Math.min(1, cropH)),
    });
  }, [imageObj]);

  // Reset all adjustments
  function handleReset() {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
  }

  // Draw main canvas
  useEffect(() => {
    if (!canvasRef.current || !imageObj) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas container resolution
    const parentWidth = containerRef.current?.clientWidth || 600;
    const parentHeight = 450;
    canvas.width = parentWidth;
    canvas.height = parentHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate aspect ratio fit
    const imgAspect = imageObj.naturalWidth / imageObj.naturalHeight;
    let drawW = canvas.width * 0.85 * zoom;
    let drawH = drawW / imgAspect;

    if (drawH > canvas.height * 0.85 * zoom) {
      drawH = canvas.height * 0.85 * zoom;
      drawW = drawH * imgAspect;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw dark overlay outside crop box
    const cropPixelX = (centerX - drawW / 2) + crop.x * drawW;
    const cropPixelY = (centerY - drawH / 2) + crop.y * drawH;
    const cropPixelW = crop.width * drawW;
    const cropPixelH = crop.height * drawH;

    ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
    // Top
    ctx.fillRect(0, 0, canvas.width, cropPixelY);
    // Bottom
    ctx.fillRect(0, cropPixelY + cropPixelH, canvas.width, canvas.height - (cropPixelY + cropPixelH));
    // Left
    ctx.fillRect(0, cropPixelY, cropPixelX, cropPixelH);
    // Right
    ctx.fillRect(cropPixelX + cropPixelW, cropPixelY, canvas.width - (cropPixelX + cropPixelW), cropPixelH);

    // Draw crop border
    ctx.strokeStyle = "#38bdf8"; // brand sky color
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cropPixelX, cropPixelY, cropPixelW, cropPixelH);
    ctx.setLineDash([]);

    // Draw grid lines inside crop box
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical grid lines
    ctx.moveTo(cropPixelX + cropPixelW / 3, cropPixelY);
    ctx.lineTo(cropPixelX + cropPixelW / 3, cropPixelY + cropPixelH);
    ctx.moveTo(cropPixelX + (cropPixelW * 2) / 3, cropPixelY);
    ctx.lineTo(cropPixelX + (cropPixelW * 2) / 3, cropPixelY + cropPixelH);
    // Horizontal grid lines
    ctx.moveTo(cropPixelX, cropPixelY + cropPixelH / 3);
    ctx.lineTo(cropPixelX + cropPixelW, cropPixelY + cropPixelH / 3);
    ctx.moveTo(cropPixelX, cropPixelY + (cropPixelH * 2) / 3);
    ctx.lineTo(cropPixelX + cropPixelW, cropPixelY + (cropPixelH * 2) / 3);
    ctx.stroke();

    // Draw 4 corner handles
    const handleSize = 10;
    ctx.fillStyle = "#0284c7";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    const corners = [
      { x: cropPixelX, y: cropPixelY }, // TL
      { x: cropPixelX + cropPixelW, y: cropPixelY }, // TR
      { x: cropPixelX, y: cropPixelY + cropPixelH }, // BL
      { x: cropPixelX + cropPixelW, y: cropPixelY + cropPixelH }, // BR
    ];

    corners.forEach((c) => {
      ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    });
  }, [imageObj, rotation, flipH, flipV, zoom, crop]);

  // Handle Mouse / Touch down for crop box adjustment
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || !imageObj) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const parentWidth = canvasRef.current.width;
    const parentHeight = canvasRef.current.height;
    const imgAspect = imageObj.naturalWidth / imageObj.naturalHeight;

    let drawW = parentWidth * 0.85 * zoom;
    let drawH = drawW / imgAspect;

    if (drawH > parentHeight * 0.85 * zoom) {
      drawH = parentHeight * 0.85 * zoom;
      drawW = drawH * imgAspect;
    }

    const centerX = parentWidth / 2;
    const centerY = parentHeight / 2;

    const cropPixelX = (centerX - drawW / 2) + crop.x * drawW;
    const cropPixelY = (centerY - drawH / 2) + crop.y * drawH;
    const cropPixelW = crop.width * drawW;
    const cropPixelH = crop.height * drawH;

    const handleTol = 16;

    // Check corners
    if (Math.hypot(clickX - cropPixelX, clickY - cropPixelY) < handleTol) {
      setDragHandle("tl");
    } else if (Math.hypot(clickX - (cropPixelX + cropPixelW), clickY - cropPixelY) < handleTol) {
      setDragHandle("tr");
    } else if (Math.hypot(clickX - cropPixelX, clickY - (cropPixelY + cropPixelH)) < handleTol) {
      setDragHandle("bl");
    } else if (Math.hypot(clickX - (cropPixelX + cropPixelW), clickY - (cropPixelY + cropPixelH)) < handleTol) {
      setDragHandle("br");
    } else if (
      clickX >= cropPixelX &&
      clickX <= cropPixelX + cropPixelW &&
      clickY >= cropPixelY &&
      clickY <= cropPixelY + cropPixelH
    ) {
      setDragHandle("move");
    } else {
      return;
    }

    setIsDragging(true);
    setDragStart({ x: clickX, y: clickY });
    setCropStart({ ...crop });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging || !dragHandle || !canvasRef.current || !imageObj) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currX = e.clientX - rect.left;
    const currY = e.clientY - rect.top;

    const parentWidth = canvasRef.current.width;
    const parentHeight = canvasRef.current.height;
    const imgAspect = imageObj.naturalWidth / imageObj.naturalHeight;

    let drawW = parentWidth * 0.85 * zoom;
    let drawH = drawW / imgAspect;

    if (drawH > parentHeight * 0.85 * zoom) {
      drawH = parentHeight * 0.85 * zoom;
      drawW = drawH * imgAspect;
    }

    const dxNorm = (currX - dragStart.x) / drawW;
    const dyNorm = (currY - dragStart.y) / drawH;

    let newX = cropStart.x;
    let newY = cropStart.y;
    let newW = cropStart.width;
    let newH = cropStart.height;

    if (dragHandle === "move") {
      newX = Math.max(0, Math.min(1 - cropStart.width, cropStart.x + dxNorm));
      newY = Math.max(0, Math.min(1 - cropStart.height, cropStart.y + dyNorm));
    } else if (dragHandle === "tl") {
      newX = Math.max(0, Math.min(cropStart.x + cropStart.width - 0.05, cropStart.x + dxNorm));
      newY = Math.max(0, Math.min(cropStart.y + cropStart.height - 0.05, cropStart.y + dyNorm));
      newW = cropStart.width - (newX - cropStart.x);
      newH = cropStart.height - (newY - cropStart.y);
    } else if (dragHandle === "tr") {
      newY = Math.max(0, Math.min(cropStart.y + cropStart.height - 0.05, cropStart.y + dyNorm));
      newW = Math.max(0.05, Math.min(1 - cropStart.x, cropStart.width + dxNorm));
      newH = cropStart.height - (newY - cropStart.y);
    } else if (dragHandle === "bl") {
      newX = Math.max(0, Math.min(cropStart.x + cropStart.width - 0.05, cropStart.x + dxNorm));
      newW = cropStart.width - (newX - cropStart.x);
      newH = Math.max(0.05, Math.min(1 - cropStart.y, cropStart.height + dyNorm));
    } else if (dragHandle === "br") {
      newW = Math.max(0.05, Math.min(1 - cropStart.x, cropStart.width + dxNorm));
      newH = Math.max(0.05, Math.min(1 - cropStart.y, cropStart.height + dyNorm));
    }

    setCrop({
      x: Math.max(0, Math.min(1, newX)),
      y: Math.max(0, Math.min(1, newY)),
      width: Math.max(0.05, Math.min(1, newW)),
      height: Math.max(0.05, Math.min(1, newH)),
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
    setDragHandle(null);
  }

  // Export cropped & transformed canvas to PNG File and save
  async function handleSaveCrop() {
    if (!imageObj) return;
    setSaving(true);
    setError(null);

    try {
      // Create offscreen canvas for transformed image
      const srcW = imageObj.naturalWidth;
      const srcH = imageObj.naturalHeight;

      const cropPixelX = crop.x * srcW;
      const cropPixelY = crop.y * srcH;
      const cropPixelW = crop.width * srcW;
      const cropPixelH = crop.height * srcH;

      const outCanvas = document.createElement("canvas");
      outCanvas.width = Math.max(1, Math.round(cropPixelW));
      outCanvas.height = Math.max(1, Math.round(cropPixelH));

      const ctx = outCanvas.getContext("2d");
      if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

      ctx.save();
      // Handle rotation and flip if any
      if (rotation !== 0 || flipH || flipV) {
        ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(
          imageObj,
          cropPixelX,
          cropPixelY,
          cropPixelW,
          cropPixelH,
          -outCanvas.width / 2,
          -outCanvas.height / 2,
          outCanvas.width,
          outCanvas.height
        );
      } else {
        ctx.drawImage(
          imageObj,
          cropPixelX,
          cropPixelY,
          cropPixelW,
          cropPixelH,
          0,
          0,
          outCanvas.width,
          outCanvas.height
        );
      }
      ctx.restore();

      // Convert to PNG blob preserving transparency
      const blob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob((b) => resolve(b), "image/png", 1.0)
      );

      if (!blob) throw new Error("Xuất ảnh PNG thất bại.");

      const cleanCode = customCode ? customCode : `CROPPED_${Date.now()}`;
      const file = new File([blob], `${cleanCode}.png`, { type: "image/png" });

      // Upload to Supabase Storage
      const uploadedUrl = await uploadFile(file, folder, customCode, oldUrl || imageUrl);
      if (!uploadedUrl) throw new Error("Tải ảnh đã cắt lên máy chủ thất bại.");

      await onSave(uploadedUrl);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Calculate pixel dimensions for preview label
  const realW = imageObj ? Math.round(crop.width * imageObj.naturalWidth) : 0;
  const realH = imageObj ? Math.round(crop.height * imageObj.naturalHeight) : 0;

  return (
    <Modal open={open} onClose={onClose} title={title} size="2xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Canvas Workspace */}
        <div className="lg:col-span-8 flex flex-col">
          <div
            ref={containerRef}
            className="relative w-full h-[360px] sm:h-[400px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center select-none"
            style={{
              backgroundImage:
                "radial-gradient(#1e293b 1px, transparent 1px), radial-gradient(#1e293b 1px, #0f172a 1px)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 10px 10px",
            }}
          >
            {loadingImg ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 size={32} className="animate-spin text-brand-400" />
                <span className="text-sm font-medium">Đang tải hình ảnh...</span>
              </div>
            ) : error ? (
              <div className="text-center p-6 text-rose-400 text-sm">{error}</div>
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair touch-none"
              />
            )}

            {/* Size Info & R2 Source Badge */}
            {imageObj && !loadingImg && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2 shadow-lg">
                  <Crop size={13} className="text-brand-400" />
                  <span>
                    Kích thước: <strong className="text-slate-100">{realW} x {realH} px</strong>
                  </span>
                </div>

                <div
                  className={`px-2.5 py-1.5 rounded-xl backdrop-blur-md text-[11px] font-medium border flex items-center gap-1.5 shadow-lg ${
                    isHdR2
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-900/90 text-slate-400 border-slate-800"
                  }`}
                >
                  <ShieldCheck size={13} className={isHdR2 ? "text-emerald-400" : "text-slate-500"} />
                  <span>{isHdR2 ? "File GỐC HD (R2)" : "File xem trước"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Control Panel & Action Buttons */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tự động</span>
              <button
                type="button"
                onClick={handleAutoTrim}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30 hover:bg-brand-500/25 font-semibold text-xs transition-all shadow-sm"
                title="Tự động loại bỏ lề trong suốt dư thừa"
              >
                <Wand2 size={16} />
                <span>Cắt tự động lề trong suốt</span>
              </button>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Xoay & Lật hình</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-slate-100 hover:bg-slate-700/80 text-xs font-medium transition-colors"
                >
                  <RotateCcw size={13} /> Xoay trái
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-slate-100 hover:bg-slate-700/80 text-xs font-medium transition-colors"
                >
                  <RotateCw size={13} /> Xoay phải
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((f) => !f)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-medium transition-colors ${
                    flipH ? "bg-brand-500/20 text-brand-400 border-brand-500/40" : "bg-slate-800 border-slate-700/60 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  <FlipHorizontal size={13} /> Lật ngang
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((f) => !f)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-medium transition-colors ${
                    flipV ? "bg-brand-500/20 text-brand-400 border-brand-500/40" : "bg-slate-800 border-slate-700/60 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  <FlipVertical size={13} /> Lật dọc
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Thu phóng</span>
              <div className="flex items-center justify-between gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-xs font-mono text-slate-200 font-medium min-w-[36px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-700"
                >
                  <RefreshCw size={12} /> Khôi phục
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons Stacked Right */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            {error && <p className="text-xs text-rose-400 mb-1">{error}</p>}
            <button
              type="button"
              onClick={handleSaveCrop}
              disabled={saving || loadingImg || !imageObj}
              className="w-full py-2.5 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? "Đang xử lý & Lưu..." : "Lưu hình đã cắt"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
