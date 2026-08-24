import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageParts";
import {
  Sparkles,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Flame,
  CheckCircle2,
  Layers,
  HelpCircle,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Users,
  User,
  Heart,
  Wand2,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { AIPrompt } from "@/lib/types";
import { DEFAULT_AI_PROMPTS } from "@/lib/defaultPrompts";
import * as XLSX from "xlsx";

const LOCAL_STORAGE_KEY = "sanpham_ai_prompts_cache_v4";

interface ExcelPromptPreview {
  title: string;
  category: string;
  side: "all" | "front" | "back";
  prompt: string;
  is_active: boolean;
}

export function AIPromptsPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSide, setSelectedSide] = useState<"all" | "front" | "back">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<"all" | "female" | "male" | "couple">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AIPrompt | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Excel Import State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<ExcelPromptPreview[]>([]);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [defaultImportCategory, setDefaultImportCategory] = useState("Cặp đôi / Couple");
  const [defaultImportSide, setDefaultImportSide] = useState<"all" | "front" | "back">("front");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Quick Add State
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

  function detectModelType(item: { title: string; prompt: string }): "couple" | "female" | "male" | "other" {
    const t = (item.title + " " + item.prompt).toLowerCase();
    if (
      t.includes("cặp") ||
      t.includes("couple") ||
      t.includes("asian models") ||
      t.includes("both models") ||
      t.includes("two young adult") ||
      t.includes("one male and one female")
    ) {
      return "couple";
    }
    if (t.includes("female model") || t.includes("model: female") || t.includes("vietnamese female")) {
      return "female";
    }
    if (t.includes("male model") || t.includes("model: male") || t.includes("vietnamese male")) {
      return "male";
    }
    return "other";
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
      id: `preset-${idx + 1}`,
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

      const modelType = detectModelType(p);
      let matchModel = true;
      if (selectedModel === "female") matchModel = modelType === "female";
      else if (selectedModel === "male") matchModel = modelType === "male";
      else if (selectedModel === "couple") matchModel = modelType === "couple";

      return matchSearch && matchSide && matchCategory && matchModel;
    });
  }, [prompts, search, selectedSide, selectedCategory, selectedModel]);

  const stats = useMemo(() => {
    const active = prompts.filter((p) => p.is_active).length;
    const front = prompts.filter((p) => p.side === "front" || p.side === "all").length;
    const back = prompts.filter((p) => p.side === "back" || p.side === "all").length;
    const female = prompts.filter((p) => detectModelType(p) === "female").length;
    const male = prompts.filter((p) => detectModelType(p) === "male").length;
    const couple = prompts.filter((p) => detectModelType(p) === "couple").length;
    return {
      total: prompts.length,
      active,
      front,
      back,
      female,
      male,
      couple,
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

  // Khôi phục nạp đầy đủ 74 mẫu gốc (37 đơn + 37 cặp đôi)
  async function handleResetDefaults() {
    if (
      !confirm(
        `Nạp lại toàn bộ ${DEFAULT_AI_PROMPTS.length} mẫu Prompt chuẩn (37 mẫu Nam/Nữ đơn + 37 mẫu Cặp đôi Nam & Nữ)? Thao tác này sẽ làm mới danh sách prompt chuẩn từ hệ thống.`
      )
    )
      return;

    setLoading(true);
    const newItems: AIPrompt[] = DEFAULT_AI_PROMPTS.map((d, i) => ({
      ...d,
      id: `preset-prompt-${i + 1}`,
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
      showToast(`🎉 Đã nạp thành công toàn bộ ${DEFAULT_AI_PROMPTS.length} mẫu prompt chuẩn!`);
    } catch (e) {
      console.warn("Lỗi lưu Supabase:", e);
      showToast(`🎉 Đã nạp ${DEFAULT_AI_PROMPTS.length} mẫu prompt vào bộ nhớ!`);
    } finally {
      setLoading(false);
    }
  }

  // Nạp thêm 37 mẫu Cặp đôi vào danh sách hiện tại (không xóa mẫu cũ)
  async function handleAppendCouplePresets() {
    setLoading(true);
    const couplePresets = DEFAULT_AI_PROMPTS.filter((p) => detectModelType(p) === "couple");
    const existingTitles = new Set(prompts.map((p) => p.title.trim().toLowerCase()));
    const toAdd = couplePresets.filter(
      (p) => !existingTitles.has(p.title.trim().toLowerCase())
    );

    if (toAdd.length === 0) {
      showToast("ℹ️ Bạn đã có đầy đủ 37 mẫu Cặp Đôi trong danh sách!");
      setLoading(false);
      return;
    }

    const newItems: AIPrompt[] = toAdd.map((d, i) => ({
      ...d,
      id: `couple-prompt-${Date.now()}-${i + 1}`,
      created_at: new Date().toISOString(),
    }));

    const merged = [...prompts, ...newItems];
    saveToDatabase(merged);

    try {
      for (const item of toAdd) {
        await supabase.from("ai_prompts").insert({
          title: item.title,
          prompt: item.prompt,
          side: item.side,
          category: item.category,
          is_active: item.is_active,
        });
      }
      showToast(`🎉 Đã thêm thành công ${newItems.length} mẫu prompt Cặp Đôi Nam & Nữ!`);
    } catch (e) {
      showToast(`🎉 Đã nạp thêm ${newItems.length} mẫu Cặp Đôi vào bộ nhớ!`);
    } finally {
      setLoading(false);
    }
  }

  // Xử lý đọc file Excel (.xlsx, .xls, .csv)
  function handleExcelFileUpload(file: File) {
    setImportFileName(file.name);
    setImportLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: "binary" });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        if (!rawRows || rawRows.length === 0) {
          alert("File Excel trống hoặc không đọc được dữ liệu!");
          setImportLoading(false);
          return;
        }

        // Parse header and rows
        const parsedList: ExcelPromptPreview[] = [];
        let headerRowIndex = 0;

        // Check if first row is header
        const row0 = (rawRows[0] || []).map((c) => String(c || "").toLowerCase().trim());
        let titleCol = -1;
        let promptCol = -1;
        let categoryCol = -1;
        let sideCol = -1;

        row0.forEach((colName, idx) => {
          if (
            colName.includes("bối cảnh") ||
            colName.includes("tiêu đề") ||
            colName.includes("title") ||
            colName.includes("tên")
          ) {
            titleCol = idx;
          }
          if (
            colName.includes("prompt") ||
            colName.includes("câu lệnh") ||
            colName.includes("nội dung") ||
            colName.includes("content")
          ) {
            promptCol = idx;
          }
          if (
            colName.includes("category") ||
            colName.includes("thể loại") ||
            colName.includes("danh mục") ||
            colName.includes("nhóm")
          ) {
            categoryCol = idx;
          }
          if (
            colName.includes("side") ||
            colName.includes("mặt") ||
            colName.includes("vị trí")
          ) {
            sideCol = idx;
          }
        });

        // Default fallbacks if header doesn't explicitly match
        if (titleCol === -1 && promptCol === -1) {
          // Check standard 3-column format: [STT, Bối cảnh, Prompt]
          if (rawRows[0].length >= 3) {
            titleCol = 1;
            promptCol = 2;
          } else if (rawRows[0].length === 2) {
            titleCol = 0;
            promptCol = 1;
          } else {
            promptCol = 0;
          }
          headerRowIndex = 1; // start from row 1
        } else {
          headerRowIndex = 1;
        }

        const dataRows = rawRows.slice(headerRowIndex);
        dataRows.forEach((row, rowIdx) => {
          if (!row || row.length === 0) return;
          const promptText = promptCol >= 0 && row[promptCol] ? String(row[promptCol]).trim() : "";
          if (!promptText) return;

          let rawTitle =
            titleCol >= 0 && row[titleCol] ? String(row[titleCol]).trim() : "";
          if (!rawTitle) {
            rawTitle = generateTitleFromPrompt(promptText);
          }

          let category =
            categoryCol >= 0 && row[categoryCol]
              ? String(row[categoryCol]).trim()
              : defaultImportCategory;
          if (!category) category = "Cặp đôi / Couple";

          let side: "all" | "front" | "back" = defaultImportSide;
          if (sideCol >= 0 && row[sideCol]) {
            const s = String(row[sideCol]).toLowerCase();
            if (s.includes("front") || s.includes("trước")) side = "front";
            else if (s.includes("back") || s.includes("sau")) side = "back";
            else side = "all";
          }

          parsedList.push({
            title: rawTitle,
            category,
            side,
            prompt: promptText.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
            is_active: true,
          });
        });

        if (parsedList.length === 0) {
          alert("Không tìm thấy dòng prompt hợp lệ nào trong file Excel!");
          setImportLoading(false);
          return;
        }

        setImportPreview(parsedList);
        setImportModalOpen(true);
      } catch (err: any) {
        console.error("Excel parse error:", err);
        alert("Lỗi khi đọc file Excel: " + (err.message || String(err)));
      } finally {
        setImportLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  }

  // Thực thi Import các dòng từ Excel vào App & Supabase
  async function handleExecuteImport() {
    if (importPreview.length === 0) return;
    setImportLoading(true);

    try {
      const newItems: AIPrompt[] = importPreview.map((item, i) => ({
        id: `import-${Date.now()}-${i + 1}`,
        title: item.title,
        prompt: item.prompt,
        category: item.category || defaultImportCategory,
        side: item.side || defaultImportSide,
        is_active: item.is_active,
        created_at: new Date().toISOString(),
      }));

      let finalPrompts: AIPrompt[] = [];
      if (importMode === "replace") {
        finalPrompts = newItems;
        await supabase.from("ai_prompts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } else {
        finalPrompts = [...prompts, ...newItems];
      }

      saveToDatabase(finalPrompts);

      // Save to supabase
      for (const item of newItems) {
        await supabase.from("ai_prompts").insert({
          title: item.title,
          prompt: item.prompt,
          side: item.side,
          category: item.category,
          is_active: item.is_active,
        });
      }

      setImportModalOpen(false);
      setImportPreview([]);
      setImportFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      showToast(
        importMode === "replace"
          ? `🎉 Đã thay thế toàn bộ bằng ${newItems.length} mẫu prompt từ Excel!`
          : `🎉 Đã import thêm thành công ${newItems.length} mẫu prompt từ Excel!`
      );
    } catch (e: any) {
      console.error("Import error:", e);
      showToast(`⚠️ Có lỗi trong quá trình lưu Supabase: ${e.message || "Lỗi không xác định"}`);
    } finally {
      setImportLoading(false);
    }
  }

  // Xuất file Excel các prompt hiện có
  function handleExportExcel() {
    try {
      const exportData = prompts.map((p, idx) => ({
        STT: idx + 1,
        "Tiêu đề": p.title,
        "Phong cách / Category": p.category || "",
        "Mặt in (Side)": p.side,
        "Trạng thái": p.is_active ? "Đang bật" : "Đã tắt",
        "Nội dung Prompt": p.prompt,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prompts");
      XLSX.writeFile(wb, `ai_prompts_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast("📥 Đã xuất file Excel danh sách prompt thành công!");
    } catch (err: any) {
      alert("Lỗi khi xuất file Excel: " + err.message);
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
      {/* Hidden File Input for Excel */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleExcelFileUpload(file);
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-bounce bg-slate-800 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl border border-brand-500/50 flex items-center gap-2 text-sm font-semibold backdrop-blur-md">
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Danh Sách Mẫu Prompt AI"
        subtitle="Quản lý kho prompt AI (Nam, Nữ, Cặp đôi Nam & Nữ) để tool Auto ChatGPT tự động bốc ngẫu nhiên tạo ảnh mockup sống động & chuẩn phôi"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Import Excel */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary flex items-center gap-1.5 text-xs sm:text-sm bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border-emerald-500/30"
              title="Nhập thêm câu prompt từ file Excel (.xlsx, .xls, .csv)"
            >
              <FileSpreadsheet size={16} />
              <span>Import Excel (.xlsx)</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              className="btn btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
              title="Xuất danh sách prompt ra file Excel"
            >
              <Download size={15} className="text-slate-400" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>

            {/* Nạp 37 Cặp đôi */}
            <button
              onClick={handleAppendCouplePresets}
              className="btn btn-secondary flex items-center gap-1.5 text-xs sm:text-sm bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border-purple-500/30"
              title="Nạp thêm 37 mẫu Cặp Nam & Nữ vào danh sách hiện tại"
            >
              <Users size={16} className="text-purple-400" />
              <span>+37 Mẫu Cặp Đôi</span>
            </button>

            {/* Nạp 74 mẫu gốc */}
            <button
              onClick={handleResetDefaults}
              className="btn btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
              title="Khôi phục trọn bộ 74 mẫu prompt chuẩn (37 Đơn + 37 Cặp đôi)"
            >
              <RotateCcw size={15} className="text-amber-400" />
              <span className="hidden sm:inline">Nạp 74 Mẫu Gốc</span>
            </button>

            {/* Thêm mới */}
            <button
              onClick={openCreate}
              className="btn btn-primary flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Plus size={16} />
              <span>Thêm Mẫu Mới</span>
            </button>
          </div>
        }
      />

      {/* QUICK ADD PROMPT BOX */}
      <div className="card-gradient rounded-2xl border border-brand-500/30 p-4 sm:p-5 bg-gradient-to-br from-brand-950/30 via-slate-900/70 to-slate-900/90 shadow-xl shadow-brand-950/20">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                Thêm Nhanh Câu Prompt Mới
                <span className="text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ⚡ Dán text & Lưu
                </span>
              </h3>
              <p className="text-xs text-slate-400 hidden sm:block">
                Dán câu prompt AI vào đây, hệ thống sẽ tự động phân loại và đưa vào kho ngẫu nhiên.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            rows={3}
            value={quickPromptText}
            onChange={(e) => setQuickPromptText(e.target.value)}
            placeholder="Dán câu prompt tại đây (VD: Asian models, Vietnamese male and female, wearing this exact {color} {blank_type}...)"
            className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Variable insertion buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Chèn biến:</span>
              {[
                { label: "+ {blank_type}", key: "blank_type", color: "text-purple-400 border-purple-500/30 hover:bg-purple-500/10" },
                { label: "+ {color}", key: "color", color: "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" },
                { label: "+ {design_name}", key: "design_name", color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10" },
                { label: "+ {side}", key: "side", color: "text-rose-400 border-rose-500/30 hover:bg-rose-500/10" },
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
              >
                <Plus size={16} />
                <span>Thêm Mẫu Prompt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Tổng Mẫu</p>
            <p className="text-xl font-bold text-slate-100">{stats.total}</p>
          </div>
        </div>

        <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Cặp Nam & Nữ</p>
            <p className="text-xl font-bold text-purple-400">{stats.couple}</p>
          </div>
        </div>

        <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
            <User size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Mẫu Nữ (Female)</p>
            <p className="text-xl font-bold text-pink-400">{stats.female}</p>
          </div>
        </div>

        <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
            <User size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Mẫu Nam (Male)</p>
            <p className="text-xl font-bold text-indigo-400">{stats.male}</p>
          </div>
        </div>

        <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Đang Bật</p>
            <p className="text-xl font-bold text-emerald-400">{stats.active}</p>
          </div>
        </div>

        <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Mặt Trước / Sau</p>
            <p className="text-sm font-bold text-sky-400">
              {stats.front} <span className="text-slate-500 text-xs font-normal">trước</span> / {stats.back} <span className="text-slate-500 text-xs font-normal">sau</span>
            </p>
          </div>
        </div>
      </div>

      {/* MODEL FILTER TABS & SEARCH BAR */}
      <div className="card-gradient p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
        {/* Model Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mr-2 shrink-0">
            <Users size={14} /> Đối tượng Model:
          </span>

          <button
            onClick={() => setSelectedModel("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              selectedModel === "all"
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <span>Tất cả ({prompts.length})</span>
          </button>

          <button
            onClick={() => setSelectedModel("couple")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              selectedModel === "couple"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 font-bold"
                : "bg-slate-900 text-purple-300 hover:text-purple-200 border border-purple-500/30"
            }`}
          >
            <Heart size={13} className="text-purple-300" />
            <span>Cặp Nam & Nữ ({stats.couple})</span>
          </button>

          <button
            onClick={() => setSelectedModel("female")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              selectedModel === "female"
                ? "bg-pink-600 text-white shadow-md shadow-pink-600/20 font-bold"
                : "bg-slate-900 text-pink-300 hover:text-pink-200 border border-pink-500/30"
            }`}
          >
            <User size={13} className="text-pink-300" />
            <span>Mẫu Nữ ({stats.female})</span>
          </button>

          <button
            onClick={() => setSelectedModel("male")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              selectedModel === "male"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold"
                : "bg-slate-900 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30"
            }`}
          >
            <User size={13} className="text-indigo-300" />
            <span>Mẫu Nam ({stats.male})</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-1 border-t border-slate-800/80">
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
              placeholder="Tìm theo bối cảnh, từ khóa prompt..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
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
              <option value="all">Tất cả bối cảnh ({categories.length - 1})</option>
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
      </div>

      {/* PROMPTS GRID */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-brand-400" />
          <p className="text-sm">Đang tải kho prompt AI...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-gradient rounded-2xl border border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Sparkles size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-200">Không tìm thấy mẫu prompt phù hợp</h4>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              Thử tìm kiếm với từ khóa khác, thay đổi bộ lọc hoặc nạp bổ sung các mẫu prompt chuẩn có sẵn.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleResetDefaults} className="btn btn-primary text-xs sm:text-sm">
              <RotateCcw size={15} /> Nạp 74 mẫu gốc ngay
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item, idx) => {
            const isFront = item.side === "front";
            const isBack = item.side === "back";
            const modelType = detectModelType(item);

            return (
              <div
                key={item.id || idx}
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
                      {/* Model Badge */}
                      {modelType === "couple" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Users size={12} /> Cặp Nam & Nữ
                        </span>
                      ) : modelType === "female" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                          <User size={12} /> Nữ (Female)
                        </span>
                      ) : modelType === "male" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <User size={12} /> Nam (Male)
                        </span>
                      ) : null}

                      {/* Side Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isFront
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : isBack
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isFront
                          ? "Mặt trước"
                          : isBack
                          ? "Mặt sau"
                          : "Cả 2 mặt"}
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
                  <h4 className="text-sm sm:text-base font-bold text-slate-100 mb-2 leading-snug">
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

      {/* EXCEL IMPORT PREVIEW MODAL */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Xác Nhận Import Prompt Từ Excel"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center gap-3">
            <FileSpreadsheet size={24} className="text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">File đã chọn:</p>
              <p className="text-sm font-bold text-slate-100">{importFileName}</p>
              <p className="text-xs text-emerald-400 font-medium mt-0.5">
                ✅ Đã phát hiện <span className="underline font-bold">{importPreview.length}</span> câu prompt hợp lệ
              </p>
            </div>
          </div>

          {/* Import Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Chế độ Import:
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === "append"}
                    onChange={() => setImportMode("append")}
                    className="text-brand-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span>
                    <strong>Nạp thêm</strong> (Giữ nguyên danh sách hiện có)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-rose-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                    className="text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span>
                    <strong>Ghi đè tất cả</strong> (Xóa hết mẫu cũ & nạp mới)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Danh mục mặc định:
              </label>
              <input
                type="text"
                value={defaultImportCategory}
                onChange={(e) => setDefaultImportCategory(e.target.value)}
                placeholder="Cặp đôi / Couple, Studio..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Preview Table */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Xem trước các câu prompt sẽ được import:
            </label>
            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Tiêu đề / Bối cảnh</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 w-20">Mặt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                  {importPreview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-2.5 text-slate-200 font-medium">
                        <div>{row.title}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 font-mono mt-0.5">
                          {row.prompt.slice(0, 80)}...
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-400">{row.category || defaultImportCategory}</td>
                      <td className="p-2.5 text-slate-400">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800">
                          {row.side}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="btn btn-secondary text-xs sm:text-sm"
              disabled={importLoading}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              className="btn btn-primary text-xs sm:text-sm flex items-center gap-1.5"
              disabled={importLoading}
            >
              {importLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Đang Import...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={15} />
                  <span>Tiến Hành Import ({importPreview.length} Mẫu)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

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
                placeholder="Studio, Streetwear, Lifestyle, Cặp đôi / Couple..."
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
