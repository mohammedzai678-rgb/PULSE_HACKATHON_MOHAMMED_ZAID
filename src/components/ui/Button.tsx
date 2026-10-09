import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants = {
    primary: isDark
      ? 'bg-dark-accent text-dark-bg hover:bg-dark-accent/90 focus-visible:ring-dark-accent'
      : 'bg-light-accent text-white hover:bg-light-accent/90 focus-visible:ring-light-accent',
    secondary: isDark
      ? 'border border-dark-border bg-dark-panel text-dark-text hover:bg-white/5'
      : 'border border-light-border bg-light-card text-light-text hover:bg-black/5',
    outline: isDark
      ? 'border border-dark-border text-dark-text hover:bg-white/5'
      : 'border border-light-border text-light-text hover:bg-black/5',
    ghost: isDark
      ? 'text-dark-secondary hover:text-dark-text hover:bg-white/5'
      : 'text-light-secondary hover:text-light-text hover:bg-black/5',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export default Button;
