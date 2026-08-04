import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Blank, BlankType, Color, Size } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field, Select } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, Pencil, Trash2, Loader2, Package, CheckSquare, Square, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

interface GroupedBlank {
  groupKey: string;
  baseCode: string;
  blank_type_id: string;
  blank_type_name?: string;
  color: string;
  price: number;
  image_url: string | null;
  image_back_url?: string | null;
  sizes: string[];
  items: Blank[];
}

export function BlanksPage() {
  const [items, setItems] = useState<Blank[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupedBlank | null>(null);

  const [form, setForm] = useState({
    code: "",
    blank_type_id: "",
    color: "",
    selectedSizes: [] as string[],
    price: "",
    image_url: "" as string | null,
    image_back_url: "" as string | null,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [bl, ty, cl, sz] = await Promise.all([
      supabase
        .from("blanks")
        .select("*, blank_types(*)")
        .order("created_at", { ascending: false }),
      supabase.from("blank_types").select("*").order("name"),
      supabase.from("colors").select("*").order("name"),
      supabase.from("sizes").select("*").order("sort_order"),
    ]);
    setItems((bl.data as Blank[]) || []);
    setTypes((ty.data as BlankType[]) || []);
    setColors((cl.data as Color[]) || []);
    setSizes((sz.data as Size[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingGroup(null);
    setForm({
      code: "",
      blank_type_id: "",
      color: "",
      selectedSizes: sizes.map((s) => s.code), // Mặc định chọn tất cả size
      price: "",
      image_url: null,
      image_back_url: null,
    });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(group: GroupedBlank) {
    setEditingGroup(group);
    setForm({
      code: group.baseCode,
      blank_type_id: group.blank_type_id,
      color: group.color,
      selectedSizes: group.sizes,
      price: String(group.price),
      image_url: group.image_url,
      image_back_url: group.image_back_url || null,
    });
    setError(null);
    setModalOpen(true);
  }

  function toggleSize(sizeCode: string) {
    if (form.selectedSizes.includes(sizeCode)) {
      setForm({
        ...form,
        selectedSizes: form.selectedSizes.filter((s) => s !== sizeCode),
      });
    } else {
      setForm({
        ...form,
        selectedSizes: [...form.selectedSizes, sizeCode],
      });
    }
  }

  function selectAllSizes() {
    setForm({ ...form, selectedSizes: sizes.map((s) => s.code) });
  }

  function deselectAllSizes() {
    setForm({ ...form, selectedSizes: [] });
  }

  async function handleSave() {
    setError(null);
    if (!form.code.trim() || !form.blank_type_id || !form.color) {
      setError("Mã phôi, loại phôi và màu sắc là bắt buộc.");
      return;
    }
    if (form.selectedSizes.length === 0) {
      setError("Vui lòng chọn ít nhất 1 size.");
      return;
    }

    setSaving(true);
    const baseCode = form.code.trim().toUpperCase();
    const priceNum = Number(form.price) || 0;

    try {
      if (editingGroup) {
        // Cập nhật phôi đã có bằng cách update theo ID của từng size để không bị đụng khoá ngoại và đụng mã trùng
        const existingItemsByDb = editingGroup.items;
        const existingMapBySize = new Map<string, Blank>();
        existingItemsByDb.forEach((item) => {
          if (item.size) existingMapBySize.set(item.size, item);
        });

        const toUpdate: Blank[] = [];
        const toInsert: Array<{
          code: string;
          blank_type_id: string;
          color: string;
          size: string;
          price: number;
          image_url: string | null;
          image_back_url: string | null;
        }> = [];
        const currentSizeSet = new Set(form.selectedSizes);

        // Tìm các size bị người dùng bỏ chọn
        const idsToDelete = existingItemsByDb
          .filter((item) => item.size && !currentSizeSet.has(item.size))
          .map((item) => item.id);

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase.from("blanks").delete().in("id", idsToDelete);
          if (delErr) {
            console.warn("Không thể xóa bớt một số size cũ do đã liên kết sản phẩm:", delErr.message);
          }
        }

        form.selectedSizes.forEach((szCode) => {
          const fullCode = baseCode.endsWith(`-${szCode}`) ? baseCode : `${baseCode}-${szCode}`;
          const existing = existingMapBySize.get(szCode);
          if (existing) {
            toUpdate.push({
              ...existing,
              code: fullCode,
              blank_type_id: form.blank_type_id,
              color: form.color,
              price: priceNum,
              image_url: form.image_url,
              image_back_url: form.image_back_url,
            });
          } else {
            toInsert.push({
              code: fullCode,
              blank_type_id: form.blank_type_id,
              color: form.color,
              size: szCode,
              price: priceNum,
              image_url: form.image_url,
              image_back_url: form.image_back_url,
            });
          }
        });

        // 1. Cập nhật từng dòng phôi đã có
        for (const item of toUpdate) {
          const { error: upErr } = await supabase
            .from("blanks")
            .update({
              code: item.code,
              blank_type_id: item.blank_type_id,
              color: item.color,
              price: item.price,
              image_url: item.image_url,
              image_back_url: item.image_back_url,
            })
            .eq("id", item.id);
          if (upErr) throw upErr;
        }

        // 2. Thêm mới các size mới được chọn thêm
        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from("blanks").insert(toInsert);
          if (insErr) throw insErr;
        }
      } else {
        // Tạo hàng loạt (Batch insert) danh sách phôi tương ứng với từng Size được tích chọn
        const batchPayload = form.selectedSizes.map((szCode) => {
          const fullCode = baseCode.endsWith(`-${szCode}`) ? baseCode : `${baseCode}-${szCode}`;
          return {
            code: fullCode,
            blank_type_id: form.blank_type_id,
            color: form.color,
            size: szCode,
            price: priceNum,
            image_url: form.image_url,
            image_back_url: form.image_back_url,
          };
        });

        const { error: insertErr } = await supabase.from("blanks").insert(batchPayload);
        if (insertErr) throw insertErr;
      }

      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const dbErr = err as { code?: string; message?: string };
      if (dbErr?.code === "23505" || dbErr?.message?.includes("blanks_code_key") || dbErr?.message?.includes("unique constraint")) {
        setError(`Mã phôi "${baseCode}" hoặc biến thể size của nó đã bị trùng với phôi đã có trong hệ thống. Vui lòng kiểm tra hoặc đổi Mã phôi cơ sở.`);
      } else {
        setError(dbErr?.message || "Đã xảy ra lỗi khi lưu phôi.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(group: GroupedBlank) {
    if (!confirm(`Xóa toàn bộ các biến thể size của phôi "${group.baseCode}"?`)) return;
    const ids = group.items.map((i) => i.id);
    const { error } = await supabase.from("blanks").delete().in("id", ids);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  // Hàm gom nhóm các phôi cùng loại + màu + ảnh thành 1 Master Row
  function getGroupedBlanks(blanks: Blank[]): GroupedBlank[] {
    const map = new Map<string, GroupedBlank>();

    for (const b of blanks) {
      const groupKey = `${b.blank_type_id}_${b.color}_${b.image_url || ""}_${b.image_back_url || ""}_${b.price}`;

      let baseCode = b.code;
      if (b.size && baseCode.endsWith(`-${b.size}`)) {
        baseCode = baseCode.slice(0, -(b.size.length + 1));
      }

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          baseCode,
          blank_type_id: b.blank_type_id,
          blank_type_name: b.blank_types?.name,
          color: b.color,
          price: b.price,
          image_url: b.image_url,
          image_back_url: b.image_back_url,
          sizes: b.size ? [b.size] : [],
          items: [b],
        });
      } else {
        const existing = map.get(groupKey)!;
        if (b.size && !existing.sizes.includes(b.size)) {
          existing.sizes.push(b.size);
        }
        existing.items.push(b);
      }
    }

    return Array.from(map.values());
  }

  const grouped = getGroupedBlanks(items);

  const filteredGrouped = grouped.filter((g) => {
    const matchSearch =
      g.baseCode.toLowerCase().includes(search.toLowerCase()) ||
      g.color.toLowerCase().includes(search.toLowerCase()) ||
      g.sizes.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchType = !filterType || g.blank_type_id === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Quản lý Phôi"
        subtitle="Quản lý phôi theo mẫu phôi mẹ và các biến thể size (Master-Variant)"
        actions={
          <>
            <Select
              label=""
              value={filterType}
              onChange={setFilterType}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Tất cả loại"
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm mẫu phôi..." />
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20 shrink-0"
            >
              <Plus size={18} /> Thêm phôi mới
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-600" size={32} />
        </div>
      ) : filteredGrouped.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-700/50">
          <EmptyState message="Chưa có phôi nào. Nhấn Thêm phôi mới để tạo." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGrouped.map((group) => {
            const colorObj = colors.find((c) => c.code === group.color);
            return (
              <div
                key={group.groupKey}
                className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-square bg-slate-800/30 flex items-center justify-center overflow-hidden relative group/img font-mono">
                    {group.image_url || group.image_back_url ? (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <img
                          src={group.image_url || group.image_back_url || ""}
                          alt={group.baseCode}
                          className="w-full h-full object-contain p-2"
                        />
                        {group.image_url && group.image_back_url && (
                          <div className="absolute bottom-2 left-2 flex gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-white">
                              2 Hình
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Package size={40} className="text-slate-700" />
                    )}
                    <span className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md text-[11px] font-mono font-medium text-emerald-400 border border-slate-700">
                      {group.sizes.length} Size
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-bold text-brand-400">{group.baseCode}</span>
                      <span className="text-sm font-bold text-slate-200">
                        {formatCurrency(group.price)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-2">
                      {group.blank_type_name || "—"}
                    </p>

                    <div className="flex items-center justify-between gap-2 mb-3">
                      {colorObj && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-300">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0"
                            style={{ background: colorObj.hex || "#ccc" }}
                          />
                          {colorObj.name} ({colorObj.code})
                        </span>
                      )}
                    </div>

                    {/* Hiển thị phân loại 2 hình phôi nếu có */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-3 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className={`px-1.5 py-0.5 rounded ${group.image_url ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"}`}>
                        {group.image_url ? "✓ Hình 1: 1 Áo" : "✕ Hình 1"}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${group.image_back_url ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-500"}`}>
                        {group.image_back_url ? "✓ Hình 2: 2 Mặt" : "✕ Hình 2"}
                      </span>
                    </div>

                    {/* Danh sách các Biến thể Size */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 block">Các size sẵn có:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.sizes.map((sz) => (
                          <span
                            key={sz}
                            className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 font-semibold"
                          >
                            {sz}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex gap-2">
                  <button
                    onClick={() => openEdit(group)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors"
                  >
                    <Pencil size={14} /> Sửa mẫu & Size
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    className="px-3 py-2 rounded-xl border border-slate-700 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                    title="Xóa mẫu phôi này"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Chỉnh sửa Phôi Biến Thể */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGroup ? `Sửa phôi (${editingGroup.baseCode})` : "Thêm mẫu phôi mới"}
        size="xl"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Field
              label="Mã phôi cơ sở (Master Code)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="CT220-BLK"
            />
            <Select
              label="Loại phôi"
              value={form.blank_type_id}
              onChange={(v) => setForm({ ...form, blank_type_id: v })}
              options={types.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` }))}
              placeholder="Chọn loại phôi"
            />
            <Select
              label="Màu sắc"
              value={form.color}
              onChange={(v) => setForm({ ...form, color: v })}
              options={colors.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
              placeholder="Chọn màu sắc"
            />
            <Field
              label="Giá phôi (VND)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="120000"
            />

            {/* Chọn nhiều Size biến thể cùng lúc */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-300">
                  Chọn các Size biến thể có sẵn:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllSizes}
                    className="text-xs text-brand-400 hover:underline font-medium"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={deselectAllSizes}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {sizes.map((s) => {
                  const checked = form.selectedSizes.includes(s.code);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSize(s.code)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        checked
                          ? "bg-brand-500/10 border-brand-500/40 text-brand-400"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      <span>{s.name}</span>
                      {checked ? (
                        <CheckSquare size={14} className="text-brand-400" />
                      ) : (
                        <Square size={14} className="text-slate-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <ImageUpload
              folder="blanks"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              label="Hình 1: Áo phía trước (1 áo mặt trước)"
              customCode={form.code ? `PHOI_${form.code}_FRONT` : undefined}
              oldUrl={editingGroup?.image_url}
            />

            <ImageUpload
              folder="blanks"
              value={form.image_back_url}
              onChange={(url) => setForm({ ...form, image_back_url: url })}
              label="Hình 2: Cả trước & sau áo (Mặt trước + Mặt sau)"
              customCode={form.code ? `PHOI_${form.code}_COMBINED` : undefined}
              oldUrl={editingGroup?.image_back_url}
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}

        <div className="flex gap-2.5 pt-5 border-t border-slate-800 mt-4">
          <button
            onClick={() => setModalOpen(false)}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {editingGroup ? "Lưu thay đổi mẫu phôi" : "Tạo mẫu phôi & các Size"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
