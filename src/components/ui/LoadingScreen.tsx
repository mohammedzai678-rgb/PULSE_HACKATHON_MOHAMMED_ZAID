import { Loader2 } from 'lucide-react';
import { useThemeStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function LoadingScreen() {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className={cn(
          'animate-spin',
          theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'
        )} />
        <p className={cn('text-sm', theme === 'dark' ? 'text-dark-secondary' : 'text-light-secondary')}>
          Loading...
        </p>
      </div>
    </div>
  );
}
