import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Color, Size, Theme, CodeRule } from "@/lib/types";
import { PageHeader, EmptyState } from "@/components/PageParts";
import { Field } from "@/components/Field";
import { Plus, Trash2, Loader2, Palette, Ruler, Tag, Code2, Save, Check } from "lucide-react";

export function SettingsPage() {
  const [tab, setTab] = useState<"colors" | "sizes" | "themes" | "code">("colors");
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
    { key: "colors" as const, label: "Màu", icon: Palette },
    { key: "sizes" as const, label: "Size", icon: Ruler },
    { key: "themes" as const, label: "Chủ đề", icon: Tag },
    { key: "code" as const, label: "Quy tắc mã", icon: Code2 },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Cài đặt" subtitle="Quản lý danh mục màu, size, chủ đề và quy tắc sinh mã" />

      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-700/50 mb-6 w-fit">
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
          {tab === "colors" && <ColorsTab colors={colors} setColors={setColors} />}
          {tab === "sizes" && <SizesTab sizes={sizes} setSizes={setSizes} />}
          {tab === "themes" && <ThemesTab themes={themes} setThemes={setThemes} />}
          {tab === "code" && <CodeTab codeRule={codeRule} setCodeRule={setCodeRule} />}
        </>
      )}
    </div>
  );
}

function ColorsTab({ colors, setColors }: { colors: Color[]; setColors: (c: Color[]) => void }) {
  const [form, setForm] = useState({ code: "", name: "", hex: "#FFFFFF" });

  async function add() {
    if (!form.code.trim() || !form.name.trim()) return;
    const { data, error } = await supabase.from("colors").insert({ code: form.code.trim(), name: form.name.trim(), hex: form.hex }).select().single();
    if (error) { alert(error.message); return; }
    setColors([...colors, data as Color].sort((a, b) => a.name.localeCompare(b.name)));
    setForm({ code: "", name: "", hex: "#FFFFFF" });
  }

  async function remove(id: number) {
    if (!confirm("Xóa màu này?")) return;
    const { error } = await supabase.from("colors").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setColors(colors.filter((c) => c.id !== id));
  }

  return (
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <Field label="Mã màu" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="T" />
        <Field label="Tên màu" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Trắng" />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">Màu hiển thị</label>
          <input type="color" value={form.hex} onChange={(e) => setForm({ ...form, hex: e.target.value })} className="w-full h-[42px] rounded-xl border border-slate-700/50 bg-slate-800/50 cursor-pointer" />
        </div>
        <div className="flex items-end">
          <button onClick={add} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"><Plus size={18} /> Thêm</button>
        </div>
      </div>
      {colors.length === 0 ? <EmptyState message="Chưa có màu nào." /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {colors.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 hover:border-slate-600 group">
              <span className="w-8 h-8 rounded-full border border-slate-600 shrink-0" style={{ background: c.hex || "#ccc" }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                <p className="text-xs text-slate-500 font-mono">{c.code}</p>
              </div>
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          ))}
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
    <div className="card-gradient rounded-2xl border border-slate-700/50 p-6">
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
