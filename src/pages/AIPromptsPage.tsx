import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { PageHeader, EmptyState } from "@/components/PageParts";
import {
  Sparkles,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Eye,
  Sliders,
  Filter,
  Flame,
  CheckCircle2,
  XCircle,
  Wand2,
  Layers,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import type { AIPrompt } from "@/lib/types";
import { DEFAULT_AI_PROMPTS } from "@/lib/defaultPrompts";

const LOCAL_STORAGE_KEY = "sanpham_ai_prompts_cache_v3";

export function AIPromptsPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSide, setSelectedSide] = useState<"all" | "front" | "back">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AIPrompt | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<{
    title: string;
    category: string;
    side: "all" | "front" | "back";
    is_active: boolean;
    prompt: string;
  }>({
    title: "",
    category: "Studio",
    side: "all",
    is_active: true,
    prompt: "",
  });

  // Quick Add State (Chỉ cần ô nhập text)
  const [quickPromptText, setQuickPromptText] = useState("");
  const [quickSide, setQuickSide] = useState<"all" | "front" | "back">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function generateTitleFromPrompt(promptText: string): string {
    const clean = promptText.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return "Mẫu Prompt Tùy chỉnh";
    const words = clean.split(" ");
    if (words.length <= 6) return clean;
    return words.slice(0, 6).join(" ") + "...";
  }

  async function handleQuickAdd() {
    if (!quickPromptText.trim()) {
      showToast("⚠️ Vui lòng nhập hoặc dán nội dung câu prompt!");
      return;
    }

    const title = generateTitleFromPrompt(quickPromptText);
    const newItem: AIPrompt = {
      id: `custom-${Date.now()}`,
      title,
      category: "Studio",
      side: quickSide,
      is_active: true,
      prompt: quickPromptText.trim(),
      created_at: new Date().toISOString(),
    };

    const updatedList = [newItem, ...prompts];
    saveToDatabase(updatedList);
    setQuickPromptText("");
    showToast("🎉 Đã thêm mẫu prompt mới thành công!");

    try {
      const { data } = await supabase
        .from("ai_prompts")
        .insert({
          title: newItem.title,
          prompt: newItem.prompt,
          side: newItem.side,
          category: newItem.category,
          is_active: newItem.is_active,
        })
        .select()
        .single();

      if (data?.id) {
        const syncedList = updatedList.map((p) => (p.id === newItem.id ? (data as AIPrompt) : p));
        saveToDatabase(syncedList);
      }
    } catch (e) {}
  }

  // Simulator State
  const [simProduct, setSimProduct] = useState("Áo Thun Cổ Tròn Cotton");
  const [simColor, setSimColor] = useState("Đen (Black)");
  const [simDesign, setSimDesign] = useState("Cyberpunk Dragon 2077");

  // Load Prompts from Supabase (with fallback to defaults)
  async function loadPrompts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !data || data.length === 0) {
        seedDefaultsLocal();
      } else {
        setPrompts(data as AIPrompt[]);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Lỗi load ai_prompts từ Supabase, dùng local fallback:", err);
      seedDefaultsLocal();
    } finally {
      setLoading(false);
    }
  }

  function seedDefaultsLocal() {
    const list: AIPrompt[] = DEFAULT_AI_PROMPTS.map((p, idx) => ({
      ...p,
      id: `word-preset-${idx + 1}`,
      created_at: new Date().toISOString(),
    }));
    setPrompts(list);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  }

  useEffect(() => {
    loadPrompts();
  }, []);

  // Save changes to Supabase & LocalStorage
  async function saveToDatabase(updatedList: AIPrompt[]) {
    setPrompts(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["all", ...Array.from(set)];
  }, [prompts]);

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.prompt.toLowerCase().includes(search.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()));

      const matchSide =
        selectedSide === "all" ? true : p.side === "all" || p.side === selectedSide;

      const matchCategory =
        selectedCategory === "all" ? true : p.category === selectedCategory;

      return matchSearch && matchSide && matchCategory;
    });
  }, [prompts, search, selectedSide, selectedCategory]);

  const stats = useMemo(() => {
    const active = prompts.filter((p) => p.is_active).length;
    const front = prompts.filter((p) => p.side === "front" || p.side === "all").length;
    const back = prompts.filter((p) => p.side === "back" || p.side === "all").length;
    return {
      total: prompts.length,
      active,
      front,
      back,
    };
  }, [prompts]);

  function openCreate() {
    setEditingItem(null);
    setForm({
      title: "",
      category: "Studio",
      side: "all",
      is_active: true,
      prompt:
        'Mockup thương mại cao cấp của chiếc {blank_type} màu {color}, in hình "{design_name}" ({side}). Chụp ảnh studio ánh sáng dịu nhẹ, phong cách hiện đại và chân thực.',
    });
    setModalOpen(true);
  }

  function openEdit(item: AIPrompt) {
    setEditingItem(item);
    setForm({
      title: item.title,
      category: item.category || "Studio",
      side: item.side,
      is_active: item.is_active,
      prompt: item.prompt,
    });
    setModalOpen(true);
  }

  function duplicatePrompt(item: AIPrompt) {
    const newPrompt: AIPrompt = {
      ...item,
      id: `copy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `${item.title} (Bản sao)`,
      created_at: new Date().toISOString(),
    };
    const updated = [newPrompt, ...prompts];
    saveToDatabase(updated);

    // Try Supabase insert
    supabase
      .from("ai_prompts")
      .insert({
        title: newPrompt.title,
        prompt: newPrompt.prompt,
        side: newPrompt.side,
        category: newPrompt.category,
        is_active: newPrompt.is_active,
      })
      .then(() => {});
  }

  async function handleToggleActive(item: AIPrompt) {
    const updated = prompts.map((p) =>
      p.id === item.id ? { ...p, is_active: !p.is_active } : p
    );
    saveToDatabase(updated);

    try {
      await supabase
        .from("ai_prompts")
        .update({ is_active: !item.is_active })
        .eq("id", item.id);
    } catch (e) {}
  }

  async function handleDelete(item: AIPrompt) {
    if (!confirm(`Bạn có chắc chắn muốn xóa mẫu prompt "${item.title}"?`)) return;
    const updated = prompts.filter((p) => p.id !== item.id);
    saveToDatabase(updated);

    try {
      await supabase.from("ai_prompts").delete().eq("id", item.id);
    } catch (e) {}
  }

  async function handleResetDefaults() {
    if (
      !confirm(
        "Nạp lại toàn bộ 37 mẫu Prompt từ file Word? Bấm 'OK' để xóa toàn bộ danh sách cũ và nạp mới đúng 37 mẫu chuẩn từ Word."
      )
    )
      return;

    setLoading(true);
    const newItems: AIPrompt[] = DEFAULT_AI_PROMPTS.map((d, i) => ({
      ...d,
      id: `word-prompt-${i + 1}`,
      created_at: new Date().toISOString(),
    }));

    setPrompts(newItems);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));

    try {
      await supabase.from("ai_prompts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      for (const item of DEFAULT_AI_PROMPTS) {
        await supabase.from("ai_prompts").insert({
          title: item.title,
          prompt: item.prompt,
          side: item.side,
          category: item.category,
          is_active: item.is_active,
        });
      }
      showToast("🎉 Đã nạp thành công 37 mẫu prompt từ file Word!");
    } catch (e) {
      console.warn("Lỗi lưu Supabase:", e);
      showToast("🎉 Đã nạp 37 mẫu prompt từ Word vào bộ nhớ!");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.prompt.trim()) {
      showToast("⚠️ Vui lòng nhập nội dung câu prompt!");
      return;
    }

    const title = form.title.trim() || generateTitleFromPrompt(form.prompt);

    if (editingItem) {
      const updatedItem: AIPrompt = {
        ...editingItem,
        title,
        category: form.category.trim() || "Studio",
        side: form.side,
        is_active: form.is_active,
        prompt: form.prompt.trim(),
        updated_at: new Date().toISOString(),
      };

      const updatedList = prompts.map((p) => (p.id === editingItem.id ? updatedItem : p));
      saveToDatabase(updatedList);
      showToast("✅ Đã cập nhật mẫu prompt!");

      try {
        await supabase
          .from("ai_prompts")
          .update({
            title: updatedItem.title,
            prompt: updatedItem.prompt,
            side: updatedItem.side,
            category: updatedItem.category,
            is_active: updatedItem.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingItem.id);
      } catch (e) {}
    } else {
      const newItem: AIPrompt = {
        id: `custom-${Date.now()}`,
        title,
        category: form.category.trim() || "Studio",
        side: form.side,
        is_active: form.is_active,
        prompt: form.prompt.trim(),
        created_at: new Date().toISOString(),
      };

      const updatedList = [newItem, ...prompts];
      saveToDatabase(updatedList);
      showToast("🎉 Đã tạo mẫu prompt mới thành công!");

      try {
        const { data } = await supabase
          .from("ai_prompts")
          .insert({
            title: newItem.title,
            prompt: newItem.prompt,
            side: newItem.side,
            category: newItem.category,
            is_active: newItem.is_active,
          })
          .select()
          .single();

        if (data?.id) {
          const syncedList = updatedList.map((p) => (p.id === newItem.id ? (data as AIPrompt) : p));
          saveToDatabase(syncedList);
        }
      } catch (e) {}
    }

    setModalOpen(false);
  }

  function handleCopyPrompt(item: AIPrompt) {
    navigator.clipboard.writeText(item.prompt);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function insertVariable(varName: string) {
    setForm((prev) => ({
      ...prev,
      prompt: `${prev.prompt} {${varName}} `,
    }));
  }

  // Render simulated prompt
  const renderedSimPrompt = useMemo(() => {
    return form.prompt
      .replace(/{product_name}/g, simProduct)
      .replace(/{blank_type}/g, simProduct)
      .replace(/{color}/g, simColor)
      .replace(/{color_code}/g, simColor)
      .replace(/{design_name}/g, simDesign)
      .replace(
        /{side}/g,
        form.side === "front"
          ? "mặt trước"
          : form.side === "back"
          ? "mặt sau"
          : "mặt trước / sau"
      );
  }, [form.prompt, form.side, simProduct, simColor, simDesign]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-bounce bg-slate-800 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl border border-brand-500/50 flex items-center gap-2 text-sm font-semibold backdrop-blur-md">
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Danh Sách Mẫu Prompt AI"
        subtitle="Quản lý thư viện câu lệnh AI đa phong cách để tool Auto ChatGPT tự động bốc ngẫu nhiên (Random), giúp ảnh tạo ra đa dạng bối cảnh & không bị trùng lặp"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm"
              title="Nạp bổ sung 37 mẫu prompt từ file Word"
            >
              <RotateCcw size={16} className="text-amber-400" />
              <span>Nạp 37 Mẫu Từ Word</span>
            </button>
            <button
              onClick={openCreate}
              className="btn btn-primary flex items-center gap-2 text-xs sm:text-sm"
            >
              <Plus size={16} />
              <span>Thêm Mẫu Prompt Mới</span>
            </button>
          </div>
        }
      />

      {/* QUICK ADD PROMPT BOX - CHỈ CẦN Ô NHẬP TEXT */}
      <div className="card-gradient rounded-2xl border border-brand-500/30 p-4 sm:p-5 bg-gradient-to-br from-brand-950/30 via-slate-900/70 to-slate-900/90 shadow-xl shadow-brand-950/20">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                Thêm Mẫu Prompt Mới (Đơn Giản)
                <span className="text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ⚡ Chỉ cần ô nhập text
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Chỉ cần dán/gõ câu lệnh prompt vào đây và bấm <strong>Thêm Mẫu Prompt</strong> (hoặc nhấn <strong>Ctrl + Enter</strong>).
              </p>
            </div>
          </div>
        </div>

        {/* Text Input Area */}
        <div className="relative">
          <textarea
            rows={3}
            value={quickPromptText}
            onChange={(e) => setQuickPromptText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            placeholder="Nhập hoặc dán câu prompt của bạn vào đây... Ví dụ: Mockup thương mại của {blank_type} màu {color}, in hình {design_name} ({side}). Chụp ảnh studio ánh sáng tự nhiên, góc nhìn hiện đại..."
            className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-brand-500 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 font-mono text-xs leading-relaxed focus:outline-none transition-all shadow-inner"
          />
        </div>

        {/* Toolbar & Controls below textarea */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2.5 border-t border-slate-800/80">
          {/* Quick Variable Insertion Helper */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
              <HelpCircle size={12} /> Chèn biến nhanh:
            </span>
            {[
              { key: "product_name", label: "+ {product_name}", color: "text-sky-400 hover:bg-sky-500/10 border-sky-500/20" },
              { key: "color", label: "+ {color}", color: "text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20" },
              { key: "design_name", label: "+ {design_name}", color: "text-amber-400 hover:bg-amber-500/10 border-amber-500/20" },
              { key: "blank_type", label: "+ {blank_type}", color: "text-purple-400 hover:bg-purple-500/10 border-purple-500/20" },
              { key: "side", label: "+ {side}", color: "text-rose-400 hover:bg-rose-500/10 border-rose-500/20" },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setQuickPromptText((prev) => `${prev} {${v.key}} `)}
                className={`px-2 py-1 bg-slate-900 rounded-lg text-xs font-mono border transition-all ${v.color}`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Side selector & Submit button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <div className="flex p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setQuickSide("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  quickSide === "all" ? "bg-brand-500 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Cả 2 mặt
              </button>
              <button
                type="button"
                onClick={() => setQuickSide("front")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  quickSide === "front" ? "bg-brand-500 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Mặt trước
              </button>
              <button
                type="button"
                onClick={() => setQuickSide("back")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  quickSide === "back" ? "bg-brand-500 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Mặt sau
              </button>
            </div>

            <button
              type="button"
              onClick={handleQuickAdd}
              className="btn btn-primary px-4 py-2 flex items-center gap-1.5 text-xs sm:text-sm font-semibold shadow-lg shadow-brand-500/20 hover:brightness-110 active:scale-95 transition-all"
              title="Phím tắt: Ctrl + Enter"
            >
              <Plus size={16} />
              <span>Thêm Mẫu Prompt</span>
            </button>
          </div>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card-gradient p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng Mẫu Prompt</p>
            <p className="text-xl font-bold text-slate-100">{stats.total}</p>
          </div>
        </div>

        <div className="card-gradient p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Đang Kích Hoạt</p>
            <p className="text-xl font-bold text-emerald-400">{stats.active}</p>
          </div>
        </div>

        <div className="card-gradient p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Mặt Trước (Front)</p>
            <p className="text-xl font-bold text-sky-400">{stats.front}</p>
          </div>
        </div>

        <div className="card-gradient p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Mặt Sau (Back)</p>
            <p className="text-xl font-bold text-amber-400">{stats.back}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên mẫu, từ khóa prompt..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Side Filter */}
          <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedSide("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedSide === "all"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tất cả mặt
            </button>
            <button
              onClick={() => setSelectedSide("front")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedSide === "front"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mặt trước
            </button>
            <button
              onClick={() => setSelectedSide("back")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedSide === "back"
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mặt sau
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            <option value="all">Tất cả phong cách</option>
            {categories
              .filter((c) => c !== "all")
              .map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* PROMPTS GRID */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Đang tải danh sách prompt...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Chưa có mẫu prompt nào phù hợp"
          description="Hãy tạo mẫu prompt mới hoặc bấm 'Nạp 12+ Mẫu Thịnh Hành' để nạp sẵn bộ prompt studio, streetwear chất lượng cao."
          action={
            <button onClick={handleResetDefaults} className="btn btn-primary mt-3 text-sm">
              <RotateCcw size={16} /> Nạp mẫu có sẵn ngay
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isFront = item.side === "front";
            const isBack = item.side === "back";
            const isAll = item.side === "all";

            return (
              <div
                key={item.id}
                className={`card-gradient rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
                  item.is_active
                    ? "border-slate-800 hover:border-slate-700 bg-slate-900/60"
                    : "border-slate-800/40 bg-slate-950/40 opacity-60"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isFront
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : isBack
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isFront
                          ? "👕 Mặt trước"
                          : isBack
                          ? "👕 Mặt sau"
                          : "🔄 Cả 2 mặt"}
                      </span>

                      {item.category && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          {item.category}
                        </span>
                      )}

                      {!item.is_active && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Đã tắt
                        </span>
                      )}
                    </div>

                    {/* Active Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      title={
                        item.is_active
                          ? "Đang bật (sẽ được chọn random). Bấm để tắt."
                          : "Đang tắt (bỏ qua khi random). Bấm để bật."
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        item.is_active ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          item.is_active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Title */}
                  <h4 className="text-base font-bold text-slate-100 mb-2 leading-snug">
                    {item.title}
                  </h4>

                  {/* Prompt Text Box */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-mono relative group mb-3">
                    <p className="line-clamp-4 select-text">{item.prompt}</p>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-auto">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyPrompt(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 px-2.5"
                      title="Sao chép câu prompt"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check size={13} className="text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span className="text-[11px]">Sao chép</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => duplicatePrompt(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 px-2.5"
                      title="Tạo bản sao mẫu prompt này"
                    >
                      <Layers size={13} />
                      <span className="text-[11px]">Nhân bản</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-slate-800 transition-colors"
                      title="Chỉnh sửa mẫu prompt"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Xóa mẫu prompt"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Chỉnh Sửa Mẫu Prompt AI" : "Thêm Mẫu Prompt AI Mới"}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tiêu đề gợi nhớ phong cách <span className="text-slate-500 font-normal">(Tùy chọn):</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="VD: Chụp Studio Ánh Sáng Mềm Mại... (Để trống hệ thống sẽ tự động đặt)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Phong cách / Thể loại:
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Studio, Streetwear, Lifestyle, Flat Lay, Vintage..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Áp dụng cho mặt in:
              </label>
              <select
                value={form.side}
                onChange={(e) =>
                  setForm({ ...form, side: e.target.value as "all" | "front" | "back" })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
              >
                <option value="all">🔄 Cả mặt trước & mặt sau</option>
                <option value="front">👕 Chỉ mặt trước (Front)</option>
                <option value="back">👕 Chỉ mặt sau (Back)</option>
              </select>
            </div>
          </div>

          {/* Quick Variable Insertion Helper */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Nội dung câu Prompt AI: <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <HelpCircle size={12} /> Bấm nút bên dưới để chèn biến tự động:
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => insertVariable("product_name")}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-xs font-mono border border-sky-500/20 transition-colors"
                title="Tên sản phẩm"
              >
                + &#123;product_name&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable("color")}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-mono border border-emerald-500/20 transition-colors"
                title="Tên màu sắc (Đen, Trắng, Be...)"
              >
                + &#123;color&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable("design_name")}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded text-xs font-mono border border-amber-500/20 transition-colors"
                title="Tên hình in"
              >
                + &#123;design_name&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable("blank_type")}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded text-xs font-mono border border-purple-500/20 transition-colors"
                title="Loại phôi (Áo thun, Hoodie, Polo...)"
              >
                + &#123;blank_type&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable("side")}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded text-xs font-mono border border-rose-500/20 transition-colors"
                title="Mặt trước / Mặt sau"
              >
                + &#123;side&#125;
              </button>
            </div>

            <textarea
              rows={5}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="VD: Mockup thương mại của {blank_type} màu {color}, in hình {design_name} ở {side}..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 font-mono text-xs leading-relaxed focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* SIMULATOR PREVIEW BOX */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand-400 flex items-center gap-1.5">
                <Wand2 size={14} /> Mô phỏng Render thực tế gửi tới ChatGPT:
              </span>
            </div>

            <div className="p-2.5 bg-slate-900/90 rounded-lg text-xs text-slate-300 font-mono border border-slate-800/80 leading-relaxed max-h-24 overflow-y-auto">
              {renderedSimPrompt || "(Chưa có nội dung)"}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-500 block">Thử sản phẩm:</label>
                <input
                  type="text"
                  value={simProduct}
                  onChange={(e) => setSimProduct(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block">Thử màu:</label>
                <input
                  type="text"
                  value={simColor}
                  onChange={(e) => setSimColor(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block">Thử hình in:</label>
                <input
                  type="text"
                  value={simDesign}
                  onChange={(e) => setSimDesign(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span className="text-xs font-medium text-slate-300">
                Kích hoạt mẫu này (cho phép random khi tạo ảnh)
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary text-xs sm:text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn btn-primary text-xs sm:text-sm"
              >
                {editingItem ? "Lưu Thay Đổi" : "Tạo Mẫu Prompt"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
