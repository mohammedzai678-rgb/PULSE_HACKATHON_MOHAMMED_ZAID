import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useImportStore, useAnalysisStore, useToastStore, useThemeStore, useSettingsStore, buildReport } from '@/lib/store';
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
  Sparkles,
  RefreshCw,
  FolderPlus,
  X,
  History,
  Eye,
  MessageSquare,
  Send,
  Mail,
  Smartphone,
  ScrollText,
  Files,
  FolderOpen,
  HeartHandshake,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeMessagesAsync } from '@/lib/analysis/worker-client';
import { parseFile, performOCR, parseWhatsAppChat } from '@/lib/parsers';
import { exportReportToPdf, exportReportToMarkdown, exportReportToJson, downloadFile } from '@/lib/export';
import { formatDateTime, formatDate, generateId, cn } from '@/lib/utils';
import { saveReport } from '@/lib/db';
import { CATEGORY_LABELS } from '@/types';
import type { AnalysisProgress, NormalizedMessage } from '@/types';

interface PendingImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  
  const {
    getAllMessages,
    batches,
    addBatch,
    removeBatch,
    clearAll,
  } = useImportStore();
  
  const {
    report,
    setReport,
    updateAction,
    reset,
    startNewAnalysis,
    history,
    selectHistoryReport,
    autoAnalyze,
    setAutoAnalyze,
  } = useAnalysisStore();
  
  const { addToast } = useToastStore();

  // Ingestion inputs: raw text + dropped images
  const [rawTextInput, setRawTextInput] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImageItem[]>([]);
  const [sourceType, setSourceType] = useState<string>('auto');

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrCurrentFile, setOcrCurrentFile] = useState<string>('');

  // Analysis execution state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewOcrModal, setViewOcrModal] = useState<{ label: string; text: string } | null>(null);
  const [showCatchUpModal, setShowCatchUpModal] = useState(false);

  const messages = getAllMessages();
  const hasData = messages.length > 0;
  
  // Track how many messages were processed in the active report
  const isReportStale = report ? messages.length > (report.totalMessagesProcessed || 0) : false;

  // 1. Run Analysis Engine
  const runAnalysis = useCallback(async () => {
    const currentMessages = getAllMessages();
    if (currentMessages.length === 0) {
      addToast({ title: 'No Data', message: 'Please add raw text or upload images first.', type: 'warning' });
      return;
    }

    setIsAnalyzing(true);
    setProgress({ phase: 'Initializing engine', percentage: 10, current: 0, total: currentMessages.length });

    try {
      const onProgress = (p: AnalysisProgress) => {
        setProgress(p);
      };

      const { settings } = useSettingsStore.getState();
      const result = await analyzeMessagesAsync(currentMessages, onProgress, {
        redactSensitive: settings.redactSensitiveContent,
        userNames: settings.userNames,
      });
      const newReport = buildReport(result, {
        title: `Intelligence Report — ${formatDate(new Date())}`,
        includeExcerpts: settings.includeExcerptsInReports,
        userNames: settings.userNames,
      });

      setReport(newReport);
      addToast({
        title: 'Analysis Complete',
        message: `Extracted ${newReport.findings.length} findings & ${newReport.actionItems.length} actions from ${currentMessages.length} items`,
        type: 'success',
      });
    } catch (e: any) {
      console.error('Analysis failed:', e);
      addToast({
        title: 'Analysis Error',
        message: e?.message || 'Inference engine encountered an issue. Please try again.',
        type: 'error',
      });
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  }, [getAllMessages, setReport, addToast]);

  // 2. Auto-run analysis when navigating with ?auto=1 or when autoAnalyze is enabled and no report exists
  useEffect(() => {
    const shouldAuto = searchParams.get('auto') === '1';
    if (shouldAuto && messages.length > 0 && !isAnalyzing) {
      runAnalysis();
    }
  }, [searchParams, messages.length, isAnalyzing, runAnalysis]);

  // 3. Handle Dropped Files (Images, PDF, Word, PPT, TXT)
  const handleImagesSelected = (files: File[]) => {
    // Check if any file is JSON, reject it immediately
    const jsonFiles = files.filter(
      (f) => f.name.toLowerCase().endsWith('.json') || f.type === 'application/json'
    );
    if (jsonFiles.length > 0) {
      addToast({
        title: 'Unsupported File Format',
        message: 'JSON files are not supported. Please upload plain text, Word (.docx), PowerPoint (.pptx), PDF, or image files.',
        type: 'error',
      });
      return;
    }

    const imageFiles = files.filter(
      (f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f.name)
    );
    const nonImageFiles = files.filter(
      (f) => !f.type.startsWith('image/') && !/\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f.name)
    );

    if (imageFiles.length > 0) {
      const newItems: PendingImageItem[] = imageFiles.map((file) => ({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setPendingImages((prev) => [...prev, ...newItems]);
      addToast({
        title: 'Images Queued',
        message: `${imageFiles.length} image(s) ready. If unsure of type, 'Other' will be applied.`,
        type: 'info',
      });
    }

    if (nonImageFiles.length > 0) {
      handleGeneralFiles(nonImageFiles);
    }
  };

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  // 4. Ingest Raw Text AND Images Together
  const handleIngestAndAnalyzeTogether = async (autoRun: boolean = true) => {
    const hasText = rawTextInput.trim().length > 0;
    const hasImages = pendingImages.length > 0;

    if (!hasText && !hasImages) {
      addToast({ title: 'Nothing to Add', message: 'Please write text or upload an image/document to analyze.', type: 'warning' });
      return;
    }

    setIsOcrProcessing(true);
    let addedCount = 0;

    // A. Process raw text
    if (hasText) {
      try {
        let normalizedMsgs: NormalizedMessage[] = [];
        if (sourceType === 'whatsapp' || (sourceType === 'auto' && (rawTextInput.includes('[') || rawTextInput.includes(' - ')))) {
          normalizedMsgs = parseWhatsAppChat(rawTextInput, 'Pasted Chat Transcript');
        } else if (sourceType === 'gmail' || (sourceType === 'auto' && (rawTextInput.includes('From:') || rawTextInput.includes('Subject:')))) {
          normalizedMsgs = parseEmlFile(rawTextInput, 'Pasted Email').map((m) => ({ ...m, sourceType: 'gmail' }));
        }
        
        if (normalizedMsgs.length === 0) {
          normalizedMsgs = [
            {
              id: generateId(),
              sourceType: (sourceType === 'auto' ? 'other' : sourceType) as any,
              sourceFilename: sourceType === 'gmail' ? 'Pasted Email' : 'Raw Text Input',
              sourceIdentifier: `text#${Date.now()}`,
              sender: sourceType === 'gmail' ? 'Email Sender' : 'Direct Input',
              originalText: rawTextInput.trim(),
              timestamp: new Date(),
              messageIndex: 1,
            },
          ];
        }

        addBatch({
          sourceType: (sourceType === 'auto' ? 'other' : sourceType) as any,
          label: `Note (${rawTextInput.slice(0, 24).replace(/\n/g, ' ')}...)`,
          status: 'ready',
          messages: normalizedMsgs,
        });

        addedCount += normalizedMsgs.length;
      } catch (err: any) {
        console.error('Error parsing raw text:', err);
      }
    }

    // B. Process pending images via local OCR
    if (hasImages) {
      for (const item of pendingImages) {
        try {
          setOcrCurrentFile(item.file.name);
          setOcrProgress(15);

          const ocr = await performOCR(item.file, (p) => setOcrProgress(Math.round(p * 100)));

          const targetSource = sourceType === 'other' ? 'other' : sourceType === 'auto' ? 'image' : sourceType;

          const newMsg: NormalizedMessage = {
            id: generateId(),
            sourceType: targetSource as any,
            sourceFilename: item.file.name,
            sourceIdentifier: `${item.file.name}#ocr`,
            originalText: ocr.text.trim() || '[Image contained no readable text]',
            timestamp: new Date(),
            sender: 'Image OCR',
            messageIndex: 1,
            ocrConfidence: ocr.confidence,
          };

          addBatch({
            sourceType: targetSource as any,
            label: item.file.name,
            file: item.file,
            previewUrl: item.previewUrl,
            size: item.file.size,
            status: 'ready',
            ocrText: ocr.text,
            ocrConfidence: ocr.confidence,
            messages: [newMsg],
          });

          addedCount += 1;
        } catch (err: any) {
          addToast({ title: 'OCR Issue', message: `Could not extract text from ${item.file.name}`, type: 'error' });
        }
      }
    }

    setIsOcrProcessing(false);
    setOcrProgress(0);
    setOcrCurrentFile('');
    setRawTextInput('');
    setPendingImages([]);

    addToast({ title: 'Ingested', message: `Added ${addedCount} items to workspace.`, type: 'success' });

    // C. Trigger analysis if requested or if autoAnalyze is active
    if (autoRun || autoAnalyze) {
      setTimeout(() => {
        runAnalysis();
      }, 50);
    }
  };

  // 5. General files handler (PDF, TXT, Word docx/doc, PPT pptx/ppt)
  const handleGeneralFiles = async (files: File[]) => {
    let count = 0;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
        addToast({
          title: 'Unsupported Format',
          message: 'JSON files are not supported.',
          type: 'error',
        });
        continue;
      }
      try {
        let sType: any = sourceType === 'other' ? 'other' : 'document';
        const parsed = await parseFile(file, sType);
        addBatch({
          sourceType: sType,
          label: file.name,
          file,
          size: file.size,
          status: 'ready',
          messages: parsed,
        });
        count++;
      } catch (e: any) {
        addToast({ title: 'Import Error', message: e?.message || `Could not parse ${file.name}`, type: 'error' });
      }
    }

    if (count > 0) {
      addToast({ title: 'Files Ingested', message: `Added ${count} file(s).`, type: 'success' });
      if (autoAnalyze) runAnalysis();
    }
  };

  // 6. Start Next Fresh Analysis Session
  const handleStartNextAnalysis = () => {
    startNewAnalysis();
    clearAll();
    setRawTextInput('');
    setPendingImages([]);
    addToast({
      title: 'Next Analysis Ready',
      message: 'Workspace reset for next analysis. Previous report saved in History.',
      type: 'info',
    });
  };

  // 7. Load Realistic Demo


  // 8. Save Report to IndexedDB
  const handleSaveReport = async () => {
    if (!report) return;
    try {
      await saveReport(report);
      addToast({ title: 'Report Saved', message: 'Report saved securely to local IndexedDB.', type: 'success' });
    } catch {
      addToast({ title: 'Save Failed', message: 'Could not write to local database.', type: 'error' });
    }
  };

  // 9. Exports
  const exportJson = () => {
    if (!report) return;
    downloadFile(exportReportToJson(report), `${report.title || 'report'}.json`, 'application/json');
    addToast({ title: 'Exported', message: 'Downloaded JSON report', type: 'success' });
  };

  const exportMarkdown = () => {
    if (!report) return;
    downloadFile(exportReportToMarkdown(report), `${report.title || 'report'}.md`, 'text/markdown');
    addToast({ title: 'Exported', message: 'Downloaded Markdown report', type: 'success' });
  };

  const exportPdf = async () => {
    if (!report) return;
    try {
      await exportReportToPdf(report);
      addToast({ title: 'Exported', message: 'Generated PDF report', type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'Failed to build PDF', type: 'error' });
    }
  };

  const toggleActionStatus = (itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    updateAction(itemId, {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date() : undefined,
    });
  };

  // Filter findings
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
      {/* ── TOP HEADER & WORKSPACE TOOLBAR ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-border/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-8 h-8 text-accent" />
            <span>Analysis</span>
          </h1>
          <p className="text-secondary text-xs sm:text-sm mt-0.5">
            Upload images and enter plain text for offline intelligence extraction.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* History Pill Selector */}
          {history.length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/10 dark:bg-white/5 p-1 rounded-lg text-xs">
              <History className="w-3.5 h-3.5 text-secondary ml-1" />
              <span className="text-[11px] text-secondary font-medium mr-1">History:</span>
              <button
                onClick={() => selectHistoryReport(history[0])}
                className="px-2 py-0.5 rounded text-[11px] bg-accent/20 text-accent font-medium hover:bg-accent/30 transition-colors"
                title="View previous analysis"
              >
                Prev ({history.length})
              </button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleStartNextAnalysis}
            icon={<FolderPlus className="w-4 h-4 text-accent" />}
            title="Preserve current report and start next analysis cleanly"
          >
            Start Next Analysis
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

      {/* STALE REPORT ALERT BANNER */}
      {isReportStale && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <span>
              <strong>New items detected in queue!</strong> Re-analyze to include all newly uploaded images and text in your intelligence report.
            </span>
          </div>
          <Button size="sm" onClick={runAnalysis} disabled={isAnalyzing}>
            Update Analysis Now
          </Button>
        </div>
      )}

      {/* ── SIDE-BY-SIDE GRID WORKSPACE ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN: INGESTION & UPLOAD WORKFLOW (5 cols) ──────────────── */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* ALL-IN-ONE DUAL INGESTION CARD */}
          <Card className="p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Ingest Data
              </span>
              
              {/* Source Tag Preset Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-secondary hidden sm:inline">Source:</span>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className={cn(
                    "text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-accent",
                    isDark ? "bg-dark-panel border-dark-border text-dark-text" : "bg-light-card border-light-border text-light-text"
                  )}
                  title="Tag source type for intelligent parsing"
                >
                  <option value="auto">Auto-Detect</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="gmail">Gmail</option>
                  <option value="sms">SMS</option>
                  <option value="circular">Circular / Notice</option>
                  <option value="document">Document</option>
                  <option value="image">Screenshot / Photo</option>
                  <option value="other">Other (Unsure)</option>
                </select>
              </div>
            </div>

            {/* QUICK SOURCE PILLS: WHATSAPP, TELEGRAM, GMAIL, SMS, CIRCULARS, ETC. */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-secondary">
                Select Source Type:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'auto', label: 'Auto', icon: Sparkles, color: isDark ? 'text-dark-accent' : 'text-light-accent' },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500' },
                  { id: 'telegram', label: 'Telegram', icon: Send, color: 'text-sky-500' },
                  { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-red-500' },
                  { id: 'sms', label: 'SMS', icon: Smartphone, color: 'text-indigo-500' },
                  { id: 'circular', label: 'Circulars', icon: ScrollText, color: 'text-amber-500' },
                  { id: 'document', label: 'Documents', icon: Files, color: 'text-blue-500' },
                  { id: 'image', label: 'Images', icon: FileImage, color: 'text-purple-500' },
                  { id: 'other', label: 'Other', icon: FolderOpen, color: 'text-slate-400' },
                ].map((src) => {
                  const isSelected = sourceType === src.id;
                  const Icon = src.icon;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setSourceType(src.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                        isSelected
                          ? isDark
                            ? "bg-dark-accent text-dark-bg border-dark-accent font-semibold shadow-xs"
                            : "bg-light-accent text-white border-light-accent font-semibold shadow-xs"
                          : isDark
                          ? "bg-dark-panel border-dark-border text-dark-secondary hover:text-dark-text hover:border-dark-accent/40"
                          : "bg-light-card border-light-border text-light-text hover:text-light-accent hover:border-light-accent/50 shadow-xs"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? (isDark ? "text-dark-bg" : "text-white") : src.color)} />
                      <span className={isSelected ? (isDark ? "text-dark-bg font-semibold" : "text-white font-semibold") : ""}>{src.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DROP ZONE: IMAGES, PDF, WORD, PPT, TXT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-secondary">
                  1. Upload Images or Documents:
                </label>
                <span className="text-[11px] text-secondary">
                  Unsure of type? Select 'Other' above
                </span>
              </div>
              <DropZone
                onDrop={handleImagesSelected}
                accept={{
                  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'],
                  'application/pdf': ['.pdf'],
                  'text/plain': ['.txt'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
                  'application/vnd.ms-powerpoint': ['.ppt'],
                }}
                maxSizeMB={50}
                icon={<FileImage className="w-6 h-6 text-accent" />}
                title="Drop images, PDFs, Word (.docx), PPT (.pptx), or plain text"
                description="Local OCR & parsing • No JSON files • Private on-device"
              />
            </div>

            {/* PENDING IMAGES THUMBNAIL STRIP */}
            {pendingImages.length > 0 && (
              <div className="space-y-2 p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-secondary">
                    {pendingImages.length} image{pendingImages.length === 1 ? '' : 's'} selected:
                  </span>
                  <button
                    onClick={() => setPendingImages([])}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Clear Images
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pendingImages.map((img) => (
                    <div key={img.id} className="relative group shrink-0">
                      <img
                        src={img.previewUrl}
                        alt="pending upload"
                        className="w-16 h-16 object-cover rounded-lg border border-border shadow-xs"
                      />
                      <button
                        onClick={() => removePendingImage(img.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-80 group-hover:opacity-100 shadow"
                        title="Remove image"
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <p className="text-[9px] truncate max-w-[64px] text-secondary mt-0.5" title={img.file.name}>
                        {img.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RAW TEXT INPUT AREA */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-secondary">
                  2. Enter / Paste Plain Text:
                </label>
                <span className="text-[11px] text-secondary">
                  {rawTextInput.trim().length} chars
                </span>
              </div>
              <textarea
                className={cn(
                  "w-full h-28 p-3 rounded-lg border text-xs sm:text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent font-sans",
                  isDark ? "bg-dark-panel border-dark-border text-dark-text" : "bg-light-card border-light-border text-light-text"
                )}
                placeholder={
                  sourceType === 'whatsapp'
                    ? "Paste WhatsApp chat export or messages (e.g. [12/10/2026, 10:15] Prof: Submit report...)..."
                    : sourceType === 'telegram'
                    ? "Paste Telegram exported messages, announcements, or chat logs..."
                    : sourceType === 'gmail'
                    ? "Paste email subject lines, body text, or communication updates..."
                    : sourceType === 'sms'
                    ? "Paste SMS text messages or alerts..."
                    : sourceType === 'circular'
                    ? "Paste circular or official notice text, guidelines, or deadlines..."
                    : "Paste plain text, chat excerpts, circular notices, emails, or personal notes here..."
                }
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
              />
            </div>

            {/* OCR PROGRESS BAR */}
            {isOcrProcessing && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-center gap-3 text-xs">
                <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-accent truncate">
                    Extracting OCR text: {ocrCurrentFile || 'Processing image...'}
                  </p>
                  <div className="w-full h-1.5 bg-black/20 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${ocrProgress || 35}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* COMBINED ACTION BUTTONS */}
            <div className="space-y-2 pt-1">
              <Button
                className="w-full"
                onClick={() => handleIngestAndAnalyzeTogether(true)}
                disabled={isOcrProcessing || isAnalyzing || (!rawTextInput.trim() && pendingImages.length === 0)}
                icon={isOcrProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              >
                {isOcrProcessing
                  ? 'Extracting OCR...'
                  : isAnalyzing
                  ? 'Analyzing Intelligence...'
                  : 'Analyze Now'}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  onClick={() => handleIngestAndAnalyzeTogether(false)}
                  disabled={isOcrProcessing || (!rawTextInput.trim() && pendingImages.length === 0)}
                  className="text-secondary hover:text-current underline cursor-pointer disabled:opacity-40"
                >
                  + Add to queue without analyzing yet
                </button>

                <label className="flex items-center gap-1.5 text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoAnalyze}
                    onChange={(e) => setAutoAnalyze(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span>Auto-analyze on upload</span>
                </label>
              </div>
            </div>
          </Card>

          {/* ACTIVE INGESTION QUEUE LIST */}
          <Card className="p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Ingested Items ({batches.length})
              </span>
              <span className="text-xs font-medium text-accent">
                {messages.length} message{messages.length === 1 ? '' : 's'} ready
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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
                          className="w-8 h-8 object-cover rounded shrink-0 border border-border"
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
                      <div className="flex items-center gap-2 text-[10px] text-secondary">
                        <span>{batch.messages.length} msg{batch.messages.length === 1 ? '' : 's'}</span>
                        {batch.ocrConfidence !== undefined && <span>• OCR {batch.ocrConfidence}%</span>}
                        {batch.ocrText && (
                          <button
                            onClick={() => setViewOcrModal({ label: batch.label, text: batch.ocrText || '' })}
                            className="text-accent hover:underline flex items-center gap-0.5"
                          >
                            <Eye className="w-2.5 h-2.5" /> OCR Text
                          </button>
                        )}
                      </div>
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
                <div className="text-center py-8 text-secondary text-xs">
                  No items in workspace. Paste text or drop images above to begin.
                </div>
              )}
            </div>

            {batches.length > 0 && (
              <div className="pt-2 border-t border-border/50 flex gap-2">
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                  icon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                >
                  {isAnalyzing ? 'Extracting...' : report ? 'Re-Analyze Current Queue' : 'Analyze Now'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartNextAnalysis}
                  icon={<FolderPlus className="w-4 h-4 text-accent" />}
                  title="Archive report and start fresh analysis"
                >
                  Next
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT COLUMN: LIVE INTELLIGENCE REPORT (7 cols) ────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* ANALYSIS IN PROGRESS ANIMATED CARD */}
          {isAnalyzing && (
            <Card className="p-8 text-center space-y-4">
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Brain className="w-14 h-14 mx-auto text-accent" />
              </motion.div>
              <div>
                <h3 className="font-bold text-lg">Extracting Local Intelligence...</h3>
                <p className="text-xs text-secondary mt-1">
                  {progress ? progress.phaseLabel || (progress as any).stage || 'Evaluating dates & actions' : 'Running rule-based inference'}
                </p>
              </div>
              <div className="w-full max-w-md mx-auto h-2 bg-black/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progress ? Math.round(progress.percentage || (progress as any).percent || 0) : 25}%` }}
                />
              </div>
              <p className="text-[11px] text-secondary">100% On-Device • Zero Cloud Calls • Privacy Intact</p>
            </Card>
          )}

          {/* EMPTY STATE: READY FOR INPUT */}
          {!isAnalyzing && !report && (
            <Card className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-bold text-xl">Analysis Studio</h3>
                <p className="text-sm text-secondary leading-relaxed">
                  Paste plain text or upload images on the left panel.
                  Intelligence findings, deadlines, action checklists, and timelines will render here in real-time.
                </p>
              </div>
            </Card>
          )}

          {/* ACTIVE INTELLIGENCE REPORT */}
          {!isAnalyzing && report && (
            <div className="space-y-6">
              
              {/* Report Title & Export Bar */}
              <Card className="p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-current">{report.title}</h2>
                    <p className="text-xs text-secondary mt-0.5">
                      {formatDateTime(report.generatedAt)} • {report.totalMessagesProcessed} items analyzed • {report.sources.length} source(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => setShowCatchUpModal(true)}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      className={cn(
                        "font-semibold shadow-xs",
                        isDark ? "bg-dark-accent text-dark-bg hover:opacity-90" : "bg-light-accent text-white hover:opacity-90"
                      )}
                    >
                      30s Catch-Up
                    </Button>
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

              {/* Key Findings List */}
              <div className="space-y-3">
                {/* Crisis Intervention Helpline Banner */}
                {report.findings.some((f) => f.category === 'mental_health_crisis') && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3.5 text-xs text-red-300">
                    <HeartHandshake className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-red-200 text-sm">Acute Distress & Mental Health Support</p>
                      <p className="leading-relaxed text-red-300/90">
                        A life-critical mental health or self-harm distress signal was identified in this conversation. If you or someone you know is struggling, confidential 24/7 help is available:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1 font-medium text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-200">India: Tele-MANAS (14416 / 1800-891-4416)</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-200">India: Kiran (1800-599-0019)</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-200">US/Global: 988 Lifeline</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-200">Text HOME to 741741</span>
                      </div>
                    </div>
                  </div>
                )}

                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="text-yellow-500 w-4 h-4" /> Key Findings ({filteredFindings.length})
                </h3>

                {filteredFindings.map((finding) => (
                  <Card key={finding.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={finding.severity} needsReview={finding.needsReview} size="sm" />
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-medium border",
                              finding.category === 'mental_health_crisis'
                                ? "bg-red-500/15 border-red-500/40 text-red-400"
                                : finding.category === 'bereavement_crisis'
                                ? "bg-purple-500/15 border-purple-500/40 text-purple-400"
                                : finding.category === 'medical_emergency'
                                ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                                : finding.category === 'safety'
                                ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                                : finding.category === 'deadline'
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                : finding.category === 'internship_placement'
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                : finding.category === 'exam_assignment'
                                ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                                : "bg-black/10 dark:bg-white/10 border-border/50 text-secondary"
                            )}
                          >
                            {CATEGORY_LABELS[finding.category] || finding.category}
                          </span>
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

      {/* OCR TEXT MODAL */}
      <AnimatePresence>
        {viewOcrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full max-w-xl p-6 rounded-2xl border shadow-xl space-y-4 max-h-[80vh] flex flex-col",
                isDark ? "bg-dark-panel border-dark-border" : "bg-light-card border-light-border"
              )}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-accent" />
                  <span>OCR Extracted Text: {viewOcrModal.label}</span>
                </h3>
                <button
                  onClick={() => setViewOcrModal(null)}
                  className="p-1 text-secondary hover:text-current rounded"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 rounded-lg bg-black/10 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {viewOcrModal.text || 'No text extracted.'}
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setViewOcrModal(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 30s CATCH-UP EXECUTIVE BRIEFING MODAL */}
      <AnimatePresence>
        {showCatchUpModal && report && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "w-full max-w-3xl p-6 rounded-2xl border shadow-2xl space-y-5 max-h-[85vh] flex flex-col",
                isDark ? "bg-dark-panel border-dark-border" : "bg-light-card border-light-border"
              )}
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-current">What Did I Miss? — 30-Second Catch-Up</h3>
                    <p className="text-xs text-secondary">Instant executive briefing across {report.totalMessagesProcessed} unread items</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCatchUpModal(false)}
                  className="p-1.5 text-secondary hover:text-current rounded-lg cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Quadrant 1: Critical & Emergency Alerts */}
                <div className="p-4 rounded-xl border bg-red-500/5 border-red-500/30 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Critical Life-Safety & Urgent Alerts ({report.findings.filter(f => f.severity === 'S4' || f.severity === 'S3').length})
                  </h4>
                  {report.findings.filter(f => f.severity === 'S4' || f.severity === 'S3').length > 0 ? (
                    <div className="space-y-2">
                      {report.findings.filter(f => f.severity === 'S4' || f.severity === 'S3').map(f => (
                        <div key={f.id} className="text-xs flex items-start gap-2 bg-black/10 dark:bg-white/5 p-2 rounded-lg">
                          <SeverityBadge severity={f.severity} size="sm" />
                          <div className="flex-1">
                            <span className="font-semibold text-current">{f.title}: </span>
                            <span className="text-secondary">{f.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-secondary">No immediate critical emergencies detected.</p>
                  )}
                </div>

                {/* Quadrant 2: Action Items & Deadlines */}
                <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/30 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Key Deadlines & Tasks ({report.actionItems.length})
                  </h4>
                  {report.actionItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {report.actionItems.slice(0, 5).map(a => (
                        <div key={a.id} className="text-xs flex items-start gap-2">
                          <span className="text-accent mt-0.5">•</span>
                          <span className="text-current font-medium flex-1">{a.taskDescription}</span>
                          {a.deadline && <span className="text-[11px] text-red-400 shrink-0">Due: {formatDate(a.deadline)}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-secondary">No pending deadlines recorded.</p>
                  )}
                </div>

                {/* Quadrant 3 & 4 Grid: Decisions and Questions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Decisions Made */}
                  <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/30 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Decisions Finalized ({report.decisions.length})
                    </h4>
                    {report.decisions.length > 0 ? (
                      <ul className="text-xs space-y-1 text-secondary">
                        {report.decisions.map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-secondary">No formal agreements logged.</p>
                    )}
                  </div>

                  {/* Unresolved Questions */}
                  <div className="p-4 rounded-xl border bg-sky-500/5 border-sky-500/30 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4" /> Unanswered Questions ({report.unresolvedQuestions.length})
                    </h4>
                    {report.unresolvedQuestions.length > 0 ? (
                      <ul className="text-xs space-y-1 text-secondary">
                        {report.unresolvedQuestions.map((q, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-sky-400 font-bold">?</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-secondary">All questions answered.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button size="sm" onClick={() => setShowCatchUpModal(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
