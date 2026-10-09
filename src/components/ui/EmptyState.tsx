import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: any;
  title: string;
  description: string;
  action?: ReactNode | { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mb-4',
        isDark ? 'bg-dark-border/50 text-dark-secondary' : 'bg-light-border/50 text-light-secondary'
      )}>
        {Icon ? (
          typeof Icon === 'function' || (typeof Icon === 'object' && '$$typeof' in Icon) ? (
            <Icon className="w-8 h-8" />
          ) : (
            Icon
          )
        ) : (
          <Inbox size={28} />
        )}
      </div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className={cn('mt-2 text-sm max-w-sm', isDark ? 'text-dark-secondary' : 'text-light-secondary')}>
        {description}
      </p>
      {action && (
        <div className="mt-6">
          {typeof action === 'object' && 'label' in action && 'onClick' in action ? (
            <Button onClick={action.onClick}>{action.label}</Button>
          ) : (
            action as ReactNode
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
