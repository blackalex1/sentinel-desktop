import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-70 flex flex-col space-y-2 max-w-sm pointer-events-none select-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-[#0a1612]/95 border-emerald-500/40 text-emerald-200 shadow-[0_4px_20px_rgba(16,185,129,0.25)]',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
        };
      case 'error':
        return {
          bg: 'bg-[#180a10]/95 border-rose-500/40 text-rose-200 shadow-[0_4px_20px_rgba(244,63,94,0.25)]',
          icon: <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
        };
      case 'info':
      default:
        return {
          bg: 'bg-[#0f0e20]/95 border-purple-500/40 text-purple-200 shadow-[0_4px_20px_rgba(168,85,247,0.25)]',
          icon: <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />,
        };
    }
  };

  const style = getToastStyles();

  return (
    <div
      className={`pointer-events-auto flex items-start justify-between p-3.5 rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-slideInRight ${style.bg}`}
    >
      <div className="flex items-start space-x-3 pr-2">
        {style.icon}
        <div>
          <h4 className="text-xs font-bold font-sans tracking-wide">{toast.title}</h4>
          {toast.message && <p className="text-[11px] font-mono text-slate-300 mt-0.5">{toast.message}</p>}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
