import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  ShieldCheck,
  Eye,
  Check,
} from "lucide-react";
import { uploadFile } from "@/lib/helpers";
import type { LogoItem } from "@/lib/types";

export function LogosPage() {
  const [items, setItems] = useState<LogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LogoItem | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    image_url: "",
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("logos").select("*").order("created_at", { ascending: false });
    setItems((data as LogoItem[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  function openCreate() {
    setEditingItem(null);
    const autoCode = `LOGO-${String(items.length + 1).padStart(2, "0")}`;
    setForm({ code: autoCode, name: "", image_url: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: LogoItem) {
    setEditingItem(item);
    setForm({ code: item.code, name: item.name, image_url: item.image_url });
    setError(null);
    setModalOpen(true);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFile(file, "logos/images");
      if (url) {
        setForm((prev) => ({
          ...prev,
          image_url: url,
          name: prev.name || file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9\s_-]/g, " "),
        }));
      }
    } catch (err) {
      alert("Lỗi tải lên file ảnh: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!form.code.trim() || !form.name.trim() || !form.image_url) {
      setError("Mã logo, tên logo và hình ảnh là bắt buộc.");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const { error: err } = await supabase
          .from("logos")
          .update({
            code: form.code.trim().toUpperCase(),
            name: form.name.trim(),
            image_url: form.image_url,
          })
          .eq("id", editingItem.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("logos").insert({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          image_url: form.image_url,
        });
        if (err) throw err;
      }

      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const dbErr = err as { code?: string; message?: string };
      if (dbErr?.code === "23505" || dbErr?.message?.includes("logos_code_key")) {
        setError(`Mã logo "${form.code}" đã bị trùng trong hệ thống. Vui lòng đổi Mã khác.`);
      } else {
        setError(dbErr?.message || "Đã xảy ra lỗi khi lưu logo.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: LogoItem) {
    if (!confirm(`Bạn có chắc muốn xóa Logo "${item.name}" (${item.code}) không?`)) return;

    const { error: err } = await supabase.from("logos").delete().eq("id", item.id);
    if (err) {
      alert("Lỗi khi xóa logo: " + err.message);
    } else {
      await load();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="text-brand-400" size={26} /> Quản lý Logo
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Quản lý kho ảnh Logo thương hiệu dùng để chèn chìm hoặc đính kèm lên sản phẩm.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all shrink-0"
        >
          <Plus size={18} /> Thêm Logo Mới
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card-gradient p-4 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mã logo..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-100 text-xs sm:text-sm outline-none focus:border-brand-500"
          />
        </div>
        <span className="text-xs text-slate-400">
          Tổng số: <strong className="text-brand-400">{filtered.length}</strong> Logo
        </span>
      </div>

      {/* Logos Grid List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="animate-spin text-brand-400" size={32} />
          <p className="text-xs">Đang tải danh sách logo...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-gradient p-12 rounded-2xl border border-slate-700/50 text-center space-y-3">
          <ShieldCheck size={48} className="mx-auto text-slate-600" />
          <p className="text-slate-300 font-semibold text-sm">Chưa có Logo nào được tải lên</p>
          <p className="text-xs text-slate-500">Bấm nút "Thêm Logo Mới" để tải ảnh logo thương hiệu đầu tiên.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg hover:border-brand-500/50 transition-all group flex flex-col justify-between"
            >
              {/* Logo Thumbnail Container */}
              <div
                onClick={() => setZoomImage({ url: item.image_url, title: `${item.name} (${item.code})` })}
                className="relative aspect-square w-full bg-slate-950 p-4 flex items-center justify-center border-b border-slate-800 cursor-zoom-in group/img"
              >
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="max-h-full max-w-full object-contain group-hover/img:scale-110 transition-transform drop-shadow-md"
                />
                <span className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-slate-300 opacity-0 group-hover/img:opacity-100 transition-opacity">
                  <Eye size={14} />
                </span>
              </div>

              {/* Logo Info & Actions */}
              <div className="p-3.5 space-y-2">
                <div>
                  <span className="font-mono text-[11px] font-bold text-brand-400">{item.code}</span>
                  <h3 className="text-xs font-semibold text-slate-200 truncate leading-snug">{item.name}</h3>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                    title="Sửa Logo"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Xóa Logo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Logo */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? "Sửa Logo" : "Thêm Logo Mới"}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Mã Logo (SKU) *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="VD: LOGO-01"
              className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 font-mono outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Tên Logo *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="VD: Logo Nike Swosh Trắng"
              className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Ảnh Logo (PNG trong suốt) *</label>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="w-24 h-24 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt="Logo preview" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <ShieldCheck size={28} className="text-slate-600" />
                )}
              </div>

              <div className="flex-1 space-y-2 w-full">
                <label className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors">
                  {uploading ? <Loader2 size={15} className="animate-spin text-brand-400" /> : <Upload size={15} />}
                  <span>{uploading ? "Đang tải ảnh lên..." : "Tải ảnh Logo PNG"}</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <p className="text-[11px] text-slate-400">Khuyên dùng file ảnh PNG tách nền trong suốt để khi ghép lên phôi áo mượt nhất.</p>
              </div>
            </div>
          </div>

          {error && <p className="text-rose-400 font-medium">{error}</p>}

          <div className="flex gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              <span>Lưu Logo</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Zoom Preview HD */}
      <ImageZoomModal
        open={!!zoomImage}
        onClose={() => setZoomImage(null)}
        imageUrl={zoomImage?.url || null}
        title={zoomImage?.title}
      />
    </div>
  );
}
