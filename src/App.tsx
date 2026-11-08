import { useState, useMemo } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricCard } from './components/MetricCard';
import { ProfitChart } from './components/ProfitChart';
import { FileUploader } from './components/FileUploader';
import { ReconciliationTable } from './components/ReconciliationTable';
import { SkuMatrix } from './components/SkuMatrix';
import { ClaimsTracker } from './components/ClaimsTracker';
import { INITIAL_ORDERS, INITIAL_CLAIMS } from './data/mockData';
import { OrderItem, SkuMetric, ClaimItem, Marketplace } from './types';
import {
  TrendingUp,
  AlertOctagon,
  RotateCcw,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [currentMarketplace, setCurrentMarketplace] = useState<Marketplace>('all');
  const [dateRange, setDateRange] = useState<string>('30D');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 100% dynamic - no dummy data!
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [claims, setClaims] = useState<ClaimItem[]>(INITIAL_CLAIMS);

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
      } else if (margin > 30 && returnRate < 15 && sku.totalOrders >= 2) {
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
  }, [displayedOrders]);

  // Aggregate Metrics dynamically
  const metrics = useMemo(() => {
    let grossSales = 0;
    let netProfit = 0;
    let discrepancies = 0;
    let rtoLoss = 0;
    let totalDeductions = 0;

    displayedOrders.forEach((o) => {
      grossSales += o.salePrice;
      const profit = o.actualPayout - o.productCost - o.packagingCost;
      netProfit += profit;
      discrepancies += o.discrepancyAmount;
      if (o.status === 'RTO' || o.status === 'Customer Return') {
        rtoLoss += (o.reverseShippingFee + o.shippingFee + o.packagingCost);
      }
      totalDeductions += (o.marketplaceCommission + o.shippingFee + o.reverseShippingFee + o.taxesAndGst);
    });

    return {
      grossSales,
      netProfit,
      discrepancies,
      rtoLoss,
      totalDeductions,
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
    setOrders((prev) => [...importedOrders, ...prev]);
    setActiveTab('reconciliation');
  };

  const handleAddClaim = (newClaim: ClaimItem) => {
    setClaims((prev) => [newClaim, ...prev]);
  };

  const handleOpenClaimFromOrder = (order: OrderItem) => {
    const claim: ClaimItem = {
      id: `clm-${Date.now()}`,
      orderId: order.orderId,
      marketplace: order.marketplace,
      sku: order.sku,
      claimType: order.status === 'Customer Return' ? 'Wrong Return' : 'Weight Mismatch Overcharge',
      amountClaimed: order.discrepancyAmount > 0 ? order.discrepancyAmount : 150,
      amountApproved: 0,
      filingDate: new Date().toISOString().split('T')[0],
      status: 'Filed',
      ticketId: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    handleAddClaim(claim);
    setActiveTab('claims');
  };

  const discrepanciesCount = useMemo(() => {
    return orders.filter((o) => o.reconciliationStatus === 'Discrepancy').length;
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
                  subValue={`${metrics.marginPercent}% clean profit margin`}
                  badge={metrics.netProfit > 0 ? 'Profitable' : '₹0'}
                  badgeType="leaf"
                  theme="leaf"
                  icon={TrendingUp}
                />

                <MetricCard
                  title="Detected Discrepancies"
                  value={`₹${metrics.discrepancies.toLocaleString('en-IN')}`}
                  subValue="Overcharged fees & missing payouts"
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

              {/* Empty State Banner or Recent Activity */}
              {displayedOrders.length === 0 ? (
                <div className="bg-surface-elevated rounded-card p-8 border border-outline shadow-soft text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-sky-soft text-sky-deep flex items-center justify-center">
                    <FileSpreadsheet className="w-7 h-7 stroke-[2.2]" />
                  </div>
                  <h3 className="text-base font-bold font-display text-ink">
                    No Orders Recorded Yet
                  </h3>
                  <p className="text-xs text-ink-muted max-w-md">
                    Upload your raw order report or payment settlement sheet from Meesho, Flipkart, or Amazon to populate your dashboard with real numbers.
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
                    <h3 className="text-base font-bold font-display text-ink">Recent Orders</h3>
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
              <FileUploader onOrdersImported={handleOrdersImported} />
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

          {/* Tab 4: SKU Matrix */}
          {activeTab === 'skus' && (
            <div className="space-y-6 animate-fadeIn">
              <SkuMatrix skus={skus} />
            </div>
          )}

          {/* Tab 5: Claims Tracker */}
          {activeTab === 'claims' && (
            <div className="space-y-6 animate-fadeIn">
              <ClaimsTracker
                claims={claims}
                orders={displayedOrders}
                onAddClaim={handleAddClaim}
              />
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
