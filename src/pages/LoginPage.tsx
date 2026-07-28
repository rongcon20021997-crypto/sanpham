import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Shirt, User, Lock, Loader2, AlertCircle } from "lucide-react";

export function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatAuthError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
      return "Tên đăng nhập hoặc mật khẩu không chính xác.";
    }
    if (lower.includes("email not confirmed")) {
      return "Tài khoản chưa được kích hoạt.";
    }
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(username, password);
    } catch (err) {
      const msg = (err as Error).message;
      setError(formatAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mb-4 drop-shadow-xl" />
          <h1 className="text-2xl font-bold text-slate-100">Quản lý Áo Thun In</h1>
          <p className="text-sm text-slate-500 mt-1">Hệ thống quản trị nội bộ</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Tên đăng nhập</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  required
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  placeholder="Nhập tên đăng nhập"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-fade-in">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 text-white font-medium shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 hover:from-brand-600 hover:to-cyan-600 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Đăng nhập
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Tài khoản do quản trị viên cấp. Vui lòng liên hệ quản trị nếu chưa có tài khoản.
          </p>
        </div>
      </div>
    </div>
  );
}
