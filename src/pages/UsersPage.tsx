import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Profile } from "@/lib/types";
import { callUserManagement, formatDate, emailToUsername, usernameToEmail } from "@/lib/helpers";
import { PageHeader, EmptyState } from "@/components/PageParts";
import { Modal } from "@/components/Modal";
import { Field, Select } from "@/components/Field";
import {
  Plus, Pencil, Trash2, Loader2, ShieldCheck, UserCircle,
  Phone, Ban, CheckCircle2,
} from "lucide-react";

export function UsersPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    username: "", password: "", fullName: "", phone: "", role: "staff", status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await callUserManagement<{ data: Profile[] }>({ action: "list" });
      setItems(data.data || []);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ username: "", password: "", fullName: "", phone: "", role: "staff", status: "active" });
    setError(null); setModalOpen(true);
  }

  function openEdit(item: Profile) {
    setEditing(item);
    setForm({ username: emailToUsername(item.email), password: "", fullName: item.full_name || "", phone: item.phone || "", role: item.role, status: item.status });
    setError(null); setModalOpen(true);
  }

  async function handleSave() {
    setError(null); setSaving(true);
    try {
      if (editing) {
        await callUserManagement({ action: "update", userId: editing.id, fullName: form.fullName, phone: form.phone, role: form.role, status: form.status });
      } else {
        if (!form.username || !form.password) { setError("Tên đăng nhập và mật khẩu là bắt buộc."); setSaving(false); return; }
        await callUserManagement({ action: "create", email: usernameToEmail(form.username), password: form.password, fullName: form.fullName, phone: form.phone, role: form.role });
      }
      setModalOpen(false); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(item: Profile) {
    if (item.id === profile?.id) { alert("Bạn không thể xóa tài khoản của chính mình."); return; }
    const displayUsername = emailToUsername(item.email);
    if (!confirm(`Xóa tài khoản "${displayUsername}"? Hành động này không thể hoàn tác.`)) return;
    try { await callUserManagement({ action: "delete", userId: item.id }); await load(); }
    catch (err) { alert((err as Error).message); }
  }

  async function toggleStatus(item: Profile) {
    const newStatus = item.status === "active" ? "disabled" : "active";
    try {
      await callUserManagement({ action: "update", userId: item.id, status: newStatus, fullName: item.full_name, phone: item.phone, role: item.role });
      await load();
    } catch (err) { alert((err as Error).message); }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Quản lý nhân viên"
        subtitle="Tạo, sửa, kích hoạt/vô hiệu hóa tài khoản nhân viên"
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">
            <Plus size={18} /> Thêm nhân viên
          </button>
        }
      />

      <div className="card-gradient rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-600" size={32} /></div>
        ) : items.length === 0 ? (
          <EmptyState message="Chưa có nhân viên nào." />
        ) : (
          <>
            {/* Mobile Card View (< sm) */}
            <div className="sm:hidden divide-y divide-slate-800">
              {items.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0">
                        <UserCircle size={24} className="text-slate-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{item.full_name || "(chưa đặt tên)"}</p>
                        <p className="text-xs text-slate-400">@{emailToUsername(item.email)}</p>
                      </div>
                    </div>
                    {item.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-500/10 text-brand-400 shrink-0">
                        <ShieldCheck size={12} /> Quản trị
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-700/50 text-slate-400 shrink-0">
                        Nhân viên
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-slate-500" />
                      {item.phone || "Chưa có SĐT"}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      item.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {item.status === "active" ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                    <button onClick={() => toggleStatus(item)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        item.status === "active" ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}>
                      {item.status === "active" ? <><Ban size={14} /> Khóa</> : <><CheckCircle2 size={14} /> Mở khóa</>}
                    </button>
                    <button onClick={() => openEdit(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-colors">
                      <Pencil size={14} /> Sửa
                    </button>
                    <button onClick={() => handleDelete(item)} disabled={item.id === profile?.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <Trash2 size={14} /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/30">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3">Nhân viên</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3 hidden md:table-cell">Liên hệ</th>
                    <th className="text-center text-xs font-semibold text-slate-400 uppercase px-5 py-3">Vai trò</th>
                    <th className="text-center text-xs font-semibold text-slate-400 uppercase px-5 py-3">Trạng thái</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase px-5 py-3 hidden lg:table-cell">Tạo lúc</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase px-5 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                            <UserCircle size={20} className="text-slate-300" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{item.full_name || "(chưa đặt tên)"}</p>
                            <p className="text-xs text-slate-500">@{emailToUsername(item.email)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        {item.phone ? (
                          <span className="flex items-center gap-1.5 text-sm text-slate-400"><Phone size={14} /> {item.phone}</span>
                        ) : <span className="text-sm text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {item.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-500/10 text-brand-400">
                            <ShieldCheck size={12} /> Quản trị
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700/50 text-slate-400">Nhân viên</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          item.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {item.status === "active" ? "Hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-slate-500">{formatDate(item.created_at)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleStatus(item)}
                            className={`p-2 rounded-lg transition-colors ${
                              item.status === "active" ? "text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" : "text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                            }`}
                            title={item.status === "active" ? "Khóa" : "Mở khóa"}>
                            {item.status === "active" ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                          </button>
                          <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-slate-500 hover:bg-amber-500/10 hover:text-amber-400 transition-colors">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDelete(item)} disabled={item.id === profile?.id}
                            className="p-2 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Sửa nhân viên" : "Thêm nhân viên"}>
        <div className="space-y-4">
          <Field label="Tên đăng nhập" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} disabled={!!editing} placeholder="nhanvien01" />
          {!editing && (
            <Field label="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
          )}
          <Field label="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nguyễn Văn A" />
          <Field label="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx xxx xxx" />
          <Select label="Vai trò" value={form.role} onChange={(v) => setForm({ ...form, role: v })}
            options={[{ value: "staff", label: "Nhân viên" }, { value: "admin", label: "Quản trị viên" }]} />
          {editing && (
            <Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })}
              options={[{ value: "active", label: "Hoạt động" }, { value: "disabled", label: "Đã khóa" }]} />
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2.5 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />} Lưu
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
