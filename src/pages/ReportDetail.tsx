import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReport, renameReport, deleteReport, saveReport } from '@/lib/db';
import type { Report, StoredReport, ActionItemStatus } from '@/types';
import { useToastStore, useThemeStore } from '@/lib/store';
import { Button, Card, SeverityBadge, ConfirmDialog } from '@/components/ui';
import {
  ArrowLeft,
  Download,
  Trash2,
  Edit2,
  Check,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
} from 'lucide-react';
import { formatDateTime, formatDate, cn } from '@/lib/utils';
import { exportReportToPdf, exportReportToMarkdown, exportReportToJson, downloadFile } from '@/lib/export';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { addToast } = useToastStore();

  const [report, setReport] = useState<StoredReport | Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getReport(id);
        if (data) {
          setReport(data);
          setEditTitle(data.title);
        } else {
          addToast('Report not found', 'error');
          navigate('/reports');
        }
      } catch (e) {
        addToast('Error loading report', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id, navigate, addToast]);

  const handleTitleSave = async () => {
    if (!report || !id) return;
    try {
      await renameReport(id, editTitle);
      setReport({ ...report, title: editTitle });
      setIsEditingTitle(false);
      addToast('Title updated', 'success');
    } catch (e) {
      addToast('Failed to update title', 'error');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteReport(id);
      addToast('Report deleted', 'success');
      navigate('/reports');
    } catch (e) {
      addToast('Failed to delete report', 'error');
    }
  };

  const handleExportPdf = async () => {
    if (!report) return;
    try {
      await exportReportToPdf(report);
      addToast('PDF exported', 'success');
    } catch {
      addToast('Failed to export PDF', 'error');
    }
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const md = exportReportToMarkdown(report);
    downloadFile(md, `${report.title || 'report'}.md`, 'text/markdown');
    addToast('Markdown exported', 'success');
  };

  const handleExportJson = () => {
    if (!report) return;
    const jsonStr = exportReportToJson(report);
    downloadFile(jsonStr, `${report.title || 'report'}.json`, 'application/json');
    addToast('JSON exported', 'success');
  };

  const toggleActionItem = async (itemId: string) => {
    if (!report) return;
    const updatedActions = report.actionItems.map((item) => {
      if (item.id === itemId) {
        const nextStatus: ActionItemStatus = item.status === 'completed' ? 'pending' : 'completed';
        return {
          ...item,
          status: nextStatus,
          completedAt: nextStatus === 'completed' ? new Date() : undefined,
        };
      }
      return item;
    });

    const updatedReport: StoredReport = {
      ...report,
      actionItems: updatedActions,
      updatedAt: new Date(),
    };
    setReport(updatedReport);
    try {
      await saveReport(updatedReport);
    } catch (e) {
      console.error('Failed to auto-save action state', e);
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-secondary text-sm">Loading report...</div>;
  }
  if (!report) return null;

  const summary = report.executiveSummary || (report as any).summary || 'No summary text available.';
  const sourceCount = report.sources ? report.sources.length : (report as any).sourceCount || 1;
  const criticalCount = report.findings.filter((f) => f.severity === 'S4' || f.severity === 'S3').length;

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-8 pb-16">
      <Button
        variant="ghost"
        onClick={() => navigate('/reports')}
        className="text-secondary hover:text-current"
        icon={<ArrowLeft className="w-4 h-4" />}
      >
        Back to Reports
      </Button>

      {/* Title & Top Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={cn(
                  "flex-1 px-3 py-1 text-2xl font-bold rounded border focus:outline-none focus:ring-1 focus:ring-accent",
                  isDark ? "bg-dark-panel border-dark-border text-dark-text" : "bg-light-card border-light-border text-light-text"
                )}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              />
              <Button size="sm" onClick={handleTitleSave} icon={<Check className="w-4 h-4" />}>
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-current tracking-tight">{report.title}</h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-secondary hover:text-current transition-colors p-1"
                title="Edit title"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-secondary text-sm mt-1">
            Generated {formatDateTime(report.generatedAt || (report as any).timestamp)} • {sourceCount} source{sourceCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} icon={<Download className="w-4 h-4" />}>
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMarkdown} icon={<Download className="w-4 h-4" />}>
            Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson} icon={<Download className="w-4 h-4" />}>
            JSON
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} icon={<Trash2 className="w-4 h-4" />}>
            Delete
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-accent">
          <p className="text-xs text-secondary font-medium">Total Findings</p>
          <p className="text-2xl font-bold text-current mt-1">{report.findings.length}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-xs text-secondary font-medium">High / Critical</p>
          <p className="text-2xl font-bold text-current mt-1">{criticalCount}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs text-secondary font-medium">Action Items</p>
          <p className="text-2xl font-bold text-current mt-1">{report.actionItems.length}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="text-xs text-secondary font-medium">Timeline Events</p>
          <p className="text-2xl font-bold text-current mt-1">{report.timeline.length}</p>
        </Card>
      </div>

      {/* Executive Summary */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="text-accent w-5 h-5" /> Executive Summary
        </h2>
        <Card className="p-6">
          <p className="text-current/90 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
            {summary}
          </p>
        </Card>
      </section>

      {/* Detailed Findings */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="text-yellow-500 w-5 h-5" /> Detailed Findings ({report.findings.length})
        </h2>
        <div className="space-y-3">
          {report.findings.map((finding) => (
            <Card key={finding.id} className="p-5 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <SeverityBadge severity={finding.severity} needsReview={finding.needsReview} />
                <h3 className="font-semibold text-lg text-current">{finding.title}</h3>
              </div>
              <p className="text-secondary text-sm leading-relaxed">{finding.description}</p>
              {finding.deadline && (
                <div className="text-xs text-red-400 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Due date: {formatDate(finding.deadline)}
                </div>
              )}
              {finding.whyItMatters && (
                <div className={cn("p-3 rounded-lg text-xs leading-relaxed", isDark ? "bg-black/20 text-current/80" : "bg-black/5 text-current/80")}>
                  <span className="font-semibold block mb-0.5">Impact Analysis:</span>
                  {finding.whyItMatters}
                </div>
              )}
            </Card>
          ))}
          {report.findings.length === 0 && (
            <p className="text-secondary text-sm py-4">No findings recorded in this report.</p>
          )}
        </div>
      </section>

      {/* Checklist and Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="text-emerald-500 w-5 h-5" /> Action Checklist
          </h2>
          <Card className="p-5 space-y-3">
            {report.actionItems.map((item) => {
              const isDone = item.status === 'completed';
              return (
                <div
                  key={item.id}
                  onClick={() => toggleActionItem(item.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border text-sm cursor-pointer select-none transition-all",
                    isDone
                      ? "opacity-60 line-through bg-black/10 border-transparent"
                      : isDark ? "bg-dark-panel/40 border-dark-border hover:border-accent/40" : "bg-light-card border-light-border hover:border-accent/40"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-colors",
                      isDone ? "bg-accent border-accent text-white" : "border-secondary"
                    )}
                  >
                    {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-current">{item.taskDescription || (item as any).task}</p>
                    {item.deadline && (
                      <p className="text-xs text-red-400 mt-0.5">
                        Due: {formatDate(item.deadline)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {report.actionItems.length === 0 && (
              <p className="text-secondary text-sm py-4">No action items.</p>
            )}
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-blue-500 w-5 h-5" /> Timeline
          </h2>
          <Card className="p-5 space-y-4">
            {report.timeline.map((event) => (
              <div key={event.id} className="flex gap-4 border-l-2 border-accent/40 pl-4 relative">
                <div className="absolute w-2.5 h-2.5 rounded-full bg-accent -left-[6px] top-1.5" />
                <div>
                  <div className="font-semibold text-sm text-current">
                    {formatDate(event.date)} {event.time ? `at ${event.time}` : ''}
                  </div>
                  <div className="text-xs text-secondary mt-0.5">{event.description || (event as any).event}</div>
                </div>
              </div>
            ))}
            {report.timeline.length === 0 && (
              <p className="text-secondary text-sm py-4">No timeline events.</p>
            )}
          </Card>
        </section>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Report"
        description="Are you sure you want to delete this report? This will remove it from local IndexedDB storage."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
