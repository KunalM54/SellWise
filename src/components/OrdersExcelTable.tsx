import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  UploadCloud, 
  Copy, 
  Check, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Trash2,
  Database
} from 'lucide-react';
import { ImportedOrderFile, RawOrderRecord } from '../types';
import { parseMarketplaceReport } from '../utils/parser';

interface OrdersExcelTableProps {
  orderFile: ImportedOrderFile | null;
  onFileLoaded: (file: ImportedOrderFile) => void;
  onClearFile: () => void;
}

export const OrdersExcelTable: React.FC<OrdersExcelTableProps> = ({
  orderFile,
  onFileLoaded,
  onClearFile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const headers = orderFile?.headers || [];
  const rows = orderFile?.rows || [];

  // Helper to find header key case-insensitively
  const findHeaderKey = (keywords: string[]): string => {
    return headers.find(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase()))) || '';
  };

  const statusKey = findHeaderKey(['reason for credit entry', 'status', 'live order status']);
  const subOrderKey = findHeaderKey(['sub order no', 'sub-order no', 'suborder number', 'order id']);
  const catalogKey = findHeaderKey(['catalog id', 'catalog']);
  const dateKey = findHeaderKey(['order date', 'date']);
  const sourceKey = findHeaderKey(['order source', 'source']);
  const stateKey = findHeaderKey(['customer state', 'state']);
  const nameKey = findHeaderKey(['product name', 'title', 'item description']);
  const skuKey = findHeaderKey(['sku', 'supplier sku']);
  const sizeKey = findHeaderKey(['size']);
  const qtyKey = findHeaderKey(['quantity', 'qty']);
  const listedPriceKey = findHeaderKey(['supplier listed price', 'listed price']);
  const discPriceKey = findHeaderKey(['supplier discounted price', 'discounted price', 'discount price']);
  const packetKey = findHeaderKey(['packet id', 'packet']);

  // Extract distinct states and sources for filters
  const distinctStates = useMemo(() => {
    if (!stateKey || rows.length === 0) return [];
    const set = new Set<string>();
    rows.forEach(r => {
      const val = r[stateKey];
      if (val && val.trim()) set.add(val.trim());
    });
    return Array.from(set).sort();
  }, [rows, stateKey]);

  const distinctSources = useMemo(() => {
    if (!sourceKey || rows.length === 0) return [];
    const set = new Set<string>();
    rows.forEach(r => {
      const val = r[sourceKey];
      if (val && val.trim()) set.add(val.trim());
    });
    return Array.from(set).sort();
  }, [rows, sourceKey]);

  // Status counts for quick filters
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: rows.length };
    if (!statusKey) return counts;
    rows.forEach(r => {
      const st = (r[statusKey] || 'UNKNOWN').trim().toUpperCase();
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [rows, statusKey]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalListed = 0;
    let totalDiscounted = 0;

    rows.forEach(r => {
      if (qtyKey && r[qtyKey]) {
        const q = Number(r[qtyKey].replace(/[^0-9]/g, '')) || 0;
        totalQty += q;
      }
      if (listedPriceKey && r[listedPriceKey]) {
        const lp = Number(r[listedPriceKey].replace(/[^0-9.-]/g, '')) || 0;
        totalListed += lp;
      }
      if (discPriceKey && r[discPriceKey]) {
        const dp = Number(r[discPriceKey].replace(/[^0-9.-]/g, '')) || 0;
        totalDiscounted += dp;
      }
    });

    return {
      totalQty: totalQty || rows.length,
      totalListed: Math.round(totalListed * 100) / 100,
      totalDiscounted: Math.round(totalDiscounted * 100) / 100,
    };
  }, [rows, qtyKey, listedPriceKey, discPriceKey]);

  // Filtering
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Status filter
    if (selectedStatus !== 'ALL' && statusKey) {
      result = result.filter(r => (r[statusKey] || '').trim().toUpperCase() === selectedStatus);
    }

    // State filter
    if (selectedState !== 'ALL' && stateKey) {
      result = result.filter(r => (r[stateKey] || '').trim() === selectedState);
    }

    // Source filter
    if (selectedSource !== 'ALL' && sourceKey) {
      result = result.filter(r => (r[sourceKey] || '').trim() === selectedSource);
    }

    // Search filter across all columns
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(r => {
        return Object.values(r).some(val => val && val.toLowerCase().includes(q));
      });
    }

    // Sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const valA = (a[sortColumn] || '').trim();
        const valB = (b[sortColumn] || '').trim();

        // Check if numeric
        const numA = Number(valA.replace(/[^0-9.-]/g, ''));
        const numB = Number(valB.replace(/[^0-9.-]/g, ''));

        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '' && !valA.includes('_') && !valB.includes('_')) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      });
    }

    return result;
  }, [rows, selectedStatus, selectedState, selectedSource, searchTerm, sortColumn, sortDirection, statusKey, stateKey, sourceKey]);

  // Pagination calculation
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn('');
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCell(id);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const handleProcessFile = async (file: File) => {
    try {
      const result = await parseMarketplaceReport(file);
      if (result.rawFile && result.rawFile.rows.length > 0) {
        onFileLoaded(result.rawFile);
        return;
      }

      // Fallback direct CSV parsing
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        const parseLine = (line: string): string[] => {
          const res: string[] = [];
          let curr = '';
          let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
              if (inQ && line[i + 1] === '"') { curr += '"'; i++; }
              else { inQ = !inQ; }
            } else if (c === ',' && !inQ) {
              res.push(curr.trim());
              curr = '';
            } else {
              curr += c;
            }
          }
          res.push(curr.trim());
          return res;
        };

        const parsedHeaders = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
        const parsedRows: RawOrderRecord[] = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseLine(lines[i]);
          const r: RawOrderRecord = {};
          parsedHeaders.forEach((h, idx) => {
            r[h] = (vals[idx] || '').replace(/^"|"$/g, '').trim();
          });
          parsedRows.push(r);
        }

        onFileLoaded({
          fileName: file.name,
          headers: parsedHeaders,
          rows: parsedRows,
          totalRows: parsedRows.length,
          uploadedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('File parsing error:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleExportCsv = () => {
    if (!orderFile || rows.length === 0) return;

    const csvRows: string[] = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    rows.forEach(r => {
      const values = headers.map(h => {
        const val = r[h] !== undefined && r[h] !== null ? String(r[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', orderFile.fileName || `Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    const s = (status || '').trim().toUpperCase();
    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';

    if (s.includes('DELIVERED')) {
      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
    } else if (s.includes('SHIPPED')) {
      badgeClass = 'bg-sky-50 text-sky-700 border-sky-300 font-bold';
    } else if (s.includes('RTO')) {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-300 font-bold';
    } else if (s.includes('READY_TO_SHIP') || s.includes('READY TO SHIP')) {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-300 font-bold';
    } else if (s.includes('PENDING')) {
      badgeClass = 'bg-purple-50 text-purple-700 border-purple-300 font-bold';
    } else if (s.includes('HOLD')) {
      badgeClass = 'bg-orange-50 text-orange-700 border-orange-300 font-bold';
    } else if (s.includes('CANCEL')) {
      badgeClass = 'bg-slate-100 text-slate-600 border-slate-300 line-through';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border whitespace-nowrap ${badgeClass}`}>
        {status}
      </span>
    );
  };

  // Split header into 2 rows when it has parentheses or is long, so columns don't stretch unnecessarily
  const renderHeaderContent = (h: string) => {
    // 1. Parenthesized subtitle, e.g. "Supplier Listed Price (Incl. GST + Commission)"
    const parenIndex = h.indexOf('(');
    if (parenIndex > 0) {
      const main = h.slice(0, parenIndex).trim();
      const sub = h.slice(parenIndex).trim();
      return (
        <div className="flex flex-col text-left leading-tight py-0.5">
          <span className="font-bold text-ink whitespace-normal text-[11px]">{main}</span>
          <span className="text-[10px] text-ink-muted font-normal whitespace-normal mt-0.5">{sub}</span>
        </div>
      );
    }

    // 2. Long multi-word header (e.g. "Reason for Credit Entry")
    const words = h.split(' ');
    if (words.length >= 3 && h.length > 16) {
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(' ');
      const line2 = words.slice(mid).join(' ');
      return (
        <div className="flex flex-col text-left leading-tight py-0.5">
          <span className="font-bold text-ink whitespace-normal text-[11px]">{line1}</span>
          <span className="text-[10px] text-ink-muted font-normal whitespace-normal mt-0.5">{line2}</span>
        </div>
      );
    }

    return <span className="whitespace-normal leading-tight text-[11px]">{h}</span>;
  };

  return (
    <div className="space-y-6 w-full animate-fadeIn select-text">
      
      {/* 1. Header Toolbar directly on canvas without redundant title/description */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline">
        <div className="flex items-center gap-2 flex-wrap">
          {orderFile && (
            <>
              <span className="px-2.5 py-1 rounded-full bg-sky-soft text-sky-deep text-xs font-mono font-bold border border-sky/30">
                {orderFile.totalRows} Orders Imported
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-medium border border-emerald-200" title="Data stored in IndexedDB browser database; persists across page reloads.">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saved locally</span>
              </span>
            </>
          )}
          <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200 uppercase tracking-wide">
            Meesho Channel
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                await handleProcessFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-sky text-white hover:bg-sky-deep shadow-xs transition-all active:scale-95"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import Orders File</span>
          </button>

          {/* Export to CSV */}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-surface border border-outline hover:border-emerald-500 hover:text-emerald-700 transition-all text-ink shadow-xs"
              title="Download entire dataset as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          )}

          {/* Clear */}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={onClearFile}
              className="p-1.5 rounded-xl border border-outline hover:border-coral hover:text-coral transition-colors text-ink-muted"
              title="Clear imported file"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Flat Summary Stats Ribbon (Direct on canvas, no boxy card wrapper) */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-sunken border border-outline">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Total Orders</div>
            <div className="text-lg font-bold font-mono text-ink mt-0.5">{rows.length}</div>
          </div>
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-sunken border border-outline">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Total Quantity</div>
            <div className="text-lg font-bold font-mono text-ink mt-0.5">{totals.totalQty} Units</div>
          </div>
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-sunken border border-outline">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Total Listed Value</div>
            <div className="text-lg font-bold font-mono text-ink mt-0.5">₹{totals.totalListed.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</div>
          </div>
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-sunken border border-outline">
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Total Discounted Value</div>
            <div className="text-lg font-bold font-mono text-ink mt-0.5">₹{totals.totalDiscounted.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</div>
          </div>
        </div>
      )}

      {/* 3. Interactive Filter Strip & Quick Status Pills */}
      {rows.length > 0 && (
        <div className="space-y-3">
          {/* Status Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-ink-muted mr-1">Status:</span>
            {Object.entries(statusCounts).map(([st, count]) => {
              const active = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(st);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                    active
                      ? 'bg-sky text-white font-bold shadow-xs'
                      : 'bg-surface-sunken text-ink hover:bg-sky-soft/40 border border-outline'
                  }`}
                >
                  <span>{st}</span>
                  <span className={`ml-1.5 px-1 py-0.2 rounded-full text-[10px] ${active ? 'bg-white/30 text-white' : 'bg-surface text-ink-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, State, Source Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by Sub Order, SKU, Product, State, Packet Id..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface-sunken border border-outline rounded-xl text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-sky"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* State Filter */}
              {distinctStates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-ink-muted">State:</span>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs bg-surface-sunken border border-outline rounded-xl px-2.5 py-1.5 text-ink focus:outline-none focus:border-sky font-medium"
                  >
                    <option value="ALL">All States ({distinctStates.length})</option>
                    {distinctStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Source Filter */}
              {distinctSources.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-ink-muted">Source:</span>
                  <select
                    value={selectedSource}
                    onChange={(e) => {
                      setSelectedSource(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs bg-surface-sunken border border-outline rounded-xl px-2.5 py-1.5 text-ink focus:outline-none focus:border-sky font-medium"
                  >
                    <option value="ALL">All Sources</option>
                    {distinctSources.map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset Filters */}
              {(selectedStatus !== 'ALL' || selectedState !== 'ALL' || selectedSource !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('ALL');
                    setSelectedState('ALL');
                    setSelectedSource('ALL');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs text-coral hover:bg-coral-soft rounded-lg font-bold transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Excel Table View */}
      {rows.length === 0 ? (
        /* Empty State / Drop Area directly on canvas */
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 my-6 ${
            isDragging 
              ? 'border-sky bg-sky-soft/40 shadow-soft' 
              : 'border-outline hover:border-sky bg-surface-sunken/40 hover:bg-sky-soft/10'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-sky-soft text-sky-deep flex items-center justify-center">
            <UploadCloud className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Choose an Orders file or drag & drop here</h3>
            <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto">
              Drop your Meesho, Flipkart, or Amazon Orders manifest (.csv, .xlsx, .xls) here. All columns and values are imported and displayed directly in full spreadsheet view without any alterations or data loss.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-2 px-4 py-2 rounded-xl bg-sky text-white hover:bg-sky-deep text-xs font-bold shadow-xs flex items-center gap-2 transition-all active:scale-95"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Browse Computer</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          
          {/* Table Container with Excel Grid Look */}
          <div className="w-full overflow-x-auto border border-outline rounded-xl bg-surface-elevated shadow-soft">
            <table className="w-full border-collapse text-left text-xs font-sans">
              
              {/* Table Header */}
              <thead className="bg-surface-sunken border-b border-outline select-none sticky top-0 z-20">
                <tr>
                  {/* Row # */}
                  <th className="py-2.5 px-3 border-r border-outline text-[11px] font-bold text-ink-muted text-center w-12 shrink-0">
                    #
                  </th>

                  {/* Render every header present in the file */}
                  {headers.map((h) => {
                    const isSorted = sortColumn === h;
                    const isPriceCol = h === listedPriceKey || h === discPriceKey;
                    return (
                      <th
                        key={h}
                        onClick={() => handleSort(h)}
                        className={`py-2 px-3 border-r border-outline text-[11px] font-bold text-ink tracking-tight hover:bg-surface transition-colors cursor-pointer align-top ${
                          isPriceCol ? 'w-36 min-w-[125px] max-w-[155px]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          {renderHeaderContent(h)}
                          <span className="text-ink-muted shrink-0 mt-0.5">
                            {isSorted ? (
                              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-sky" /> : <ArrowDown className="w-3 h-3 text-sky" />
                            ) : (
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-outline">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 1} className="py-12 text-center text-xs text-ink-muted">
                      No matching orders found. Try clearing your filters or search term.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, rowIdx) => {
                    const overallIndex = pageSize === 0 ? rowIdx + 1 : (currentPage - 1) * pageSize + rowIdx + 1;
                    return (
                      <tr 
                        key={overallIndex}
                        className="hover:bg-sky-soft/20 transition-colors group"
                      >
                        {/* Row Index # */}
                        <td className="py-2 px-3 border-r border-outline text-center font-mono text-[11px] text-ink-muted bg-surface-sunken/40">
                          {overallIndex}
                        </td>

                        {/* Cell for each column */}
                        {headers.map((h, colIdx) => {
                          const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
                          const isStatusCol = h === statusKey;
                          const isSubOrderCol = h === subOrderKey;
                          const isCatalogCol = h === catalogKey;
                          const isPacketCol = h === packetKey;
                          const isSkuCol = h === skuKey;
                          const isSizeCol = h === sizeKey;
                          const isPriceCol = h === listedPriceKey || h === discPriceKey;
                          const isDateCol = h === dateKey;
                          const isQtyCol = h === qtyKey;
                          const isNameCol = h === nameKey;

                          const cellId = `${overallIndex}-${colIdx}`;
                          const isCopied = copiedCell === cellId;

                          return (
                            <td 
                              key={colIdx} 
                              className={`py-2 px-3 border-r border-outline text-ink text-xs ${
                                isPriceCol ? 'text-right font-mono font-medium w-36 min-w-[125px] max-w-[155px]' : ''
                              } ${isQtyCol ? 'text-center font-mono font-bold' : ''}`}
                            >
                              {/* Status Badge */}
                              {isStatusCol ? (
                                renderStatusBadge(val)
                              ) : isSubOrderCol ? (
                                <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-ink select-all">
                                  <span>{val}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(val, cellId)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-sunken text-ink-muted hover:text-ink"
                                    title="Copy Sub Order No"
                                  >
                                    {isCopied ? <Check className="w-3 h-3 text-leaf-deep" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : isCatalogCol ? (
                                <span className="font-mono text-xs text-ink-muted">{val}</span>
                              ) : isSizeCol ? (
                                <span className="text-xs">{val}</span>
                              ) : isPacketCol ? (
                                val ? (
                                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted select-all">
                                    <span>{val}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(val, cellId)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-sunken text-ink-muted hover:text-ink"
                                      title="Copy Packet ID"
                                    >
                                      {isCopied ? <Check className="w-3 h-3 text-leaf-deep" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-ink-faint text-[11px]">—</span>
                                )
                              ) : isSkuCol ? (
                                <span className="font-mono text-xs font-bold text-sky-deep bg-sky-soft/40 px-1.5 py-0.5 rounded">
                                  {val}
                                </span>
                              ) : isPriceCol ? (
                                val ? `₹${val}` : '—'
                              ) : isDateCol ? (
                                <span className="font-mono text-xs text-ink-muted">{val}</span>
                              ) : isNameCol ? (
                                <div className="max-w-xs truncate text-xs text-ink" title={val}>
                                  {val}
                                </div>
                              ) : (
                                <span>{val !== '' ? val : <span className="text-ink-faint">—</span>}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination & Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to <strong>{Math.min(currentPage * pageSize || filteredRows.length, filteredRows.length)}</strong> of <strong>{filteredRows.length}</strong> orders
                {filteredRows.length !== rows.length && ` (filtered from ${rows.length})`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-surface-sunken border border-outline rounded-lg px-2 py-1 text-xs text-ink font-mono font-medium focus:outline-none focus:border-sky"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All ({filteredRows.length})</option>
                </select>
              </div>

              {/* Prev / Next Page Buttons */}
              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-outline hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                  >
                    Prev
                  </button>

                  <span className="font-mono text-xs px-2 text-ink">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-outline hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
