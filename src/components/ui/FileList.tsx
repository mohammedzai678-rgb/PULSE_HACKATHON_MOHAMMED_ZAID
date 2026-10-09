import React from 'react';
import { FileText, FileArchive, FileImage, AlertCircle, CheckCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { useThemeStore } from '@/lib/store';

export interface FileListItem {
  id: string;
  name?: string;
  label?: string;
  size?: number;
  status: 'pending' | 'processing' | 'completed' | 'ready' | 'error';
  error?: string;
  messages?: any[];
}

interface FileListProps {
  files: FileListItem[];
  onRemove: (id: string) => void;
}

export function FileList({ files, onRemove }: FileListProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  if (!files || files.length === 0) return null;

  const getFileIcon = (fileName: string = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return <FileArchive className="w-5 h-5 text-amber-500 shrink-0" />;
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext || '')) {
      return <FileImage className="w-5 h-5 text-blue-500 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-emerald-500 shrink-0" />;
  };

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const displayName = file.name || file.label || 'Unnamed file';
        const isDone = file.status === 'completed' || file.status === 'ready';
        const isProcessing = file.status === 'processing';
        const isError = file.status === 'error';
        const msgCount = file.messages?.length ?? 0;

        return (
          <div
            key={file.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border text-sm transition-colors',
              isDark ? 'bg-dark-panel/60 border-dark-border' : 'bg-light-card border-light-border shadow-xs'
            )}
          >
            <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
              {getFileIcon(displayName)}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-current" title={displayName}>
                  {displayName}
                </p>
                <div className="flex items-center gap-2 text-xs text-secondary mt-0.5">
                  {file.size !== undefined && <span>{formatFileSize(file.size)}</span>}
                  {file.size !== undefined && <span>•</span>}

                  {isProcessing && (
                    <span className="flex items-center text-accent gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </span>
                  )}
                  {isDone && (
                    <span className="flex items-center text-emerald-500 gap-1 font-medium">
                      <CheckCircle className="w-3 h-3" /> {msgCount} {msgCount === 1 ? 'message' : 'messages'}
                    </span>
                  )}
                  {isError && (
                    <span className="flex items-center text-red-400 gap-1 truncate max-w-xs" title={file.error}>
                      <AlertCircle className="w-3 h-3 shrink-0" /> {file.error || 'Failed'}
                    </span>
                  )}
                  {file.status === 'pending' && (
                    <span className="flex items-center text-secondary gap-1">
                      <Clock className="w-3 h-3" /> Ready to process
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => onRemove(file.id)}
              disabled={isProcessing}
              className={cn(
                'p-1.5 rounded-md text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:pointer-events-none'
              )}
              title="Remove file"
              aria-label={`Remove ${displayName}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default FileList;
