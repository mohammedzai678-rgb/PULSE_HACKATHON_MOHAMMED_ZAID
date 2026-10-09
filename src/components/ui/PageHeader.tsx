import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  icon?: any;
}

export function PageHeader({ title, description, backTo, actions, badge, icon: Icon }: PageHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  return (
    <div className="mb-6 md:mb-8">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className={cn(
            'flex items-center gap-1.5 text-sm mb-3 transition-colors cursor-pointer',
            isDark ? 'text-dark-secondary hover:text-dark-text' : 'text-light-secondary hover:text-light-text'
          )}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {Icon && (
              typeof Icon === 'function' || typeof Icon === 'object' && '$$typeof' in Icon
                ? <Icon className={cn('w-7 h-7', isDark ? 'text-dark-accent' : 'text-light-accent')} />
                : Icon
            )}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className={cn('mt-2 text-sm md:text-base max-w-2xl', isDark ? 'text-dark-secondary' : 'text-light-secondary')}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
