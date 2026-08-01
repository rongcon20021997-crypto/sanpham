import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setShow(true);
      document.body.style.overflow = "hidden";
    } else {
      setShow(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open && !show) return null;

  const sizeClass = {
    sm: "max-w-lg",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-5xl",
    "2xl": "max-w-6xl",
  }[size || "md"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div
        className={`relative w-full ${sizeClass} max-w-full my-0 sm:my-auto bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-700/60 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden transition-all duration-200 ${
          show ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 sm:translate-y-0 scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-700/60 shrink-0 bg-slate-900/90">
          <h3 className="text-base sm:text-lg font-semibold text-slate-100 truncate pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors shrink-0"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
