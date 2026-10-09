import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, FileImage, Sparkles } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { useThemeStore, useImportStore, useToastStore } from '@/lib/store';
import type { NormalizedMessage } from '@/types';
import { Button, Card, PageHeader, DropZone, FileList } from '@/components/ui';
import { parseFile, parseWhatsAppChat, performOCR } from '@/lib/parsers';

export default function WhatsAppUpload() {
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const isDarkMode = theme === 'dark';
  const addToast = useToastStore((state) => state.addToast);
  const { files, addFiles, updateFileStatus, addPastedText, removeFile, getPendingFiles } = useImportStore();

  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const whatsappFiles = files.filter((f) => f.sourceType === 'whatsapp' || f.source === 'whatsapp');
  const pendingFiles = getPendingFiles().filter((f) => f.sourceType === 'whatsapp' || f.source === 'whatsapp');

  const handleFilesDrop = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles, 'whatsapp');
    },
    [addFiles]
  );

  const processPendingFilesInternal = async () => {
    let count = 0;
    for (const batch of pendingFiles) {
      if (!batch.file) continue;
      updateFileStatus(batch.id, 'processing');
      try {
        let messages: NormalizedMessage[] = [];
        const isImage = batch.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(batch.file.name);
        
        if (isImage) {
          const ocr = await performOCR(batch.file);
          const parsed = parseWhatsAppChat(ocr.text, batch.file.name);
          messages = parsed.length > 0 ? parsed : [
            {
              id: generateId(),
              sourceType: 'whatsapp',
              sourceFilename: batch.file.name,
              sourceIdentifier: `${batch.file.name}#ocr`,
              sender: 'Chat Screenshot',
              originalText: ocr.text.trim(),
              timestamp: new Date(),
              messageIndex: 1,
              ocrConfidence: ocr.confidence,
            },
          ];
        } else if (batch.file.name.endsWith('.zip')) {
          messages = await parseFile(batch.file, 'whatsapp');
        } else {
          const text = await batch.file.text();
          messages = parseWhatsAppChat(text, batch.file.name);
        }
        updateFileStatus(batch.id, 'completed', messages);
        count++;
      } catch (error) {
        updateFileStatus(batch.id, 'error', [], error instanceof Error ? error.message : 'Unknown error');
      }
    }
    return count;
  };

  const handleProcessFiles = async () => {
    if (pendingFiles.length === 0) return;
    setIsProcessing(true);
    const count = await processPendingFilesInternal();
    setIsProcessing(false);
    if (count > 0) {
      addToast({ title: 'Success', message: `Processed ${count} WhatsApp file/image item(s)`, type: 'success' });
    }
  };

  const handleAddText = () => {
    if (!pasteText.trim()) return;
    try {
      const messages = parseWhatsAppChat(pasteText, 'Pasted WhatsApp Chat.txt');
      addPastedText(pasteText, 'whatsapp', messages);
      setPasteText('');
      addToast({ title: 'Success', message: 'Chat text added successfully', type: 'success' });
    } catch {
      addToast({ title: 'Error', message: 'Failed to parse chat text', type: 'error' });
    }
  };

  // Combined action: Process both images/files AND raw text together and go directly to Live Analysis Studio
  const handleProcessAndAnalyzeTogether = async () => {
    setIsProcessing(true);

    // 1. Process text if present
    if (pasteText.trim()) {
      try {
        const messages = parseWhatsAppChat(pasteText, 'Pasted WhatsApp Chat.txt');
        addPastedText(pasteText, 'whatsapp', messages);
        setPasteText('');
      } catch (err) {
        console.error('Error parsing raw text:', err);
      }
    }

    // 2. Process pending files/images
    if (pendingFiles.length > 0) {
      await processPendingFilesInternal();
    }

    setIsProcessing(false);
    addToast({ title: 'Ready for Analysis', message: 'Navigating to side-by-side Live Analysis Studio...', type: 'success' });
    navigate('/analysis?auto=1');
  };

  const hasCompletedFiles = whatsappFiles.some((f) => f.status === 'completed' || f.status === 'ready');
  const hasAnythingToProcess = pendingFiles.length > 0 || pasteText.trim().length > 0;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="WhatsApp Chat & Screenshot Export"
        description="Upload WhatsApp exports (.txt, .zip) or screenshot images (.png, .jpg) and accompanying raw text notes together."
        backTo="/upload"
      />

      {/* QUICK COMBINED ACTION BAR */}
      {hasAnythingToProcess && (
        <Card className="p-4 bg-accent/10 border-accent/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent shrink-0" />
            <span className="text-xs sm:text-sm font-medium">
              You have {pendingFiles.length} file/image(s) and {pasteText.trim() ? 'raw text' : 'no text'} ready.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleProcessAndAnalyzeTogether}
            disabled={isProcessing}
            icon={isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          >
            Process Both & Live Analyze Side-by-Side
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-accent" /> Upload WhatsApp Files & Images
            </h3>
            <p className="text-xs text-secondary mb-4">
              Supports chat export text files, zip archives, and screenshot images with automatic OCR.
            </p>
            <DropZone
              onDrop={handleFilesDrop}
              accept={{
                'text/plain': ['.txt'],
                'application/zip': ['.zip'],
                'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
              }}
              maxSizeMB={50}
              title="Drop WhatsApp chats or screenshot images here"
              description=".txt, .zip, .png, .jpg supported with automatic OCR"
            />
          </Card>

          <Card>
            <h3 className="text-lg font-medium mb-2">Or Paste Raw WhatsApp Text</h3>
            <p className="text-xs text-secondary mb-3">
              Paste exported messages or type context notes directly.
            </p>
            <textarea
              className={cn(
                'w-full h-32 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent font-sans',
                isDarkMode ? 'bg-dark-panel border-dark-border text-dark-text' : 'bg-light-card border-light-border text-light-text'
              )}
              placeholder="[10/09/26, 10:15:23 AM] Prof. Kumar: Submit project by Oct 12..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-secondary">{pasteText.trim().length} chars</span>
              <Button onClick={handleAddText} disabled={!pasteText.trim()} size="sm">
                Add Raw Text
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Uploaded Items</h3>
              {pendingFiles.length > 0 && (
                <Button onClick={handleProcessFiles} disabled={isProcessing} size="sm">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Process {pendingFiles.length} Item{pendingFiles.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {whatsappFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary py-12">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No items uploaded yet</p>
                  <p className="text-xs text-secondary mt-1">Upload screenshots, chat exports, or paste raw text</p>
                </div>
              ) : (
                <FileList files={whatsappFiles} onRemove={removeFile} />
              )}
            </div>

            {(hasCompletedFiles || hasAnythingToProcess) && (
              <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row gap-2">
                <Button className="w-full" onClick={handleProcessAndAnalyzeTogether} disabled={isProcessing}>
                  Live Analyze Side-by-Side
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
