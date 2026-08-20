import { useState, useRef, useEffect, useMemo } from "react";
import { Modal } from "@/components/Modal";
import { ImageZoomModal } from "@/components/ImageZoomModal";
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
  Eye,
  EyeOff,
  Layers,
  ShieldCheck,
  X,
  Copy,
  ClipboardCheck,
} from "lucide-react";
import { uploadFile } from "@/lib/helpers";
import { loadImageWithR2Priority } from "@/lib/r2Storage";
import type { PrintPositionData, LogoItem } from "@/lib/types";

export interface PrintDesignItem {
  id: string;
  code: string;
  name: string;
  url: string;
}

interface MockupEditorModalProps {
  open: boolean;
  onClose: () => void;
  blankImageUrl: string | null;
  blankImageBackUrl?: string | null;
  printDesignUrl?: string | null; // Cho 1 hình in cũ
  printDesigns?: PrintDesignItem[]; // Cho 1 đến 3 hình in mới
  availableLogos?: LogoItem[]; // Danh sách Logo thương hiệu
  masterCode?: string;
  hasOtherColors?: boolean; // Có nhiều hơn 1 phôi màu trong nhóm SP
  initialPosition?: PrintPositionData;
  initialPositions?: Record<string, PrintPositionData>;
  initialImageType?: "front" | "combined" | string;
  onSaveMockup: (
    imageUrl: string,
    position: PrintPositionData,
    imageType: string,
    positions?: Record<string, PrintPositionData>,
    applyToAllColors?: boolean,
    activeDesigns?: PrintDesignItem[]
  ) => Promise<void> | void;
}

