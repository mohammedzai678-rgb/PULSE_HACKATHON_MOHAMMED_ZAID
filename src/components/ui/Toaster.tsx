import { useEffect } from 'react';
import { useToastStore, type Toast as ToastType } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const Icon = icons[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg', colors[toast.type])}
    >
      <Icon size={18} className="shrink-0" />
      <span className="text-sm flex-1">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="shrink-0 p-1 rounded hover:bg-white/10">
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const _setOnline = () => {};

  // Track online/offline
  useEffect(() => {
    const onOnline = () => useToastStore.getState().addToast({ message: 'Back online', type: 'success' });
    const onOffline = () => useToastStore.getState().addToast({ message: 'You are offline. Core features still work.', type: 'warning' });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
