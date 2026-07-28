import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrintDesign, Theme } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field, Select } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, Pencil, Trash2, Loader2, Image as ImageIcon, Tag, X } from "lucide-react";

export function PrintDesignsPage() {
  const [items, setItems] = useState<PrintDesign[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PrintDesign | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    theme: "",
    png_url: "" as string | null,
    thumbnail_url: "" as string | null,
    tags: [] as string[],
    notes: "",
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
    setForm({ code: "", name: "", theme: "", png_url: null, thumbnail_url: null, tags: [], notes: "" });
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

  const filtered = items.filter((i) => {
    const matchSearch =
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchTheme = !filterTheme || i.theme === filterTheme;
    return matchSearch && matchTheme;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Hình in"
        subtitle="Quản lý hình in (file PNG nền trong, thumbnail, tag)"
        actions={
          <>
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
          <EmptyState message="Chưa có hình in nào. Nhấn Thêm để tạo." />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-colors group"
            >
              <div className="aspect-square bg-slate-800/30 flex items-center justify-center overflow-hidden relative">
                {item.thumbnail_url || item.png_url ? (
                  <img
                    src={(item.thumbnail_url || item.png_url) as string}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon size={36} className="text-slate-700" />
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/70 text-slate-300 text-[10px] font-mono">
                    {item.code}
                  </span>
                </div>
                <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg bg-slate-800 text-slate-300 shadow-lg hover:text-brand-400 border border-slate-700"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2 rounded-lg bg-slate-800 text-slate-300 shadow-lg hover:text-rose-400 border border-slate-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                {item.theme && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 text-[11px] font-medium">
                    {item.theme}
                  </span>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] text-slate-500">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
            />
            <ImageUpload
              folder="designs-thumb"
              value={form.thumbnail_url}
              onChange={(url) => setForm({ ...form, thumbnail_url: url })}
              label="Thumbnail"
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
