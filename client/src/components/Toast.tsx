import { useClipStore } from '../store/useClipStore';
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  error:
    'border-[rgba(251,113,133,0.28)] bg-[linear-gradient(180deg,rgba(54,18,28,0.96),rgba(26,10,16,0.92))] text-[#ffe4e6]',
  warning:
    'border-[rgba(251,191,36,0.28)] bg-[linear-gradient(180deg,rgba(53,38,14,0.96),rgba(27,19,9,0.92))] text-[#fde9b2]',
  info:
    'border-[rgba(125,211,252,0.28)] bg-[linear-gradient(180deg,rgba(17,39,66,0.96),rgba(10,21,36,0.92))] text-[#d9f3ff]',
};

export function ToastContainer() {
  const toasts = useClipStore((s) => s.toasts);
  const dismissToast = useClipStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`animate-slide-up flex items-start gap-3 rounded-[22px] border px-4 py-3 shadow-[0_26px_60px_-36px_rgba(2,8,23,0.95)] backdrop-blur-xl ${colorMap[toast.type]}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{toast.text}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded-full p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
