import React, { useState, useEffect } from 'react';
import { useSettingsStore, useToastStore, useThemeStore } from '@/lib/store';
import { Card, PageHeader, Button } from '@/components/ui';
import { Settings, Shield, Moon, Sun, Save, ShieldCheck, Wifi, WifiOff, HardDrive, Cpu, Mail, User } from 'lucide-react';
import type { AppSettings } from '@/types';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { settings, updateSettings, isOnline, ocrReady } = useSettingsStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { addToast } = useToastStore();

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [userNamesInput, setUserNamesInput] = useState((settings.userNames || []).join(', '));

  useEffect(() => {
    setLocalSettings(settings);
    setUserNamesInput((settings.userNames || []).join(', '));
  }, [settings]);

  const handleSave = async () => {
    const parsedNames = userNamesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await updateSettings({
      ...localSettings,
      userNames: parsedNames,
    });
    addToast('Settings saved successfully', 'success');
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <PageHeader title="Settings" icon={Settings} />
        <Button onClick={handleSave} icon={<Save className="w-4 h-4" />}>
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Preferences */}
          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b border-border/50 pb-3">
              <Settings className="w-5 h-5 text-accent" /> Preferences
            </h2>

            <div className="space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Theme Mode</h3>
                  <p className="text-xs text-secondary">Switch between dark and light appearance</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={cn(
                    "p-2.5 rounded-xl border transition-colors cursor-pointer",
                    isDark ? "bg-dark-panel border-dark-border text-yellow-400 hover:bg-white/5" : "bg-light-card border-light-border text-blue-500 hover:bg-black/5"
                  )}
                  aria-label="Toggle theme"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>

              {/* Include Excerpts */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Include Original Excerpts</h3>
                  <p className="text-xs text-secondary">Store message quotes inside generated reports</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={localSettings.includeExcerptsInReports}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, includeExcerptsInReports: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-secondary/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>

              {/* Redact Sensitive */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Redact Sensitive PII / OTPs</h3>
                  <p className="text-xs text-secondary">Mask verification codes and financial card numbers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={localSettings.redactSensitiveContent}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, redactSensitiveContent: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-secondary/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>

              {/* Max File Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <h3 className="font-medium">Max Upload File Size</h3>
                  <span className="font-semibold text-accent">{localSettings.maxFileSizeMB} MB</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={localSettings.maxFileSizeMB}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, maxFileSizeMB: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-2 bg-secondary/20 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <p className="text-xs text-secondary">Files are processed in memory and never leave your browser.</p>
              </div>

              {/* User Names & Aliases */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <label className="block text-sm font-medium">Your Names & Aliases</label>
                <p className="text-xs text-secondary">
                  Comma-separated names (e.g. "Mohamed, Alex, @mohamed") to detect mentions and assign tasks to you.
                </p>
                <input
                  type="text"
                  placeholder="e.g. John, Johnny, @john_doe"
                  value={userNamesInput}
                  onChange={(e) => setUserNamesInput(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-accent",
                    isDark ? "bg-dark-panel border-dark-border" : "bg-light-card border-light-border"
                  )}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Status Info */}
        <div className="space-y-6">
          <Card className="p-6 space-y-4 border-emerald-500/30 bg-emerald-500/5">
            <h2 className="text-base font-semibold flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-5 h-5" /> Privacy First Architecture
            </h2>
            <ul className="space-y-3 text-xs text-secondary leading-relaxed">
              <li className="flex gap-2">
                <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                Processing is 100% on-device using local rule-based inference.
              </li>
              <li className="flex gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                Reports are saved to local IndexedDB. No external database is used.
              </li>
              <li className="flex gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                Raw uploaded files and auth tokens are kept strictly in memory.
              </li>
            </ul>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold">System Diagnostics</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">Network</span>
                <span className={cn("flex items-center gap-1 text-xs font-medium", isOnline ? "text-emerald-400" : "text-amber-400")}>
                  {isOnline ? <><Wifi className="w-3.5 h-3.5" /> Online</> : <><WifiOff className="w-3.5 h-3.5" /> Offline Ready</>}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">Storage</span>
                <span className="text-xs font-medium text-accent">IndexedDB (Active)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">OCR Engine</span>
                <span className="text-xs font-medium text-emerald-400">Tesseract.js (Ready)</span>
              </div>
            </div>
          </Card>

          <div className="text-center text-xs text-secondary space-y-1">
            <p className="font-semibold text-current">WHAT DID I MISS?</p>
            <p>Version 1.0.0 • Pulse Hackathon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
