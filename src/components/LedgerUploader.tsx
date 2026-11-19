import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { LedgerFileMeta, LedgerFileKind } from '../types/ledger';

interface LedgerUploaderProps {
  files: LedgerFileMeta[];
  isParsing: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

const KIND_LABEL: Record<LedgerFileKind, string> = {
  orders: 'Orders',
  returns: 'Returns / RTO',
  payment: 'Payments',
  unknown: 'Unrecognised',
};

const KIND_STYLE: Record<LedgerFileKind, string> = {
  orders: 'bg-sky-soft text-sky-deep border-sky/30',
  returns: 'bg-sun-soft text-sun-deep border-sun/30',
  payment: 'bg-leaf-soft text-leaf-deep border-leaf/30',
  unknown: 'bg-coral-soft text-coral border-coral/30',
};

export const LedgerUploader: React.FC<LedgerUploaderProps> = ({
  files,
  isParsing,
  onUpload,
  onRemove,
  onClearAll,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onUpload(Array.from(list));
  };

  return (
    <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
      <div className="p-5 border-b border-outline flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold font-display text-ink">Meesho files</h2>
          <p className="text-[11px] text-ink-muted">
            Add the orders CSV, the returns CSV and the payment XLSX. Re-uploading a file refreshes only that file's
            data.
          </p>
        </div>
        {files.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] font-bold text-coral hover:text-coral-deep px-2.5 py-1.5 rounded-lg hover:bg-coral-soft transition-all"
          >
            Clear all data
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-sky bg-sky-soft/40'
              : 'border-outline-strong bg-surface-sunken/40 hover:border-sky hover:bg-sky-soft/20'
          }`}
        >
          {isParsing ? (
            <Loader2 className="w-7 h-7 text-sky animate-spin" />
          ) : (
            <UploadCloud className="w-7 h-7 text-sky" />
          )}
          <p className="text-xs font-bold text-ink">
            {isParsing ? 'Reading files…' : 'Drop Meesho files here, or click to browse'}
          </p>
          <p className="text-[11px] text-ink-muted">
            .csv orders · .csv returns / RTO tracking · .xlsx payment file
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="divide-y divide-outline rounded-xl border border-outline overflow-hidden">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-elevated">
                <FileSpreadsheet className="w-4 h-4 text-ink-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-[10px] text-ink-muted">
                    {file.rowCount} rows · {file.eventCount} ledger entries ·{' '}
                    {new Date(file.uploadedAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${KIND_STYLE[file.kind]}`}
                >
                  {KIND_LABEL[file.kind]}
                </span>
                {file.kind === 'unknown' && (
                  <span title="This file was not recognised" className="shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-coral" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-coral hover:bg-coral-soft transition-all shrink-0"
                  title="Remove this file's data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
