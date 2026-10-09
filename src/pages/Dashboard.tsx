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

  const handleTryDemo = () => {
    clearAll();
    addBatch({
      sourceType: 'whatsapp',
      label: 'Demo WhatsApp Group',
      status: 'ready',
      messages: [
        {
          id: crypto.randomUUID(),
          sourceType: 'whatsapp',
          sourceFilename: 'Demo WhatsApp Group',
          sourceIdentifier: 'demo-1',
          sender: 'Prof. Kumar',
          originalText: 'Reminder - Submit your AI project report by October 12, 2026 before 5:00 PM. Late submissions will not be accepted.',
          timestamp: new Date('2026-10-08T09:15:00'),
          messageIndex: 1,
        },
        {
          id: crypto.randomUUID(),
          sourceType: 'whatsapp',
          sourceFilename: 'Demo WhatsApp Group',
          sourceIdentifier: 'demo-2',
          sender: 'Rahul',
          originalText: 'Hey everyone, the department meeting has been moved to October 11 at 3 PM in Room 204. Attendance is mandatory.',
          timestamp: new Date('2026-10-08T10:30:00'),
          messageIndex: 2,
        },
        {
          id: crypto.randomUUID(),
          sourceType: 'whatsapp',
          sourceFilename: 'Demo WhatsApp Group',
          sourceIdentifier: 'demo-3',
          sender: "Dean's Office",
          originalText: 'IMPORTANT - All students must complete fee payment by October 15, 2026. Failure to pay will result in examination hall ticket being withheld.',
          timestamp: new Date('2026-10-09T08:00:00'),
          messageIndex: 3,
        },
        {
          id: crypto.randomUUID(),
          sourceType: 'whatsapp',
          sourceFilename: 'Demo WhatsApp Group',
          sourceIdentifier: 'demo-4',
          sender: 'Priya',
          originalText: "Can someone share the notes from yesterday's Data Structures lecture? I missed the class.",
          timestamp: new Date('2026-10-09T11:45:00'),
          messageIndex: 4,
        },
        {
          id: crypto.randomUUID(),
          sourceType: 'whatsapp',
          sourceFilename: 'Demo WhatsApp Group',
          sourceIdentifier: 'demo-5',
          sender: 'Placement Cell',
          originalText: 'TCS recruitment drive on October 20, 2026. Eligible students must register on the portal by October 14. Bring 2 passport photos and updated resume.',
          timestamp: new Date('2026-10-07T14:00:00'),
          messageIndex: 5,
        },
      ],
    });
    navigate('/analysis');
  };

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
            Every message matters. Know what matters most. Upload your chats, emails, and notices to instantly extract
            deadlines, pending tasks, and critical warnings completely on-device.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" onClick={() => navigate('/upload')} icon={<ArrowRight className="w-5 h-5" />}>
              Analyze Now
            </Button>
            <Button size="lg" variant="secondary" onClick={handleTryDemo} icon={<Zap className="w-5 h-5 text-yellow-500" />}>
              Try Demo
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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Quick Import</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/upload')}>
            View All Sources <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'WhatsApp', icon: MessageSquare, route: '/upload/whatsapp', color: 'text-green-500', bg: 'bg-green-500/10', desc: 'Chats & groups' },
            { label: 'Gmail', icon: Mail, route: '/upload/gmail', color: 'text-red-500', bg: 'bg-red-500/10', desc: 'Important emails' },
            { label: 'Circulars', icon: ScrollText, route: '/upload/circulars', color: 'text-amber-500', bg: 'bg-amber-500/10', desc: 'Notices & bulletins' },
            { label: 'Images / OCR', icon: FileImage, route: '/upload/images', color: 'text-blue-500', bg: 'bg-blue-500/10', desc: 'Screenshots' },
          ].map((src) => (
            <Card
              key={src.label}
              className="p-4 cursor-pointer hover:border-accent transition-colors flex flex-col items-center text-center group"
              onClick={() => navigate(src.route)}
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
