import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Blank, BlankType, Color, Size } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field, Select } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

export function BlanksPage() {
  const [items, setItems] = useState<Blank[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Blank | null>(null);
  const [form, setForm] = useState({
    code: "",
    blank_type_id: "",
    color: "",
    size: "",
    price: "",
    image_url: "" as string | null,
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
    setEditing(null);
    setForm({ code: "", blank_type_id: "", color: "", size: "", price: "", image_url: null });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: Blank) {
    setEditing(item);
    setForm({
      code: item.code,
      blank_type_id: item.blank_type_id,
      color: item.color,
      size: item.size,
      price: String(item.price),
      image_url: item.image_url,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.code.trim() || !form.blank_type_id || !form.color || !form.size) {
      setError("Mã, loại phôi, màu, size là bắt buộc.");
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      blank_type_id: form.blank_type_id,
      color: form.color,
      size: form.size,
      price: Number(form.price) || 0,
      image_url: form.image_url,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("blanks").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blanks").insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Blank) {
    if (!confirm(`Xóa phôi "${item.code}"?`)) return;
    const { error } = await supabase.from("blanks").delete().eq("id", item.id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  const filtered = items.filter((i) => {
    const matchSearch =
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.color.toLowerCase().includes(search.toLowerCase()) ||
      i.size.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || i.blank_type_id === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Phôi"
        subtitle="Quản lý phôi theo loại, màu, size và giá"
        actions={
          <>
            <Select
              label=""
              value={filterType}
              onChange={setFilterType}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Tất cả loại"
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm phôi..." />
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus size={18} /> Thêm
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-700/50">
          <EmptyState message="Chưa có phôi nào. Nhấn Thêm để tạo." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const colorObj = colors.find((c) => c.code === item.color);
            return (
              <div
                key={item.id}
                className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-colors group"
              >
                <div className="aspect-square bg-slate-800/30 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.code} className="w-full h-full object-contain" />
                  ) : (
                    <Package size={40} className="text-slate-700" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-semibold text-brand-400">{item.code}</span>
                    <span className="text-sm font-bold text-slate-200">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {item.blank_types?.name || "—"}
                  </p>
                  <div className="flex items-center gap-2">
                    {colorObj && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-600"
                          style={{ background: colorObj.hex || "#ccc" }}
                        />
                        {colorObj.name}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-xs font-medium text-slate-400">
                      {item.size}
                    </span>
                  </div>
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={() => openEdit(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors"
                  >
                    <Pencil size={14} /> Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="px-3 py-2 rounded-xl border border-slate-700 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Sửa phôi" : "Thêm phôi"}
        size="xl"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Field
              label="Mã phôi"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="CT220"
            />
            <Select
              label="Loại phôi"
              value={form.blank_type_id}
              onChange={(v) => setForm({ ...form, blank_type_id: v })}
              options={types.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` }))}
              placeholder="Chọn loại phôi"
            />
            <Select
              label="Màu"
              value={form.color}
              onChange={(v) => setForm({ ...form, color: v })}
              options={colors.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
              placeholder="Chọn màu"
            />
            <Select
              label="Size"
              value={form.size}
              onChange={(v) => setForm({ ...form, size: v })}
              options={sizes.map((s) => ({ value: s.code, label: s.name }))}
              placeholder="Chọn size"
            />
            <Field
              label="Giá (VND)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <ImageUpload
              folder="blanks"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              label="Ảnh phôi"
            />
          </div>
        </div>
        {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}
        <div className="flex gap-2.5 pt-5">
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
            {saving && <Loader2 size={16} className="animate-spin" />} Lưu
          </button>
        </div>
      </Modal>
    </div>
  );
}
