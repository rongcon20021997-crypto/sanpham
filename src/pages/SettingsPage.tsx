import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Color, Size, Theme, CodeRule } from "@/lib/types";
import { PageHeader, EmptyState } from "@/components/PageParts";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { uploadFile } from "@/lib/helpers";
import { useSync } from "@/context/SyncContext";
import {
  Plus,
  Trash2,
  Loader2,
  Palette,
  Ruler,
  Tag,
  Code2,
  Save,
  Check,
  Cloud,
  HardDrive,
  RefreshCw,
  Sparkles,
  Key,
  Bot,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Pencil,
  X,
  Upload,
  Image as ImageIcon,
  Crop,
  Maximize2,
  HelpCircle,
  CheckCircle,
  Store,
  ShoppingBag,
  Link2,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Globe,
  Server,
} from "lucide-react";
import {
  getOpenAiApiKey,
  setOpenAiApiKey,
  getOpenAiModel,
  setOpenAiModel,
  getOpenAiCustomPrompt,
  setOpenAiCustomPrompt,
  testOpenAiConnection,
} from "@/lib/openai";

import {
  getShopeeAppConfig,
  setShopeeAppConfig,
  fetchShopeeAppConfig,
  getShopeeSizeChartUrl,
  setShopeeSizeChartUrl,
  type ShopeeAppConfig,
} from "@/lib/shopee";
import {
  getTikTokAppConfig,
  setTikTokAppConfig,
  fetchTikTokAppConfig,
  type TikTokAppConfig,
} from "@/lib/tiktok";

