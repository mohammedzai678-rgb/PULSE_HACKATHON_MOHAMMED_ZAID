import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, FileImage } from 'lucide-react';
import { generateId, cn } from '@/lib/utils';
import { useImportStore, useToastStore, useThemeStore } from '@/lib/store';
import type { NormalizedMessage } from '@/types';
import { Button, Card, PageHeader, DropZone, FileList } from '@/components/ui';
import { performOCR } from '@/lib/parsers/ocr';

export default function ImagesUpload() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const isDarkMode = theme === 'dark';
  const addToast = useToastStore((state) => state.addToast);
  const { files, addFiles, updateFileStatus, addPastedText, removeFile, getPendingFiles } = useImportStore();

  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const imageFiles = files.filter((f) => f.sourceType === 'image' || (f.source as any) === 'images' || (f.source as any) === 'image');
  const pendingFiles = getPendingFiles().filter((f) => f.sourceType === 'image' || (f.source as any) === 'images' || (f.source as any) === 'image');

  const handleFilesDrop = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles, 'image');
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
        const ocrResult = await performOCR(batch.file);
        const messages: NormalizedMessage[] = [
          {
            id: generateId(),
            sourceType: 'image',
            sourceFilename: batch.file.name,
            sourceIdentifier: `${batch.file.name}#ocr`,
            originalText: ocrResult.text.trim(),
            timestamp: new Date(),
            sender: 'OCR System',
            messageIndex: 1,
            ocrConfidence: ocrResult.confidence,
          },
        ];
        updateFileStatus(batch.id, 'completed', messages);
        successCount++;
      } catch (error) {
        updateFileStatus(batch.id, 'error', [], error instanceof Error ? error.message : 'Unknown OCR error');
        errorCount++;
      }
    }

    setIsProcessing(false);
    if (successCount > 0) {
      addToast({ title: 'Success', message: `Processed ${successCount} image${successCount === 1 ? '' : 's'} via OCR`, type: 'success' });
    }
    if (errorCount > 0) {
      addToast({ title: 'Error', message: `Failed to process ${errorCount} image${errorCount === 1 ? '' : 's'}`, type: 'error' });
    }
  };

  const handleAddText = async () => {
    if (!pasteText.trim()) return;
    try {
      addPastedText(pasteText, 'image', [
        {
          id: generateId(),
          sourceType: 'image',
          sourceFilename: 'Pasted Image Notes',
          sourceIdentifier: `pasted-image#${Date.now()}`,
          originalText: pasteText,
          timestamp: new Date(),
          sender: 'User Notes',
          messageIndex: 1,
        },
      ]);
      setPasteText('');
      addToast({ title: 'Success', message: 'Raw text notes added successfully', type: 'success' });
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to add text notes', type: 'error' });
    }
  };

  const hasCompletedFiles = imageFiles.some((f) => f.status === 'completed' || f.status === 'ready');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Image Text Extraction (OCR) & Notes"
        description="Upload screenshots, whiteboard photos, circular snapshots, and add raw text notes together."
        backTo="/upload"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Upload Images</h3>
            <DropZone
              onDrop={handleFilesDrop}
              accept={{
                'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'],
              }}
              maxSizeMB={50}
              icon={<FileImage size={24} />}
              title="Drop images here for OCR"
            />
          </Card>

          <Card>
            <h3 className="text-lg font-medium mb-4">Or Paste Accompanying Raw Text</h3>
            <textarea
              className={cn(
                'w-full h-32 p-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent',
                isDarkMode ? 'bg-dark-panel border-dark-border text-dark-text' : 'bg-light-card border-light-border text-light-text'
              )}
              placeholder="Paste any context or raw text related to the images..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handleAddText} disabled={!pasteText.trim()}>
                Add Raw Text
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Uploaded Images & Items</h3>
              {pendingFiles.length > 0 && (
                <Button onClick={handleProcessFiles} disabled={isProcessing} size="sm">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Process {pendingFiles.length} Image{pendingFiles.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {imageFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-secondary py-12">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No images uploaded yet</p>
                </div>
              ) : (
                <FileList files={imageFiles} onRemove={removeFile} />
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
