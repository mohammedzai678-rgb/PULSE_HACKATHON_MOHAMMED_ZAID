import React, { useState, useEffect, useRef } from 'react';
import { useSettingsStore, useToastStore, useThemeStore } from '@/lib/store';
import { Card, PageHeader, Button } from '@/components/ui';
import {
  Settings,
  Shield,
  Moon,
  Sun,
  Save,
  ShieldCheck,
  Wifi,
  WifiOff,
  HardDrive,
  Cpu,
  Mail,
  User,
  Download,
  Upload,
  Trash2,
  Database,
  Layers,
  RefreshCw,
} from 'lucide-react';
import type { AppSettings } from '@/types';
import { cn } from '@/lib/utils';
import {
  getStorageUsageEstimate,
  exportDatabaseBackup,
  importDatabaseBackup,
  deleteAllReports,
  getReportCount,
} from '@/lib/db';
import { downloadFile } from '@/lib/export';

export default function SettingsPage() {
  const { settings, updateSettings, isOnline, ocrReady } = useSettingsStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { addToast } = useToastStore();

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [userNamesInput, setUserNamesInput] = useState((settings.userNames || []).join(', '));
  const [storageStats, setStorageStats] = useState<{ usageMB: number; quotaMB: number; percentage: number }>({
    usageMB: 0,
    quotaMB: 0,
    percentage: 0,
  });
  const [reportCount, setReportCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStorageInfo = async () => {
    try {
      const stats = await getStorageUsageEstimate();
      setStorageStats(stats);
      const count = await getReportCount();
      setReportCount(count);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadStorageInfo();
  }, []);

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

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const jsonBackup = await exportDatabaseBackup();
      const filename = `wdim-backup-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(jsonBackup, filename, 'application/json');
      addToast('Backup exported successfully', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to export backup', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const res = await importDatabaseBackup(text);
      await loadStorageInfo();
      addToast(`Restored ${res.restoredReports} reports successfully!`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Invalid backup file structure', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm('Are you sure you want to delete all stored reports from your browser? This cannot be undone.')) {
      try {
        await deleteAllReports();
        await loadStorageInfo();
        addToast('All local reports cleared', 'info');
      } catch {
        addToast('Failed to clear database', 'error');
      }
    }
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

          {/* Local Storage, Backup & Audit Card */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Database className="w-5 h-5 text-accent" /> Local Storage & Data Management
              </h2>
              <button
                onClick={loadStorageInfo}
                title="Refresh Storage Status"
                className="p-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border/60 bg-surface/30 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-accent" /> IndexedDB Quota Usage
                  </span>
                  <span className="text-xs text-secondary font-mono">
                    {storageStats.usageMB} MB {storageStats.quotaMB > 0 ? `/ ${storageStats.quotaMB} MB` : 'used'}
                  </span>
                </div>
                <div className="w-full bg-secondary/20 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-300"
                    style={{ width: `${Math.max(2, Math.min(100, storageStats.percentage || 2))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-secondary">
                  <span>{reportCount} Stored Intelligence Report(s)</span>
                  <span>100% On-Device Sandbox</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border/80 hover:border-accent hover:bg-accent/5 text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-accent" />
                  {isExporting ? 'Exporting...' : 'Export Backup (.json)'}
                </button>

                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border/80 hover:border-accent hover:bg-accent/5 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-accent" />
                    {isImporting ? 'Restoring...' : 'Restore Backup'}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-medium text-destructive">Wipe All Local Storage</h4>
                  <p className="text-xs text-secondary">Permanently delete all saved analysis reports from this browser.</p>
                </div>
                <button
                  onClick={handleClearAllData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Wipe Data
                </button>
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
                Processing is 100% on-device using local rule-based inference. Zero cloud calls.
              </li>
              <li className="flex gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                Reports are saved to local IndexedDB. No external tracking or database.
              </li>
              <li className="flex gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                Raw uploaded documents and auth tokens are kept strictly in ephemeral memory.
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
                <span className="text-xs text-secondary">Compute Engine</span>
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Web Worker (Threaded)
                </span>
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
