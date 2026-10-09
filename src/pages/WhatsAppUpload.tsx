import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, useImportStore, useToastStore } from '@/lib/store';
import type { NormalizedMessage } from '@/types';
import { Button, Card, PageHeader, DropZone, FileList } from '@/components/ui';
import { parseFile, parseWhatsAppChat } from '@/lib/parsers';

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
        if (batch.file.name.endsWith('.zip')) {
          messages = await parseFile(batch.file, 'whatsapp');
        } else {
          const text = await batch.file.text();
          messages = parseWhatsAppChat(text, batch.file.name);
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
      addToast({ title: 'Success', message: `Processed ${successCount} WhatsApp file${successCount === 1 ? '' : 's'}`, type: 'success' });
    }
    if (errorCount > 0) {
      addToast({ title: 'Error', message: `Failed to process ${errorCount} file${errorCount === 1 ? '' : 's'}`, type: 'error' });
    }
  };

  const handleAddText = async () => {
    if (!pasteText.trim()) return;
    try {
      const messages = parseWhatsAppChat(pasteText, 'Pasted WhatsApp Chat.txt');
      addPastedText(pasteText, 'whatsapp', messages);
      setPasteText('');
      addToast({ title: 'Success', message: 'Chat text parsed successfully', type: 'success' });
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to parse chat text', type: 'error' });
    }
  };

  const hasCompletedFiles = whatsappFiles.some((f) => f.status === 'completed' || f.status === 'ready');

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Chat Export"
        description="Upload exported WhatsApp chat files (.txt, .zip) or paste chat text directly."
        backTo="/upload"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Upload Files</h3>
            <DropZone
              onDrop={handleFilesDrop}
              accept={{ 'text/plain': ['.txt'], 'application/zip': ['.zip'] }}
              maxSizeMB={50}
              title="Drop WhatsApp exports here"
            />
          </Card>

          <Card>
            <h3 className="text-lg font-medium mb-4">Or Paste Text</h3>
            <textarea
              className={cn(
                'w-full h-32 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent',
                isDarkMode ? 'bg-dark-panel border-dark-border text-dark-text' : 'bg-light-card border-light-border text-light-text'
              )}
              placeholder="[10/09/26, 10:15:23 AM] Prof. Kumar: Submit project by Oct 12..."
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
              {whatsappFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary py-12">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No files uploaded yet</p>
                </div>
              ) : (
                <FileList files={whatsappFiles} onRemove={removeFile} />
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
