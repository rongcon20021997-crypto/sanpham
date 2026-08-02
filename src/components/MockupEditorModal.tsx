import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/Modal";
import {
  Move,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Loader2,
  Check,
  Package,
  Image as ImageIcon,
  AlignCenter,
  CornerUpLeft,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { uploadFile } from "@/lib/helpers";

export interface MockupPositionData {
  posX: number; // Tỷ lệ % từ lề trái (0 -> 100)
  posY: number; // Tỷ lệ % từ lề trên (0 -> 100)
  scale: number; // Tỷ lệ % kích thước so với khung áo (10 -> 100)
}

interface MockupEditorModalProps {
  open: boolean;
  onClose: () => void;
  blankImageUrl: string | null;
  printDesignUrl: string | null;
  masterCode?: string;
  initialPosition?: MockupPositionData;
  onSaveMockup: (imageUrl: string, position: MockupPositionData) => Promise<void> | void;
}

export function MockupEditorModal({
  open,
  onClose,
  blankImageUrl,
  printDesignUrl,
  masterCode = "SP",
  initialPosition = { posX: 50, posY: 38, scale: 45 },
  onSaveMockup,
}: MockupEditorModalProps) {
  const [posX, setPosX] = useState<number>(initialPosition?.posX ?? 50);
  const [posY, setPosY] = useState<number>(initialPosition?.posY ?? 38);
  const [scale, setScale] = useState<number>(initialPosition?.scale ?? 45);

  const [activeAction, setActiveAction] = useState<"move" | "resize" | null>(null);

  // Dùng useRef để lưu vết kéo chuột liên tục 60 FPS mà KHÔNG bị stale state / reset state
  const actionTypeRef = useRef<"move" | "resize" | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startCenterRef = useRef({ x: 50, y: 38 });
  const startScaleRef = useRef(45);

  const [rendering, setRendering] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Chỉ reset vị trí đúng một lần khi mở Modal (Chữa triệt để lỗi tự reset về ban đầu)
  useEffect(() => {
    if (open) {
      const defaultX = initialPosition?.posX ?? 50;
      const defaultY = initialPosition?.posY ?? 38;
      const defaultS = initialPosition?.scale ?? 45;
      setPosX(defaultX);
      setPosY(defaultY);
      setScale(defaultS);
      setSavedSuccess(false);
      actionTypeRef.current = null;
      setActiveAction(null);
    }
  }, [open]);

  // Các Preset cài đặt sẵn vị trí nhanh
  const presets = [
    { label: "Ngực Trái", icon: CornerUpLeft, x: 38, y: 30, s: 22 },
    { label: "Giữa Ngực Vừa", icon: AlignCenter, x: 50, y: 38, s: 45 },
    { label: "Giữa Ngực To", icon: Maximize2, x: 50, y: 42, s: 65 },
    { label: "Sát Cổ Áo", icon: Minimize2, x: 50, y: 22, s: 30 },
  ];

  // Bắt đầu Di Chuyển Hình In (MouseDown trên hình)
  function handleStartMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    actionTypeRef.current = "move";
    setActiveAction("move");

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startPosRef.current = { x: clientX, y: clientY };
    startCenterRef.current = { x: posX, y: posY };
  }

  // Bắt đầu Thu Phóng Kích Thước (MouseDown trên 4 nút góc)
  function handleStartResize(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    actionTypeRef.current = "resize";
    setActiveAction("resize");

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startPosRef.current = { x: clientX, y: clientY };
    startScaleRef.current = scale;
  }

  // Đăng ký sự kiện Kéo Thả toàn cục (Global Event Listener) cho mượt 60 FPS
  useEffect(() => {
    function handleGlobalMove(e: MouseEvent | TouchEvent) {
      if (!actionTypeRef.current || !containerRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const rect = containerRef.current.getBoundingClientRect();

      if (actionTypeRef.current === "move") {
        const deltaX = ((clientX - startPosRef.current.x) / rect.width) * 100;
        const deltaY = ((clientY - startPosRef.current.y) / rect.height) * 100;

        setPosX(Math.max(5, Math.min(95, startCenterRef.current.x + deltaX)));
        setPosY(Math.max(5, Math.min(95, startCenterRef.current.y + deltaY)));
      } else if (actionTypeRef.current === "resize") {
        const deltaX = ((clientX - startPosRef.current.x) / rect.width) * 100;
        const deltaY = ((clientY - startPosRef.current.y) / rect.height) * 100;
        const deltaScale = (deltaX + deltaY) / 1.5;

        setScale(Math.max(10, Math.min(90, startScaleRef.current + deltaScale)));
      }
    }

    function handleGlobalEnd() {
      if (actionTypeRef.current) {
        actionTypeRef.current = null;
        setActiveAction(null);
      }
    }

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalEnd);
    window.addEventListener("touchmove", handleGlobalMove);
    window.addEventListener("touchend", handleGlobalEnd);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalEnd);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("touchend", handleGlobalEnd);
    };
  }, []);

  // Thu phóng bằng con trỏ chuột (Mouse Wheel Zoom)
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 3 : -3;
    setScale((prev) => Math.max(10, Math.min(90, prev + zoomDelta)));
  }

  // Ghép ảnh thật bằng Canvas và Xuất ảnh Mockup
  async function handleExportAndSave() {
    if (!blankImageUrl || !printDesignUrl) {
      alert("Thiếu ảnh phôi hoặc ảnh hình in để tạo mockup.");
      return;
    }

    setRendering(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const imgBlank = new Image();
      imgBlank.crossOrigin = "anonymous";
      imgBlank.src = blankImageUrl;

      const imgDesign = new Image();
      imgDesign.crossOrigin = "anonymous";
      imgDesign.src = printDesignUrl;

      await Promise.all([
        new Promise((resolve) => (imgBlank.onload = resolve)),
        new Promise((resolve) => (imgDesign.onload = resolve)),
      ]);

      canvas.width = 1200;
      canvas.height = 1200;

      if (ctx) {
        // 1. Vẽ Phôi Áo
        ctx.drawImage(imgBlank, 0, 0, 1200, 1200);

        // 2. Tính toán vị trí & kích thước Hình In dựa theo % posX, posY, scale
        const designWidth = (scale / 100) * 1200;
        const designAspect = imgDesign.height / imgDesign.width;
        const designHeight = designWidth * designAspect;

        const drawX = (posX / 100) * 1200 - designWidth / 2;
        const drawY = (posY / 100) * 1200 - designHeight / 2;

        ctx.drawImage(imgDesign, drawX, drawY, designWidth, designHeight);
      }

      // Convert Canvas sang WebP Blob
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.88)
      );

      if (!blob) throw new Error("Lỗi render ảnh mockup.");

      const file = new File([blob], `MOCKUP_${masterCode}.webp`, { type: "image/webp" });

      // Upload ảnh mockup mới tạo lên Supabase Storage
      const uploadedUrl = await uploadFile(file, "products/mockups", `MOCKUP_${masterCode}`);

      if (uploadedUrl) {
        // Gửi thông số vị trí sang Node.js Server (renderimage) ghép file HD 300DPI
        notifyNodeJsRenderServer({
          masterCode,
          blankImageUrl,
          printDesignUrl,
          posX,
          posY,
          scale,
        }).catch(() => {});

        await onSaveMockup(uploadedUrl, { posX, posY, scale });
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err) {
      alert("Lỗi xuất ảnh mockup: " + (err as Error).message);
    } finally {
      setRendering(false);
    }
  }

  // Gọi API thông báo cho dự án Node.js (renderimage) ghép file HD 300DPI
  async function notifyNodeJsRenderServer(payload: Record<string, unknown>) {
    const nodeUrl = import.meta.env.VITE_NODE_SERVER_URL || "http://localhost:5000";
    await fetch(`${nodeUrl}/api/render-hd-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Kéo Thả & Co Giãn Hình In (${masterCode})`} size="lg">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-5 select-none">
        {/* VÙNG KHUNG XEM TRƯỚC VÀ KÉO THẢ (Interactive Workspace) */}
        <div className="md:col-span-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1">
              <Move size={13} className="text-brand-400" /> Kéo chuột di chuyển hoặc kéo 4 góc để co giãn
            </span>
            <span className="text-[11px] sm:text-xs font-mono text-brand-400 font-bold">
              X:{Math.round(posX)}% Y:{Math.round(posY)}% S:{Math.round(scale)}%
            </span>
          </div>

          <div
            ref={containerRef}
            onWheel={handleWheel}
            className="relative aspect-square w-full max-w-[360px] sm:max-w-[400px] mx-auto rounded-2xl bg-slate-900 border-2 border-slate-700/80 overflow-hidden flex items-center justify-center shadow-xl touch-none"
          >
            {/* Ảnh Phôi Nền */}
            {blankImageUrl ? (
              <img src={blankImageUrl} alt="Blank" className="w-full h-full object-contain pointer-events-none" />
            ) : (
              <Package size={48} className="text-slate-700" />
            )}

            {/* KHUNG HÌNH IN CÓ THỂ KÉO THẢ & CO GIÃN BẰNG NÚT 4 GÓC */}
            {printDesignUrl ? (
              <div
                style={{
                  top: `${posY}%`,
                  left: `${posX}%`,
                  width: `${scale}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className={`absolute group cursor-move ${
                  activeAction ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-slate-950" : "hover:ring-2 hover:ring-brand-400/80"
                } rounded-lg p-1.5 transition-all`}
                onMouseDown={handleStartMove}
                onTouchStart={handleStartMove}
              >
                {/* Ảnh Hình In */}
                <img
                  src={printDesignUrl}
                  alt="Design"
                  className="w-full h-auto object-contain pointer-events-none drop-shadow-2xl"
                />

                {/* Khung Viền Nét Đứt */}
                <div className="absolute inset-0 border-2 border-dashed border-brand-400/90 rounded-lg pointer-events-none" />

                {/* 🔴 4 NÚT VUÔNG BỐN GÓC ĐỂ NẮM CHUỘT KÉO CO GIÃN TRỰC TIẾP */}
                {/* Góc Trên-Trái */}
                <div
                  onMouseDown={handleStartResize}
                  onTouchStart={handleStartResize}
                  className="absolute -top-2 -left-2 w-4 h-4 bg-brand-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                  title="Kéo để thu phóng kích thước"
                />
                {/* Góc Trên-Phải */}
                <div
                  onMouseDown={handleStartResize}
                  onTouchStart={handleStartResize}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-brand-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                  title="Kéo để thu phóng kích thước"
                />
                {/* Góc Dưới-Trái */}
                <div
                  onMouseDown={handleStartResize}
                  onTouchStart={handleStartResize}
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-brand-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                  title="Kéo để thu phóng kích thước"
                />
                {/* Góc Dưới-Phải */}
                <div
                  onMouseDown={handleStartResize}
                  onTouchStart={handleStartResize}
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-brand-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                  title="Kéo để thu phóng kích thước"
                />
              </div>
            ) : (
              <ImageIcon size={48} className="text-slate-700" />
            )}
          </div>
        </div>

        {/* BẢNG ĐIỀU CHỈNH THÔNG SỐ & NÚT LƯU */}
        <div className="md:col-span-2 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
              📍 Căn chỉnh vị trí nhanh (Presets)
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setPosX(p.x);
                      setPosY(p.y);
                      setScale(p.s);
                    }}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:bg-brand-500/10 hover:border-brand-500/40 hover:text-brand-400 text-slate-300 text-xs font-medium transition-all"
                  >
                    <Icon size={14} className="text-brand-400 shrink-0" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
                📏 Điều chỉnh kích thước & vị trí
              </h4>

              {/* Thanh trượt Co Giãn (Scale) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <ZoomIn size={13} className="text-brand-400" /> Co giãn (Scale):
                  </span>
                  <span className="font-mono text-brand-400 font-bold">{Math.round(scale)}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Thanh trượt Vị trí Dọc (PosY) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>↕️ Vị trí Dọc (Y):</span>
                  <span className="font-mono text-slate-400 font-semibold">{Math.round(posY)}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={posY}
                  onChange={(e) => setPosY(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Thanh trượt Vị trí Ngang (PosX) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>↔️ Vị trí Ngang (X):</span>
                  <span className="font-mono text-slate-400 font-semibold">{Math.round(posX)}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={posX}
                  onChange={(e) => setPosX(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleExportAndSave}
              disabled={rendering}
              className="w-full py-3 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
            >
              {savedSuccess ? (
                <>
                  <Check size={18} /> Đã lưu vị trí thành công!
                </>
              ) : rendering ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Đang render & tải mockup...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Lưu Vị Trí & Tạo Ảnh Mockup
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
