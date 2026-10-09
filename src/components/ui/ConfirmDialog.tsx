import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';

export interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  isOpen,
  title,
  description,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'default',
  isDestructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isShown = isOpen ?? open ?? false;
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  if (!isShown) return null;

  const desc = description ?? message ?? '';
  const cLabel = confirmText ?? confirmLabel ?? 'Confirm';
  const canLabel = cancelText ?? cancelLabel ?? 'Cancel';
  const isDanger = isDestructive || variant === 'danger';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onCancel} />
      <div className={cn(
        'relative w-full max-w-md rounded-xl border p-6 shadow-2xl',
        isDark ? 'bg-dark-panel border-dark-border text-dark-text' : 'bg-light-card border-light-border text-light-text'
      )}>
        <h3 className="text-lg font-semibold">{title}</h3>
        {desc && (
          <p className={cn('mt-2 text-sm', isDark ? 'text-dark-secondary' : 'text-light-secondary')}>
            {desc}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors',
              isDark ? 'hover:bg-white/5 text-dark-secondary' : 'hover:bg-black/5 text-light-secondary'
            )}
          >
            {canLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors',
              isDanger
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : isDark
                  ? 'bg-dark-accent text-dark-bg hover:bg-dark-accent/90'
                  : 'bg-light-accent text-white hover:bg-light-accent/90'
            )}
          >
            {cLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
