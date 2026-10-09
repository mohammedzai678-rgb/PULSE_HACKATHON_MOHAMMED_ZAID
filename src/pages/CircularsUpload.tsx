import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { useThemeStore, useImportStore, useToastStore } from '@/lib/store';
import type { NormalizedMessage } from '@/types';
import { Button, Card, PageHeader, DropZone, FileList } from '@/components/ui';
import { parseFile, performOCR } from '@/lib/parsers';

export default function CircularsUpload() {
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const isDarkMode = theme === 'dark';
  const addToast = useToastStore((state) => state.addToast);
  const { files, addFiles, updateFileStatus, addPastedText, removeFile, getPendingFiles } = useImportStore();

  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const circularFiles = files.filter((f) => f.sourceType === 'circular' || (f.source as any) === 'circular' || (f.source as any) === 'circulars');
  const pendingFiles = getPendingFiles().filter((f) => f.sourceType === 'circular' || (f.source as any) === 'circular' || (f.source as any) === 'circulars');

  const handleFilesDrop = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles, 'circular');
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
        if (batch.file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(batch.file.name)) {
          const ocr = await performOCR(batch.file);
          messages = [
            {
              id: generateId(),
              sourceType: 'circular',
              sourceFilename: batch.file.name,
              sourceIdentifier: `${batch.file.name}#ocr`,
              originalText: ocr.text,
              timestamp: new Date(),
              sender: 'Circular Notice',
              messageIndex: 1,
              ocrConfidence: ocr.confidence,
            },
          ];
        } else {
          messages = await parseFile(batch.file, 'circular');
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
      addToast({ title: 'Success', message: `Processed ${successCount} circular${successCount === 1 ? '' : 's'}`, type: 'success' });
    }
    if (errorCount > 0) {
      addToast({ title: 'Error', message: `Failed to process ${errorCount} file${errorCount === 1 ? '' : 's'}`, type: 'error' });
    }
  };

  const handleAddText = async () => {
    if (!pasteText.trim()) return;
    try {
      addPastedText(pasteText, 'circular', [
        {
          id: generateId(),
          sourceType: 'circular',
          sourceFilename: 'Pasted circular',
          sourceIdentifier: `circular#${Date.now()}`,
          originalText: pasteText,
          timestamp: new Date(),
          sender: 'Notice Board',
          messageIndex: 1,
        },
      ]);
      setPasteText('');
      addToast({ title: 'Success', message: 'Circular text added successfully', type: 'success' });
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to add circular text', type: 'error' });
    }
  };

  const hasCompletedFiles = circularFiles.some((f) => f.status === 'completed' || f.status === 'ready');

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Circulars & Notices"
        description="Upload official notices, exam timetables, fee notices, and bulletins (.pdf, images, .txt). Images will be extracted via local OCR."
        backTo="/upload"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Upload Notices</h3>
            <DropZone
              onDrop={handleFilesDrop}
              accept={{
                'application/pdf': ['.pdf'],
                'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                'text/plain': ['.txt'],
              }}
              maxSizeMB={50}
              title="Drop circulars and notices here"
            />
          </Card>

          <Card>
            <h3 className="text-lg font-medium mb-4">Or Paste Notice Text</h3>
            <textarea
              className={cn(
                'w-full h-32 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent',
                isDarkMode ? 'bg-dark-panel border-dark-border text-dark-text' : 'bg-light-card border-light-border text-light-text'
              )}
              placeholder="Paste announcement text or official memo here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handleAddText} disabled={!pasteText.trim()}>
                Add Notice
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
              {circularFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary py-12">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No circulars uploaded yet</p>
                </div>
              ) : (
                <FileList files={circularFiles} onRemove={removeFile} />
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