export function SettingsPage() {
  const [tab, setTab] = useState<"ai" | "shopee" | "tiktok" | "sync" | "colors" | "sizes" | "themes" | "code">("ai");
  const [loading, setLoading] = useState(true);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [codeRule, setCodeRule] = useState<CodeRule | null>(null);

  useEffect(() => {
    (async () => {
      const [cl, sz, th, cr] = await Promise.all([
        supabase.from("colors").select("*").order("name"),
        supabase.from("sizes").select("*").order("sort_order"),
        supabase.from("themes").select("*").order("name"),
        supabase.from("code_rules").select("*").eq("id", 1).maybeSingle(),
      ]);
      setColors((cl.data as Color[]) || []);
      setSizes((sz.data as Size[]) || []);
      setThemes((th.data as Theme[]) || []);
      setCodeRule(cr.data as CodeRule | null);
      setLoading(false);
    })();
  }, []);

  const tabs = [
    { key: "ai" as const, label: "AI OpenAI (Shopee)", icon: Sparkles },
    { key: "shopee" as const, label: "Kết nối Shopee", icon: ShoppingBag },
    { key: "tiktok" as const, label: "Kết nối TikTok Shop", icon: Store },
    { key: "sync" as const, label: "Đồng bộ lưu trữ", icon: RefreshCw },
    { key: "colors" as const, label: "Màu", icon: Palette },
    { key: "sizes" as const, label: "Size", icon: Ruler },
    { key: "themes" as const, label: "Chủ đề", icon: Tag },
    { key: "code" as const, label: "Quy tắc mã", icon: Code2 },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Cài đặt" subtitle="Quản lý cấu hình AI OpenAI, kết nối Sàn Shopee, danh mục màu, size, chủ đề và đồng bộ" />

      <div className="flex flex-wrap gap-1 p-1 bg-slate-900 rounded-xl border border-slate-700/50 mb-6 w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" : "text-slate-400 hover:bg-slate-800"
              }`}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={32} /></div>
      ) : (
        <>
          {tab === "ai" && <OpenAiTab />}
          {tab === "shopee" && <ShopeeTab />}
          {tab === "tiktok" && <TikTokTab />}
          {tab === "sync" && <SyncTab />}
          {tab === "colors" && <ColorsTab colors={colors} setColors={setColors} />}
          {tab === "sizes" && <SizesTab sizes={sizes} setSizes={setSizes} />}
          {tab === "themes" && <ThemesTab themes={themes} setThemes={setThemes} />}
          {tab === "code" && <CodeTab codeRule={codeRule} setCodeRule={setCodeRule} />}
        </>
      )}
    </div>
  );
}

function SyncTab() {
  const { enableR2, enableDrive, setEnableR2, setEnableDrive } = useSync();

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
          <RefreshCw size={18} className="text-brand-400" /> Cài đặt đồng bộ hình ảnh gốc
        </h3>
        <p className="text-xs text-slate-400">
          Khi tải ảnh phôi hoặc hình in, ứng dụng tự động nén ảnh WebP nhỏ gọn (~100KB) lên Supabase để hiển thị UI.
          Tùy chọn bên dưới cho phép bạn BẬT/TẮT đồng bộ file GỐC HD sang Cloudflare R2 & Google Drive.
        </p>
      </div>

      <div className="space-y-4">
        {/* Cloudflare R2 Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${enableR2 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/50 text-slate-500"}`}>
              <Cloud size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
                Cloudflare R2 Storage
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${enableR2 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-700 text-slate-400"}`}>
                  {enableR2 ? "ĐANG BẬT" : "ĐANG TẮT"}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Tự động tải file gốc HD chất lượng cao lên Cloudflare R2</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnableR2(!enableR2)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enableR2 ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enableR2 ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Google Drive Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${enableDrive ? "bg-sky-500/10 text-sky-400" : "bg-slate-700/50 text-slate-500"}`}>
              <HardDrive size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
                Google Drive Backup
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${enableDrive ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" : "bg-slate-700 text-slate-400"}`}>
                  {enableDrive ? "ĐANG BẬT" : "ĐANG TẮT"}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Tự động đẩy bản sao file gốc lên Google Drive xưởng in</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnableDrive(!enableDrive)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enableDrive ? "bg-sky-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enableDrive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorsTab({ colors, setColors }: { colors: Color[]; setColors: (c: Color[]) => void }) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    hex: "#FFFFFF",
    prompt_front: "",
    prompt_back: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(c: Color) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      name: c.name,
      hex: c.hex || "#FFFFFF",
      prompt_front: c.prompt_front || "",
      prompt_back: c.prompt_back || "",
    });
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ code: "", name: "", hex: "#FFFFFF", prompt_front: "", prompt_back: "" });
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      alert("Vui lòng nhập đầy đủ Mã màu và Tên màu!");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        hex: form.hex,
        prompt_front: form.prompt_front.trim() || null,
        prompt_back: form.prompt_back.trim() || null,
      };

      if (editingId) {
        const { data, error } = await supabase
          .from("colors")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
        if (error) {
          alert(error.message);
          return;
        }
        setColors(
          colors
            .map((c) => (c.id === editingId ? (data as Color) : c))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        cancelEdit();
      } else {
        const { data, error } = await supabase
          .from("colors")
          .insert(payload)
          .select()
          .single();
        if (error) {
          alert(error.message);
          return;
        }
        setColors([...colors, data as Color].sort((a, b) => a.name.localeCompare(b.name)));
        setForm({ code: "", name: "", hex: "#FFFFFF", prompt_front: "", prompt_back: "" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Xóa màu này?")) return;
    const { error } = await supabase.from("colors").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setColors(colors.filter((c) => c.id !== id));
    if (editingId === id) {
      cancelEdit();
    }
  }

  return (
    <div className="space-y-6">
      {/* Form thêm / chỉnh sửa màu */}
      <div className={`card-gradient rounded-2xl border p-6 transition-all ${
        editingId ? "border-brand-500/50 ring-2 ring-brand-500/20 bg-brand-500/5" : "border-slate-700/50"
      }`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-slate-200">
              {editingId ? "Chỉnh sửa màu sắc & Prompt AI" : "Thêm màu sắc mới"}
            </h3>
          </div>
          {editingId && (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
            >
              <X size={13} /> Hủy chỉnh sửa
            </button>
          )}
        </div>

        {/* Thông tin cơ bản */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Field
            label="Mã màu"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="VD: T, D, XNV"
          />
          <Field
            label="Tên màu"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="VD: Trắng, Đen, Xanh Navy"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Màu hiển thị (HEX)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.hex}
                onChange={(e) => setForm({ ...form, hex: e.target.value })}
                className="w-12 h-[42px] rounded-xl border border-slate-700/50 bg-slate-800/50 cursor-pointer p-1"
              />
              <input
                type="text"
                value={form.hex}
                onChange={(e) => setForm({ ...form, hex: e.target.value })}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                placeholder="#FFFFFF"
              />
            </div>
          </div>
        </div>

        {/* 2 Câu Prompt AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-sm font-medium text-slate-300">
              <span className="flex items-center gap-1.5 text-sky-400">
                <Sparkles size={14} /> Prompt AI - Mặt trước (Front)
              </span>
              <span className="text-[11px] text-slate-500">Tùy chọn</span>
            </label>
            <textarea
              rows={3}
              value={form.prompt_front}
              onChange={(e) => setForm({ ...form, prompt_front: e.target.value })}
              placeholder="VD: plain white cotton t-shirt, clean front view mockup, solid studio lighting, centered, 8k resolution..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none text-xs leading-relaxed focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-sm font-medium text-slate-300">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Sparkles size={14} /> Prompt AI - Mặt sau (Back)
              </span>
              <span className="text-[11px] text-slate-500">Tùy chọn</span>
            </label>
            <textarea
              rows={3}
              value={form.prompt_back}
              onChange={(e) => setForm({ ...form, prompt_back: e.target.value })}
              placeholder="VD: plain white cotton t-shirt, clean back view mockup, solid studio lighting, centered, 8k resolution..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none text-xs leading-relaxed focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 font-mono"
            />
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-2.5">
          {editingId && (
            <button
              onClick={cancelEdit}
              type="button"
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Hủy
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50 shadow-lg shadow-brand-500/20"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : editingId ? (
              <Save size={16} />
            ) : (
              <Plus size={16} />
            )}
            {editingId ? "Lưu cập nhật màu" : "Thêm màu mới"}
          </button>
        </div>
      </div>

      {/* Danh sách màu */}
      {colors.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-700/50 p-6">
          <EmptyState message="Chưa có màu nào." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {colors.map((c) => {
            const isEditingThis = editingId === c.id;
            return (
              <div
                key={c.id}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                  isEditingThis
                    ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30"
                    : "border-slate-700/50 hover:border-slate-600 bg-slate-900/40"
                }`}
              >
                {/* Header card */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-8 h-8 rounded-full border-2 border-slate-600/80 shadow-md shrink-0"
                      style={{ background: c.hex || "#ccc" }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{c.name}</p>
                      <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                        {c.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(c)}
                      title="Chỉnh sửa màu & Prompt"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-brand-400 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      title="Xóa màu"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Phần Prompt AI */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  {c.prompt_front ? (
                    <div className="bg-slate-950/60 rounded-lg p-2 border border-sky-500/20">
                      <div className="text-[11px] font-semibold text-sky-400 mb-0.5 flex items-center gap-1">
                        <Sparkles size={11} /> AI Mặt trước:
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono line-clamp-2 leading-relaxed" title={c.prompt_front}>
                        {c.prompt_front}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic py-0.5">
                      Chưa có prompt mặt trước
                    </div>
                  )}

                  {c.prompt_back ? (
                    <div className="bg-slate-950/60 rounded-lg p-2 border border-purple-500/20">
                      <div className="text-[11px] font-semibold text-purple-400 mb-0.5 flex items-center gap-1">
                        <Sparkles size={11} /> AI Mặt sau:
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono line-clamp-2 leading-relaxed" title={c.prompt_back}>
                        {c.prompt_back}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic py-0.5">
                      Chưa có prompt mặt sau
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SizesTab({ sizes, setSizes }: { sizes: Size[]; setSizes: (s: Size[]) => void }) {
  const [form, setForm] = useState({ code: "", name: "", sort_order: "0" });

  async function add() {
    if (!form.code.trim() || !form.name.trim()) return;
    const { data, error } = await supabase.from("sizes").insert({ code: form.code.trim(), name: form.name.trim(), sort_order: Number(form.sort_order) || 0 }).select().single();
    if (error) { alert(error.message); return; }
    setSizes([...sizes, data as Size].sort((a, b) => a.sort_order - b.sort_order));
    setForm({ code: "", name: "", sort_order: "0" });
  }

  async function remove(id: number) {
    if (!confirm("Xóa size này?")) return;
    const { error } = await supabase.from("sizes").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setSizes(sizes.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="card-gradient rounded-2xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/60">
          <Ruler className="text-brand-400" size={18} />
          <h3 className="font-semibold text-slate-100 text-base">Danh mục kích cỡ (Size)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <Field label="Mã size" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="XL" />
          <Field label="Tên size" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="XL" />
          <Field label="Thứ tự" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="0" />
          <div className="flex items-end">
            <button onClick={add} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"><Plus size={18} /> Thêm</button>
          </div>
        </div>
        {sizes.length === 0 ? <EmptyState message="Chưa có size nào." /> : (
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/50 hover:border-slate-600 group">
                <span className="text-sm font-medium text-slate-200">{s.name}</span>
                <span className="text-xs text-slate-500 font-mono">{s.code}</span>
                <button onClick={() => remove(s.id)} className="p-1 rounded text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ShopeeSizeChartCard />
    </div>
  );
}

function ThemesTab({ themes, setThemes }: { themes: Theme[]; setThemes: (t: Theme[]) => void }) {
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    const { data, error } = await supabase.from("themes").insert({ name: name.trim() }).select().single();
    if (error) { alert(error.message); return; }
    setThemes([...themes, data as Theme].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
  }

  async function remove(id: number) {
    if (!confirm("Xóa chủ đề này?")) return;
    const { error } = await supabase.from("themes").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setThemes(themes.filter((t) => t.id !== id));
  }

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6">
      <div className="flex gap-3 mb-6">
        <div className="flex-1"><Field label="Tên chủ đề" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anime" /></div>
        <div className="flex items-end">
          <button onClick={add} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"><Plus size={18} /> Thêm</button>
        </div>
      </div>
      {themes.length === 0 ? <EmptyState message="Chưa có chủ đề nào." /> : (
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/50 hover:border-slate-600 group">
              <Tag size={14} className="text-violet-400" />
              <span className="text-sm font-medium text-slate-200">{t.name}</span>
              <button onClick={() => remove(t.id)} className="p-1 rounded text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CodeTab({ codeRule, setCodeRule }: { codeRule: CodeRule | null; setCodeRule: (c: CodeRule | null) => void }) {
  const [template, setTemplate] = useState(codeRule?.template || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.from("code_rules").update({ template }).eq("id", 1).select().maybeSingle();
    if (error) { alert(error.message); setSaving(false); return; }
    setCodeRule(data as CodeRule);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tokens = ["{blank_code}", "{color}", "{size}", "{print_code}"];

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Code2 size={18} className="text-brand-400" />
        <h3 className="font-semibold text-slate-100">Quy tắc sinh mã sản phẩm</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Dùng các biến sau để tạo mẫu mã. Ví dụ: <code className="px-1.5 py-0.5 rounded bg-slate-800 text-brand-400 font-mono text-xs">{`{blank_code}-{color}-{size}-{print_code}`}</code> sẽ tạo mã <code className="px-1.5 py-0.5 rounded bg-slate-800 text-brand-400 font-mono text-xs">CT220-T-M-607</code>
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {tokens.map((t) => (
          <button key={t} onClick={() => setTemplate(template + t)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-mono hover:bg-slate-700 hover:text-slate-200 transition-colors">{t}</button>
        ))}
      </div>
      <Field label="Mẫu mã" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="{blank_code}-{color}-{size}-{print_code}" />
      <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <p className="text-xs text-slate-500 mb-1">Ví dụ kết quả</p>
        <p className="font-mono text-sm font-semibold text-brand-400">
          {template.replace("{blank_code}", "CT220").replace("{color}", "T").replace("{size}", "M").replace("{print_code}", "607")}
        </p>
      </div>
      <button onClick={save} disabled={saving} className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
        {saved ? <Check size={18} /> : saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        {saved ? "Đã lưu" : "Lưu quy tắc"}
      </button>
    </div>
  );
}

function OpenAiTab() {
  const [apiKey, setApiKey] = useState(getOpenAiApiKey());
  const [model, setModel] = useState(getOpenAiModel());
  const [customPrompt, setCustomPrompt] = useState(getOpenAiCustomPrompt());
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleTest() {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: "Vui lòng nhập OpenAI API Key trước khi kiểm tra." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await testOpenAiConnection(apiKey.trim());
    setTestResult(res);
    setTesting(false);
  }

  function handleSave() {
    setOpenAiApiKey(apiKey);
    setOpenAiModel(model);
    setOpenAiCustomPrompt(customPrompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-brand-400" /> Cấu hình OpenAI AI (Tối ưu Sản phẩm Shopee)
        </h3>
        <p className="text-xs text-slate-400">
          Thiết lập OpenAI API Key để hệ thống tự động sinh Tên sản phẩm chuẩn SEO Shopee và Mô tả sản phẩm thu hút cho thương hiệu <strong>MEO BAO</strong>.
        </p>
      </div>

      <div className="space-y-4">
        {/* API Key Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key size={14} className="text-brand-400" /> OpenAI API Key <span className="text-rose-400 font-bold">*</span>
            </span>
            <span className="text-[11px] font-normal text-slate-400">Bắt đầu bằng <code>sk-...</code></span>
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="sk-proj-..."
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              title={showKey ? "Ẩn Key" : "Hiện Key"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            🔒 API Key được lưu an toàn trực tiếp trên trình duyệt của bạn (Local Storage) và chỉ được gửi trực tiếp tới OpenAI API.
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Bot size={14} className="text-brand-400" /> Mô hình AI (OpenAI Model)
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 cursor-pointer"
          >
            <option value="gpt-4o-mini">gpt-4o-mini (Khuyên dùng - Nhanh, Siêu rẻ, Tối ưu SEO Shopee xuất sắc)</option>
            <option value="gpt-4o">gpt-4o (Mô hình thông minh cao cấp nhất)</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo (Mô hình cổ điển tiêu chuẩn)</option>
          </select>
        </div>

        {/* Custom Prompt Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Ghi chú / Quy tắc viết Shopee bổ sung (Tùy chọn)
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            placeholder="VD: Nhấn mạnh form áo rộng che khuyết điểm, tặng kèm quà sticker cho mỗi đơn hàng, bảo hành đổi trả 7 ngày..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 custom-scrollbar"
          />
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            )}
            <div>
              <p className="font-semibold">{testResult.success ? "Kết nối thành công!" : "Lỗi kết nối:"}</p>
              <p className="mt-0.5 text-[11px] opacity-90">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !apiKey.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            {testing && <Loader2 size={14} className="animate-spin" />}
            <span>Kiểm tra kết nối Key</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all flex items-center gap-1.5"
          >
            {saved ? <Check size={15} /> : <Save size={15} />}
            <span>{saved ? "Đã lưu cài đặt AI!" : "Lưu cài đặt AI"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
function ShopeeSizeChartCard() {
  const [sizeChartUrl, setSizeChartUrl] = useState<string>(getShopeeSizeChartUrl());
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchShopeeAppConfig().then((cfg) => {
      if (cfg.sizeChartUrl) {
        setSizeChartUrl(cfg.sizeChartUrl);
      }
    });
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFile(file, "settings/size-charts", "SHOPEE_SIZE_CHART_DEFAULT");
      if (url) {
        setSizeChartUrl(url);
        await setShopeeSizeChartUrl(url);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err: any) {
      alert("Lỗi tải ảnh lên: " + (err.message || String(err)));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!confirm("Bạn có chắc chắn muốn xóa ảnh Bảng quy đổi kích cỡ này? Hệ thống sẽ quay về tự động sinh ảnh vẽ khi đẩy sản phẩm lên Shopee.")) return;
    setSizeChartUrl("");
    await setShopeeSizeChartUrl("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleCropped(newUrl: string | null) {
    if (newUrl) {
      setSizeChartUrl(newUrl);
      await setShopeeSizeChartUrl(newUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 max-w-2xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-700/60">
        <div>
          <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
            <Ruler size={19} className="text-orange-400" /> Bảng quy đổi kích cỡ Shopee (Size Chart)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tải lên 1 ảnh Bảng quy đổi kích cỡ hoàn chỉnh của shop. Khi bạn đẩy sản phẩm lên Shopee, hệ thống sẽ tự động dùng hình ảnh này làm <strong>Bảng quy đổi kích cỡ (Size Chart)</strong> thay vì ảnh tự vẽ.
          </p>
        </div>

        <div>
          {sizeChartUrl ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
              <CheckCircle2 size={13} /> Đã có ảnh chuẩn
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
              <AlertCircle size={13} /> Tự động vẽ canvas
            </span>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {sizeChartUrl ? (
        <div className="space-y-4">
          <div className="relative rounded-2xl border-2 border-slate-700/80 bg-slate-950/60 p-3 overflow-hidden group">
            <div className="w-full h-64 sm:h-80 flex items-center justify-center bg-slate-900/40 rounded-xl overflow-hidden">
              <img
                src={sizeChartUrl}
                alt="Bảng quy đổi kích cỡ Shopee"
                className="max-h-full max-w-full object-contain rounded-lg shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => setPreviewOpen(true)}
              />
            </div>

            {/* Quick action overlay buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 size={13} className="text-brand-400" />
                  <span>Phóng to</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCropperOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Crop size={13} className="text-purple-400" />
                  <span>Cắt & Chỉnh sửa</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  <span>{uploading ? "Đang tải lên..." : "Thay đổi ảnh"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-semibold border border-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xóa ảnh</span>
              </button>
            </div>
          </div>

          {saved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Đã lưu ảnh Bảng quy đổi kích cỡ Shopee thành công!</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-52 sm:h-60 rounded-2xl border-2 border-dashed border-slate-700 hover:border-orange-500/80 bg-slate-900/40 hover:bg-orange-500/5 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer p-6 text-center group"
          >
            <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-110 transition-transform">
              {uploading ? (
                <Loader2 size={32} className="animate-spin text-orange-400" />
              ) : (
                <Ruler size={32} />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-200 group-hover:text-orange-400 transition-colors">
                {uploading ? "Đang tải ảnh lên máy chủ..." : "Bấm để tải lên ảnh Bảng quy đổi kích cỡ của shop"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hỗ trợ định dạng JPG, PNG, WebP (Ảnh rõ nét, đầy đủ thông số đo hoặc cân nặng/chiều cao)
              </p>
            </div>

            <button
              type="button"
              disabled={uploading}
              className="mt-1 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-900/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>Chọn ảnh từ máy tính</span>
            </button>
          </div>

          {saved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Đã cập nhật cài đặt Bảng quy đổi kích cỡ!</span>
            </div>
          )}
        </div>
      )}

      {/* Shopee Best Practice Tips */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed">
        <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
          <HelpCircle size={14} className="text-orange-400" /> Tiêu chuẩn Bảng quy đổi kích cỡ Shopee:
        </h4>
        <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 text-[11px]">
          <li>Hình ảnh nên có tỷ lệ <strong>1:1</strong> (tối thiểu 700x700 px) hoặc ảnh dọc rõ ràng, nền trắng hoặc màu sáng.</li>
          <li>Bảng size phải có đầy đủ cột tên Size (S, M, L, XL, 2XL...) cùng các thông số đo chính xác (Dài áo, Rộng ngực, Rộng vai...).</li>
          <li>Shopee AI sẽ quét và duyệt tự động hình ảnh bảng size để kích hoạt tính năng chọn size thông minh cho người mua.</li>
        </ul>
      </div>

      {/* Lightbox / Zoom Modal */}
      {previewOpen && (
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Xem ảnh Bảng quy đổi kích cỡ Shopee"
          size="lg"
        >
          <div className="flex flex-col items-center justify-center p-2">
            <img
              src={sizeChartUrl}
              alt="Bảng size lớn"
              className="max-h-[75vh] w-auto object-contain rounded-xl border border-slate-700/80 shadow-2xl"
            />
            <div className="mt-4 flex items-center justify-end w-full gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Image Cropper Modal */}
      {cropperOpen && (
        <ImageCropperModal
          imageUrl={sizeChartUrl}
          isOpen={cropperOpen}
          onClose={() => setCropperOpen(false)}
          onCropComplete={handleCropped}
          folder="settings/size-charts"
          customCode="SHOPEE_SIZE_CHART"
        />
      )}
    </div>
  );
}

function ShopeeTab() {
  const [appConfig, setAppConfig] = useState<ShopeeAppConfig>(getShopeeAppConfig());
  const [showKey, setShowKey] = useState(false);
  const [appSaved, setAppSaved] = useState(false);

  useEffect(() => {
    fetchShopeeAppConfig().then((cfg) => {
      setAppConfig(cfg);
    });
  }, []);

  async function handleSaveAppConfig() {
    await setShopeeAppConfig(appConfig);
    setAppSaved(true);
    setTimeout(() => setAppSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* 1. Bảng quy đổi kích cỡ Shopee */}
      <ShopeeSizeChartCard />

      {/* 2. Cấu hình Partner App */}
      <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 max-w-2xl space-y-6">
        <div>
          <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
            <Key size={18} className="text-brand-400" /> Cấu hình Shopee Open Platform (Partner App)
          </h3>
          <p className="text-xs text-slate-400">
            Lưu thông số <strong>Partner ID</strong> và <strong>Partner Key</strong> do Shopee cấp để kết nối API. Sau khi lưu, bạn có thể vào menu <strong>"Gian hàng Shopee"</strong> để quản lý và kết nối nhiều shop.
          </p>
        </div>

        <div className="space-y-4">
          {/* Partner ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Partner ID (Mã đối tác) <span className="text-rose-400 font-bold">*</span></span>
              <span className="text-[11px] font-normal text-slate-400">Số nguyên từ Shopee Console</span>
            </label>
            <input
              type="text"
              value={appConfig.partnerId}
              onChange={(e) => setAppConfig({ ...appConfig, partnerId: e.target.value.trim() })}
              placeholder="VD: 2008542"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>

          {/* Partner Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Partner Key (Khóa bảo mật Secret) <span className="text-rose-400 font-bold">*</span></span>
              <span className="text-[11px] font-normal text-slate-400">Chuỗi Hex SHA256</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={appConfig.partnerKey}
                onChange={(e) => setAppConfig({ ...appConfig, partnerKey: e.target.value.trim() })}
                placeholder="VD: 7461626364... (Secret Key)"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                title={showKey ? "Ẩn Key" : "Hiện Key"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Environment */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Môi trường API (Environment)
            </label>
            <select
              value={appConfig.environment}
              onChange={(e) => setAppConfig({ ...appConfig, environment: e.target.value as "live" | "test" })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 cursor-pointer"
            >
              <option value="live">Live / Production (Sàn thật Shopee Việt Nam)</option>
              <option value="test">Test / Sandbox (Môi trường kiểm thử Shopee)</option>
            </select>
          </div>

          {/* Redirect URL (Chỉ hiển thị để copy dán vào Shopee Console) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Globe size={14} className="text-brand-400" /> Redirect URL (URL chuyển hướng khi ủy quyền OAuth2)
              </label>
              <span className="text-[11px] text-amber-400 font-medium">Tự động nhận diện</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Dán vào mục <strong>Redirect URL</strong> trên Shopee Console (<code>open.shopee.com</code>):
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? `${window.location.origin}/shopee-callback` : "http://localhost:5173/shopee-callback"}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800 select-all outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}/shopee-callback` : "http://localhost:5173/shopee-callback";
                  navigator.clipboard.writeText(url);
                  setAppSaved(true);
                  setTimeout(() => setAppSaved(false), 2000);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-sm"
                title="Sao chép Redirect URL"
              >
                <Globe size={13} className="text-brand-400" />
                <span>Sao chép</span>
              </button>
            </div>
          </div>

          {/* Webhook URL (Push Mechanism) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Server size={14} className="text-emerald-400" /> Webhook URL (Push Mechanism Callback URL)
              </label>
              <span className="text-[11px] text-emerald-400 font-medium">Nhận sự kiện tự động</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Dán vào mục <strong>Push Mechanism Callback URL</strong> trên Shopee Console để nhận webhook tự động (đơn hàng, cập nhật shop...):
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? `${window.location.origin}/api/shopee/webhook` : "http://localhost:5173/api/shopee/webhook"}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800 select-all outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}/api/shopee/webhook` : "http://localhost:5173/api/shopee/webhook";
                  navigator.clipboard.writeText(url);
                  setAppSaved(true);
                  setTimeout(() => setAppSaved(false), 2000);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-sm"
                title="Sao chép Webhook URL"
              >
                <Server size={13} className="text-emerald-400" />
                <span>Sao chép</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveAppConfig}
              className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all flex items-center gap-1.5"
            >
              {appSaved ? <Check size={15} /> : <Save size={15} />}
              <span>{appSaved ? "Đã lưu cài đặt Partner App!" : "Lưu cài đặt Shopee"}</span>
            </button>
          </div>
        </div>

        {/* Guide Box */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
            <HelpCircle size={15} className="text-brand-400" /> Hướng dẫn lấy Partner ID & Key:
          </h4>
          <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1 leading-relaxed">
            <li>Truy cập cổng nhà phát triển <a href="https://open.shopee.com" target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">open.shopee.com</a>.</li>
            <li>Tạo một <strong>Partner App</strong> (App Type: E-Commerce Solution / Shop Management).</li>
            <li>Vào mục <strong>App Details</strong> để copy <strong>Partner ID</strong> và <strong>Partner Key</strong> dán vào form trên rồi bấm Lưu.</li>
            <li>Sau đó, sang menu <strong>"Gian hàng Shopee"</strong> ở thanh bên trái để bấm ủy quyền kết nối các Shop.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function TikTokTab() {
  const [appConfig, setAppConfig] = useState<TikTokAppConfig>(getTikTokAppConfig());
  const [showSecret, setShowSecret] = useState(false);
  const [appSaved, setAppSaved] = useState(false);

  useEffect(() => {
    fetchTikTokAppConfig().then((cfg) => {
      setAppConfig(cfg);
    });
  }, []);

  async function handleSaveAppConfig() {
    await setTikTokAppConfig(appConfig);
    setAppSaved(true);
    setTimeout(() => setAppSaved(false), 2500);
  }

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6 max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold text-slate-100 text-base mb-1 flex items-center gap-2">
          <Store size={18} className="text-rose-400" /> Cấu hình TikTok Shop Partner (Ứng dụng nội bộ)
        </h3>
        <p className="text-xs text-slate-400">
          Lưu thông số <strong>Khóa ứng dụng (App Key)</strong> và <strong>Khóa bí mật của ứng dụng (App Secret)</strong> do TikTok Shop Partner Center cấp để kết nối API. Sau khi lưu, bạn có thể vào menu <strong>"Gian hàng TikTok"</strong> để kết nối và tự động làm mới token.
        </p>
      </div>

      <div className="space-y-4">
        {/* App Key */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Khóa ứng dụng (App Key) <span className="text-rose-400 font-bold">*</span></span>
            <span className="text-[11px] font-normal text-slate-400">App Key từ TikTok Partner</span>
          </label>
          <input
            type="text"
            value={appConfig.appKey}
            onChange={(e) => setAppConfig({ ...appConfig, appKey: e.target.value.trim() })}
            placeholder="VD: 6b7c8d9e..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
          />
        </div>

        {/* App Secret */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Khóa bí mật của ứng dụng (App Secret) <span className="text-rose-400 font-bold">*</span></span>
            <span className="text-[11px] font-normal text-slate-400">App Secret bảo mật</span>
          </label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={appConfig.appSecret}
              onChange={(e) => setAppConfig({ ...appConfig, appSecret: e.target.value.trim() })}
              placeholder="VD: a1b2c3d4e5f6... (App Secret)"
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              title={showSecret ? "Ẩn Secret" : "Hiện Secret"}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Service ID (Tùy chọn) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Service ID (Tùy chọn)</span>
            <span className="text-[11px] font-normal text-slate-400">Dành cho app dạng Service</span>
          </label>
          <input
            type="text"
            value={appConfig.serviceId}
            onChange={(e) => setAppConfig({ ...appConfig, serviceId: e.target.value.trim() })}
            placeholder="VD: 72481923..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
          />
        </div>

        {/* Environment */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Môi trường API (Environment)
          </label>
          <select
            value={appConfig.environment}
            onChange={(e) => setAppConfig({ ...appConfig, environment: e.target.value as "live" | "sandbox" })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-100 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 cursor-pointer"
          >
            <option value="live">Live / Production (TikTok Shop Thật)</option>
            <option value="sandbox">Sandbox / Test (Môi trường kiểm thử)</option>
          </select>
        </div>

        {/* Redirect URL */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Globe size={14} className="text-rose-400" /> Redirect URL (URL chuyển hướng khi ủy quyền)
            </label>
            <span className="text-[11px] text-rose-400 font-medium">Tự động nhận diện</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Dán vào mục <strong>Redirect URL</strong> trên TikTok Shop Partner Center:
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={typeof window !== "undefined" ? `${window.location.origin}/tiktok-callback` : "http://localhost:5173/tiktok-callback"}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800 select-all outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const url = typeof window !== "undefined" ? `${window.location.origin}/tiktok-callback` : "http://localhost:5173/tiktok-callback";
                navigator.clipboard.writeText(url);
                setAppSaved(true);
                setTimeout(() => setAppSaved(false), 2000);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-sm"
              title="Sao chép Redirect URL"
            >
              <Globe size={13} className="text-rose-400" />
              <span>Sao chép</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSaveAppConfig}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {appSaved ? <Check size={15} /> : <Save size={15} />}
            <span>{appSaved ? "Đã lưu cài đặt TikTok App!" : "Lưu cài đặt TikTok Shop"}</span>
          </button>
        </div>
      </div>

      {/* Guide Box */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
        <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
          <HelpCircle size={15} className="text-rose-400" /> Hướng dẫn lấy Khóa ứng dụng TikTok:
        </h4>
        <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1 leading-relaxed">
          <li>Truy cập <a href="https://partner.tiktokshop.com" target="_blank" rel="noreferrer" className="text-rose-400 hover:underline">TikTok Shop Partner Center</a>.</li>
          <li>Vào <strong>App Management</strong> &gt; Tạo ứng dụng <strong>Custom App (Ứng dụng nội bộ)</strong>.</li>
          <li>Sao chép <strong>Khóa ứng dụng (App Key)</strong> và <strong>Khóa bí mật của ứng dụng (App Secret)</strong> dán vào form trên rồi bấm Lưu.</li>
          <li>Sau đó, sang menu <strong>"Gian hàng TikTok"</strong> ở thanh bên trái để kết nối và kiểm tra token của Shop.</li>
        </ol>
      </div>
    </div>
  );
}
