import { useState, useRef, useEffect, type InputHTMLAttributes, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

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
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ label, value, onChange, options, placeholder, className, disabled }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder || "Chọn...";

  return (
    <div className={`space-y-1.5 ${className || ""}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-800/60 hover:bg-slate-800 text-left outline-none transition-all flex items-center justify-between text-sm ${
            isOpen ? "border-brand-500 ring-2 ring-brand-500/30" : "border-slate-700/60"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className={`truncate ${selectedOption ? "text-slate-100 font-medium" : "text-slate-400"}`}>
            {displayText}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-brand-400" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl max-h-60 overflow-y-auto p-1.5 animate-fade-in space-y-0.5">
            {placeholder && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  value === ""
                    ? "bg-brand-500/15 text-brand-400 font-medium"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <span className="truncate">{placeholder}</span>
                {value === "" && <Check className="w-4 h-4 text-brand-400 shrink-0" />}
              </button>
            )}
            {options.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    isSelected
                      ? "bg-brand-500/15 text-brand-400 font-medium"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-brand-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

