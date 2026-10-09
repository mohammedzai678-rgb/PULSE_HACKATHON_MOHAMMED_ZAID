import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImportStore, useAnalysisStore, useToastStore, useThemeStore, buildReport } from '@/lib/store';
import { Button, Card, SeverityBadge, DropZone } from '@/components/ui';
import {
  Brain,
  FileText,
  Download,
  Save,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  FileCheck,
  Check,
  FileImage,
  Upload,
  Trash2,
  Zap,
  RotateCcw,
  Plus,
  Loader2,
  FileArchive,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeMessages } from '@/lib/analysis/engine';
import { parseFile, performOCR, parseWhatsAppChat } from '@/lib/parsers';
import { exportReportToPdf, exportReportToMarkdown, exportReportToJson, downloadFile } from '@/lib/export';
import { formatDateTime, formatDate, generateId, cn } from '@/lib/utils';
import { saveReport } from '@/lib/db';
import type { AnalysisProgress, NormalizedMessage } from '@/types';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const {
    getAllMessages,
    batches,
    addBatch,
    addPastedText,
    removeBatch,
    clearAll,
  } = useImportStore();
  const { report, setReport, updateAction, reset } = useAnalysisStore();
  const { addToast } = useToastStore();

  // Active input tab: 'text' | 'image' | 'file'
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'file'>('text');
  const [rawTextInput, setRawTextInput] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const messages = getAllMessages();
  const hasData = messages.length > 0;

  // 1. Handle Raw Text Ingestion
  const handleAddRawText = () => {
    if (!rawTextInput.trim()) return;
    try {
      const parsed = parseWhatsAppChat(rawTextInput, 'Pasted Text');
      const normalizedMsgs = parsed.length > 0 ? parsed : [
        {
          id: generateId(),
          sourceType: 'other' as const,
          sourceFilename: 'Pasted Notes',
          sourceIdentifier: `pasted#${Date.now()}`,
          sender: 'User',
          originalText: rawTextInput.trim(),
          timestamp: new Date(),
          messageIndex: 1,
        },
      ];

      addBatch({
        sourceType: 'other',
        label: `Pasted Note (${rawTextInput.slice(0, 20)}...)`,
        status: 'ready',
        messages: normalizedMsgs,
      });

      setRawTextInput('');
      addToast({ title: 'Added', message: `Added ${normalizedMsgs.length} message(s) to analysis queue`, type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'Failed to process pasted text', type: 'error' });
    }
  };

  // 2. Handle Image Drops & OCR Extraction
  const handleImageDrop = async (files: File[]) => {
    if (files.length === 0) return;
    setIsOcrProcessing(true);
    let successCount = 0;

    for (const file of files) {
      try {
        setOcrProgress(10);
        const ocr = await performOCR(file, (p) => setOcrProgress(Math.round(p * 100)));
        const previewUrl = URL.createObjectURL(file);

        const newMsg: NormalizedMessage = {
          id: generateId(),
          sourceType: 'image',
          sourceFilename: file.name,
          sourceIdentifier: `${file.name}#ocr`,
          originalText: ocr.text,
          timestamp: new Date(),
          sender: 'OCR Extraction',
          messageIndex: 1,
          ocrConfidence: ocr.confidence,
        };

        addBatch({
          sourceType: 'image',
          label: file.name,
          file,
          previewUrl,
          size: file.size,
          status: 'ready',
          ocrText: ocr.text,
          ocrConfidence: ocr.confidence,
          messages: [newMsg],
        });
        successCount++;
      } catch (err: any) {
        addToast({ title: 'OCR Failed', message: err?.message || `Failed to process image ${file.name}`, type: 'error' });
      }
    }

    setIsOcrProcessing(false);
    setOcrProgress(0);
    if (successCount > 0) {
      addToast({ title: 'Image OCR Ready', message: `Extracted text from ${successCount} image(s)`, type: 'success' });
    }
  };

  // 3. Handle File Drops (PDFs, WhatsApp chats, JSON, SMS, etc.)
  const handleFileDrop = async (files: File[]) => {
    if (files.length === 0) return;
    let count = 0;

    for (const file of files) {
      try {
        let sourceType: any = 'document';
        const name = file.name.toLowerCase();
        if (name.includes('whatsapp')) sourceType = 'whatsapp';
        else if (name.includes('telegram')) sourceType = 'telegram';
        else if (name.includes('sms')) sourceType = 'sms';
        else if (name.includes('circular') || name.includes('notice')) sourceType = 'circular';

        const parsedMsgs = await parseFile(file, sourceType);
        addBatch({
          sourceType,
          label: file.name,
          file,
          size: file.size,
          status: 'ready',
          messages: parsedMsgs,
        });
        count++;
      } catch (e: any) {
        addToast({ title: 'File Error', message: `Failed to parse ${file.name}: ${e?.message || 'Unknown'}`, type: 'error' });
      }
    }

    if (count > 0) {
      addToast({ title: 'Files Added', message: `Ingested ${count} file(s) into queue`, type: 'success' });
    }
  };

  // 4. Trigger / Re-trigger Analysis (can be called repeatedly whenever new items are added!)
  const runAnalysis = async () => {
    const currentMessages = getAllMessages();
    if (currentMessages.length === 0) {
      addToast({ title: 'No Data', message: 'Please paste text or upload an image first', type: 'warning' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const onProgress = (p: AnalysisProgress) => {
        setProgress(p);
      };

      const result = await analyzeMessages(currentMessages, onProgress);
      const newReport = buildReport(result, {
        title: `Intelligence Report — ${formatDate(new Date())}`,
        includeExcerpts: true,
        userNames: [],
      });

      setReport(newReport);
      addToast({ title: 'Analysis Complete', message: `Generated ${newReport.findings.length} findings from ${currentMessages.length} items`, type: 'success' });
    } catch (e: any) {
      console.error(e);
      addToast({ title: 'Analysis Error', message: e?.message || 'Analysis failed', type: 'error' });
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  // 5. Add Realistic Demo Data (Circular image note + WhatsApp group chat + exam reminder)
  const handleLoadDemo = () => {
    clearAll();
    reset();

    // 1. WhatsApp conversation batch
    addBatch({
      sourceType: 'whatsapp',
      label: 'Batch 2026 WhatsApp Group',
      status: 'ready',
      messages: [
        {
          id: generateId(),
          sourceType: 'whatsapp',
          sourceFilename: 'Batch 2026 WhatsApp Group',
          sourceIdentifier: 'wa-1',
          sender: 'Prof. Kumar',
          originalText: 'Urgent: Submit your AI Capstone project report by October 12, 2026 before 5:00 PM. Late submissions will strictly not be accepted.',
          timestamp: new Date('2026-10-08T09:15:00'),
          messageIndex: 1,
        },
        {
          id: generateId(),
          sourceType: 'whatsapp',
          sourceFilename: 'Batch 2026 WhatsApp Group',
          sourceIdentifier: 'wa-2',
          sender: 'Priya',
          originalText: 'Does anyone have the template for the capstone documentation?',
          timestamp: new Date('2026-10-08T09:20:00'),
          messageIndex: 2,
        },
        {
          id: generateId(),
          sourceType: 'whatsapp',
          sourceFilename: 'Batch 2026 WhatsApp Group',
          sourceIdentifier: 'wa-3',
          sender: 'Placement Cell',
          originalText: 'TCS campus recruitment drive on October 20, 2026. Register on the college portal before October 14. Bring 2 passport photos and updated resumes.',
          timestamp: new Date('2026-10-08T14:30:00'),
          messageIndex: 3,
        },
      ],
    });

    // 2. Circular / Image OCR note batch
    addBatch({
      sourceType: 'circular',
      label: 'Exam Fee Notice & Hall Ticket (Circular #44)',
      status: 'ready',
      ocrText: 'CIRCULAR: Examination Fee Payment Deadline is October 15, 2026. Penalty of Rs. 500 will apply after due date. Failure to pay will result in hall tickets being withheld.',
      ocrConfidence: 96,
      messages: [
        {
          id: generateId(),
          sourceType: 'circular',
          sourceFilename: 'Exam Fee Notice & Hall Ticket (Circular #44)',
          sourceIdentifier: 'circ-1',
          sender: "Dean's Office",
          originalText: 'CIRCULAR: Examination Fee Payment Deadline is October 15, 2026. Penalty of Rs. 500 will apply after due date. Failure to pay will result in hall tickets being withheld.',
          timestamp: new Date('2026-10-09T08:00:00'),
          messageIndex: 1,
          ocrConfidence: 96,
        },
      ],
    });

    addToast({ title: 'Sample Data Loaded', message: 'Loaded WhatsApp chat and college circular notices. Click "Run Intelligence Analysis" to inspect.', type: 'info' });
  };

  // 6. Reset Session (Allows starting fresh anytime)
  const handleClearSession = () => {
    clearAll();
    reset();
    addToast({ title: 'Cleared', message: 'Workspace cleared. Ready for new input.', type: 'info' });
  };

  // 7. Save Report
  const handleSaveReport = async () => {
    if (!report) return;
    try {
      await saveReport(report);
      addToast({ title: 'Report Saved', message: 'Saved report to local IndexedDB. You can view it in Saved Reports anytime.', type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'Failed to save report to local database', type: 'error' });
    }
  };

  // 8. Exports
  const exportJson = () => {
    if (!report) return;
    const jsonStr = exportReportToJson(report);
    downloadFile(jsonStr, `${report.title || 'report'}.json`, 'application/json');
    addToast({ title: 'Exported', message: 'Report exported as JSON', type: 'success' });
  };

  const exportMarkdown = () => {
    if (!report) return;
    const md = exportReportToMarkdown(report);
    downloadFile(md, `${report.title || 'report'}.md`, 'text/markdown');
    addToast({ title: 'Exported', message: 'Report exported as Markdown', type: 'success' });
  };

  const exportPdf = async () => {
    if (!report) return;
    try {
      await exportReportToPdf(report);
      addToast({ title: 'Exported', message: 'Report exported as PDF', type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'Failed to generate PDF', type: 'error' });
    }
  };

  const toggleActionStatus = (itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    updateAction(itemId, {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date() : undefined,
    });
  };

  const filteredFindings = report
    ? report.findings.filter((f) => {
        if (severityFilter !== 'all') {
          if (severityFilter === 'critical' && f.severity !== 'S4') return false;
          if (severityFilter === 'high' && f.severity !== 'S3') return false;
          if (severityFilter === 'moderate' && f.severity !== 'S2') return false;
          if (severityFilter === 'low' && f.severity !== 'S1' && f.severity !== 'S0') return false;
          if (['S4', 'S3', 'S2', 'S1', 'S0'].includes(severityFilter) && f.severity !== severityFilter) return false;
        }
        if (
          searchQuery &&
          !f.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !f.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
    : [];

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-7 h-7 text-accent" /> Live Analysis Studio
          </h1>
          <p className="text-secondary text-xs sm:text-sm mt-0.5">
            Ingest raw text, screenshots, OCR images, and chats side-by-side with local offline intelligence extraction.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleLoadDemo} icon={<Zap className="w-4 h-4 text-amber-500" />}>
            Load Demo
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearSession} icon={<RotateCcw className="w-4 h-4" />}>
            Clear
          </Button>
          <Button
            size="sm"
            onClick={runAnalysis}
            disabled={!hasData || isAnalyzing}
            icon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          >
            {report ? 'Re-Analyze All' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Side-by-Side Unified Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: INGESTION & DATA HUB (5 cols on lg) ──────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Ingest Data
              </span>

              {/* Ingestion Tabs */}
              <div className="flex rounded-lg p-0.5 bg-black/10 text-xs">
                <button
                  onClick={() => setActiveTab('text')}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                    activeTab === 'text' ? "bg-accent text-white shadow-xs" : "text-secondary hover:text-current"
                  )}
                >
                  Raw Text
                </button>
                <button
                  onClick={() => setActiveTab('image')}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                    activeTab === 'image' ? "bg-accent text-white shadow-xs" : "text-secondary hover:text-current"
                  )}
                >
                  Images (OCR)
                </button>
                <button
                  onClick={() => setActiveTab('file')}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                    activeTab === 'file' ? "bg-accent text-white shadow-xs" : "text-secondary hover:text-current"
                  )}
                >
                  Files
                </button>
              </div>
            </div>

            {/* TAB 1: RAW TEXT INPUT */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <textarea
                  className={cn(
                    "w-full h-36 p-3 rounded-lg border text-xs sm:text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent font-sans",
                    isDark ? "bg-dark-panel border-dark-border text-dark-text" : "bg-light-card border-light-border text-light-text"
                  )}
                  placeholder="Paste WhatsApp messages, email bodies, circular text, or deadlines here..."
                  value={rawTextInput}
                  onChange={(e) => setRawTextInput(e.target.value)}
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-secondary">
                    {rawTextInput.trim().length} characters
                  </span>
                  <Button size="sm" onClick={handleAddRawText} disabled={!rawTextInput.trim()}>
                    Add to Analysis Queue
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: IMAGE UPLOAD & OCR */}
            {activeTab === 'image' && (
              <div className="space-y-3">
                <DropZone
                  onDrop={handleImageDrop}
                  accept={{
                    'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'],
                  }}
                  maxSizeMB={50}
                  icon={<FileImage size={24} />}
                  title="Drop screenshots or notice photos"
                  description="On-device OCR extracts text immediately"
                />

                {isOcrProcessing && (
                  <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-center gap-3 text-xs">
                    <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-accent">Extracting text via local OCR...</p>
                      <div className="w-full h-1.5 bg-black/20 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-200"
                          style={{ width: `${ocrProgress || 30}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: FILE UPLOADS */}
            {activeTab === 'file' && (
              <div className="space-y-3">
                <DropZone
                  onDrop={handleFileDrop}
                  accept={{
                    'application/pdf': ['.pdf'],
                    'text/plain': ['.txt'],
                    'application/json': ['.json'],
                    'text/csv': ['.csv'],
                    'application/zip': ['.zip'],
                  }}
                  maxSizeMB={100}
                  title="Drop WhatsApp, Telegram, PDF or CSV files"
                />
              </div>
            )}
          </Card>

          {/* ACTIVE INGESTION QUEUE */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Ingested Items ({batches.length})
              </span>
              <span className="text-xs font-medium text-accent">
                {messages.length} message{messages.length === 1 ? '' : 's'} ready
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
                    isDark ? "bg-dark-panel/40 border-dark-border" : "bg-light-card border-light-border"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    {batch.sourceType === 'image' ? (
                      batch.previewUrl ? (
                        <img
                          src={batch.previewUrl}
                          alt="preview"
                          className="w-7 h-7 object-cover rounded shrink-0 border border-border"
                        />
                      ) : (
                        <FileImage className="w-4 h-4 text-blue-500 shrink-0" />
                      )
                    ) : batch.label.endsWith('.zip') ? (
                      <FileArchive className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-current" title={batch.label}>
                        {batch.label}
                      </p>
                      <p className="text-[10px] text-secondary">
                        {batch.messages.length} msg{batch.messages.length === 1 ? '' : 's'}
                        {batch.ocrConfidence !== undefined && ` • OCR ${batch.ocrConfidence}%`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeBatch(batch.id)}
                    className="p-1 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Remove item"
                    aria-label={`Remove ${batch.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {batches.length === 0 && (
                <div className="text-center py-6 text-secondary text-xs">
                  No items in queue. Paste text or drop images above to start.
                </div>
              )}
            </div>

            {batches.length > 0 && (
              <Button
                className="w-full mt-2"
                onClick={runAnalysis}
                disabled={isAnalyzing}
                icon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              >
                {isAnalyzing ? 'Extracting Intelligence...' : report ? 'Re-Analyze All Items' : 'Analyze Now'}
              </Button>
            )}
          </Card>
        </div>

        {/* ── RIGHT COLUMN: LIVE ANALYSIS RESULTS (7 cols on lg) ─────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* ANALYSIS IN PROGRESS INDICATOR */}
          {isAnalyzing && (
            <Card className="p-6 text-center space-y-4">
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Brain className="w-12 h-12 mx-auto text-accent" />
              </motion.div>
              <div>
                <h3 className="font-bold text-lg">Extracting Local Intelligence...</h3>
                <p className="text-xs text-secondary mt-1">
                  {progress ? progress.phaseLabel || (progress as any).stage || 'Analyzing content' : 'Running rule-based inference'}
                </p>
              </div>
              <div className="w-full max-w-md mx-auto h-2 bg-black/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progress ? Math.round(progress.percentage || (progress as any).percent || 0) : 15}%` }}
                />
              </div>
              <p className="text-[11px] text-secondary">100% On-Device • Private • No Cloud Calls</p>
            </Card>
          )}

          {/* NO REPORT YET EMPTY STATE */}
          {!isAnalyzing && !report && (
            <Card className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto">
                <Brain className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-bold text-lg">Workspace Ready</h3>
                <p className="text-sm text-secondary">
                  Add raw text or drop circular images on the left panel. Click <strong>Analyze Now</strong> or{' '}
                  <strong>Load Demo</strong> to see findings, action items, and timelines side-by-side in real-time.
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" variant="secondary" onClick={handleLoadDemo} icon={<Zap className="w-4 h-4 text-amber-500" />}>
                  Load College Demo Data
                </Button>
              </div>
            </Card>
          )}

          {/* ACTIVE REPORT PANEL */}
          {!isAnalyzing && report && (
            <div className="space-y-6">
              {/* Report Title & Export Bar */}
              <Card className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-current">{report.title}</h2>
                    <p className="text-xs text-secondary mt-0.5">
                      {formatDateTime(report.generatedAt)} • {report.totalMessagesProcessed} items analyzed • {report.sources.length} source(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button variant="outline" size="sm" onClick={exportPdf} icon={<Download className="w-3.5 h-3.5" />}>
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportMarkdown} icon={<Download className="w-3.5 h-3.5" />}>
                      MD
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportJson} icon={<Download className="w-3.5 h-3.5" />}>
                      JSON
                    </Button>
                    <Button size="sm" onClick={handleSaveReport} icon={<Save className="w-3.5 h-3.5" />}>
                      Save
                    </Button>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="pt-3 border-t border-border/50">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-accent" /> Executive Summary
                  </h3>
                  <p className="text-xs sm:text-sm text-current leading-relaxed whitespace-pre-wrap">
                    {report.executiveSummary}
                  </p>
                </div>
              </Card>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'S4', label: 'S4 Critical' },
                    { id: 'S3', label: 'S3 High' },
                    { id: 'S2', label: 'S2 Moderate' },
                    { id: 'S1', label: 'S1 Low' },
                  ].map((sev) => (
                    <button
                      key={sev.id}
                      onClick={() => setSeverityFilter(sev.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border",
                        severityFilter === sev.id
                          ? "bg-accent border-accent text-white"
                          : isDark ? "bg-dark-panel border-dark-border text-secondary hover:text-current" : "bg-light-card border-light-border text-secondary hover:text-current"
                      )}
                    >
                      {sev.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search findings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      "w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-accent",
                      isDark ? "bg-dark-panel border-dark-border" : "bg-light-card border-light-border"
                    )}
                  />
                </div>
              </div>

              {/* Key Findings */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="text-yellow-500 w-4 h-4" /> Key Findings ({filteredFindings.length})
                </h3>

                {filteredFindings.map((finding) => (
                  <Card key={finding.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={finding.severity} needsReview={finding.needsReview} size="sm" />
                          <h4 className="font-semibold text-sm text-current">{finding.title}</h4>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">{finding.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary pt-2 border-t border-border/40">
                      {finding.deadline && (
                        <span className="flex items-center text-red-400 font-medium gap-1">
                          <Clock className="w-3 h-3" /> Due: {formatDate(finding.deadline)}
                        </span>
                      )}
                      {finding.sender && <span>From: {finding.sender}</span>}
                      <span>Source: {finding.sourceFilename}</span>
                      {finding.whyItMatters && (
                        <span className="w-full italic text-current/80 mt-0.5">
                          Reason: {finding.whyItMatters}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}

                {filteredFindings.length === 0 && (
                  <div className="text-center py-8 text-secondary text-xs">
                    No findings match the current filter or search criteria.
                  </div>
                )}
              </div>

              {/* Action Checklist & Timeline Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Action Items */}
                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="text-emerald-500 w-4 h-4" /> Action Checklist ({report.actionItems.length})
                  </h3>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {report.actionItems.map((item) => {
                      const isDone = item.status === 'completed';
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleActionStatus(item.id, item.status)}
                          className={cn(
                            "flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all",
                            isDone
                              ? "opacity-60 line-through bg-black/10 border-transparent"
                              : isDark ? "bg-dark-panel/40 border-dark-border hover:border-accent/40" : "bg-light-card border-light-border hover:border-accent/40"
                          )}
                        >
                          <div
                            className={cn(
                              "w-3.5 h-3.5 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-colors",
                              isDone ? "bg-accent border-accent text-white" : "border-secondary"
                            )}
                          >
                            {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-current">{item.taskDescription}</p>
                            {item.deadline && (
                              <p className="text-[10px] text-red-400 mt-0.5">
                                Due: {formatDate(item.deadline)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {report.actionItems.length === 0 && (
                      <p className="text-secondary text-xs py-4 text-center">No action items detected.</p>
                    )}
                  </div>
                </Card>

                {/* Timeline */}
                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="text-blue-500 w-4 h-4" /> Timeline ({report.timeline.length})
                  </h3>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {report.timeline.map((event) => (
                      <div key={event.id} className="flex gap-3 border-l-2 border-accent/40 pl-3 relative text-xs">
                        <div className="absolute w-2 h-2 rounded-full bg-accent -left-[5px] top-1" />
                        <div>
                          <div className="font-semibold text-current">
                            {formatDate(event.date)} {event.time ? `at ${event.time}` : ''}
                          </div>
                          <div className="text-[11px] font-medium text-accent mt-0.5">{event.title}</div>
                          <div className="text-[10px] text-secondary mt-0.5">{event.description}</div>
                        </div>
                      </div>
                    ))}

                    {report.timeline.length === 0 && (
                      <p className="text-secondary text-xs py-4 text-center">No calendar events identified.</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Decisions & Questions */}
              {(report.decisions.length > 0 || report.unresolvedQuestions.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.decisions.length > 0 && (
                    <Card className="p-4 space-y-2">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-purple-400">
                        <FileCheck className="w-3.5 h-3.5" /> Key Decisions
                      </h4>
                      <ul className="space-y-1.5 text-xs text-secondary">
                        {report.decisions.map((dec, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-accent font-bold">•</span>
                            <span>{dec}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {report.unresolvedQuestions.length > 0 && (
                    <Card className="p-4 space-y-2">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                        <HelpCircle className="w-3.5 h-3.5" /> Questions Pending Response
                      </h4>
                      <ul className="space-y-1.5 text-xs text-secondary">
                        {report.unresolvedQuestions.map((q, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
