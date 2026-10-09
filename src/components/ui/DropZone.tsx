import { useCallback, useState, type DragEvent, type ReactNode } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { cn, formatFileSize, isValidFileType } from '@/lib/utils';
import { useThemeStore, useToastStore } from '@/lib/store';

export interface DropZoneProps {
  acceptedTypes?: string[];
  acceptedExtensions?: string[];
  accept?: Record<string, string[]> | string;
  maxSizeMB?: number;
  maxSize?: number; // bytes
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  onDrop?: (files: File[]) => void;
  title?: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function DropZone({
  acceptedTypes = [],
  acceptedExtensions = [],
  accept,
  maxSizeMB,
  maxSize,
  multiple = true,
  onFiles,
  onDrop,
  title = 'Drop files here or click to browse',
  description,
  icon,
  children,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const theme = useThemeStore((s) => s.theme);
  const addToast = useToastStore((s) => s.addToast);
  const isDark = theme === 'dark';

  // Compute max size in bytes
  const limitBytes = maxSize ?? (maxSizeMB ? maxSizeMB * 1024 * 1024 : 50 * 1024 * 1024);
  const limitMB = Math.round(limitBytes / (1024 * 1024));

  // Compute accept patterns
  const patterns: string[] = [...acceptedTypes, ...acceptedExtensions];
  if (accept) {
    if (typeof accept === 'string') {
      patterns.push(...accept.split(',').map((s) => s.trim()));
    } else if (typeof accept === 'object') {
      for (const [mime, exts] of Object.entries(accept)) {
        patterns.push(mime);
        if (Array.isArray(exts)) {
          patterns.push(...exts);
        }
      }
    }
  }

  const handleDispatchFiles = useCallback((validFiles: File[]) => {
    if (onFiles) onFiles(validFiles);
    if (onDrop) onDrop(validFiles);
  }, [onFiles, onDrop]);

  const validateAndAdd = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const valid: File[] = [];
    const newErrors: string[] = [];

    files.forEach((file) => {
      if (patterns.length > 0 && !isValidFileType(file, patterns)) {
        newErrors.push(`"${file.name}" is not a supported file type.`);
        return;
      }
      if (file.size > limitBytes) {
        newErrors.push(`"${file.name}" exceeds the ${limitMB}MB limit (${formatFileSize(file.size)})`);
        return;
      }
      valid.push(file);
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      newErrors.forEach((e) => addToast({ message: e, type: 'error' }));
    } else {
      setErrors([]);
    }

    if (valid.length > 0) {
      handleDispatchFiles(valid);
    }
  }, [patterns, limitBytes, limitMB, handleDispatchFiles, addToast]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAdd(e.dataTransfer.files);
    }
  }, [validateAndAdd]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAdd(e.target.files);
      e.target.value = '';
    }
  }, [validateAndAdd]);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        className={cn(
          'drop-zone relative cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all',
          isDark
            ? 'border-dark-border hover:border-dark-accent/60 bg-dark-panel/40'
            : 'border-light-border hover:border-light-accent/60 bg-light-card/40',
          isDragging && (isDark ? 'border-dark-accent bg-dark-accent/10' : 'border-light-accent bg-light-accent/10')
        )}
      >
        <input
          type="file"
          onChange={handleFileInput}
          accept={patterns.length > 0 ? patterns.join(',') : undefined}
          multiple={multiple}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          aria-label={description || title}
        />
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-transform',
            isDark ? 'bg-dark-accent/10 text-dark-accent' : 'bg-light-accent/10 text-light-accent'
          )}>
            {icon ?? <Upload size={24} />}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {title}
            </p>
            {description && (
              <p className={cn('text-xs mt-1', isDark ? 'text-dark-secondary' : 'text-light-secondary')}>
                {description}
              </p>
            )}
          </div>
          <p className={cn('text-xs', isDark ? 'text-dark-secondary/60' : 'text-light-secondary/60')}>
            Max {limitMB}MB per file
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={14} />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

export default DropZone;
