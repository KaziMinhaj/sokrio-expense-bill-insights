// FileUpload component with drag-and-drop
import { useCallback, useRef, useState } from 'react';
import type { ParseProgress } from '../hooks/useParseWorker';

interface Props {
  onFile: (file: File) => void;
  parsing: boolean;
  progress: ParseProgress | null;
  error: string | null;
  onAbort: () => void;
}

export function FileUpload({ onFile, parsing, progress, error, onAbort }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    onFile(file);
  }, [onFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !parsing && inputRef.current?.click()}
        className={[
          'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all cursor-pointer',
          dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
          parsing ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
        <div className="text-4xl mb-3">📊</div>
        <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
          Drop Allowance Report here
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          or click to browse · .xlsx / .xls
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          Multiple months are split automatically
        </p>
      </div>

      {parsing && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{progress.message}</span>
            <button
              onClick={onAbort}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 underline"
            >
              Cancel
            </button>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
