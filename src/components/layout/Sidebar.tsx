import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  FileText,
  Settings,
  MessageSquare,
  Mail,
  Smartphone,
  ScrollText,
  FileImage,
  Files,
  FolderOpen,
  Send,
  Sun,
  Moon,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, useSettingsStore } from '@/lib/store';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Import' },
  { to: '/analysis', icon: BarChart3, label: 'Analysis' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const sourceNav = [
  { to: '/upload/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
  { to: '/upload/telegram', icon: Send, label: 'Telegram' },
  { to: '/upload/gmail', icon: Mail, label: 'Gmail' },
  { to: '/upload/sms', icon: Smartphone, label: 'SMS' },
  { to: '/upload/circulars', icon: ScrollText, label: 'Circulars' },
  { to: '/upload/documents', icon: Files, label: 'Documents' },
  { to: '/upload/images', icon: FileImage, label: 'Images' },
  { to: '/upload/other', icon: FolderOpen, label: 'Other' },
];

export function Sidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const isOnline = useSettingsStore((s) => s.isOnline);
  const showSources = location.pathname.startsWith('/upload');

  return (
    <aside className={cn(
      'hidden md:flex flex-col w-60 border-r shrink-0',
      theme === 'dark' ? 'bg-dark-panel border-dark-border' : 'bg-light-card border-light-border'
    )}>
      {/* Logo */}
      <div className="p-4 border-b">
        <NavLink to="/" className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg',
            theme === 'dark' ? 'bg-dark-accent/20 text-dark-accent' : 'bg-light-accent/20 text-light-accent'
          )}>
            ?
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">What Did I Miss?</h1>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-dark-secondary' : 'text-light-secondary')}>
              Every message matters
            </p>
          </div>
        </NavLink>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <p className={cn('px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider',
          theme === 'dark' ? 'text-dark-secondary' : 'text-light-secondary')}>
          Navigation
        </p>
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? theme === 'dark'
                  ? 'bg-dark-accent/10 text-dark-accent'
                  : 'bg-light-accent/10 text-light-accent'
                : theme === 'dark'
                  ? 'text-dark-secondary hover:text-dark-text hover:bg-white/5'
                  : 'text-light-secondary hover:text-light-text hover:bg-black/5'
            )}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}

        {/* Source shortcuts */}
        {showSources && (
          <>
            <p className={cn('px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider',
              theme === 'dark' ? 'text-dark-secondary' : 'text-light-secondary')}>
              Import Sources
            </p>
            {sourceNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? theme === 'dark'
                      ? 'bg-dark-accent/10 text-dark-accent'
                      : 'bg-light-accent/10 text-light-accent'
                    : theme === 'dark'
                      ? 'text-dark-secondary hover:text-dark-text hover:bg-white/5'
                      : 'text-light-secondary hover:text-light-text hover:bg-black/5'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom bar */}
      <div className={cn('p-3 border-t space-y-2', theme === 'dark' ? 'border-dark-border' : 'border-light-border')}>
        {/* Status indicators */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi size={14} className="text-emerald-400" />
            ) : (
              <WifiOff size={14} className="text-amber-400" />
            )}
            <span className={cn('text-xs', theme === 'dark' ? 'text-dark-secondary' : 'text-light-secondary')}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={14} className={theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'} />
            <span className={cn('text-xs', theme === 'dark' ? 'text-dark-secondary' : 'text-light-secondary')}>
              Local
            </span>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
            theme === 'dark'
              ? 'text-dark-secondary hover:text-dark-text hover:bg-white/5'
              : 'text-light-secondary hover:text-light-text hover:bg-black/5'
          )}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  );
}