export function MockupEditorModal({
  open,
  onClose,
  blankImageUrl,
  blankImageBackUrl,
  printDesignUrl,
  printDesigns,
  availableLogos = [],
  masterCode = "SP",
  hasOtherColors = false,
  initialPosition = { posX: 50, posY: 38, scale: 45, visible: true },
  initialPositions,
  initialImageType = "front",
  onSaveMockup,
}: MockupEditorModalProps) {
  const [imageType, setImageType] = useState<string>(initialImageType || "front");

  // State quản lý tính năng ghép Logo tùy chọn
  const [enableLogo, setEnableLogo] = useState<boolean>(false);
  const [selectedLogoId, setSelectedLogoId] = useState<string>("");

  // Tìm đối tượng Logo đang chọn
  const selectedLogo = useMemo(() => {
    return availableLogos.find((l) => l.id === selectedLogoId) || availableLogos[0] || null;
  }, [availableLogos, selectedLogoId]);

  // Quy chuẩn danh sách các hình in + Logo (nếu được bật)
  const normalizedDesigns: PrintDesignItem[] = useMemo(() => {
    let baseList: PrintDesignItem[] = [];
    if (printDesigns && printDesigns.length > 0) {
      baseList = [...printDesigns];
    } else if (printDesignUrl) {
      baseList = [{ id: "main", code: "PRINT", name: "Hình in chính", url: printDesignUrl }];
    }

    if (enableLogo && selectedLogo) {
      baseList.push({
        id: "logo",
        code: selectedLogo.code,
        name: `Logo: ${selectedLogo.name}`,
        url: selectedLogo.image_url,
      });
    }

    return baseList;
  }, [printDesigns, printDesignUrl, enableLogo, selectedLogo]);

  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [designPositions, setDesignPositions] = useState<Record<string, PrintPositionData>>({});

  const [activeAction, setActiveAction] = useState<"move" | "resize" | null>(null);

  // Dùng useRef để lưu vết kéo chuột liên tục 60 FPS mà KHÔNG bị stale state
  const actionTypeRef = useRef<"move" | "resize" | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startCenterRef = useRef({ x: 50, y: 38 });
  const startScaleRef = useRef(45);

  const [rendering, setRendering] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [zoomPreviewUrl, setZoomPreviewUrl] = useState<string | null>(null);

  const [applyToAllColors, setApplyToAllColors] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }

  function handleCopyPosition() {
    if (!activeDesignId) return;
    const current = designPositions[activeDesignId] || { posX: 50, posY: 38, scale: 45, visible: true };
    const payload = {
      singlePosition: current,
      allPositions: designPositions,
      imageType,
      timestamp: Date.now(),
    };
    localStorage.setItem("copied_print_position_data", JSON.stringify(payload));
    showToast("Đã sao chép vị trí hình in!");
  }

  function handlePastePosition() {
    try {
      const raw = localStorage.getItem("copied_print_position_data");
      if (!raw) {
        alert("Chưa có vị trí hình in nào được sao chép.");
        return;
      }
      const data = JSON.parse(raw);
      if (data.singlePosition && activeDesignId) {
        setDesignPositions((prev) => ({
          ...prev,
          [activeDesignId]: {
            ...(prev[activeDesignId] || { posX: 50, posY: 38, scale: 45, visible: true }),
            posX: data.singlePosition.posX,
            posY: data.singlePosition.posY,
            scale: data.singlePosition.scale,
          },
        }));
        if (data.imageType && data.imageType !== imageType) {
          setImageType(data.imageType);
        }
        showToast("Đã dán vị trí hình in!");
      }
    } catch (err) {
      alert("Không thể dán vị trí: " + (err as Error).message);
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);

  // Ảnh phôi nền hiện tại đang được chọn (Hình 1: Mặt trước vs. Hình 2: Trước & sau)
  const activeBlankImage =
    imageType === "combined" && blankImageBackUrl
      ? blankImageBackUrl
      : blankImageUrl || blankImageBackUrl || null;

  // Tạo ảnh canvas tức thì để xem phóng to HD
  async function handleOpenZoomPreview() {
    const targetBlankImage = activeBlankImage || blankImageUrl || blankImageBackUrl;
    if (!targetBlankImage) return;

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const imgBlank = new Image();
      imgBlank.crossOrigin = "anonymous";
      imgBlank.src = targetBlankImage;

      await new Promise((resolve) => (imgBlank.onload = resolve));

      canvas.width = 1200;
      canvas.height = 1200;

      if (ctx) {
        ctx.drawImage(imgBlank, 0, 0, 1200, 1200);

        for (const design of normalizedDesigns) {
          const pos = designPositions[design.id] || {
            posX: 50,
            posY: 38,
            scale: 45,
            visible: true,
          };
          if (pos.visible === false) continue;

          const imgDesign = new Image();
          imgDesign.crossOrigin = "anonymous";
          imgDesign.src = design.url;
          await new Promise((resolve) => (imgDesign.onload = resolve));

          const designWidth = (pos.scale / 100) * 1200;
          const designAspect = imgDesign.height / imgDesign.width;
          const designHeight = designWidth * designAspect;

          const drawX = (pos.posX / 100) * 1200 - designWidth / 2;
          const drawY = (pos.posY / 100) * 1200 - designHeight / 2;

          ctx.drawImage(imgDesign, drawX, drawY, designWidth, designHeight);
        }
      }

      const dataUrl = canvas.toDataURL("image/png");
      setZoomPreviewUrl(dataUrl);
    } catch (err) {
      setZoomPreviewUrl(targetBlankImage);
    }
  }

  // Load initial position, positions map & image type when opening Modal
  useEffect(() => {
    if (open) {
      const type = initialImageType || (blankImageUrl ? "front" : "combined");
      setImageType(type);

      const posMap: Record<string, PrintPositionData> = {};

      // Kiểm tra xem đã từng bật ghép Logo trước đó chưa
      const logoPos = initialPositions?.["logo"];
      if (logoPos && logoPos.visible !== false) {
        setEnableLogo(true);
        const savedLogoId = (logoPos as unknown as { logoId?: string; logoUrl?: string }).logoId;
        const savedLogoUrl = (logoPos as unknown as { logoId?: string; logoUrl?: string }).logoUrl;
        const matchedLogo = availableLogos.find(
          (l) => l.id === savedLogoId || (savedLogoUrl && l.image_url === savedLogoUrl)
        );
        if (matchedLogo) {
          setSelectedLogoId(matchedLogo.id);
        } else if (availableLogos.length > 0) {
          setSelectedLogoId(availableLogos[0].id);
        }
      } else {
        setEnableLogo(false);
        if (availableLogos.length > 0) {
          setSelectedLogoId(availableLogos[0].id);
        }
      }

      normalizedDesigns.forEach((d, idx) => {
        if (initialPositions && initialPositions[d.id]) {
          posMap[d.id] = { ...initialPositions[d.id] };
        } else if (d.id === "logo") {
          if (initialPositions && initialPositions["logo"]) {
            posMap[d.id] = { ...initialPositions["logo"] };
          } else {
            posMap[d.id] = {
              posX: type === "combined" ? 21 : 38,
              posY: 28,
              scale: 16,
              visible: true,
              logoId: selectedLogo?.id,
              logoUrl: selectedLogo?.image_url,
            };
          }
        } else if (idx === 0) {
          if (initialPosition) {
            posMap[d.id] = { ...initialPosition };
          } else if (initialPositions) {
            const firstNonLogo = Object.entries(initialPositions).find(([k]) => k !== "logo");
            if (firstNonLogo) {
              posMap[d.id] = { ...firstNonLogo[1] };
            }
          }
        } else if (initialPositions) {
          const nonLogoEntries = Object.entries(initialPositions).filter(([k]) => k !== "logo");
          if (nonLogoEntries[idx]) {
            posMap[d.id] = { ...nonLogoEntries[idx][1] };
          } else {
            const defaultX = type === "combined" ? (d.is_back ? 72 : (idx === 1 ? 72 : 28)) : idx === 1 ? 38 : 50;
            const defaultY = idx === 2 ? 65 : 38;
            const defaultS = type === "combined" ? 35 : idx === 1 ? 25 : 45;
            posMap[d.id] = { posX: defaultX, posY: defaultY, scale: defaultS, visible: true };
          }
        } else {
          const defaultX = type === "combined" ? (d.is_back ? 72 : (idx === 1 ? 72 : 28)) : idx === 1 ? 38 : 50;
          const defaultY = idx === 2 ? 65 : 38;
          const defaultS = type === "combined" ? 35 : idx === 1 ? 25 : 45;
          posMap[d.id] = { posX: defaultX, posY: defaultY, scale: defaultS, visible: true };
        }
      });

      const firstId = normalizedDesigns[0]?.id || "main";
      setActiveDesignId(firstId);

      setDesignPositions(posMap);
      setSavedSuccess(false);
      actionTypeRef.current = null;
      setActiveAction(null);
    }
  }, [open, initialPosition, initialPositions, initialImageType, blankImageUrl]);

  // Thông số của Layer đang được chọn (Active Design hoặc Active Logo)
  const currentPos = useMemo(() => {
    return (
      designPositions[activeDesignId] || {
        posX: 50,
        posY: 38,
        scale: 45,
        visible: true,
      }
    );
  }, [designPositions, activeDesignId]);

  const posX = currentPos.posX;
  const posY = currentPos.posY;
  const scale = currentPos.scale;

  // Cập nhật vị trí cho layer đang active
  function updateActivePos(updates: Partial<PrintPositionData>) {
    if (!activeDesignId) return;
    setDesignPositions((prev) => ({
      ...prev,
      [activeDesignId]: {
        ...(prev[activeDesignId] || { posX: 50, posY: 38, scale: 45, visible: true }),
        ...updates,
      },
    }));
  }

  // Nút Ẩn / Hiện (Bật / Tắt) cho hình in hoặc logo chỉ định
  function toggleVisibility(id: string) {
    setDesignPositions((prev) => {
      const current = prev[id] || { posX: 50, posY: 38, scale: 45, visible: true };
      const nextVisible = current.visible === false ? true : false;
      return {
        ...prev,
        [id]: {
          ...current,
          visible: nextVisible,
        },
      };
    });
  }

  // Chuyển đổi giữa Chế độ Hình 1 (Mặt trước) và Hình 2 (Trước & Sau)
  function handleToggleImageType(newType: "front" | "combined") {
    setImageType(newType);
    if (!activeDesignId) return;

    if (newType === "combined") {
      updateActivePos({ posX: 28, posY: 38, scale: 35 });
    } else {
      updateActivePos({ posX: 50, posY: 38, scale: 45 });
    }
  }

  // Các Preset vị trí phù hợp với từng chế độ hình phôi
  const presetsFront = [
    { label: "Giữa Ngực Vừa", icon: AlignCenter, x: 50, y: 38, s: 45 },
    { label: "Ngực Trái", icon: CornerUpLeft, x: 38, y: 30, s: 22 },
    { label: "Giữa Ngực To", icon: Maximize2, x: 50, y: 42, s: 65 },
    { label: "Sát Cổ Áo", icon: Minimize2, x: 50, y: 22, s: 30 },
  ];

  const presetsCombined = [
    { label: "Áo Trái (Mặt trước)", icon: AlignCenter, x: 28, y: 38, s: 35 },
    { label: "Áo Phải (Mặt sau)", icon: AlignCenter, x: 72, y: 38, s: 35 },
    { label: "Ngực Trái Áo Trái", icon: CornerUpLeft, x: 21, y: 30, s: 18 },
    { label: "Sát Cổ Áo Trái", icon: Minimize2, x: 28, y: 22, s: 22 },
  ];

  const presets = imageType === "combined" ? presetsCombined : presetsFront;

  // Bắt đầu Di Chuyển Layer (MouseDown trên hình)
  function handleStartMove(e: React.MouseEvent | React.TouchEvent, designId: string) {
    e.preventDefault();
    e.stopPropagation();
    setActiveDesignId(designId);
    actionTypeRef.current = "move";
    setActiveAction("move");

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const pos = designPositions[designId] || { posX: 50, posY: 38, scale: 45, visible: true };

    startPosRef.current = { x: clientX, y: clientY };
    startCenterRef.current = { x: pos.posX, y: pos.posY };
  }

  // Bắt đầu Thu Phóng Kích Thước (MouseDown trên 4 nút góc)
  function handleStartResize(e: React.MouseEvent | React.TouchEvent, designId: string) {
    e.preventDefault();
    e.stopPropagation();
    setActiveDesignId(designId);
    actionTypeRef.current = "resize";
    setActiveAction("resize");

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const pos = designPositions[designId] || { posX: 50, posY: 38, scale: 45, visible: true };

    startPosRef.current = { x: clientX, y: clientY };
    startScaleRef.current = pos.scale;
  }

  // Đăng ký sự kiện Kéo Thả toàn cục (Global Event Listener) cho mượt 60 FPS
  useEffect(() => {
    function handleGlobalMove(e: MouseEvent | TouchEvent) {
      if (!actionTypeRef.current || !containerRef.current || !activeDesignId) return;
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const rect = containerRef.current.getBoundingClientRect();

      if (actionTypeRef.current === "move") {
        const deltaX = ((clientX - startPosRef.current.x) / rect.width) * 100;
        const deltaY = ((clientY - startPosRef.current.y) / rect.height) * 100;

        const newX = Math.max(5, Math.min(95, startCenterRef.current.x + deltaX));
        const newY = Math.max(5, Math.min(95, startCenterRef.current.y + deltaY));

        setDesignPositions((prev) => ({
          ...prev,
          [activeDesignId]: {
            ...(prev[activeDesignId] || { posX: 50, posY: 38, scale: 45, visible: true }),
            posX: newX,
            posY: newY,
          },
        }));
      } else if (actionTypeRef.current === "resize") {
        const deltaX = ((clientX - startPosRef.current.x) / rect.width) * 100;
        const deltaY = ((clientY - startPosRef.current.y) / rect.height) * 100;
        const deltaScale = (deltaX + deltaY) / 1.5;

        const newScale = Math.max(5, Math.min(90, startScaleRef.current + deltaScale));

        setDesignPositions((prev) => ({
          ...prev,
          [activeDesignId]: {
            ...(prev[activeDesignId] || { posX: 50, posY: 38, scale: 45, visible: true }),
            scale: newScale,
          },
        }));
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
  }, [activeDesignId]);

  // Thu phóng bằng con trỏ chuột (Mouse Wheel Zoom)
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!activeDesignId) return;
    const zoomDelta = e.deltaY < 0 ? 3 : -3;
    updateActivePos({ scale: Math.max(5, Math.min(90, scale + zoomDelta)) });
  }

  // Ghép đa lớp tất cả các hình in & Logo đang BẬT (Visible) bằng Canvas và Xuất ảnh Mockup
  async function handleExportAndSave() {
    const targetBlankImage = activeBlankImage || blankImageUrl || blankImageBackUrl;
    if (!targetBlankImage || normalizedDesigns.length === 0) {
      alert("Thiếu ảnh phôi hoặc ảnh hình in để tạo mockup.");
      return;
    }

    setRendering(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const imgBlank = await loadImageWithR2Priority(targetBlankImage, "blanks");

      canvas.width = 1200;
      canvas.height = 1200;

      if (ctx) {
        // 1. Vẽ Phôi Áo Nền
        ctx.drawImage(imgBlank, 0, 0, 1200, 1200);

        // 2. Lần lượt vẽ từng Hình In & Logo đang ở trạng thái HIỆN (Visible) lên Canvas
        for (const design of normalizedDesigns) {
          const pos = designPositions[design.id] || {
            posX: 50,
            posY: 38,
            scale: 45,
            visible: true,
          };
          if (pos.visible === false) continue; // Bỏ qua không vẽ những layer bị ẨN

          const isLogo = design.id === "logo" || design.code?.toLowerCase().includes("logo");
          const imgDesign = await loadImageWithR2Priority(
            design.url,
            isLogo ? "logos" : "designs",
            design.code
          );

          const designWidth = (pos.scale / 100) * 1200;
          const designAspect = imgDesign.height / imgDesign.width;
          const designHeight = designWidth * designAspect;

          const drawX = (pos.posX / 100) * 1200 - designWidth / 2;
          const drawY = (pos.posY / 100) * 1200 - designHeight / 2;

          ctx.drawImage(imgDesign, drawX, drawY, designWidth, designHeight);
        }
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
        const finalPositionsMap = { ...designPositions };
        if (enableLogo && selectedLogo) {
          finalPositionsMap["logo"] = {
            ...(designPositions["logo"] || { posX: 38, posY: 28, scale: 16, visible: true }),
            logoId: selectedLogo.id,
            logoUrl: selectedLogo.image_url,
          } as PrintPositionData;
        }

        // Gửi thông số vị trí sang Node.js Server (renderimage) ghép file HD 300DPI
        notifyNodeJsRenderServer({
          masterCode,
          blankImageUrl: targetBlankImage,
          printDesigns: normalizedDesigns.map((d) => ({
            id: d.id,
            url: d.url,
            position: finalPositionsMap[d.id] || designPositions[d.id],
          })),
          imageType,
        }).catch(() => {});

        const primaryPos = finalPositionsMap[normalizedDesigns[0]?.id || "main"] || designPositions[normalizedDesigns[0]?.id || "main"] || {
          posX,
          posY,
          scale,
        };

        await onSaveMockup(uploadedUrl, primaryPos, imageType, finalPositionsMap, applyToAllColors, normalizedDesigns);
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
    <Modal open={open} onClose={onClose} title={`Kéo Thả & Co Giãn Vị Trí (${masterCode})`} size="lg">
      <div className="space-y-3">
        {/* Nút chuyển đổi chọn Chế độ Hình Phôi (Hình 1 vs. Hình 2) */}
        <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 flex-wrap gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <ImageIcon size={15} className="text-brand-400" /> Chọn loại hình phôi làm Mockup:
          </span>
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => handleToggleImageType("front")}
              disabled={!blankImageUrl && !blankImageBackUrl}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                imageType === "front"
                  ? "bg-brand-500 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>👕 Hình 1: 1 Áo phía trước</span>
              {!blankImageUrl && <span className="text-[10px] text-amber-400">(Chưa tải)</span>}
            </button>
            <button
              type="button"
              onClick={() => handleToggleImageType("combined")}
              disabled={!blankImageUrl && !blankImageBackUrl}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                imageType === "combined"
                  ? "bg-brand-500 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>👕👕 Hình 2: Trước & sau của áo</span>
              {!blankImageBackUrl && <span className="text-[10px] text-amber-400">(Chưa tải)</span>}
            </button>
          </div>
        </div>

        {/* THẺ TÙY CHỌN GHÉP LOGO THƯƠNG HIỆU LÊN ÁO */}
        {availableLogos && availableLogos.length > 0 && (
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-400" /> Ghép Logo thương hiệu lên áo?
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !enableLogo;
                    setEnableLogo(nextState);
                    if (nextState) {
                      if (!selectedLogoId && availableLogos.length > 0) {
                        setSelectedLogoId(availableLogos[0].id);
                      }
                      setDesignPositions((prev) => ({
                        ...prev,
                        logo: prev["logo"] || { posX: 38, posY: 28, scale: 16, visible: true },
                      }));
                      setActiveDesignId("logo");
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    enableLogo
                      ? "bg-emerald-500 text-white shadow-sm font-bold"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                  }`}
                >
                  {enableLogo ? (
                    <>
                      <Check size={13} /> Có ghép Logo
                    </>
                  ) : (
                    <>
                      <X size={13} /> Không ghép Logo
                    </>
                  )}
                </button>

                {enableLogo && (
                  <div className="flex items-center gap-1.5">
                    {selectedLogo && (
                      <div className="w-7 h-7 rounded bg-slate-950 border border-slate-700 p-0.5 flex items-center justify-center shrink-0" title={`Logo: ${selectedLogo.name}`}>
                        <img src={selectedLogo.image_url} alt="" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <select
                      value={selectedLogoId}
                      onChange={(e) => {
                        const newLogoId = e.target.value;
                        setSelectedLogoId(newLogoId);
                        const matched = availableLogos.find((l) => l.id === newLogoId);
                        if (matched) {
                          setDesignPositions((prev) => ({
                            ...prev,
                            logo: {
                              ...(prev["logo"] || { posX: 38, posY: 28, scale: 16, visible: true }),
                              logoId: matched.id,
                              logoUrl: matched.image_url,
                            },
                          }));
                        }
                        setActiveDesignId("logo");
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs outline-none focus:border-emerald-500 max-w-[180px] truncate"
                    >
                      {availableLogos.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} — {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NÚT CHỌN TAB & BẬT/TẮT 👁️ (ẨN/HIỆN) TỪNG HÌNH IN & LOGO */}
        {normalizedDesigns.length > 0 && (
          <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers size={14} className="text-brand-400" /> Danh sách Layers ({normalizedDesigns.length} layer) — Bấm 👁️ để Ẩn / Hiện:
            </span>
            <div className="flex flex-wrap gap-2">
              {normalizedDesigns.map((d, idx) => {
                const pos = designPositions[d.id] || { posX: 50, posY: 38, scale: 45, visible: true };
                const isVisible = pos.visible !== false;
                const isSelected = d.id === activeDesignId;
                const isLogoLayer = d.id === "logo";

                return (
                  <div
                    key={d.id}
                    className={`flex items-center rounded-xl border text-xs overflow-hidden transition-all ${
                      isSelected
                        ? isLogoLayer
                          ? "bg-emerald-500/20 border-emerald-500/50 shadow-sm"
                          : "bg-brand-500/20 border-brand-500/50 shadow-sm"
                        : "bg-slate-900 border-slate-700/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveDesignId(d.id)}
                      className={`px-3 py-1.5 flex items-center gap-1.5 font-medium ${
                        isSelected
                          ? isLogoLayer
                            ? "text-emerald-300 font-bold"
                            : "text-brand-300 font-bold"
                          : "text-slate-300 hover:text-slate-100"
                      }`}
                    >
                      <img src={d.url} alt="" className="w-4 h-4 object-contain rounded bg-slate-950 p-0.5" />
                      <span>{isLogoLayer ? d.name : `Hình in ${idx + 1}: ${d.name}`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleVisibility(d.id)}
                      className={`px-2.5 py-1.5 border-l hover:bg-slate-800 transition-colors flex items-center gap-1 ${
                        isVisible
                          ? "text-emerald-400 border-slate-800 bg-emerald-500/10"
                          : "text-rose-400 border-slate-800 bg-rose-500/10"
                      }`}
                      title={isVisible ? "Đang HIỆN - Bấm để ẨN layer này" : "Đang ẨN - Bấm để HIỆN layer này"}
                    >
                      {isVisible ? (
                        <>
                          <Eye size={13} /> <span className="text-[10px]">Hiện</span>
                        </>
                      ) : (
                        <>
                          <EyeOff size={13} /> <span className="text-[10px]">Ẩn</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-5 select-none">
          {/* VÙNG KHUNG XEM TRƯỚC VÀ KÉO THẢ ĐA LỚP (Interactive Workspace) */}
          <div className="md:col-span-3 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1">
                <Move size={13} className="text-brand-400" /> Kéo chuột di chuyển hoặc kéo 4 góc để co giãn
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyPosition}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Sao chép thông số vị trí (X, Y, Scale) hiện tại"
                >
                  <Copy size={12} className="text-amber-400" /> Copy vị trí
                </button>
                <button
                  type="button"
                  onClick={handlePastePosition}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Dán vị trí đã sao chép"
                >
                  <ClipboardCheck size={12} className="text-emerald-400" /> Dán vị trí
                </button>
                <button
                  type="button"
                  onClick={handleOpenZoomPreview}
                  className="px-2 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                  title="Tạo ảnh xem trước HD và soi phóng to chi tiết"
                >
                  <Eye size={12} /> 🔍 HD
                </button>
                <span className="text-[11px] font-mono text-brand-400 font-bold ml-1">
                  X:{Math.round(posX)}% Y:{Math.round(posY)}% S:{Math.round(scale)}%
                </span>
              </div>
            </div>

            <div
              ref={containerRef}
              onWheel={handleWheel}
              className="relative aspect-square w-full max-w-[360px] sm:max-w-[400px] mx-auto rounded-2xl bg-slate-900 border-2 border-slate-700/80 overflow-hidden flex items-center justify-center shadow-xl touch-none"
            >
              {/* Toast Thông Báo Nổi (Floating Notification Toast) */}
              {toastMessage && (
                <div className="absolute top-3 z-50 px-3.5 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg animate-fade-in flex items-center gap-1.5 border border-emerald-300">
                  <Check size={14} /> {toastMessage}
                </div>
              )}

              {/* Ảnh Phôi Nền */}
              {activeBlankImage ? (
                <img src={activeBlankImage} alt="Blank" className="w-full h-full object-contain pointer-events-none" />
              ) : (
                <Package size={48} className="text-slate-700" />
              )}

              {/* KHUNG CÁC HÌNH IN & LOGO ĐA LỚP (Hiển thị các layer đang BẬT) */}
              {normalizedDesigns.map((d, idx) => {
                const pos = designPositions[d.id] || { posX: 50, posY: 38, scale: 45, visible: true };
                if (pos.visible === false) return null; // Ẩn layer này nếu nút 👁️ đang tắt

                const isSelected = d.id === activeDesignId;
                const isLogoLayer = d.id === "logo";

                return (
                  <div
                    key={d.id}
                    style={{
                      top: `${pos.posY}%`,
                      left: `${pos.posX}%`,
                      width: `${pos.scale}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: isSelected ? 30 : 10 + idx,
                    }}
                    className={`absolute group cursor-move ${
                      isSelected
                        ? isLogoLayer
                          ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950"
                          : "ring-2 ring-brand-400 ring-offset-2 ring-offset-slate-950"
                        : "hover:ring-2 hover:ring-brand-400/60 opacity-90 hover:opacity-100"
                    } rounded-lg p-1.5 transition-all`}
                    onMouseDown={(e) => handleStartMove(e, d.id)}
                    onTouchStart={(e) => handleStartMove(e, d.id)}
                  >
                    {/* Ảnh Layer (Hình in hoặc Logo) */}
                    <img
                      src={d.url}
                      alt={d.name}
                      className="w-full h-auto object-contain pointer-events-none drop-shadow-2xl"
                    />

                    {/* Tag tên layer */}
                    <span
                      className={`absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-medium pointer-events-none whitespace-nowrap border ${
                        isLogoLayer
                          ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40"
                          : "bg-black/80 text-brand-300 border-brand-500/30"
                      }`}
                    >
                      {d.name}
                    </span>

                    {isSelected && (
                      <>
                        {/* Khung Viền Nét Đứt */}
                        <div
                          className={`absolute inset-0 border-2 border-dashed ${
                            isLogoLayer ? "border-emerald-400/90" : "border-brand-400/90"
                          } rounded-lg pointer-events-none`}
                        />

                        {/* 4 Nút Vuông Co Giãn */}
                        <div
                          onMouseDown={(e) => handleStartResize(e, d.id)}
                          onTouchStart={(e) => handleStartResize(e, d.id)}
                          className={`absolute -top-2 -left-2 w-4 h-4 ${
                            isLogoLayer ? "bg-emerald-400" : "bg-brand-400"
                          } border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform`}
                          title="Kéo để thu phóng kích thước"
                        />
                        <div
                          onMouseDown={(e) => handleStartResize(e, d.id)}
                          onTouchStart={(e) => handleStartResize(e, d.id)}
                          className={`absolute -top-2 -right-2 w-4 h-4 ${
                            isLogoLayer ? "bg-emerald-400" : "bg-brand-400"
                          } border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform`}
                          title="Kéo để thu phóng kích thước"
                        />
                        <div
                          onMouseDown={(e) => handleStartResize(e, d.id)}
                          onTouchStart={(e) => handleStartResize(e, d.id)}
                          className={`absolute -bottom-2 -left-2 w-4 h-4 ${
                            isLogoLayer ? "bg-emerald-400" : "bg-brand-400"
                          } border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform`}
                          title="Kéo để thu phóng kích thước"
                        />
                        <div
                          onMouseDown={(e) => handleStartResize(e, d.id)}
                          onTouchStart={(e) => handleStartResize(e, d.id)}
                          className={`absolute -bottom-2 -right-2 w-4 h-4 ${
                            isLogoLayer ? "bg-emerald-400" : "bg-brand-400"
                          } border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform`}
                          title="Kéo để thu phóng kích thước"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* BẢNG ĐIỀU CHỈNH THÔNG SỐ & NÚT LƯU */}
          <div className="md:col-span-2 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>📍 Căn vị trí nhanh (Presets)</span>
                {activeDesignId && (
                  <span className="text-xs font-normal text-brand-400 truncate max-w-[120px]">
                    {normalizedDesigns.find((d) => d.id === activeDesignId)?.name}
                  </span>
                )}
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => updateActivePos({ posX: p.x, posY: p.y, scale: p.s })}
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
                    min="5"
                    max="90"
                    value={scale}
                    onChange={(e) => updateActivePos({ scale: Number(e.target.value) })}
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
                    min="5"
                    max="95"
                    value={posY}
                    onChange={(e) => updateActivePos({ posY: Number(e.target.value) })}
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
                    min="5"
                    max="95"
                    value={posX}
                    onChange={(e) => updateActivePos({ posX: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              {hasOtherColors && (
                <label className="flex items-center gap-2 p-2 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs font-semibold text-brand-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToAllColors}
                    onChange={(e) => setApplyToAllColors(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                  />
                  <span>✨ Đồng bộ vị trí cho TẤT CẢ các phôi màu</span>
                </label>
              )}
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
      </div>

      {/* Modal Zoom Preview HD */}
      <ImageZoomModal
        open={!!zoomPreviewUrl}
        onClose={() => setZoomPreviewUrl(null)}
        imageUrl={zoomPreviewUrl}
        title={`Xem trước Mockup Phóng to HD (${masterCode})`}
      />
    </Modal>
  );
}
