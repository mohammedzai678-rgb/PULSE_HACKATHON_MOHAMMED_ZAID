import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Upload, BarChart3, FileText, Settings, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Import' },
  { to: '/analysis', icon: BarChart3, label: 'Analysis' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className={cn(
      'md:hidden flex items-center justify-between px-4 py-3 border-b',
      theme === 'dark' ? 'bg-dark-panel border-dark-border' : 'bg-light-card border-light-border'
    )}>
      <NavLink to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm',
          theme === 'dark' ? 'bg-dark-accent/20 text-dark-accent' : 'bg-light-accent/20 text-light-accent'
        )}>
          ?
        </div>
        <span className="text-sm font-semibold">WDIM</span>
      </NavLink>

      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-white/5" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg hover:bg-white/5" aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {open && (
        <div
          className={cn(
            'fixed inset-0 top-14 z-50 p-4',
            theme === 'dark' ? 'bg-dark-bg/95' : 'bg-light-bg/95'
          )}
        >
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-base transition-colors',
                  isActive
                    ? theme === 'dark'
                      ? 'bg-dark-accent/10 text-dark-accent'
                      : 'bg-light-accent/10 text-light-accent'
                    : theme === 'dark'
                      ? 'text-dark-secondary hover:text-dark-text'
                      : 'text-light-secondary hover:text-light-text'
                )}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
