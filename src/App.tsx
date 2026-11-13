import { useState, useMemo } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricCard } from './components/MetricCard';
import { ProfitChart } from './components/ProfitChart';
import { FileUploader } from './components/FileUploader';
import { ReconciliationTable } from './components/ReconciliationTable';
import { SkuMatrix } from './components/SkuMatrix';
import { SkuManager } from './components/SkuManager';
import { ReturnAuditScanner } from './components/ReturnAuditScanner';
import { ClaimsTracker } from './components/ClaimsTracker';
import { OrderMantraDashboard } from './components/OrderMantraDashboard';
import { OrderMantraDetailModal, OrderMantraCategoryInfo } from './components/OrderMantraDetailModal';
import { INITIAL_ORDERS, INITIAL_CLAIMS, INITIAL_SKU_MASTER } from './data/mockData';
import { OrderItem, SkuMetric, ClaimItem, SkuMasterItem, Marketplace } from './types';
import {
  TrendingUp,
  AlertOctagon,
  RotateCcw,
  FileSpreadsheet,
  UploadCloud,
  LayoutGrid,
  BarChart3,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [overviewMode, setOverviewMode] = useState<'mantra' | 'classic'>('mantra');
  const [currentMarketplace, setCurrentMarketplace] = useState<Marketplace>('all');
  const [dateRange, setDateRange] = useState<string>('30D');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMantraCategory, setSelectedMantraCategory] = useState<OrderMantraCategoryInfo | null>(null);

  // App Master state
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [claims, setClaims] = useState<ClaimItem[]>(INITIAL_CLAIMS);
  const [skuMasterList, setSkuMasterList] = useState<SkuMasterItem[]>(INITIAL_SKU_MASTER);

  // Filter orders by selected channel
  const displayedOrders = useMemo(() => {
    if (currentMarketplace === 'all') return orders;
    return orders.filter((o) => o.marketplace === currentMarketplace);
  }, [orders, currentMarketplace]);

  // Derive SKU metrics dynamically from uploaded orders
  const skus = useMemo<SkuMetric[]>(() => {
    if (displayedOrders.length === 0) return [];

    const map: { [sku: string]: SkuMetric } = {};

    displayedOrders.forEach((o) => {
      const s = o.sku || 'GENERAL-SKU';
      const master = skuMasterList.find((m) => m.sku.toLowerCase() === s.toLowerCase());

      if (!map[s]) {
        map[s] = {
          sku: s,
          title: o.title || s,
          totalOrders: 0,
          deliveredOrders: 0,
          rtoOrders: 0,
          customerReturns: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalMarketplaceFees: 0,
          netProfit: 0,
          profitMarginPercent: 0,
          returnRatePercent: 0,
          type: 'Profitable',
          weightGrams: master?.weightGrams || o.actualWeightGrams || 350,
        };
      }

      map[s].totalOrders += 1;
      map[s].totalRevenue += o.salePrice;
      map[s].totalCost += (o.productCost + o.packagingCost);
      map[s].totalMarketplaceFees += (o.marketplaceCommission + o.shippingFee + o.reverseShippingFee + o.taxesAndGst);

      const itemProfit = o.actualPayout - o.productCost - o.packagingCost;
      map[s].netProfit += itemProfit;

      if (o.status === 'Delivered') {
        map[s].deliveredOrders += 1;
      } else if (o.status === 'RTO') {
        map[s].rtoOrders += 1;
      } else if (o.status === 'Customer Return') {
        map[s].customerReturns += 1;
      }
    });

    // Compute margins and categorize
    return Object.values(map).map((sku) => {
      const margin = sku.totalRevenue > 0 ? Math.round((sku.netProfit / sku.totalRevenue) * 100) : 0;
      const totalReturns = sku.rtoOrders + sku.customerReturns;
      const returnRate = sku.totalOrders > 0 ? Math.round((totalReturns / sku.totalOrders) * 100) : 0;

      let type: SkuMetric['type'] = 'Profitable';
      if (sku.netProfit < 0 || returnRate > 35) {
        type = 'Laggard';
      } else if (margin > 25 && returnRate < 20 && sku.totalOrders >= 1) {
        type = 'Hero';
      } else if (margin <= 10) {
        type = 'Breakeven';
      }

      return {
        ...sku,
        profitMarginPercent: margin,
        returnRatePercent: returnRate,
        type,
      };
    });
  }, [displayedOrders, skuMasterList]);

  // Aggregate Metrics dynamically
  const metrics = useMemo(() => {
    let grossSales = 0;
    let netProfit = 0;
    let discrepancies = 0;
    let rtoLoss = 0;
    let totalDeductions = 0;
    let weightLeaks = 0;

    displayedOrders.forEach((o) => {
      grossSales += o.salePrice;
      const profit = o.actualPayout - o.productCost - o.packagingCost;
      netProfit += profit;
      discrepancies += o.discrepancyAmount;
      if (o.status === 'RTO' || o.status === 'Customer Return') {
        rtoLoss += (o.reverseShippingFee + o.shippingFee + o.packagingCost);
      }
      if (o.weightDiscrepancy) {
        weightLeaks += 1;
      }
      totalDeductions += (o.marketplaceCommission + o.shippingFee + o.reverseShippingFee + o.taxesAndGst);
    });

    return {
      grossSales,
      netProfit,
      discrepancies,
      rtoLoss,
      totalDeductions,
      weightLeaks,
      orderCount: displayedOrders.length,
      marginPercent: grossSales > 0 ? Math.round((netProfit / grossSales) * 100) : 0,
    };
  }, [displayedOrders]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleOrdersImported = (importedOrders: OrderItem[]) => {
    // Avoid duplicate orders if re-importing
    setOrders((prev) => {
      const existingIds = new Set(prev.map(p => p.orderId));
      const newOrders = importedOrders.filter(o => !existingIds.has(o.orderId));
      return [...newOrders, ...prev];
    });
    setActiveTab('reconciliation');
  };

  const handleAddClaim = (newClaim: ClaimItem) => {
    setClaims((prev) => [newClaim, ...prev]);
  };

  const handleUpdateClaimStatus = (claimId: string, status: ClaimItem['status'], amountApproved: number) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status, amountApproved } : c))
    );
  };

  const handleSaveSku = (skuItem: SkuMasterItem) => {
    setSkuMasterList((prev) => {
      const idx = prev.findIndex(s => s.sku === skuItem.sku);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = skuItem;
        return copy;
      }
      return [skuItem, ...prev];
    });

    // Update existing orders linked to this SKU with new cost and weight
    setOrders((prev) =>
      prev.map((o) => {
        if (o.sku.toLowerCase() === skuItem.sku.toLowerCase()) {
          const actualWeight = skuItem.weightGrams;
          const billed = o.billedWeightGrams || actualWeight;
          const isWeightOver = billed > actualWeight + 200;
          return {
            ...o,
            productCost: skuItem.costPrice,
            packagingCost: skuItem.packagingCost,
            actualWeightGrams: actualWeight,
            weightDiscrepancy: isWeightOver,
          };
        }
        return o;
      })
    );
  };

  const handleDeleteSku = (skuCode: string) => {
    setSkuMasterList((prev) => prev.filter(s => s.sku !== skuCode));
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderItem['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? { ...o, status } : o))
    );
  };

  const handleOpenClaimFromOrder = (order: OrderItem) => {
    const claim: ClaimItem = {
      id: `clm-${Date.now()}`,
      orderId: order.orderId,
      marketplace: order.marketplace,
      sku: order.sku,
      claimType: order.weightDiscrepancy 
        ? 'Weight Mismatch Overcharge' 
        : order.status === 'Customer Return' 
        ? 'Wrong Return' 
        : 'Payment Not Credited',
      amountClaimed: order.discrepancyAmount > 0 ? order.discrepancyAmount : 150,
      amountApproved: 0,
      filingDate: new Date().toISOString().split('T')[0],
      status: 'Filed',
      ticketId: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      evidenceNotes: order.discrepancyReason || 'Raised via Reconciliation Ledger dispute button.',
    };
    handleAddClaim(claim);
    setActiveTab('claims');
  };

  const discrepanciesCount = useMemo(() => {
    return orders.filter((o) => o.reconciliationStatus === 'Discrepancy' || o.weightDiscrepancy).length;
  }, [orders]);

  return (
    <div className="min-h-screen flex bg-surface">
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        ordersCount={orders.length}
        discrepanciesCount={discrepanciesCount}
      />

      {/* 2. Right Workspace Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <Header
          currentMarketplace={currentMarketplace}
          onSelectMarketplace={setCurrentMarketplace}
          dateRange={dateRange}
          onSelectDateRange={setDateRange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          totalOrders={orders.length}
        />

        {/* Workspace Body */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-[1400px] w-full">
          
          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* View Switcher Banner */}
              <div className="flex items-center justify-between bg-surface-elevated p-2 rounded-xl border border-outline shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOverviewMode('mantra')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      overviewMode === 'mantra'
                        ? 'bg-[#1b7e6d] text-white shadow-xs'
                        : 'text-ink-muted hover:text-ink hover:bg-surface-sunken'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Order Mantra Dashboard (Category View)</span>
                  </button>

                  <button
                    onClick={() => setOverviewMode('classic')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      overviewMode === 'classic'
                        ? 'bg-sky text-white shadow-xs'
                        : 'text-ink-muted hover:text-ink hover:bg-surface-sunken'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Executive KPI & Charts</span>
                  </button>
                </div>

                <div className="text-[11px] text-ink-muted font-mono hidden sm:block pr-2">
                  Click any category box below to view Excel order ledger
                </div>
              </div>

              {/* Mode 1: Order Mantra Category Dashboard */}
              {overviewMode === 'mantra' && (
                <OrderMantraDashboard
                  orders={displayedOrders}
                  claims={claims}
                  skuMasterList={skuMasterList}
                  currentMarketplace={currentMarketplace}
                  onSelectCategory={(category) => setSelectedMantraCategory(category)}
                  onOpenImport={() => setActiveTab('import')}
                  onOpenScanner={() => setActiveTab('scanner')}
                  onOpenSkuManager={() => setActiveTab('sku-manager')}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                />
              )}

              {/* Mode 2: Executive KPI Cards & Charts */}
              {overviewMode === 'classic' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* KPI Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <MetricCard
                      title="Gross Order Sales"
                      value={`₹${metrics.grossSales.toLocaleString('en-IN')}`}
                      subValue={`${metrics.orderCount} total orders recorded`}
                      badge={metrics.orderCount > 0 ? `${metrics.orderCount} Orders` : 'Empty'}
                      badgeType="sky"
                      theme="sky"
                      icon={TrendingUp}
                    />

                    <MetricCard
                      title="Real Net Profit"
                      value={`₹${metrics.netProfit.toLocaleString('en-IN')}`}
                      subValue={`${metrics.marginPercent}% clean margin after COGS`}
                      badge={metrics.netProfit > 0 ? 'Profitable' : '₹0'}
                      badgeType="leaf"
                      theme="leaf"
                      icon={TrendingUp}
                    />

                    <MetricCard
                      title="Detected Discrepancies"
                      value={`₹${metrics.discrepancies.toLocaleString('en-IN')}`}
                      subValue={metrics.weightLeaks > 0 ? `${metrics.weightLeaks} courier weight overcharges` : 'Overcharged fees & missing payouts'}
                      badge={metrics.discrepancies > 0 ? 'Action Needed' : 'None'}
                      badgeType="coral"
                      theme="coral"
                      icon={AlertOctagon}
                    />

                    <MetricCard
                      title="RTO & Return Losses"
                      value={`₹${metrics.rtoLoss.toLocaleString('en-IN')}`}
                      subValue="Freight penalty & damaged stock"
                      badge={metrics.rtoLoss > 0 ? 'Loss Tracked' : '₹0'}
                      badgeType="coral"
                      theme="coral"
                      icon={RotateCcw}
                    />
                  </div>

                  {/* Dynamic Interactive Charts */}
                  <ProfitChart
                    orders={displayedOrders}
                    onImportClick={() => setActiveTab('import')}
                  />
                </div>
              )}

              {/* Recent Orders Table or Empty State */}
              {displayedOrders.length === 0 ? (
                <div className="bg-surface-elevated rounded-card p-10 border border-outline shadow-soft text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-sky-soft text-sky-deep flex items-center justify-center">
                    <FileSpreadsheet className="w-7 h-7 stroke-[2.2]" />
                  </div>
                  <h3 className="text-base font-bold font-display text-ink">
                    No Orders Uploaded Yet
                  </h3>
                  <p className="text-xs text-ink-muted max-w-md">
                    Upload your raw order report or payment settlement sheet from Meesho, Flipkart, or Amazon to view your real profit and payment reconciliation.
                  </p>
                  <button
                    onClick={() => setActiveTab('import')}
                    className="mt-2 flex items-center gap-2 bg-sky text-white px-5 py-2.5 rounded-button text-xs font-bold shadow-soft hover:bg-sky-deep transition-all"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Marketplace File (.xlsx, .csv)</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold font-display text-ink">Recent Orders & Payout Status</h3>
                    <button
                      onClick={() => setActiveTab('reconciliation')}
                      className="text-xs text-sky font-bold hover:underline"
                    >
                      View All Orders ({displayedOrders.length}) →
                    </button>
                  </div>
                  <ReconciliationTable
                    orders={displayedOrders.slice(0, 5)}
                    onOpenClaim={handleOpenClaimFromOrder}
                  />
                </div>
              )}

            </div>
          )}

          {/* Tab 2: Ingestion Dropzone */}
          {activeTab === 'import' && (
            <div className="space-y-6 animate-fadeIn">
              <FileUploader 
                onOrdersImported={handleOrdersImported}
                skuMasterList={skuMasterList}
              />
              {displayedOrders.length > 0 && (
                <ReconciliationTable
                  orders={displayedOrders}
                  onOpenClaim={handleOpenClaimFromOrder}
                />
              )}
            </div>
          )}

          {/* Tab 3: Full Reconciliation Table */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6 animate-fadeIn">
              <ReconciliationTable
                orders={displayedOrders}
                onOpenClaim={handleOpenClaimFromOrder}
              />
            </div>
          )}

          {/* Tab 4: Inbound Return & Barcode Scanner */}
          {activeTab === 'scanner' && (
            <div className="space-y-6 animate-fadeIn">
              <ReturnAuditScanner
                orders={orders}
                onFileClaimFromScan={handleAddClaim}
                onUpdateOrderStatus={handleUpdateOrderStatus}
              />
            </div>
          )}

          {/* Tab 5: Master SKU & Cost Engine */}
          {activeTab === 'sku-manager' && (
            <div className="space-y-6 animate-fadeIn">
              <SkuManager
                skuMasterList={skuMasterList}
                onSaveSku={handleSaveSku}
                onDeleteSku={handleDeleteSku}
              />
            </div>
          )}

          {/* Tab 6: SKU Matrix */}
          {activeTab === 'skus' && (
            <div className="space-y-6 animate-fadeIn">
              <SkuMatrix 
                skus={skus} 
                onOpenSkuManager={() => setActiveTab('sku-manager')}
              />
            </div>
          )}

          {/* Tab 7: Claims Tracker */}
          {activeTab === 'claims' && (
            <div className="space-y-6 animate-fadeIn">
              <ClaimsTracker
                claims={claims}
                orders={displayedOrders}
                onAddClaim={handleAddClaim}
                onUpdateClaimStatus={handleUpdateClaimStatus}
              />
            </div>
          )}

        </main>
      </div>

      {/* Order Mantra Excel Detailed View Modal */}
      {selectedMantraCategory && (
        <OrderMantraDetailModal
          category={selectedMantraCategory}
          orders={displayedOrders}
          storeName="Seller Store"
          onClose={() => setSelectedMantraCategory(null)}
          onOpenClaim={handleOpenClaimFromOrder}
          onDeleteOrder={handleDeleteOrder}
        />
      )}

    </div>
  );
}
