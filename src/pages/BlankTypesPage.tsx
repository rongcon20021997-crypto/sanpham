import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BlankType } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Plus, Pencil, Trash2, Loader2, Layers } from "lucide-react";

export function BlankTypesPage() {
  const [items, setItems] = useState<BlankType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlankType | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("blank_types")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as BlankType[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", description: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: BlankType) {
    setEditing(item);
    setForm({ code: item.code, name: item.name, description: item.description || "" });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.code.trim() || !form.name.trim()) {
      setError("Mã và tên là bắt buộc.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("blank_types")
          .update(form)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blank_types").insert(form);
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

  async function handleDelete(item: BlankType) {
    if (!confirm(`Xóa loại phôi "${item.name}"?`)) return;
    const { error } = await supabase.from("blank_types").delete().eq("id", item.id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  const filtered = items.filter(
    (i) =>
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Loại phôi"
        subtitle="Quản lý danh mục loại phôi (cotton, polo, hoodie...)"
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm loại phôi..." />
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus size={18} /> Thêm
            </button>
          </>
        }
      />

      <div className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-slate-600" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState message="Chưa có loại phôi nào. Nhấn Thêm để tạo." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3">Mã</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3">Tên</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3 hidden md:table-cell">Mô tả</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase px-5 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-sm font-medium text-brand-400">{item.code}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                        <Layers size={16} className="text-brand-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-200">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-sm text-slate-400">{item.description || "—"}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Sửa loại phôi" : "Thêm loại phôi"}
      >
        <div className="space-y-4">
          <Field
            label="Mã loại phôi"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="CT220"
          />
          <Field
            label="Tên loại phôi"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Cotton 220gsm"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Mô tả</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Vải cotton 100%, dệt kim 2 lớp..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2.5 pt-2">
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
        </div>
      </Modal>
    </div>
  );
}
