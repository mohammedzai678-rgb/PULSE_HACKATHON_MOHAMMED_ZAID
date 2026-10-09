import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader, EmptyState, ConfirmDialog, SeverityBadge } from '@/components/ui';
import { BookOpen, Search, Trash2, Calendar, FileText } from 'lucide-react';
import { getAllReports, deleteReport, deleteAllReports } from '@/lib/db';
import type { StoredReport } from '@/types';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useToastStore, useThemeStore } from '@/lib/store';

export default function ReportsPage() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { addToast } = useToastStore();
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const data = await getAllReports();
      setReports(
        data.sort(
          (a, b) =>
            new Date(b.generatedAt || (b as any).timestamp).getTime() -
            new Date(a.generatedAt || (a as any).timestamp).getTime()
        )
      );
    } catch (e) {
      addToast('Failed to load reports', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async () => {
    if (!reportToDelete) return;
    try {
      await deleteReport(reportToDelete);
      addToast('Report deleted', 'success');
      setReportToDelete(null);
      fetchReports();
    } catch (e) {
      addToast('Failed to delete report', 'error');
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllReports();
      addToast('All reports deleted', 'success');
      setShowDeleteAllConfirm(false);
      fetchReports();
    } catch (e) {
      addToast('Failed to delete reports', 'error');
    }
  };

  const filteredReports = reports.filter((r) => {
    const summaryText = r.executiveSummary || (r as any).summary || '';
    return (
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      summaryText.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Saved Reports" icon={BookOpen} />

        {reports.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => setShowDeleteAllConfirm(true)} icon={<Trash2 className="w-4 h-4" />}>
            Delete All
          </Button>
        )}
      </div>

      {reports.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search reports by title or summary content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-accent",
              isDark ? "bg-dark-panel border-dark-border text-dark-text" : "bg-light-card border-light-border text-light-text"
            )}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-secondary text-sm">Loading reports...</div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Reports Saved"
          description="You have not saved any analysis reports yet. Go to Upload to start analyzing data."
          action={{ label: 'Go to Upload', onClick: () => navigate('/upload') }}
        />
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-20 text-secondary text-sm">No reports matched your search query.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReports.map((report) => {
            const criticalCount = report.findings.filter((f) => f.severity === 'S4').length;
            const highCount = report.findings.filter((f) => f.severity === 'S3').length;
            const summary = report.executiveSummary || (report as any).summary || 'No summary text available.';
            const sourceCount = report.sources ? report.sources.length : (report as any).sourceCount || 1;

            return (
              <Card
                key={report.id}
                className="flex flex-col h-full hover:border-accent/60 transition-all cursor-pointer group p-0 overflow-hidden"
                onClick={() => navigate(`/reports/${report.id}`)}
              >
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-current mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                    {report.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-secondary mb-3">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatRelativeTime(report.generatedAt || (report as any).timestamp)}</span>
                    <span>•</span>
                    <FileText className="w-3.5 h-3.5" />
                    <span>{sourceCount} source{sourceCount === 1 ? '' : 's'}</span>
                  </div>

                  <p className="text-sm text-secondary line-clamp-3 mb-4 leading-relaxed">
                    {summary}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                    {criticalCount > 0 && <SeverityBadge severity="S4" size="sm" />}
                    {highCount > 0 && <SeverityBadge severity="S3" size="sm" />}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-border/50 flex justify-between items-center bg-black/5 text-xs text-secondary">
                  <span>
                    {report.findings.length} findings • {report.actionItems.length} actions
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportToDelete(report.id);
                    }}
                    className="p-1 rounded text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete report"
                    aria-label={`Delete report ${report.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-secondary">
        Reports are stored locally in your browser (IndexedDB). They are private to your device.
      </p>

      {/* Delete Single Confirm */}
      <ConfirmDialog
        open={!!reportToDelete}
        title="Delete Report"
        description="Are you sure you want to delete this report? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setReportToDelete(null)}
      />

      {/* Delete All Confirm */}
      <ConfirmDialog
        open={showDeleteAllConfirm}
        title="Delete All Reports"
        description="Are you sure you want to delete ALL saved reports? This will permanently erase your report history from this browser."
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />
    </div>
  );
}
