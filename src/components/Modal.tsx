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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div
        className={`absolute inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity duration-200 ${
          show ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeClass} my-auto bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 transition-all duration-200 ${
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
