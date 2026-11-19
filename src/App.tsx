import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { LedgerUploader } from './components/LedgerUploader';
import { LedgerDashboard } from './components/LedgerDashboard';
import { LedgerOrdersTable } from './components/LedgerOrdersTable';
import { SkuManager, DetectedSku } from './components/SkuManager';
import { SkuMasterItem } from './types';
import { LedgerEvent, LedgerFileMeta, LedgerItem } from './types/ledger';
import { buildLedger, dedupeEvents } from './utils/ledger';
import { parseMeeshoFile } from './utils/meesho';
import {
  clearLedgerState,
  loadLedgerState,
  loadSkuMaster,
  saveLedgerEvents,
  saveLedgerFiles,
  saveSkuMaster,
} from './utils/storage';

const TAB_TITLES: Record<TabType, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Profit Dashboard',
    subtitle: 'Meesho orders, fees, returns and profit in one place',
  },
  orders: {
    title: 'Order Ledger',
    subtitle: 'Every sub-order, its status and its settlement state',
  },
  'sku-manager': {
    title: 'SKU Costs',
    subtitle: 'Cost price and packaging per SKU — the missing half of profit',
  },
};

interface Notice {
  tone: 'ok' | 'warn';
  messages: string[];
}

function itemTitle(item: LedgerItem): string {
  const event = item.events.find((entry) => entry.rawRow['Product Name']);
  return event?.rawRow['Product Name'] ?? item.sku;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sellwise_sidebar_collapsed') === 'true';
  });

  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [files, setFiles] = useState<LedgerFileMeta[]>([]);
  const [skuMasterList, setSkuMasterList] = useState<SkuMasterItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Restore persisted ledger + SKU costs on mount.
  useEffect(() => {
    let isMounted = true;
    Promise.all([loadLedgerState(), loadSkuMaster()]).then(([ledger, savedSkus]) => {
      if (!isMounted) return;
      if (ledger.events) setEvents(ledger.events);
      if (ledger.files) setFiles(ledger.files);
      if (savedSkus) setSkuMasterList(savedSkus);
      setIsLoaded(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sellwise_sidebar_collapsed', String(next));
      return next;
    });
  };

  const costs = useMemo(
    () =>
      skuMasterList.map((item) => ({
        sku: item.sku,
        costPrice: item.costPrice,
        packagingCost: item.packagingCost,
      })),
    [skuMasterList],
  );

  const ledger = useMemo(() => {
    const sales = events.filter((event) => event.eventType === 'sale');
    const others = events.filter((event) => event.eventType !== 'sale');
    return buildLedger(sales, others, costs);
  }, [events, costs]);

  const detectedSkus = useMemo<DetectedSku[]>(() => {
    const configured = new Set(
      skuMasterList.filter((item) => item.costPrice > 0).map((item) => item.sku.toLowerCase()),
    );
    const map = new Map<string, DetectedSku>();
    for (const item of ledger.items) {
      if (!item.sku || configured.has(item.sku.toLowerCase())) continue;
      const bucket = map.get(item.sku);
      if (bucket) bucket.orders += 1;
      else map.set(item.sku, { sku: item.sku, title: itemTitle(item), orders: 1 });
    }
    return [...map.values()].sort((a, b) => b.orders - a.orders);
  }, [ledger.items, skuMasterList]);

  const handleUpload = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return;
      setIsParsing(true);
      const messages: string[] = [];
      const parsedFiles: Array<{ meta: LedgerFileMeta; events: LedgerEvent[] }> = [];

      for (const file of incoming) {
        try {
          const result = await parseMeeshoFile(file);
          result.warnings.forEach((warning) => messages.push(warning));

          if (result.kind === 'unknown') {
            messages.push(`"${file.name}" was not recognised as a Meesho report and was skipped.`);
            continue;
          }

          parsedFiles.push({
            meta: {
              id: `${result.kind}:${result.fileName}`,
              fileName: result.fileName,
              kind: result.kind,
              rowCount: result.rowCount,
              eventCount: result.events.length,
              uploadedAt: new Date().toISOString(),
            },
            events: result.events,
          });
        } catch (error) {
          messages.push(
            `"${file.name}" could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }

      // Re-uploading a file replaces that file's data instead of stacking on top.
      const replacedNames = new Set(parsedFiles.map((entry) => entry.meta.fileName));
      const keptEvents = events.filter((event) => !replacedNames.has(event.sourceFile));
      const incomingEvents = parsedFiles.flatMap((entry) => entry.events);
      const mergedEvents = dedupeEvents([...keptEvents, ...incomingEvents]).events;
      const addedEvents = mergedEvents.length - keptEvents.length;

      const nextFiles = [...files];
      for (const entry of parsedFiles) {
        const index = nextFiles.findIndex((item) => item.id === entry.meta.id);
        if (index >= 0) nextFiles[index] = entry.meta;
        else nextFiles.push(entry.meta);
      }

      setEvents(mergedEvents);
      setFiles(nextFiles);
      void saveLedgerEvents(mergedEvents);
      void saveLedgerFiles(nextFiles);

      if (parsedFiles.length > 0) {
        messages.unshift(
          addedEvents > 0
            ? `Loaded ${addedEvents} ledger entries from ${parsedFiles.length} file(s).`
            : `No ledger entries found in these files.`,
        );
      }

      const warningCount = messages.length - (parsedFiles.length > 0 ? 1 : 0);
      setNotice(messages.length > 0 ? { tone: warningCount > 0 ? 'warn' : 'ok', messages } : null);
      setIsParsing(false);
    },
    [events, files],
  );

  const handleRemoveFile = (id: string) => {
    const file = files.find((item) => item.id === id);
    if (!file) return;
    const nextFiles = files.filter((item) => item.id !== id);
    const nextEvents = events.filter((event) => event.sourceFile !== file.fileName);
    setFiles(nextFiles);
    setEvents(nextEvents);
    void saveLedgerFiles(nextFiles);
    void saveLedgerEvents(nextEvents);
  };

  const handleClearAll = () => {
    const confirmed = window.confirm(
      'Remove every uploaded Meesho file and its ledger entries? SKU costs are kept.',
    );
    if (!confirmed) return;
    setFiles([]);
    setEvents([]);
    setNotice(null);
    void clearLedgerState();
  };

  const handleSaveSku = (skuItem: SkuMasterItem) => {
    const existing = skuMasterList.findIndex(
      (item) => item.sku.toLowerCase() === skuItem.sku.toLowerCase(),
    );
    const next = [...skuMasterList];
    if (existing >= 0) next[existing] = skuItem;
    else next.unshift(skuItem);
    setSkuMasterList(next);
    void saveSkuMaster(next);
  };

  const handleDeleteSku = (skuCode: string) => {
    const next = skuMasterList.filter(
      (item) => item.sku.toLowerCase() !== skuCode.toLowerCase(),
    );
    setSkuMasterList(next);
    void saveSkuMaster(next);
  };

  const heading = TAB_TITLES[activeTab];

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={heading.title}
          subtitle={heading.subtitle}
          totalOrders={ledger.items.length}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        <main className="flex-1 p-6 md:p-8 space-y-6 max-w-[1400px] w-full">
          {!isLoaded ? (
            <div className="flex items-center justify-center py-24 text-sm text-ink-muted gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading saved data…
            </div>
          ) : (
            <>
              {notice && (
                <div
                  className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                    notice.tone === 'ok'
                      ? 'bg-leaf-soft/50 border-leaf/30 text-leaf-deep'
                      : 'bg-sun-soft/60 border-sun/40 text-sun-deep'
                  }`}
                >
                  {notice.tone === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 text-[11px] leading-relaxed space-y-0.5">
                    {notice.messages.slice(0, 6).map((message, index) => (
                      <p key={`${message}-${index}`}>{message}</p>
                    ))}
                    {notice.messages.length > 6 && (
                      <p className="font-bold">…and {notice.messages.length - 6} more note(s).</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    className="p-1 rounded-lg hover:bg-white/40 transition-all shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fadeIn">
                  <LedgerUploader
                    files={files}
                    isParsing={isParsing}
                    onUpload={handleUpload}
                    onRemove={handleRemoveFile}
                    onClearAll={handleClearAll}
                  />
                  <LedgerDashboard
                    ledger={ledger}
                    files={files}
                    onOpenSkuManager={() => setActiveTab('sku-manager')}
                    onOpenOrders={() => setActiveTab('orders')}
                  />
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-6 animate-fadeIn">
                  <LedgerOrdersTable items={ledger.items} />
                </div>
              )}

              {activeTab === 'sku-manager' && (
                <div className="space-y-6 animate-fadeIn">
                  <SkuManager
                    skuMasterList={skuMasterList}
                    detectedSkus={detectedSkus}
                    onSaveSku={handleSaveSku}
                    onDeleteSku={handleDeleteSku}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
