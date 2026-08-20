import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrintDesign, Theme } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field, Select } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { Plus, Pencil, Trash2, Loader2, Image as ImageIcon, Tag, X, Crop, Check } from "lucide-react";

export function PrintDesignsPage() {
  const [items, setItems] = useState<PrintDesign[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterSide, setFilterSide] = useState<string>("all"); // "all" | "front" | "back"
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PrintDesign | null>(null);
  const [croppingItem, setCroppingItem] = useState<PrintDesign | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    theme: "",
    png_url: "" as string | null,
    thumbnail_url: "" as string | null,
    tags: [] as string[],
    notes: "",
    is_back: false,
  });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pd, th] = await Promise.all([
      supabase.from("print_designs").select("*").order("created_at", { ascending: false }),
      supabase.from("themes").select("*").order("name"),
    ]);
    setItems((pd.data as PrintDesign[]) || []);
    setThemes((th.data as Theme[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      code: "",
      name: "",
      theme: "",
      png_url: null,
      thumbnail_url: null,
      tags: [],
      notes: "",
      is_back: false,
    });
    setTagInput("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: PrintDesign) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      theme: item.theme || "",
      png_url: item.png_url,
      thumbnail_url: item.thumbnail_url,
      tags: item.tags || [],
      notes: item.notes || "",
      is_back: Boolean(item.is_back),
    });
    setTagInput("");
    setError(null);
    setModalOpen(true);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] });
      setTagInput("");
    }
  }

  function removeTag(t: string) {
    setForm({ ...form, tags: form.tags.filter((x) => x !== t) });
  }

  async function handleToggleIsBack(item: PrintDesign) {
    const nextVal = !item.is_back;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_back: nextVal } : i))
    );
    try {
      const { error } = await supabase
        .from("print_designs")
        .update({ is_back: nextVal })
        .eq("id", item.id);
      if (error) throw error;
    } catch (err) {
      alert("Lỗi cập nhật vị trí hình in: " + (err as Error).message);
      // rollback
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_back: !nextVal } : i))
      );
    }
  }

  async function handleSave() {
    setError(null);
    if (!form.code.trim() || !form.name.trim()) {
      setError("Mã và tên là bắt buộc.");
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      theme: form.theme || null,
      png_url: form.png_url,
      thumbnail_url: form.thumbnail_url,
      tags: form.tags.length ? form.tags : null,
      notes: form.notes || null,
      is_back: Boolean(form.is_back),
    };
    try {
      if (editing) {
        const { error } = await supabase.from("print_designs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("print_designs").insert(payload);
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

  async function handleDelete(item: PrintDesign) {
    if (!confirm(`Xóa hình in "${item.name}"?`)) return;
    const { error } = await supabase.from("print_designs").delete().eq("id", item.id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  async function handleSaveCroppedImage(newUrl: string) {
    if (!croppingItem) return;
    const { error } = await supabase
      .from("print_designs")
      .update({ png_url: newUrl, thumbnail_url: newUrl })
      .eq("id", croppingItem.id);
    if (error) {
      alert("Lỗi cập nhật hình in: " + error.message);
      return;
    }
    setCroppingItem(null);
    await load();
  }

  const filtered = items.filter((i) => {
    const matchSearch =
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchTheme = !filterTheme || i.theme === filterTheme;
    const matchSide =
      filterSide === "all" ||
      (filterSide === "back" && Boolean(i.is_back)) ||
      (filterSide === "front" && !i.is_back);
    return matchSearch && matchTheme && matchSide;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Hình in"
        subtitle="Quản lý hình in (file PNG nền trong, vị trí in trước/sau, thumbnail, tag)"
        actions={
          <>
            <Select
              label=""
              value={filterSide}
              onChange={setFilterSide}
              options={[
                { value: "all", label: "Tất cả vị trí" },
                { value: "front", label: "👕 Chỉ mặt trước" },
                { value: "back", label: "🔙 Chỉ mặt sau (In sau)" },
              ]}
              placeholder="Vị trí in"
            />
            <Select
              label=""
              value={filterTheme}
              onChange={setFilterTheme}
              options={themes.map((t) => ({ value: t.name, label: t.name }))}
              placeholder="Tất cả chủ đề"
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm hình in..." />
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
          <EmptyState message="Chưa có hình in nào phù hợp. Nhấn Thêm để tạo mới." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`card-gradient rounded-2xl border transition-all group flex flex-col justify-between ${
                item.is_back
                  ? "border-amber-500/40 hover:border-amber-500/70"
                  : "border-slate-700/50 hover:border-slate-600"
              }`}
            >
              <div>
                <div className="aspect-square bg-slate-800/30 flex items-center justify-center overflow-hidden relative">
                  {item.thumbnail_url || item.png_url ? (
                    <img
                      src={(item.thumbnail_url || item.png_url) as string}
                      alt={item.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <ImageIcon size={36} className="text-slate-700" />
                  )}

                  {/* Mã hình in */}
                  <div className="absolute top-2 left-2 flex gap-1 z-10">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-300 text-[10px] font-mono border border-slate-800 backdrop-blur-sm">
                      {item.code}
                    </span>
                  </div>

                  {/* Dấu tích nhanh / Nút badge Mặt sau ở góc trên bên phải */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleIsBack(item);
                    }}
                    title={item.is_back ? "Đang áp dụng Mặt sau (Click để bỏ chọn)" : "Click để áp dụng cho Mặt sau của áo"}
                    className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all shadow-md z-10 ${
                      item.is_back
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400 border border-amber-400"
                        : "bg-slate-950/80 text-slate-400 border border-slate-700/80 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded flex items-center justify-center border transition-colors ${
                        item.is_back
                          ? "border-slate-950 bg-slate-950 text-amber-400"
                          : "border-slate-500 bg-slate-800"
                      }`}
                    >
                      {item.is_back && <Check size={10} strokeWidth={4} />}
                    </span>
                    <span>{item.is_back ? "Mặt sau" : "Mặt trước"}</span>
                  </button>

                  {/* Action buttons khi hover */}
                  <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 p-2">
                    <button
                      onClick={() => setCroppingItem(item)}
                      title="Cắt & Sửa viền hình in"
                      className="p-2 rounded-lg bg-slate-800 text-slate-200 shadow-lg hover:text-brand-400 border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                      <Crop size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      title="Chỉnh sửa thông tin"
                      className="p-2 rounded-lg bg-slate-800 text-slate-200 shadow-lg hover:text-brand-400 border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      title="Xóa hình in"
                      className="p-2 rounded-lg bg-slate-800 text-slate-200 shadow-lg hover:text-rose-400 border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="p-3 pb-2">
                  <p className="text-sm font-semibold text-slate-200 truncate" title={item.name}>
                    {item.name}
                  </p>
                  {item.theme && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 text-[11px] font-medium">
                      {item.theme}
                    </span>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] text-slate-500">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dấu tích checkbox ở chân thẻ hình in */}
              <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/30 flex items-center justify-between">
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 cursor-pointer text-xs select-none group/chk w-full"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.is_back)}
                    onChange={() => handleToggleIsBack(item)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer accent-amber-500"
                  />
                  <span
                    className={`transition-colors text-[11px] ${
                      item.is_back
                        ? "text-amber-400 font-bold"
                        : "text-slate-400 group-hover/chk:text-slate-300"
                    }`}
                  >
                    {item.is_back ? "✓ Áp dụng mặt sau" : "Áp dụng mặt sau"}
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Thêm / Sửa */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Sửa hình in" : "Thêm hình in"}
        size="xl"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Field
              label="Mã hình"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="607"
            />
            <Field
              label="Tên hình"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Hình rồng đen"
            />
            <Select
              label="Chủ đề"
              value={form.theme}
              onChange={(v) => setForm({ ...form, theme: v })}
              options={themes.map((t) => ({ value: t.name, label: t.name }))}
              placeholder="Chọn chủ đề"
            />

            {/* Checkbox Áp dụng mặt sau */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-700/50 bg-slate-800/40 cursor-pointer hover:bg-slate-800/70 transition-colors">
              <input
                type="checkbox"
                checked={form.is_back}
                onChange={(e) => setForm({ ...form, is_back: e.target.checked })}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer accent-amber-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-200">Áp dụng cho hình mặt sau của áo</p>
                <p className="text-[10px] text-slate-400">
                  Hình in này sẽ được định vị mặc định cho mặt sau khi tạo sản phẩm hoặc ghép mockup 2 mặt áo
                </p>
              </div>
            </label>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Tag</label>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Nhập tag rồi Enter"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800"
                >
                  <Tag size={16} />
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-500/10 text-brand-400 text-xs font-medium"
                    >
                      {t}
                      <button onClick={() => removeTag(t)}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Ghi chú</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
              />
            </div>
          </div>
          <div className="space-y-4">
            <ImageUpload
              folder="designs-png"
              value={form.png_url}
              onChange={(url) => setForm({ ...form, png_url: url })}
              label="File PNG (nền trong)"
              accept="image/png"
              customCode={form.code ? `HINHIN_${form.code}` : undefined}
              oldUrl={editing?.png_url}
            />
            <ImageUpload
              folder="designs-thumb"
              value={form.thumbnail_url}
              onChange={(url) => setForm({ ...form, thumbnail_url: url })}
              label="Thumbnail"
              customCode={form.code ? `HINHIN_${form.code}_THUMB` : undefined}
              oldUrl={editing?.thumbnail_url}
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

      {/* Modal Cắt & Sửa Hình In độc lập */}
      {croppingItem && (croppingItem.png_url || croppingItem.thumbnail_url) && (
        <ImageCropperModal
          open={!!croppingItem}
          onClose={() => setCroppingItem(null)}
          imageUrl={(croppingItem.png_url || croppingItem.thumbnail_url) as string}
          onSave={handleSaveCroppedImage}
          title={`Cắt & Chỉnh sửa hình in (${croppingItem.code} - ${croppingItem.name})`}
          folder="designs-png"
          customCode={`HINHIN_${croppingItem.code}`}
          oldUrl={croppingItem.png_url}
        />
      )}
    </div>
  );
}
