import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable }: CardProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isDark ? 'bg-dark-panel border-dark-border' : 'bg-light-card border-light-border shadow-sm',
        hoverable && (isDark ? 'hover:border-dark-accent/30 cursor-pointer' : 'hover:border-light-accent/30 cursor-pointer'),
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {children}
    </div>
  );
}

export default Card;
