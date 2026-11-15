import { useState, useMemo } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { ProfitChart } from './components/ProfitChart';
import { FileUploader } from './components/FileUploader';
import { ReconciliationTable } from './components/ReconciliationTable';
import { SkuMatrix } from './components/SkuMatrix';
import { SkuManager } from './components/SkuManager';
import { ReturnAuditScanner } from './components/ReturnAuditScanner';
import { ClaimsTracker } from './components/ClaimsTracker';
import { SellWiseDashboard } from './components/SellWiseDashboard';
import { INITIAL_ORDERS, INITIAL_CLAIMS, INITIAL_SKU_MASTER } from './data/mockData';
import { OrderItem, SkuMetric, ClaimItem, SkuMasterItem, Marketplace } from './types';

const TAB_TITLES: Record<TabType, string> = {
  'overview': 'Overview & P&L',
  'import': 'Import Reports',
  'reconciliation': 'Reconciliation Ledger',
  'scanner': 'Return & Barcode Audit',
  'sku-manager': 'SKU Master & Costs',
  'skus': 'SKU Profit Matrix',
  'claims': 'Dispute & SPF Claims',
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [currentMarketplace, setCurrentMarketplace] = useState<Marketplace>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // App Master state
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [claims, setClaims] = useState<ClaimItem[]>(INITIAL_CLAIMS);
  const [skuMasterList, setSkuMasterList] = useState<SkuMasterItem[]>(INITIAL_SKU_MASTER);
  const [adSpend, setAdSpend] = useState<number>(0);

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

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  function mergeOrderStatuses(existing: OrderItem['status'], incoming: OrderItem['status']): OrderItem['status'] {
    if (incoming === 'Return Received' || existing === 'Return Received') return 'Return Received';
    if (incoming === 'Customer Return' || incoming === 'RTO' || incoming === 'Return In Transit' || incoming === 'Return Mismatch') {
      return incoming;
    }
    if (existing === 'Customer Return' || existing === 'RTO' || existing === 'Return In Transit') {
      return existing;
    }
    if (incoming === 'Delivered') return 'Delivered';
    if (existing === 'Delivered') return 'Delivered';
    if (incoming === 'Cancelled') return 'Cancelled';
    if (existing === 'Cancelled') return 'Cancelled';
    if (incoming === 'Shipped') return 'Shipped';
    if (existing === 'Shipped') return 'Shipped';
    return incoming || existing;
  }

  const handleOrdersImported = (importedOrders: OrderItem[], adCostTotal?: number) => {
    setOrders((prev) => {
      const orderMap = new Map<string, OrderItem>(prev.map(o => [o.orderId, { ...o }]));

      for (const incoming of importedOrders) {
        const existing = orderMap.get(incoming.orderId);
        if (!existing) {
          orderMap.set(incoming.orderId, incoming);
        } else {
          // Smart 3-way merge across Orders, Payments, and Returns reports
          const merged: OrderItem = {
            ...existing,
            // Real selling price (do not overwrite if incoming has 0)
            salePrice: incoming.salePrice > 0 ? incoming.salePrice : existing.salePrice,
            title: existing.title && !existing.title.startsWith('UNKNOWN') && existing.title !== 'GENERAL-SKU' 
              ? existing.title 
              : incoming.title,
            sku: existing.sku && existing.sku !== 'GENERAL-SKU' && existing.sku !== 'UNKNOWN-SKU'
              ? existing.sku 
              : incoming.sku,
            customerCity: existing.customerCity && existing.customerCity !== 'N/A' 
              ? existing.customerCity 
              : incoming.customerCity,
            customerState: existing.customerState && existing.customerState !== 'N/A' 
            ? existing.customerState 
            : incoming.customerState,
            // Courier and AWB tracking
            courier: incoming.courier || existing.courier,
            awbNumber: incoming.awbNumber || existing.awbNumber,
            returnType: incoming.returnType || existing.returnType,
            returnPriceType: incoming.returnPriceType || existing.returnPriceType,
            scanDate: incoming.scanDate || existing.scanDate,
            discrepancyReason: incoming.discrepancyReason || existing.discrepancyReason,
            // Settlement & bank payout
            actualPayout: incoming.actualPayout !== 0 ? incoming.actualPayout : existing.actualPayout,
            reconciliationStatus: (incoming.reconciliationStatus === 'Settled' || incoming.reconciliationStatus === 'Discrepancy')
              ? incoming.reconciliationStatus
              : existing.reconciliationStatus,
            bankDepositDate: incoming.bankDepositDate || existing.bankDepositDate,
            bankUtr: incoming.bankUtr || existing.bankUtr,
            shippingFee: (incoming.returnType === 'RTO' || incoming.status === 'RTO') ? 0 : (incoming.shippingFee > 0 ? incoming.shippingFee : existing.shippingFee),
            reverseShippingFee: (incoming.returnType === 'RTO' || incoming.status === 'RTO') ? 0 : (incoming.reverseShippingFee > 0 ? incoming.reverseShippingFee : existing.reverseShippingFee),
            status: mergeOrderStatuses(existing.status, incoming.status),
          };
          orderMap.set(incoming.orderId, merged);
        }
      }
      return Array.from(orderMap.values());
    });

    if (adCostTotal && adCostTotal > 0) {
      setAdSpend(prev => Math.round((prev + adCostTotal) * 100) / 100);
    }
    setActiveTab('overview');
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
        discrepanciesCount={discrepanciesCount}
      />

      {/* 2. Right Workspace Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <Header
          title={TAB_TITLES[activeTab] || 'Overview & P&L'}
          currentMarketplace={currentMarketplace}
          onSelectMarketplace={setCurrentMarketplace}
          totalOrders={orders.length}
        />

        {/* Workspace Body */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-[1400px] w-full">
          
          {/* Tab 1: Overview - Clean Dedicated SellWise Experience */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* If no orders loaded, directly show beautiful file import experience */}
              {displayedOrders.length === 0 ? (
                <div className="space-y-6 max-w-4xl mx-auto py-2">
                  <div className="text-center space-y-1.5 mb-6">
                    <h2 className="text-2xl font-bold font-display text-ink tracking-tight">
                      Overview & Profit Reconciliation
                    </h2>
                    <p className="text-xs text-ink-muted max-w-lg mx-auto leading-relaxed">
                      Import your marketplace reports (Orders, Payments/Settlement, or Returns) to immediately calculate true net profits and reconcile payouts.
                    </p>
                  </div>

                  <FileUploader 
                    onOrdersImported={handleOrdersImported}
                    skuMasterList={skuMasterList}
                  />

                  {/* 3 Step Guide Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left my-2 text-xs">
                    <div className="p-3.5 rounded-2xl bg-surface-elevated border border-outline shadow-soft">
                      <div className="font-bold text-sky-deep mb-1">1. Orders Manifest</div>
                      <div className="text-[11px] text-ink-muted leading-relaxed">Captures real selling prices, quantities, SKU names, and customer locations.</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-surface-elevated border border-outline shadow-soft">
                      <div className="font-bold text-emerald-700 mb-1">2. Settlement Excel</div>
                      <div className="text-[11px] text-ink-muted leading-relaxed">Matches bank transfers, deposit dates, marketplace fees, and ad deductions.</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-surface-elevated border border-outline shadow-soft">
                      <div className="font-bold text-purple-700 mb-1">3. Return Tracking</div>
                      <div className="text-[11px] text-ink-muted leading-relaxed">Audits couriers & AWBs, tracking free ₹0 RTOs versus customer returns.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Clean Dedicated SellWise Dashboard */}
                  <SellWiseDashboard
                    orders={displayedOrders}
                    claims={claims}
                    skuMasterList={skuMasterList}
                    currentMarketplace={currentMarketplace}
                    storeName="Seller Store"
                    adSpend={adSpend}
                    onOpenImport={() => setActiveTab('import')}
                    onOpenScanner={() => setActiveTab('scanner')}
                    onOpenSkuManager={() => setActiveTab('sku-manager')}
                    onOpenClaim={handleOpenClaimFromOrder}
                    onDeleteOrder={handleDeleteOrder}
                    onRefresh={handleRefresh}
                    isRefreshing={isRefreshing}
                  />

                  {/* Profit & Growth Analytics Chart */}
                  <div className="space-y-4 pt-4 border-t border-outline">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-ink">Cash Flow & Payout Trends</h3>
                        <p className="text-xs text-ink-muted">Historical visual breakdown of customer sales vs net settlement credits.</p>
                      </div>
                    </div>
                    <ProfitChart
                      orders={displayedOrders}
                      onImportClick={() => setActiveTab('import')}
                    />
                  </div>
                </>
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

    </div>
  );
}
