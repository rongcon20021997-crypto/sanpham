import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { PrintDesign, Theme } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field, Select } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Tag,
  X,
  Crop,
  Check,
  Filter,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

export function PrintDesignsPage() {
  const [items, setItems] = useState<PrintDesign[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterSide, setFilterSide] = useState<"all" | "front" | "back">("all");
  const [filterTag, setFilterTag] = useState("");
  const [filterMedia, setFilterMedia] = useState<"all" | "has_png" | "no_png">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc" | "code_asc">("newest");

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

  // Danh sách tất cả các tag duy nhất
  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (Array.isArray(i.tags)) {
        i.tags.forEach((t) => t && set.add(t.trim()));
      }
    });
    return Array.from(set).sort();
  }, [items]);

  // Đếm số lượng theo vị trí in
  const counts = useMemo(() => {
    const total = items.length;
    const back = items.filter((i) => Boolean(i.is_back)).length;
    const front = total - back;
    return { total, front, back };
  }, [items]);

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

  function resetFilters() {
    setSearch("");
    setFilterTheme("");
    setFilterSide("all");
    setFilterTag("");
    setFilterMedia("all");
    setSortBy("newest");
  }

  const hasActiveFilters = Boolean(
    search || filterTheme || filterSide !== "all" || filterTag || filterMedia !== "all" || sortBy !== "newest"
  );

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        const matchSearch =
          !search ||
          i.code.toLowerCase().includes(search.toLowerCase()) ||
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          (i.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
        const matchTheme = !filterTheme || i.theme === filterTheme;
        const matchSide =
          filterSide === "all" ||
          (filterSide === "back" && Boolean(i.is_back)) ||
          (filterSide === "front" && !i.is_back);
        const matchTag = !filterTag || (i.tags || []).includes(filterTag);
        const matchMedia =
          filterMedia === "all" ||
          (filterMedia === "has_png" && Boolean(i.png_url || i.thumbnail_url)) ||
          (filterMedia === "no_png" && !i.png_url && !i.thumbnail_url);

        return matchSearch && matchTheme && matchSide && matchTag && matchMedia;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        }
        if (sortBy === "name_asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "name_desc") {
          return b.name.localeCompare(a.name);
        }
        if (sortBy === "code_asc") {
          return a.code.localeCompare(b.code);
        }
        return 0;
      });
  }, [items, search, filterTheme, filterSide, filterTag, filterMedia, sortBy]);

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Hình in"
        subtitle="Quản lý hình in (file PNG nền trong, vị trí in trước/sau, thumbnail, tag)"
        actions={
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã, tên, tag..." />
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20 shrink-0"
            >
              <Plus size={18} /> Thêm
            </button>
          </div>
        }
      />

      {/* THANH BỘ LỌC TOÀN DIỆN */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 1. TABS LỌC NHANH VỊ TRÍ IN */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterSide("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterSide === "all"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Tất cả vị trí</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterSide === "all" ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                {counts.total}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterSide("front")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterSide === "front"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>👕 Mặt trước</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterSide === "front" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                {counts.front}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterSide("back")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterSide === "back"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>🔙 Mặt sau (In sau)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${filterSide === "back" ? "bg-amber-600 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                {counts.back}
              </span>
            </button>
          </div>

          {/* NÚT RESET LỌC */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-950/60 border border-slate-800 hover:border-rose-500/30 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* 2. CÁC DROPDOWN BỘ LỌC CHI TIẾT */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-slate-800/80">
          {/* Lọc theo Chủ đề */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <Filter size={11} className="text-brand-400" /> Chủ đề
            </label>
            <select
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-950 text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">Tất cả chủ đề</option>
              {themes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Tag */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <Tag size={11} className="text-brand-400" /> Tag
            </label>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-950 text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">Tất cả Tag ({allTags.length})</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Trạng thái ảnh */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <ImageIcon size={11} className="text-brand-400" /> File PNG ảnh
            </label>
            <select
              value={filterMedia}
              onChange={(e) => setFilterMedia(e.target.value as "all" | "has_png" | "no_png")}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-950 text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="all">Tất cả hình in</option>
              <option value="has_png">✓ Đã có file PNG</option>
              <option value="no_png">✕ Chưa có file PNG</option>
            </select>
          </div>

          {/* Sắp xếp */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <ArrowUpDown size={11} className="text-brand-400" /> Sắp xếp
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "name_asc" | "name_desc" | "code_asc")}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-950 text-slate-200 text-xs outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="newest">Mới nhất trước</option>
              <option value="oldest">Cũ nhất trước</option>
              <option value="name_asc">Tên A → Z</option>
              <option value="name_desc">Tên Z → A</option>
              <option value="code_asc">Mã hình in</option>
            </select>
          </div>
        </div>

        {/* THÔNG TIN KẾT QUẢ & ACTIVE FILTER BADGES */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Đang hiển thị <strong className="text-slate-200">{filtered.length}</strong> / {items.length} hình in
            </span>
          </div>

          {/* Active filter badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filterSide !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                {filterSide === "back" ? "Mặt sau" : "Mặt trước"}
                <button type="button" onClick={() => setFilterSide("all")} className="hover:text-white">
                  <X size={10} />
                </button>
              </span>
            )}
            {filterTheme && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px]">
                Chủ đề: {filterTheme}
                <button type="button" onClick={() => setFilterTheme("")} className="hover:text-white">
                  <X size={10} />
                </button>
              </span>
            )}
            {filterTag && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px]">
                #{filterTag}
                <button type="button" onClick={() => setFilterTag("")} className="hover:text-white">
                  <X size={10} />
                </button>
              </span>
            )}
            {filterMedia !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                {filterMedia === "has_png" ? "Đã có PNG" : "Chưa có PNG"}
                <button type="button" onClick={() => setFilterMedia("all")} className="hover:text-white">
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-8 text-center space-y-3">
          <EmptyState message="Không tìm thấy hình in nào phù hợp với bộ lọc." />
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <RotateCcw size={14} /> Xóa bộ lọc và hiển thị tất cả
            </button>
          )}
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
                    title={item.is_back ? "Đang áp dụng Mặt sau (Click để đổi sang Mặt trước)" : "Click để áp dụng cho Mặt sau của áo"}
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
                        <span
                          key={t}
                          onClick={() => setFilterTag(t)}
                          className="text-[10px] text-slate-500 hover:text-sky-400 cursor-pointer transition-colors"
                        >
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
