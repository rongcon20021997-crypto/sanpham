import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  children?: ReactNode;
}

export function Field({ label, error, children, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {children || (
        <input
          {...props}
          className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-800/50 text-slate-100 placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 ${
            error ? "border-rose-500/50" : "border-slate-700/50"
          }`}
        />
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, value, onChange, options, placeholder }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-100 outline-none transition-all focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
