import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Blank, PrintDesign, BlankType } from "@/lib/types";
import { PageHeader, SearchInput, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Field";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Boxes,
  Eye,
  Layers as LayersIcon,
  Sparkles,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers";

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [designs, setDesigns] = useState<PrintDesign[]>([]);
  const [types, setTypes] = useState<BlankType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterTheme, setFilterTheme] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [singleModal, setSingleModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<Product | null>(null);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pr, bl, pd, bt] = await Promise.all([
      supabase
        .from("products")
        .select("*, blanks(*), print_designs(*)")
        .order("created_at", { ascending: false }),
      supabase.from("blanks").select("*, blank_types(*)").order("code"),
      supabase.from("print_designs").select("*").order("code"),
      supabase.from("blank_types").select("*").order("name"),
    ]);
    setItems((pr.data as Product[]) || []);
    setBlanks((bl.data as Blank[]) || []);
    setDesigns((pd.data as PrintDesign[]) || []);
    setTypes((bt.data as BlankType[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const colors = useMemo(
    () => [...new Set(blanks.map((b) => b.color))].sort(),
    [blanks]
  );
  const sizes = useMemo(
    () => [...new Set(blanks.map((b) => b.size))].sort(),
    [blanks]
  );
  const themes = useMemo(
    () => [...new Set(designs.map((d) => d.theme).filter(Boolean))] as string[],
    [designs]
  );

  function genCode(blank: Blank, design: PrintDesign): string {
    return `${blank.code}-${blank.color}-${blank.size}-${design.code}`;
  }

  const filtered = items.filter((p) => {
    const blank = p.blanks;
    const design = p.print_designs;
    const matchSearch =
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (blank?.color || "").toLowerCase().includes(search.toLowerCase()) ||
      (blank?.size || "").toLowerCase().includes(search.toLowerCase()) ||
      (design?.code || "").toLowerCase().includes(search.toLowerCase()) ||
      (design?.theme || "").toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || blank?.blank_type_id === filterType;
    const matchColor = !filterColor || blank?.color === filterColor;
    const matchSize = !filterSize || blank?.size === filterSize;
    const matchTheme = !filterTheme || design?.theme === filterTheme;
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchType && matchColor && matchSize && matchTheme && matchStatus;
  });

  function openEdit(p: Product) {
    setEditItem(p);
    setEditPrice(String(p.price));
    setEditStatus(p.status);
    setError(null);
  }

  async function handleSaveEdit() {
    if (!editItem) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from("products")
        .update({ price: Number(editPrice) || 0, status: editStatus })
        .eq("id", editItem.id);
      if (error) throw error;
      setEditItem(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Xóa sản phẩm "${p.code}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  }

  const hasFilters = filterType || filterColor || filterSize || filterTheme || filterStatus;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sản phẩm"
        subtitle="Tạo sản phẩm từ phôi + hình in, xem preview, tìm kiếm & lọc"
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm sản phẩm..." />
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                showFilters || hasFilters
                  ? "border-brand-500/30 bg-brand-500/10 text-brand-400"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Filter size={16} /> Lọc
            </button>
            <button
              onClick={() => setBatchModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-400 text-sm font-medium hover:bg-brand-500/20 transition-colors"
            >
              <Sparkles size={18} /> Tạo hàng loạt
            </button>
            <button
              onClick={() => setSingleModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus size={18} /> Tạo sản phẩm
            </button>
          </>
        }
      />

      {showFilters && (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-4 mb-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Select label="Loại phôi" value={filterType} onChange={setFilterType}
            options={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="Tất cả" />
          <Select label="Màu" value={filterColor} onChange={setFilterColor}
            options={colors.map((c) => ({ value: c, label: c }))} placeholder="Tất cả" />
          <Select label="Size" value={filterSize} onChange={setFilterSize}
            options={sizes.map((s) => ({ value: s, label: s }))} placeholder="Tất cả" />
          <Select label="Chủ đề" value={filterTheme} onChange={setFilterTheme}
            options={themes.map((t) => ({ value: t, label: t }))} placeholder="Tất cả" />
          <Select label="Trạng thái" value={filterStatus} onChange={setFilterStatus}
            options={[{ value: "active", label: "Đang bán" }, { value: "inactive", label: "Tạm dừng" }]}
            placeholder="Tất cả" />
        </div>
      )}

      <div className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-slate-600" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState message="Chưa có sản phẩm nào. Tạo sản phẩm đơn lẻ hoặc hàng loạt." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3">Mã SP</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3">Tên</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3 hidden lg:table-cell">Phôi</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3 hidden md:table-cell">Hình in</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase px-5 py-3">Giá</th>
                  <th className="text-center text-xs font-semibold text-slate-400 uppercase px-5 py-3">Trạng thái</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-medium text-brand-400">{p.code}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-200">{p.name}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-slate-400">{p.blanks?.code}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-slate-400">{p.print_designs?.code} — {p.print_designs?.name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-medium text-slate-200">{formatCurrency(Number(p.price))}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        p.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/50 text-slate-400"
                      }`}>
                        {p.status === "active" ? "Đang bán" : "Tạm dừng"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreviewItem(p)} className="p-2 rounded-lg text-slate-500 hover:bg-brand-500/10 hover:text-brand-400 transition-colors" title="Xem preview">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-slate-500 hover:bg-amber-500/10 hover:text-amber-400 transition-colors" title="Sửa">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-2 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors" title="Xóa">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SingleCreateModal
        open={singleModal}
        onClose={() => setSingleModal(false)}
        blanks={blanks}
        designs={designs}
        genCode={genCode}
        onCreated={load}
      />

      <BatchCreateModal
        open={batchModal}
        onClose={() => setBatchModal(false)}
        blanks={blanks}
        designs={designs}
        genCode={genCode}
        onCreated={load}
      />

      <Modal open={!!previewItem} onClose={() => setPreviewItem(null)} title="Xem trước sản phẩm" size="lg">
        {previewItem && <ProductPreview product={previewItem} />}
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Sửa sản phẩm">
        {editItem && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <p className="text-xs text-slate-500">Mã sản phẩm</p>
              <p className="font-mono text-sm font-semibold text-brand-400">{editItem.code}</p>
              <p className="text-sm text-slate-300 mt-1">{editItem.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Giá bán (VND)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <Select label="Trạng thái" value={editStatus} onChange={setEditStatus}
              options={[{ value: "active", label: "Đang bán" }, { value: "inactive", label: "Tạm dừng" }]} />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex gap-2.5 pt-2">
              <button onClick={() => setEditItem(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800">Hủy</button>
              <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />} Lưu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProductPreview({ product }: { product: Product }) {
  const blank = product.blanks;
  const design = product.print_designs;
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500 mb-2">Ảnh phôi</p>
          <div className="aspect-square rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center overflow-hidden">
            {blank?.image_url ? (
              <img src={blank.image_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <Boxes size={32} className="text-slate-700" />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2">Hình in (PNG)</p>
          <div className="aspect-square rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center overflow-hidden">
            {design?.png_url ? (
              <img src={design.png_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <LayersIcon size={32} className="text-slate-700" />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2">Preview (= phôi + hình)</p>
          <div className="aspect-square rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center overflow-hidden relative">
            {blank?.image_url ? (
              <img src={blank.image_url} alt="" className="w-full h-full object-contain absolute inset-0" />
            ) : (
              <Boxes size={32} className="text-slate-700 absolute" />
            )}
            {design?.png_url && (
              <img src={design.png_url} alt="" className="w-[60%] h-[60%] object-contain absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Mã sản phẩm</span>
          <span className="font-mono text-sm font-semibold text-brand-400">{product.code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Tên</span>
          <span className="text-sm font-medium text-slate-200">{product.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Phôi</span>
          <span className="text-sm text-slate-300">{blank?.code} ({blank?.color} {blank?.size})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Hình in</span>
          <span className="text-sm text-slate-300">{design?.code} — {design?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Giá bán</span>
          <span className="text-sm font-bold text-slate-100">{formatCurrency(Number(product.price))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Trạng thái</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
            product.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/50 text-slate-400"
          }`}>
            {product.status === "active" ? "Đang bán" : "Tạm dừng"}
          </span>
        </div>
      </div>
    </div>
  );
}

function SingleCreateModal({
  open, onClose, blanks, designs, genCode, onCreated,
}: {
  open: boolean; onClose: () => void; blanks: Blank[]; designs: PrintDesign[];
  genCode: (b: Blank, d: PrintDesign) => string; onCreated: () => void;
}) {
  const [blankId, setBlankId] = useState("");
  const [designId, setDesignId] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blank = blanks.find((b) => b.id === blankId);
  const design = designs.find((d) => d.id === designId);
  const code = blank && design ? genCode(blank, design) : "";

  async function handleCreate() {
    setError(null);
    if (!blankId || !designId) { setError("Vui lòng chọn phôi và hình in."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("products").insert({
        code,
        name: `${blank?.blank_types?.name || blank?.code} ${blank?.color} ${blank?.size} - ${design?.name}`,
        blank_id: blankId,
        print_design_id: designId,
        price: Number(price) || 0,
        status: "active",
      });
      if (error) {
        if (error.code === "23505") setError("Sản phẩm này đã tồn tại (trùng mã).");
        else throw error;
        return;
      }
      setBlankId(""); setDesignId(""); setPrice("");
      onClose(); onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo sản phẩm" size="lg">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Select label="Phôi" value={blankId} onChange={setBlankId}
            options={blanks.map((b) => ({ value: b.id, label: `${b.code} — ${b.color} ${b.size} (${b.blank_types?.name})` }))}
            placeholder="Chọn phôi" />
          <Select label="Hình in" value={designId} onChange={setDesignId}
            options={designs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
            placeholder="Chọn hình in" />
        </div>
        {blank && design && (
          <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-brand-400" />
              <span className="text-sm font-medium text-brand-400">Mã tự sinh</span>
            </div>
            <p className="font-mono text-lg font-bold text-brand-400">{code}</p>
            <p className="text-xs text-slate-500 mt-1">
              {blank.code} (phôi) + {blank.color} (màu) + {blank.size} (size) + {design.code} (hình)
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Giá bán (VND)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2.5 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800">Hủy</button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} Tạo sản phẩm
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BatchCreateModal({
  open, onClose, blanks, designs, genCode, onCreated,
}: {
  open: boolean; onClose: () => void; blanks: Blank[]; designs: PrintDesign[];
  genCode: (b: Blank, d: PrintDesign) => string; onCreated: () => void;
}) {
  const [selectedBlanks, setSelectedBlanks] = useState<string[]>([]);
  const [selectedDesigns, setSelectedDesigns] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleBlank(id: string) {
    setSelectedBlanks((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleDesign(id: string) {
    setSelectedDesigns((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const previewCount = selectedBlanks.length * selectedDesigns.length;

  async function handleCreate() {
    setError(null); setResult(null);
    if (selectedBlanks.length === 0 || selectedDesigns.length === 0) {
      setError("Chọn ít nhất 1 phôi và 1 hình in."); return;
    }
    setSaving(true);
    const rows = [];
    for (const bid of selectedBlanks) {
      const blank = blanks.find((b) => b.id === bid)!;
      for (const did of selectedDesigns) {
        const design = designs.find((d) => d.id === did)!;
        rows.push({
          code: genCode(blank, design),
          name: `${blank.blank_types?.name || blank.code} ${blank.color} ${blank.size} - ${design.name}`,
          blank_id: bid, print_design_id: did,
          price: Number(price) || 0, status: "active",
        });
      }
    }
    let created = 0, skipped = 0;
    for (const row of rows) {
      const { error } = await supabase.from("products").insert(row);
      if (error) {
        if (error.code === "23505") skipped++;
        else { setError(error.message); setSaving(false); return; }
      } else { created++; }
    }
    setResult({ created, skipped });
    setSaving(false); onCreated();
  }

  function close() {
    setSelectedBlanks([]); setSelectedDesigns([]); setPrice("");
    setResult(null); setError(null); onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Tạo sản phẩm hàng loạt" size="xl">
      <div className="space-y-5">
        {result && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 animate-fade-in">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">
              Đã tạo {result.created} sản phẩm
              {result.skipped > 0 && `, bỏ qua ${result.skipped} sản phẩm đã tồn tại`}
            </p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Chọn phôi ({selectedBlanks.length} đã chọn)</p>
          <div className="max-h-40 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-2 p-1">
            {blanks.map((b) => (
              <button key={b.id} onClick={() => toggleBlank(b.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                  selectedBlanks.includes(b.id)
                    ? "border-brand-500/50 bg-brand-500/10 text-brand-400"
                    : "border-slate-700/50 hover:border-slate-600 text-slate-400"
                }`}>
                <span className="font-mono font-medium">{b.code}</span>
                <span className="text-slate-500 ml-1">{b.color} {b.size}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Chọn hình in ({selectedDesigns.length} đã chọn)</p>
          <div className="max-h-40 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-2 p-1">
            {designs.map((d) => (
              <button key={d.id} onClick={() => toggleDesign(d.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                  selectedDesigns.includes(d.id)
                    ? "border-brand-500/50 bg-brand-500/10 text-brand-400"
                    : "border-slate-700/50 hover:border-slate-600 text-slate-400"
                }`}>
                <span className="font-mono font-medium">{d.code}</span>
                <span className="text-slate-500 ml-1">{d.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Giá bán chung (VND)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          <div className="flex items-end">
            <div className="w-full p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <p className="text-sm text-brand-400">
                Sẽ tạo <span className="font-bold">{previewCount}</span> sản phẩm
                ({selectedBlanks.length} phôi × {selectedDesigns.length} hình)
              </p>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2.5 pt-2">
          <button onClick={close} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800">Đóng</button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Tạo {previewCount > 0 ? `${previewCount} ` : ""}sản phẩm
          </button>
        </div>
      </div>
    </Modal>
  );
}
