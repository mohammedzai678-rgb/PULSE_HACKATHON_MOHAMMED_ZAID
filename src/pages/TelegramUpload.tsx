import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, useImportStore, useToastStore } from '@/lib/store';
import type { NormalizedMessage } from '@/types';
import { Button, Card, PageHeader, DropZone, FileList } from '@/components/ui';
import { parseTelegramJson, parseTelegramHtml } from '@/lib/parsers';

export default function TelegramUpload() {
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const isDarkMode = theme === 'dark';
  const addToast = useToastStore((state) => state.addToast);
  const { files, addFiles, updateFileStatus, addPastedText, removeFile, getPendingFiles } = useImportStore();

  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const telegramFiles = files.filter((f) => f.sourceType === 'telegram' || f.source === 'telegram');
  const pendingFiles = getPendingFiles().filter((f) => f.sourceType === 'telegram' || f.source === 'telegram');

  const handleFilesDrop = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles, 'telegram');
    },
    [addFiles]
  );

  const handleProcessFiles = async () => {
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const batch of pendingFiles) {
      if (!batch.file) continue;
      updateFileStatus(batch.id, 'processing');
      try {
        let messages: NormalizedMessage[] = [];
        const text = await batch.file.text();
        if (batch.file.name.endsWith('.html') || batch.file.name.endsWith('.htm')) {
          messages = parseTelegramHtml(text, batch.file.name);
        } else {
          messages = parseTelegramJson(text, batch.file.name);
        }
        updateFileStatus(batch.id, 'completed', messages);
        successCount++;
      } catch (error) {
        updateFileStatus(batch.id, 'error', [], error instanceof Error ? error.message : 'Unknown error');
        errorCount++;
      }
    }

    setIsProcessing(false);
    if (successCount > 0) {
      addToast({ title: 'Success', message: `Processed ${successCount} Telegram file${successCount === 1 ? '' : 's'}`, type: 'success' });
    }
    if (errorCount > 0) {
      addToast({ title: 'Error', message: `Failed to process ${errorCount} file${errorCount === 1 ? '' : 's'}`, type: 'error' });
    }
  };

  const handleAddText = async () => {
    if (!pasteText.trim()) return;
    try {
      let messages: NormalizedMessage[];
      if (pasteText.trim().startsWith('<')) {
        messages = parseTelegramHtml(pasteText, 'pasted-telegram.html');
      } else {
        messages = parseTelegramJson(pasteText, 'pasted-telegram.json');
      }
      addPastedText(pasteText, 'telegram', messages);
      setPasteText('');
      addToast({ title: 'Success', message: 'Telegram export parsed successfully', type: 'success' });
    } catch (error: any) {
      addToast({ title: 'Error', message: error?.message || 'Failed to parse text as Telegram export', type: 'error' });
    }
  };

  const hasCompletedFiles = telegramFiles.some((f) => f.status === 'completed' || f.status === 'ready');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram Export"
        description="Upload Telegram Desktop exports (.json, .html). To export, go to Settings > Advanced > Export Telegram Data in Telegram Desktop."
        backTo="/upload"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Upload Files</h3>
            <DropZone
              onDrop={handleFilesDrop}
              accept={{ 'application/json': ['.json'], 'text/html': ['.html', '.htm'] }}
              maxSizeMB={100}
              title="Drop Telegram exports here"
            />
          </Card>

          <Card>
            <h3 className="text-lg font-medium mb-4">Or Paste Text</h3>
            <textarea
              className={cn(
                'w-full h-32 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent font-mono',
                isDarkMode ? 'bg-dark-panel border-dark-border text-dark-text' : 'bg-light-card border-light-border text-light-text'
              )}
              placeholder="Paste JSON or HTML export content here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handleAddText} disabled={!pasteText.trim()}>
                Add Text
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Uploaded Files</h3>
              {pendingFiles.length > 0 && (
                <Button onClick={handleProcessFiles} disabled={isProcessing} size="sm">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Process {pendingFiles.length} File{pendingFiles.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {telegramFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary py-12">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No files uploaded yet</p>
                </div>
              ) : (
                <FileList files={telegramFiles} onRemove={removeFile} />
              )}
            </div>

            {hasCompletedFiles && (
              <div className="mt-6 pt-4 border-t border-border">
                <Button className="w-full" onClick={() => navigate('/analysis')}>
                  Analyze All Processed Data
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
