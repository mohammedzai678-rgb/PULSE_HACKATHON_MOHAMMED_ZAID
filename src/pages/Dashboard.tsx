import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Database,
  Shield,
  Zap,
  MessageSquare,
  Mail,
  ScrollText,
  FileImage,
  Clock,
  Files,
} from 'lucide-react';
import { useThemeStore, useImportStore } from '@/lib/store';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { StoredReport } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getAllReports } from '@/lib/db';

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const clearAll = useImportStore((state) => state.clearAll);
  const addBatch = useImportStore((state) => state.addBatch);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const isDark = theme === 'dark';

  useEffect(() => {
    getAllReports()
      .then((data) => setReports(data))
      .catch((error) => {
        console.error('Failed to load reports:', error);
      });
  }, []);

  const criticalFindings = reports.reduce(
    (total, report) =>
      total +
      (report.findings || []).filter((finding) => finding.severity === 'S3' || finding.severity === 'S4').length,
    0
  );
  const actionItems = reports.reduce(
    (total, report) =>
      total + (report.actionItems || []).filter((action) => action.status === 'pending').length,
    0
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <section
        className={cn(
          'rounded-2xl p-8 relative overflow-hidden transition-all',
          isDark ? 'bg-dark-panel border border-dark-border' : 'bg-light-card shadow-sm border border-light-border'
        )}
      >
        <div className="max-w-3xl relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium text-secondary">All processing local. 100% Privacy first.</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">What did you miss?</h1>
          <p className="text-lg text-secondary mb-8">
            Every message matters. Know what matters most. Upload images, documents, and plain text to instantly extract
            deadlines, pending tasks, and critical warnings completely on-device.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" onClick={() => navigate('/analysis')} icon={<ArrowRight className="w-5 h-5" />}>
              Open Analysis Studio
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-secondary font-medium">Saved Reports</p>
            <p className="text-2xl font-bold">{reports.length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-secondary font-medium">Critical Alerts</p>
            <p className="text-2xl font-bold">{criticalFindings}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-secondary font-medium">Pending Tasks</p>
            <p className="text-2xl font-bold">{actionItems}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-purple-500/10 text-purple-500">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-secondary font-medium">Engine Mode</p>
            <p className="text-lg font-bold">100% Offline</p>
          </div>
        </Card>
      </section>

      {/* Quick Import Sources */}
      {/* Quick Analysis Formats */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Start Analysis</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/analysis')}>
            Open Studio <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Images & OCR', icon: FileImage, color: 'text-purple-500', bg: 'bg-purple-500/10', desc: 'Photos, screenshots & notices' },
            { label: 'Documents & PDF', icon: ScrollText, color: 'text-blue-500', bg: 'bg-blue-500/10', desc: 'PDF, Word (.docx) & PPT' },
            { label: 'Plain Text & Notes', icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10', desc: 'Direct paste & typed notes' },
            { label: 'Other Formats', icon: Files, color: 'text-amber-500', bg: 'bg-amber-500/10', desc: 'Any unsure image or text' },
          ].map((src) => (
            <Card
              key={src.label}
              className="p-4 cursor-pointer hover:border-accent transition-colors flex flex-col items-center text-center group"
              onClick={() => navigate('/analysis')}
            >
              <div className={cn('p-3 rounded-xl mb-3', src.bg, src.color)}>
                <src.icon className="w-6 h-6" />
              </div>
              <h3 className="font-medium group-hover:text-accent transition-colors">{src.label}</h3>
              <p className="text-xs text-secondary mt-1">{src.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent Reports */}
      {reports.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Reports</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
              View History <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {reports.slice(0, 3).map((r) => (
              <Card
                key={r.id}
                className="p-4 cursor-pointer hover:border-accent/60 transition-colors flex items-center justify-between"
                onClick={() => navigate(`/reports/${r.id}`)}
              >
                <div>
                  <h3 className="font-semibold text-base">{r.title || 'Analysis Report'}</h3>
                  <div className="flex items-center gap-3 text-xs text-secondary mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelativeTime(r.generatedAt)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Files className="w-3.5 h-3.5" />
                      {r.totalMessagesProcessed} messages
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-center px-3 py-1 rounded-md bg-red-500/10 text-red-400 font-bold text-sm">
                    {r.findings.filter((f) => f.severity === 'S4' || f.severity === 'S3').length}
                    <span className="block text-[10px] font-normal uppercase text-secondary">Alerts</span>
                  </div>
                  <div className="text-center px-3 py-1 rounded-md bg-accent/10 text-accent font-bold text-sm">
                    {r.actionItems.length}
                    <span className="block text-[10px] font-normal uppercase text-secondary">Tasks</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
