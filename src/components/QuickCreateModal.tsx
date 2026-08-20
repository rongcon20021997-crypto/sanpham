import { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType, PrintPositionData, LogoItem } from "@/lib/types";
import { SearchInput } from "@/components/PageParts";
import { Sparkles, Loader2, AlertTriangle, Check, Package, Image as ImageIcon, Copy, EyeOff, ShieldCheck } from "lucide-react";
import { formatColorName } from "@/lib/helpers";

interface QuickCreateModalProps {
  open: boolean;
  onClose: () => void;
  existingProducts: Product[];
  blanks: Blank[];
  designs: PrintDesign[];
  types: BlankType[];
  logos?: LogoItem[];
  onCreated: () => void;
}

export function QuickCreateModal({
  open,
  onClose,
  existingProducts,
  blanks,
  designs,
  types,
  logos = [],
  onCreated,
}: QuickCreateModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>("");
  const [blankImageType, setBlankImageType] = useState<"front" | "combined">("front");
  const [defaultPrice, setDefaultPrice] = useState<string>("250000");

  const [enableLogo, setEnableLogo] = useState<boolean>(false);
  const [selectedLogoId, setSelectedLogoId] = useState<string>("");

  const [searchDesign, setSearchDesign] = useState<string>("");
  const [searchType, setSearchType] = useState<string>("");

  const [hideCreatedDesigns, setHideCreatedDesigns] = useState<boolean>(true);
  const [allowDuplicate, setAllowDuplicate] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form khi mở modal
  useEffect(() => {
    if (open) {
      setSelectedTypeId(types[0]?.id || "");
      setSelectedDesignIds([]);
      setSelectedTemplateCode("");
      setBlankImageType("front");
      setDefaultPrice("250000");
      setEnableLogo(false);
      setSelectedLogoId(logos[0]?.id || "");
      setError(null);
      setAllowDuplicate(false);
      setSearchDesign("");
      setSearchType("");
      setHideCreatedDesigns(true);
    }
  }, [open, types, logos]);

  // Danh sách các sản phẩm mẫu để lựa chọn copy: Loại phôi, Kiểu hình phôi 1/2 áo, Vị trí in, Giá bán
  const templateOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        name: string;
        blankTypeId: string | null;
        blankTypeName: string | null;
        pos: PrintPositionData | null;
        posMap: Record<string, PrintPositionData> | null;
        imageType: "front" | "combined";
        price: number | null;
      }
    >();

    existingProducts.forEach((p) => {
      if (!p) return;
      const key = p.master_code || p.code;
      const bTypeId =
        p.blanks?.blank_type_id ||
        p.blanks?.blank_types?.id ||
        blanks.find((b) => b.id === p.blank_id)?.blank_type_id ||
        null;
      const bTypeName =
        p.blanks?.blank_types?.name ||
        types.find((t) => t.id === bTypeId)?.name ||
        null;

      const imgType: "front" | "combined" =
        p.blank_image_type === "combined" ? "combined" : "front";
      const existingEntry = map.get(key);

      if (!existingEntry) {
        map.set(key, {
          code: key,
          name: p.master_name || p.name,
          blankTypeId: bTypeId,
          blankTypeName: bTypeName,
          pos: p.print_position || null,
          posMap: p.print_positions || null,
          imageType: imgType,
          price: p.price ? Number(p.price) : null,
        });
      } else {
        if (!existingEntry.blankTypeId && bTypeId) {
          existingEntry.blankTypeId = bTypeId;
          existingEntry.blankTypeName = bTypeName;
        }
        if (!existingEntry.pos && p.print_position) {
          existingEntry.pos = p.print_position;
        }
        if (p.print_positions) {
          if (!existingEntry.posMap) {
            existingEntry.posMap = p.print_positions;
          } else {
            existingEntry.posMap = { ...existingEntry.posMap, ...p.print_positions };
          }
        }
        if (existingEntry.imageType !== "combined" && p.blank_image_type === "combined") {
          existingEntry.imageType = "combined";
        }
        if (!existingEntry.price && p.price) {
          existingEntry.price = Number(p.price);
        }
      }
    });

    return Array.from(map.values());
  }, [existingProducts, blanks, types]);

  // Khi chọn SP mẫu để copy, tự động sao chép toàn bộ: Loại phôi, Kiểu hình 1/2 áo, Vị trí in, Giá bán & Cấu hình Logo
  function handleTemplateChange(templateCode: string) {
    setSelectedTemplateCode(templateCode);
    if (!templateCode) return;
    const t = templateOptions.find((opt) => opt.code === templateCode);
    if (t) {
      // 1. Sao chép Loại Phôi
      if (t.blankTypeId && types.some((tp) => tp.id === t.blankTypeId)) {
        setSelectedTypeId(t.blankTypeId);
      }
      // 2. Sao chép Kiểu hình phôi (1 Áo hay 2 Áo)
      if (t.imageType === "combined" || t.imageType === "front") {
        setBlankImageType(t.imageType);
      }
      // 3. Sao chép Giá bán mặc định
      if (t.price && t.price > 0) {
        setDefaultPrice(String(t.price));
      }
      // 4. Sao chép Cấu hình Logo chính xác
      if (t.posMap && t.posMap["logo"] && t.posMap["logo"].visible !== false) {
        setEnableLogo(true);
        const savedLogoId = (t.posMap["logo"] as unknown as { logoId?: string; logoUrl?: string }).logoId;
        const savedLogoUrl = (t.posMap["logo"] as unknown as { logoId?: string; logoUrl?: string }).logoUrl;
        const matchedLogo = logos.find(
          (l) => l.id === savedLogoId || (savedLogoUrl && l.image_url === savedLogoUrl)
        );
        if (matchedLogo) {
          setSelectedLogoId(matchedLogo.id);
        } else if (logos.length > 0) {
          setSelectedLogoId(logos[0].id);
        }
      } else {
        setEnableLogo(false);
      }
    }
  }

  const selectedBlankType = useMemo(
    () => types.find((t) => t.id === selectedTypeId) || null,
    [types, selectedTypeId]
  );

  // Danh sách hình in đã từng tạo với phôi (selectedTypeId)
  const existingDesignIdsForSelectedType = useMemo(() => {
    if (!selectedTypeId) return new Set<string>();

    const blankIdsForSelectedType = new Set(
      blanks.filter((b) => b.blank_type_id === selectedTypeId).map((b) => b.id)
    );

    const set = new Set<string>();
    existingProducts.forEach((p) => {
      if (!p) return;
      const matchesType =
        p.blanks?.blank_type_id === selectedTypeId ||
        p.blanks?.blank_types?.id === selectedTypeId ||
        blankIdsForSelectedType.has(p.blank_id);

      if (matchesType) {
        if (p.print_design_id) set.add(p.print_design_id);
        if (Array.isArray(p.print_design_ids)) {
          p.print_design_ids.forEach((id) => {
            if (id) set.add(id);
          });
        }
      }
    });

    return set;
  }, [selectedTypeId, blanks, existingProducts]);

  // Số lượng hình in bị ẩn do đã từng tạo với phôi này
  const hiddenDesignsCount = useMemo(() => {
    if (!selectedTypeId) return 0;
    return designs.filter((d) => existingDesignIdsForSelectedType.has(d.id)).length;
  }, [selectedTypeId, designs, existingDesignIdsForSelectedType]);

  // Tự động bỏ chọn các hình in đã ẩn nếu loại phôi thay đổi hoặc bật ẩn
  useEffect(() => {
    if (hideCreatedDesigns && existingDesignIdsForSelectedType.size > 0) {
      setSelectedDesignIds((prev) =>
        prev.filter((id) => !existingDesignIdsForSelectedType.has(id))
      );
    }
  }, [selectedTypeId, hideCreatedDesigns, existingDesignIdsForSelectedType]);

  const selectedDesigns = useMemo(
    () => designs.filter((d) => selectedDesignIds.includes(d.id)),
    [designs, selectedDesignIds]
  );

  // Lọc danh sách loại phôi theo từ khóa
  const filteredTypes = useMemo(() => {
    return types.filter(
      (t) =>
        t.name.toLowerCase().includes(searchType.toLowerCase()) ||
        t.code.toLowerCase().includes(searchType.toLowerCase())
    );
  }, [types, searchType]);

  // Lọc danh sách hình in theo từ khóa và theo bộ lọc ẩn hình in đã tạo
  const filteredDesigns = useMemo(() => {
    return designs.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchDesign.toLowerCase()) ||
        d.code.toLowerCase().includes(searchDesign.toLowerCase()) ||
        (d.theme || "").toLowerCase().includes(searchDesign.toLowerCase());

      if (!matchesSearch) return false;

      // Ẩn các hình in đã từng tạo với phôi được chọn
      if (hideCreatedDesigns && existingDesignIdsForSelectedType.has(d.id)) {
        return false;
      }

      return true;
    });
  }, [designs, searchDesign, hideCreatedDesigns, existingDesignIdsForSelectedType]);

  const availableBlanks = useMemo(() => {
    if (!selectedTypeId) return [];
    return blanks.filter((b) => b.blank_type_id === selectedTypeId);
  }, [blanks, selectedTypeId]);

  // Danh sách các Sản phẩm Chung riêng biệt sẽ được khởi tạo
  const productsToGenerate = useMemo(() => {
    if (!selectedBlankType || selectedDesigns.length === 0) return [];

    return selectedDesigns.map((d) => {
      const masterCode = `${selectedBlankType.code}-${d.code}`;
      const masterName = `MEO BAO ${selectedBlankType.name} ${d.name}`;

      const existing = existingProducts.find(
        (p) =>
          p &&
          (p.blanks?.blank_type_id === selectedBlankType.id ||
            p.blanks?.blank_types?.id === selectedBlankType.id) &&
          (p.print_design_id === d.id || p.print_design_ids?.includes(d.id))
      );

      return {
        design: d,
        masterCode,
        masterName,
        isDuplicate: !!existing,
        existingProduct: existing,
      };
    });
  }, [selectedBlankType, selectedDesigns, existingProducts]);

  // Đếm số sản phẩm bị trùng
  const duplicateProductsCount = useMemo(
    () => productsToGenerate.filter((p) => p.isDuplicate).length,
    [productsToGenerate]
  );

  const totalVariantsCount = productsToGenerate.length * availableBlanks.length;

  // Handler toggle chọn hình in
  function toggleSelectDesign(id: string) {
    setSelectedDesignIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  }

  // Thực hiện khởi tạo siêu tốc hàng loạt sản phẩm
  async function handleQuickCreate() {
    setError(null);
    if (!selectedTypeId) {
      setError("Vui lòng chọn 1 loại phôi.");
      return;
    }
    if (selectedDesignIds.length === 0) {
      setError("Vui lòng chọn ít nhất 1 hình in.");
      return;
    }
    if (availableBlanks.length === 0) {
      setError("Loại phôi này chưa có danh sách màu & size phôi.");
      return;
    }

    setSaving(true);
    try {
      const selectedTemplate = templateOptions.find((t) => t.code === selectedTemplateCode);
      const defaultPosition =
        blankImageType === "combined"
          ? { posX: 28, posY: 38, scale: 35, visible: true }
          : { posX: 50, posY: 38, scale: 45, visible: true };

      const targetPosition = selectedTemplate?.pos || defaultPosition;
      const targetPositionsMap = selectedTemplate?.posMap || null;
      const targetImageType = blankImageType;
      const currentSelectedLogo = logos.find((l) => l.id === selectedLogoId) || logos[0] || null;

      const recordsToInsert: Record<string, unknown>[] = [];

      for (const item of productsToGenerate) {
        if (item.isDuplicate && !allowDuplicate) continue;

        // Xây dựng map vị trí chuẩn cho từng hình in & logo của sản phẩm mới này
        const itemPositionsMap: Record<string, PrintPositionData> = {};
        const posForDesign = selectedTemplate?.pos || (
          item.design.is_back && blankImageType === "combined"
            ? { posX: 72, posY: 38, scale: 35, visible: true }
            : defaultPosition
        );
        itemPositionsMap[item.design.id] = { ...posForDesign };

        if (enableLogo && currentSelectedLogo) {
          const baseLogoPos = targetPositionsMap?.["logo"] || {
            posX: blankImageType === "combined" ? 21 : 38,
            posY: 28,
            scale: 16,
            visible: true,
          };
          itemPositionsMap["logo"] = {
            ...baseLogoPos,
            logoId: currentSelectedLogo.id,
            logoUrl: currentSelectedLogo.image_url,
          } as PrintPositionData;
        }

        for (const b of availableBlanks) {
          const vCode = `${item.masterCode}-${b.color}-${b.size}`;
          const vName = `${item.masterName} (${formatColorName(b.color)} - ${b.size})`;

          recordsToInsert.push({
            code: vCode,
            name: vName,
            master_code: item.masterCode,
            master_name: item.masterName,
            blank_id: b.id,
            print_design_id: item.design.id,
            print_design_ids: [item.design.id],
            price: Number(defaultPrice) || Number(b.price) || 250000,
            status: "active",
            print_position: targetPosition,
            print_positions: itemPositionsMap,
            blank_image_type: targetImageType,
            images: [],
          });
        }
      }

      if (recordsToInsert.length === 0) {
        setError("Tất cả sản phẩm đã chọn đều bị trùng và không được phép khởi tạo.");
        return;
      }

      const { error: insertErr } = await supabase.from("products").insert(recordsToInsert);
      if (insertErr) throw insertErr;

      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="⚡ Khởi Tạo Hàng Loạt Sản Phẩm Siêu Tốc" size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch select-none text-xs">
        {/* CỘT TRÁI (5/12): BƯỚC 1 (CHỌN 1 PHÔI) & BƯỚC 2 (CHỌN NHIỀU HÌNH IN) TẠO XONG NẰM TRÊN DƯỚI */}
        <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
          {/* BƯỚC 1: CHỌN 1 LOẠI PHÔI */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Package size={14} className="text-brand-400" /> Bước 1: Chọn 1 Loại Phôi
              </span>
              <span className="text-[10px] text-slate-400">{filteredTypes.length} phôi</span>
            </div>
            <SearchInput value={searchType} onChange={setSearchType} placeholder="Tìm loại phôi..." />

            <div className="max-h-[135px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredTypes.map((t) => {
                const isSelected = t.id === selectedTypeId;
                const blankCount = blanks.filter((b) => b.blank_type_id === t.id).length;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTypeId(t.id)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-brand-500/20 border-brand-500 text-brand-300 font-bold shadow-sm"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="truncate">
                      <p className="font-semibold truncate">{t.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{t.code}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                        {blankCount} màu/size
                      </span>
                      {isSelected && <Check size={14} className="text-brand-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BƯỚC 2: CHỌN NHIỀU HÌNH IN */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-brand-400" /> Bước 2: Chọn Hình In ({selectedDesignIds.length})
              </span>
              {selectedDesignIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDesignIds([])}
                  className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>

            <SearchInput value={searchDesign} onChange={setSearchDesign} placeholder="Tìm mã, tên hình in..." />

            {/* Checkbox ẩn/hiện hình in đã tạo */}
            {selectedTypeId && hiddenDesignsCount > 0 && (
              <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-[10px]">
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <EyeOff size={12} /> Đã ẩn {hiddenDesignsCount} hình in đã tạo
                </span>
                <label className="flex items-center gap-1 text-slate-300 cursor-pointer select-none hover:text-white">
                  <input
                    type="checkbox"
                    checked={hideCreatedDesigns}
                    onChange={(e) => setHideCreatedDesigns(e.target.checked)}
                    className="w-3 h-3 rounded accent-brand-500 cursor-pointer"
                  />
                  <span>Ẩn đã tạo</span>
                </label>
              </div>
            )}

            <div className="flex-1 min-h-[170px] max-h-[220px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredDesigns.map((d) => {
                const isSelected = selectedDesignIds.includes(d.id);
                const isAlreadyCreated = existingDesignIdsForSelectedType.has(d.id);

                return (
                  <div
                    key={d.id}
                    onClick={() => toggleSelectDesign(d.id)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-brand-500/20 border-brand-500 text-brand-300 font-bold shadow-sm"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {d.png_url ? (
                        <img
                          src={d.png_url}
                          alt=""
                          className="w-6 h-6 object-contain rounded bg-slate-950 p-0.5 border border-slate-800 shrink-0"
                        />
                      ) : (
                        <ImageIcon size={18} className="text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <p className="font-medium truncate text-xs">{d.name}</p>
                          {d.is_back && (
                            <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-semibold shrink-0 border border-amber-500/30">
                              Mặt sau
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-slate-400">{d.code}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isAlreadyCreated && !hideCreatedDesigns && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] border border-amber-500/20">
                          Đã tạo
                        </span>
                      )}
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center gap-1">
                          <Check size={11} /> Đã chọn
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] border border-slate-700">
                          + Chọn
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredDesigns.length === 0 && (
                <p className="text-[11px] text-slate-500 italic text-center py-6">
                  {hideCreatedDesigns && hiddenDesignsCount > 0
                    ? "Tất cả hình in phù hợp đã được tạo với phôi này."
                    : "Không tìm thấy hình in nào."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (7/12): BẢNG XEM TRƯỚC KẾT QUẢ VÀ NÚT KÍCH HOẠT */}
        <div className="lg:col-span-7 p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            {/* TIÊU ĐỀ XEM TRƯỚC */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-brand-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Sparkles size={14} /> Danh Sách Sản Phẩm Sẽ Tạo:
              </span>
              {productsToGenerate.length > 0 && availableBlanks.length > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 text-emerald-400 border border-slate-700">
                  Sẽ tạo: {productsToGenerate.length} SP ({totalVariantsCount} biến thể)
                </span>
              )}
            </div>

            {/* DANH SÁCH SẢN PHẨM CHUNG SẼ TẠO */}
            {productsToGenerate.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                <Sparkles size={24} className="mx-auto text-slate-600 animate-pulse" />
                <p className="text-slate-400 font-medium">Vui lòng chọn Loại phôi & chọn các Hình in bên trái...</p>
                <p className="text-[11px] text-slate-500">Các sản phẩm tương ứng sẽ xuất hiện tại đây để bạn xem trước.</p>
              </div>
            ) : (
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {productsToGenerate.map((item, idx) => (
                  <div
                    key={item.design.id}
                    className={`p-2 rounded-lg border flex items-center justify-between text-xs transition-all ${
                      item.isDuplicate
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.design.png_url ? (
                        <img
                          src={item.design.png_url}
                          alt=""
                          className="w-7 h-7 object-contain rounded bg-slate-950 p-0.5 border border-slate-800 shrink-0"
                        />
                      ) : (
                        <ImageIcon size={20} className="text-slate-600 shrink-0" />
                      )}
                      <div className="min-w-0 truncate">
                        <p className="font-semibold truncate">
                          {idx + 1}. {item.masterName}
                          {item.isDuplicate && <span className="ml-1.5 text-[10px] text-rose-400 font-bold">(Trùng)</span>}
                        </p>
                        <p className="font-mono text-[10px] text-brand-400 font-bold">{item.masterCode}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* THÔNG TIN BỔ SUNG: GIÁ BÁN & SP MẪU & LOẠI HÌNH 1/2 ÁO & LOGO */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Giá bán mặc định (VND):</label>
                  <input
                    type="number"
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs font-bold outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1 truncate">
                    <Copy size={12} className="text-amber-400 shrink-0" /> Copy từ SP mẫu (Vị trí & Loại áo):
                  </label>
                  <select
                    value={selectedTemplateCode}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs outline-none focus:border-amber-500 truncate"
                  >
                    <option value="">-- Mặc định (Tự căn vị trí) --</option>
                    {templateOptions.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.code} — {t.name} ({t.blankTypeName ? t.blankTypeName + " • " : ""}{t.imageType === "combined" ? "2 Áo" : "1 Áo"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lựa chọn loại hình mockup (Được tự động copy khi chọn SP mẫu) */}
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    Loại hình phôi mockup:
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedTemplateCode ? "✨ Đã copy cấu hình từ SP mẫu" : "Chọn hiển thị 1 mặt hay 2 mặt"}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBlankImageType("front")}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1 border ${
                      blankImageType === "front"
                        ? "bg-brand-500/20 border-brand-500/50 text-brand-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>👕</span> 1 Áo (Mặt trước)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlankImageType("combined")}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1 border ${
                      blankImageType === "combined"
                        ? "bg-brand-500/20 border-brand-500/50 text-brand-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>👕👕</span> 2 Áo (Trước & Sau)
                  </button>
                </div>
              </div>

              {/* Lựa chọn Logo thương hiệu (Tự động copy từ SP mẫu nếu có) */}
              {logos && logos.length > 0 && (
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-emerald-400" /> Ghép Logo thương hiệu:
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                      <input
                        type="checkbox"
                        checked={enableLogo}
                        onChange={(e) => {
                          setEnableLogo(e.target.checked);
                          if (e.target.checked && !selectedLogoId && logos.length > 0) {
                            setSelectedLogoId(logos[0].id);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                      />
                      <span className={enableLogo ? "text-emerald-400 font-bold" : "text-slate-400"}>
                        {enableLogo ? "Có ghép Logo" : "Không ghép Logo"}
                      </span>
                    </label>
                  </div>

                  {enableLogo && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                      {/* Thumbnail ảnh logo đang chọn */}
                      {(() => {
                        const cur = logos.find((l) => l.id === selectedLogoId) || logos[0];
                        return cur ? (
                          <div className="w-7 h-7 rounded bg-slate-950 border border-slate-700 p-0.5 flex items-center justify-center shrink-0">
                            <img src={cur.image_url} alt="" className="w-full h-full object-contain" />
                          </div>
                        ) : null;
                      })()}
                      <select
                        value={selectedLogoId || (logos[0]?.id ?? "")}
                        onChange={(e) => setSelectedLogoId(e.target.value)}
                        className="flex-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs outline-none focus:border-emerald-500 truncate"
                      >
                        {logos.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code} — {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ⚠️ CẢNH BÁO TRÙNG SẢN PHẨM */}
            {duplicateProductsCount > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>⚠️ PHÁT HIỆN {duplicateProductsCount}/{productsToGenerate.length} SẢN PHẨM ĐÃ TỒN TẠI!</span>
                </div>
                <label className="flex items-center gap-2 font-medium text-rose-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(e) => setAllowDuplicate(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-rose-500 cursor-pointer"
                  />
                  <span>Vẫn khởi tạo các sản phẩm bị trùng lặp này</span>
                </label>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-400 font-semibold pt-1">{error}</p>}

          {/* NÚT THỰC HIỆN KÍCH HOẠT */}
          <div className="pt-3 border-t border-slate-800 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleQuickCreate}
              disabled={
                saving ||
                !selectedTypeId ||
                selectedDesignIds.length === 0 ||
                (duplicateProductsCount === productsToGenerate.length && !allowDuplicate)
              }
              className="flex-2 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Đang tạo sản phẩm...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> ⚡ Tạo Hàng Loạt ({productsToGenerate.length} SP - {totalVariantsCount} biến thể)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
