import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { parseMarketplaceReport, ParseResult } from '../utils/parser';
import { OrderItem, SkuMasterItem } from '../types';

interface FileUploaderProps {
  onOrdersImported: (orders: OrderItem[]) => void;
  skuMasterList: SkuMasterItem[];
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onOrdersImported, skuMasterList }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [manualMarketplaceOverride, setManualMarketplaceOverride] = useState<'auto' | 'meesho' | 'flipkart' | 'amazon'>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setSelectedFileName(file.name);
    setIsProcessing(true);
    setParseResult(null);

    const result = await parseMarketplaceReport(file, skuMasterList);
    
    // If user explicitly picked an override
    if (manualMarketplaceOverride !== 'auto' && result.orders.length > 0) {
      result.orders = result.orders.map(o => ({ ...o, marketplace: manualMarketplaceOverride }));
      result.recognizedMarketplace = manualMarketplaceOverride;
    }

    setIsProcessing(false);
    setParseResult(result);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyImport = () => {
    if (parseResult && parseResult.orders.length > 0) {
      onOrdersImported(parseResult.orders);
      setParseResult(null);
      setSelectedFileName('');
    }
  };

  return (
    <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold font-display text-ink">Import Marketplace Reports</h3>
          <p className="text-xs text-ink-muted">
            Drag and drop settlement or order sheets from <strong>Meesho, Flipkart, or Amazon</strong> (.xlsx, .xls, .csv).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-ink-muted">Channel Detection:</label>
          <select
            value={manualMarketplaceOverride}
            onChange={(e) => setManualMarketplaceOverride(e.target.value as any)}
            className="text-xs font-bold bg-surface-sunken border border-outline rounded-xl px-2.5 py-1.5 text-ink focus:outline-none focus:border-sky"
          >
            <option value="auto">⚡ Auto-Detect</option>
            <option value="meesho">Meesho</option>
            <option value="flipkart">Flipkart</option>
            <option value="amazon">Amazon</option>
          </select>
        </div>
      </div>

      {/* Sunken Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed transition-all p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 ${
          isDragging
            ? 'border-sky bg-sky-soft/40 scale-[1.005]'
            : 'border-outline-strong/40 bg-surface-sunken hover:border-sky hover:bg-sky-soft/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="w-14 h-14 rounded-2xl bg-sky-soft text-sky-deep flex items-center justify-center">
          <UploadCloud className="w-7 h-7 stroke-[2.2]" />
        </div>

        <div>
          <p className="text-base font-bold text-ink">
            {selectedFileName ? selectedFileName : 'Choose a file or drag & drop it here'}
          </p>
          <p className="text-xs text-ink-muted mt-1 max-w-lg">
            Supports Meesho Payment Dashboard Excel (.xlsx with <em>Order Payments</em> tab), Flipkart Settlement MTR, and Amazon Flat Files.
          </p>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs font-bold text-sky-deep animate-pulse mt-2">
            <FileSpreadsheet className="w-4 h-4" /> Analyzing headers & mapping column structures...
          </div>
        )}
      </div>

      {/* Parsing Summary Banner */}
      {parseResult && (
        <div className="p-4 rounded-2xl border transition-all animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-sunken border-outline">
          {parseResult.error ? (
            <div className="flex items-center gap-2 text-coral text-sm font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{parseResult.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-leaf-soft text-leaf-deep flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink">
                    Successfully mapped {parseResult.orders.length} orders
                  </h4>
                  <p className="text-xs text-ink-muted">
                    Channel identified: <strong className="text-sky-deep uppercase">{parseResult.recognizedMarketplace}</strong>
                    {skuMasterList.length > 0 && (
                      <span className="ml-2 text-leaf-deep font-medium">
                        • Linked with {skuMasterList.length} Master SKUs for exact COGS
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={handleApplyImport}
                className="flex items-center gap-2 bg-leaf-deep text-white px-5 py-2.5 rounded-button text-sm font-bold shadow-soft hover:bg-leaf transition-all active:scale-95"
              >
                <span>Import to Ledger</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
