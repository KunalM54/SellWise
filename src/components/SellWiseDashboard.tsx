import React, { useState, useMemo } from 'react';
import { 
  OrderItem, 
  ClaimItem, 
  SkuMasterItem, 
  Marketplace 
} from '../types';
import {
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  Search,
  Download,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  Barcode,
  ChevronRight,
  X,
  FileSpreadsheet
} from 'lucide-react';

interface SellWiseDashboardProps {
  orders: OrderItem[];
  claims: ClaimItem[];
  skuMasterList: SkuMasterItem[];
  currentMarketplace: Marketplace;
  storeName?: string;
  adSpend?: number;
  onOpenImport: () => void;
  onOpenScanner: () => void;
  onOpenSkuManager: () => void;
  onOpenClaim: (order: OrderItem) => void;
  onDeleteOrder?: (orderId: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const SellWiseDashboard: React.FC<SellWiseDashboardProps> = ({
  orders,
  claims,
  skuMasterList,
  currentMarketplace,
  storeName = 'Seller Store',
  adSpend = 0,
  onOpenImport,
  onOpenScanner,
  onOpenSkuManager,
  onOpenClaim,
  onDeleteOrder,
  onRefresh,
  isRefreshing = false,
}) => {
  // State for interactive order pipeline filtering
  const [activePipelineFilter, setActivePipelineFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Core Financial & Cash Metrics
  const metrics = useMemo(() => {
    let grossSales = 0;
    let totalCogs = 0;
    let totalPackaging = 0;
    let totalForwardShipping = 0;
    let totalReverseShipping = 0;
    let totalSettledPayout = 0;
    let totalPendingValue = 0;
    let settledCount = 0;
    let pendingCount = 0;

    let overdueLostReturns: OrderItem[] = [];
    let weightOverchargedOrders: OrderItem[] = [];
    let discrepancyOrders: OrderItem[] = [];

    orders.forEach((o) => {
      grossSales += o.salePrice;
      totalCogs += o.productCost;
      totalPackaging += o.packagingCost;
      totalForwardShipping += o.shippingFee;
      totalReverseShipping += o.reverseShippingFee;

      if (o.reconciliationStatus === 'Settled' && o.actualPayout !== 0) {
        totalSettledPayout += o.actualPayout;
        settledCount += 1;
      } else {
        totalPendingValue += (o.salePrice - o.shippingFee);
        pendingCount += 1;
      }

      // Leakage Detection 1: Overdue Return > 15 days without scan
      if ((o.status === 'RTO' || o.status === 'Return In Transit' || o.status === 'Customer Return') && (o.daysInTransit || 0) > 15) {
        overdueLostReturns.push(o);
      }

      // Leakage Detection 2: Weight Overcharges
      if (o.weightDiscrepancy) {
        weightOverchargedOrders.push(o);
      }

      // Leakage Detection 3: Price / Payout Discrepancy
      if (o.reconciliationStatus === 'Discrepancy' || o.discrepancyAmount > 20) {
        discrepancyOrders.push(o);
      }
    });

    // Real Net Profit = Actual Settled Payout (or expected receivable) - COGS - Packaging - Ads - Reverse Shipping
    const netProfit = totalSettledPayout > 0 
      ? (totalSettledPayout - totalCogs - totalPackaging - adSpend)
      : (grossSales - totalCogs - totalPackaging - totalForwardShipping - totalReverseShipping - adSpend);

    const netProfitMargin = grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(1) : '0.0';

    // Total Recoverable Leakage Amount
    const lostReturnsValue = overdueLostReturns.reduce((acc, o) => acc + (o.salePrice || o.productCost), 0);
    const discrepancyValue = discrepancyOrders.reduce((acc, o) => acc + o.discrepancyAmount, 0);
    const totalRecoverableLeakage = lostReturnsValue + discrepancyValue + (weightOverchargedOrders.length * 40);

    return {
      grossSales,
      netProfit,
      netProfitMargin,
      totalSettledPayout,
      totalPendingValue: Math.max(0, totalPendingValue),
      settledCount,
      pendingCount,
      adSpend,
      totalDeductions: totalForwardShipping + totalReverseShipping + adSpend,
      overdueLostReturns,
      weightOverchargedOrders,
      discrepancyOrders,
      totalRecoverableLeakage,
      orderCount: orders.length,
    };
  }, [orders, adSpend]);

  // Order Pipeline Counts & Values
  const pipelineTabs = useMemo(() => {
    const list = [
      { id: 'all', label: 'All Orders', count: orders.length, total: orders.reduce((s, o) => s + o.salePrice, 0), color: 'blue' },
      { id: 'ready_to_ship', label: 'Ready To Ship', count: orders.filter(o => o.status === 'Ready To Ship').length, total: orders.filter(o => o.status === 'Ready To Ship').reduce((s, o) => s + o.salePrice, 0), color: 'amber' },
      { id: 'shipped', label: 'In Transit / Shipped', count: orders.filter(o => o.status === 'Shipped').length, total: orders.filter(o => o.status === 'Shipped').reduce((s, o) => s + o.salePrice, 0), color: 'sky' },
      { id: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'Delivered').length, total: orders.filter(o => o.status === 'Delivered').reduce((s, o) => s + o.salePrice, 0), color: 'emerald' },
      { id: 'rto', label: 'RTO Returns (₹0 Fee)', count: orders.filter(o => o.status === 'RTO' || o.returnType === 'RTO').length, total: orders.filter(o => o.status === 'RTO' || o.returnType === 'RTO').reduce((s, o) => s + o.salePrice, 0), color: 'purple' },
      { id: 'customer_return', label: 'Customer Returns', count: orders.filter(o => o.status === 'Customer Return' || o.returnType === 'CUSTOMER RETURN').length, total: orders.filter(o => o.status === 'Customer Return' || o.returnType === 'CUSTOMER RETURN').reduce((s, o) => s + o.salePrice, 0), color: 'rose' },
      { id: 'hold', label: 'On Hold', count: orders.filter(o => o.status === 'Hold').length, total: orders.filter(o => o.status === 'Hold').reduce((s, o) => s + o.salePrice, 0), color: 'slate' },
      { id: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'Cancelled').length, total: orders.filter(o => o.status === 'Cancelled').reduce((s, o) => s + o.salePrice, 0), color: 'gray' },
      { id: 'settled', label: 'Bank Settled', count: orders.filter(o => o.reconciliationStatus === 'Settled' && o.actualPayout !== 0).length, total: orders.filter(o => o.reconciliationStatus === 'Settled').reduce((s, o) => s + o.actualPayout, 0), color: 'emerald' },
    ];
    return list;
  }, [orders]);

  // Unique couriers for filter dropdown
  const uniqueCouriers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.courier && o.courier !== '-' && o.courier !== 'null') {
        set.add(o.courier);
      }
    });
    return Array.from(set);
  }, [orders]);

  // Filtered orders list for the table
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Pipeline filter
      if (activePipelineFilter === 'ready_to_ship' && o.status !== 'Ready To Ship') return false;
      if (activePipelineFilter === 'shipped' && o.status !== 'Shipped') return false;
      if (activePipelineFilter === 'delivered' && o.status !== 'Delivered') return false;
      if (activePipelineFilter === 'rto' && !(o.status === 'RTO' || o.returnType === 'RTO')) return false;
      if (activePipelineFilter === 'customer_return' && !(o.status === 'Customer Return' || o.returnType === 'CUSTOMER RETURN')) return false;
      if (activePipelineFilter === 'hold' && o.status !== 'Hold') return false;
      if (activePipelineFilter === 'cancelled' && o.status !== 'Cancelled') return false;
      if (activePipelineFilter === 'settled' && !(o.reconciliationStatus === 'Settled' && o.actualPayout !== 0)) return false;

      // 2. Courier filter
      if (selectedCourierFilter !== 'all' && o.courier !== selectedCourierFilter) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = o.orderId.toLowerCase().includes(q);
        const matchesSku = o.sku.toLowerCase().includes(q);
        const matchesCity = o.customerCity.toLowerCase().includes(q) || o.customerState.toLowerCase().includes(q);
        const matchesAwb = o.awbNumber ? o.awbNumber.toLowerCase().includes(q) : false;
        const matchesTitle = o.title.toLowerCase().includes(q);
        if (!matchesId && !matchesSku && !matchesCity && !matchesAwb && !matchesTitle) return false;
      }

      return true;
    });
  }, [orders, activePipelineFilter, selectedCourierFilter, searchQuery]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) return;
    const headers = [
      'Sub Order No', 'Order Date', 'Status', 'SKU', 'Product Name', 
      'Customer State', 'Customer City', 'Selling Price', 'Product Cost', 
      'Shipping Fee', 'Reverse Shipping Fee', 'Actual Bank Payout', 
      'Courier Partner', 'AWB Number', 'Return Type', 'Return Price Type', 'Payment Date'
    ];
    const rows = filteredOrders.map(o => [
      `"${o.orderId}"`, `"${o.orderDate}"`, `"${o.status}"`, `"${o.sku}"`, `"${o.title.replace(/"/g, '""')}"`,
      `"${o.customerState}"`, `"${o.customerCity}"`, o.salePrice, o.productCost,
      o.shippingFee, o.reverseShippingFee, o.actualPayout,
      `"${o.courier || ''}"`, `"${o.awbNumber || ''}"`, `"${o.returnType || ''}"`, `"${o.returnPriceType || ''}"`, `"${o.bankDepositDate || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SellWise_${activePipelineFilter}_Orders.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans select-none animate-fadeIn">
      
      {/* ============================================================== */}
      {/* 1. TOP PULSE BAR: Store Status, Channel Badge & Fast Actions   */}
      {/* ============================================================== */}
      <div className="bg-surface-elevated rounded-2xl border border-outline p-4 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-soft text-sky-deep flex items-center justify-center font-bold text-lg shadow-xs">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">{storeName}</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-soft text-sky-deep uppercase border border-sky/20">
                Channel: {currentMarketplace.toUpperCase()}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Reconciled
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {metrics.orderCount} orders loaded • {metrics.settledCount} bank settlements • {metrics.overdueLostReturns.length} potential claims {claims.length > 0 ? `• ${claims.length} active disputes` : ''}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSkuManager}
            className="flex items-center gap-1.5 bg-surface text-ink-muted hover:text-ink hover:bg-surface-sunken border border-outline px-3 py-2 rounded-xl text-xs font-bold transition-all"
            title="Configure SKU Costs & Pricing"
          >
            <Package className="w-3.5 h-3.5" />
            <span>SKU Costs ({skuMasterList.length})</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 bg-sky-deep text-white hover:bg-sky px-3.5 py-2 rounded-xl text-xs font-bold shadow-soft transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Upload Reports</span>
          </button>

          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 bg-surface text-ink-muted hover:text-ink hover:bg-surface-sunken border border-outline px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <Barcode className="w-3.5 h-3.5" />
            <span>Barcode Audit</span>
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 bg-surface text-ink-muted hover:text-ink hover:bg-surface-sunken border border-outline px-3 py-2 rounded-xl text-xs font-bold transition-all"
            title="Refresh Ledger"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. THE 4 FINANCIAL PILLARS: What Every Seller Wants to Know    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Real Net Profit */}
        <div className="bg-surface-elevated rounded-2xl border border-outline p-5 shadow-soft hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-bold tracking-tight text-ink">Real Net Profit</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TrendingUp className="w-3 h-3" />
              {metrics.netProfitMargin}% Margin
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tracking-tight">
            ₹{metrics.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-ink-muted mt-2 border-t border-outline/60 pt-2 flex items-center justify-between">
            <span>Gross Sales:</span>
            <span className="font-mono font-bold text-ink">₹{metrics.grossSales.toLocaleString('en-IN')}</span>
          </p>
        </div>

        {/* Card 2: Bank Settled vs Pending */}
        <div className="bg-surface-elevated rounded-2xl border border-outline p-5 shadow-soft hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-bold tracking-tight text-ink">Bank Settled Funds</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-soft text-sky-deep border border-sky/20">
              {metrics.settledCount} Credited
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-sky-deep tracking-tight">
            ₹{metrics.totalSettledPayout.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-ink-muted mt-2 border-t border-outline/60 pt-2 flex items-center justify-between">
            <span>Pending with Channel:</span>
            <span className="font-mono font-bold text-amber-600">₹{metrics.totalPendingValue.toLocaleString('en-IN', { minimumFractionDigits: 0 })} ({metrics.pendingCount})</span>
          </p>
        </div>

        {/* Card 3: Leakage & Discrepancy Radar */}
        <div className={`bg-surface-elevated rounded-2xl border p-5 shadow-soft transition-all ${
          metrics.totalRecoverableLeakage > 0 ? 'border-coral/40 bg-coral-soft/10' : 'border-outline'
        }`}>
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-bold tracking-tight text-ink flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-coral" />
              <span>Leakage Radar</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-coral-soft text-coral border border-coral/30">
              Action Needed
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-coral tracking-tight">
            ₹{metrics.totalRecoverableLeakage.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-ink-muted mt-2 border-t border-outline/60 pt-2 flex items-center justify-between">
            <span>Recoverable Lost Stock:</span>
            <span className="font-mono font-bold text-coral">{metrics.overdueLostReturns.length} Overdue RTOs</span>
          </p>
        </div>

        {/* Card 4: Platform Costs & Ads */}
        <div className="bg-surface-elevated rounded-2xl border border-outline p-5 shadow-soft hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-bold tracking-tight text-ink">Total Platform Costs</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Deductions
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 tracking-tight">
            ₹{metrics.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-ink-muted mt-2 border-t border-outline/60 pt-2 flex items-center justify-between">
            <span>Meesho Ads Spent:</span>
            <span className="font-mono font-bold text-ink">₹{metrics.adSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>

      </div>

      {/* ============================================================== */}
      {/* 3. MONEY LEAKAGE ALERT BANNER: 1-Click Actionable Recovery     */}
      {/* ============================================================== */}
      {metrics.overdueLostReturns.length > 0 && (
        <div className="bg-coral-soft/30 border border-coral/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-coral-soft text-coral flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                <span>{metrics.overdueLostReturns.length} Overdue Return Packages Detected</span>
                <span className="text-[10px] bg-coral text-white font-mono px-1.5 py-0.2 rounded font-bold">Over 15 Days</span>
              </h4>
              <p className="text-xs text-ink-muted mt-0.5">
                These packages have had no delivery scan for &gt;15 days. Under Meesho SPF policy, you can claim full compensation.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (metrics.overdueLostReturns[0]) {
                onOpenClaim(metrics.overdueLostReturns[0]);
              }
            }}
            className="flex items-center gap-1.5 bg-coral text-white hover:bg-red-600 px-4 py-2 rounded-xl text-xs font-bold shadow-soft transition-all active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            <span>File SPF Claim</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. ORDER LIFECYCLE PIPELINE: Clean Segmented Horizontal Tabs    */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Order Lifecycle Pipeline</h3>
            <p className="text-xs text-ink-muted">Click any lifecycle state below to view and filter matching orders.</p>
          </div>
          <span className="text-xs font-mono font-bold text-ink-muted bg-surface-sunken px-2.5 py-1 rounded-lg border border-outline">
            Showing: {filteredOrders.length} of {orders.length}
          </span>
        </div>

        {/* Pipeline Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {pipelineTabs.map((tab) => {
            const active = activePipelineFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePipelineFilter(tab.id)}
                className={`flex flex-col text-left px-3.5 py-2 rounded-xl transition-all border shrink-0 min-w-[130px] ${
                  active
                    ? 'bg-surface-elevated border-sky text-sky-deep shadow-soft ring-2 ring-sky/20'
                    : 'bg-surface border-outline text-ink-muted hover:border-outline-strong hover:bg-surface-elevated hover:text-ink'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold truncate">{tab.label}</span>
                  <span className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    active ? 'bg-sky-soft text-sky-deep' : 'bg-surface-sunken text-ink-muted'
                  }`}>
                    {tab.count}
                  </span>
                </div>
                <div className="text-xs font-bold font-mono text-ink mt-1">
                  ₹{tab.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. SEARCH & COURIER FILTER BAR                                 */}
      {/* ============================================================== */}
      <div className="bg-surface-elevated rounded-2xl border border-outline p-3 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Order ID, SKU, City, AWB, or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-sunken border border-outline rounded-xl pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-sky font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-ink-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {uniqueCouriers.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-ink-muted" />
              <select
                value={selectedCourierFilter}
                onChange={(e) => setSelectedCourierFilter(e.target.value)}
                className="bg-surface-sunken border border-outline rounded-xl px-2.5 py-1.5 text-xs font-bold text-ink focus:outline-none focus:border-sky"
              >
                <option value="all">All Couriers ({uniqueCouriers.length})</option>
                {uniqueCouriers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 bg-surface text-ink hover:bg-surface-sunken border border-outline px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 self-end sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 6. ORDERS LEDGER TABLE: Clean, Legible & Transparent Data      */}
      {/* ============================================================== */}
      <div className="bg-surface-elevated rounded-2xl border border-outline shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken/80 border-b border-outline text-[11px] font-bold uppercase text-ink-muted tracking-wider">
              <tr>
                <th className="py-3 px-4">Sub Order ID</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Lifecycle Status</th>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-3">Customer City</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Settled Payout</th>
                <th className="py-3 px-3">Logistics & AWB</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/60 text-ink">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">No orders match the selected filters.</p>
                    <p className="text-xs text-ink-muted mt-1">Try selecting "All Orders" or clearing your search keywords.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.slice(0, 100).map((order) => {
                  const isSettled = order.reconciliationStatus === 'Settled' && order.actualPayout !== 0;
                  const isRto = order.status === 'RTO' || order.returnType === 'RTO';
                  const isCustomerReturn = order.status === 'Customer Return' || order.returnType === 'CUSTOMER RETURN';

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-sky-soft/20 cursor-pointer transition-colors group"
                    >
                      {/* Sub Order No */}
                      <td className="py-3 px-4 font-mono font-bold text-ink">
                        {order.orderId}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 font-mono text-ink-muted whitespace-nowrap">
                        {order.orderDate}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : order.status === 'Shipped'
                            ? 'bg-sky-soft text-sky-deep border border-sky/20'
                            : order.status === 'Ready To Ship'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : order.status === 'Hold'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : isRto
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : isCustomerReturn
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}>
                          {order.status === 'Delivered' && <CheckCircle2 className="w-3 h-3" />}
                          {order.status === 'Shipped' && <Truck className="w-3 h-3" />}
                          {order.status === 'Ready To Ship' && <Clock className="w-3 h-3" />}
                          {isRto && <RotateCcw className="w-3 h-3" />}
                          {order.status}
                          {isRto && ' (₹0 Fee)'}
                        </span>
                      </td>

                      {/* Product & SKU */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold truncate text-ink">{order.title}</div>
                        <div className="font-mono text-[10px] text-ink-muted">SKU: {order.sku}</div>
                      </td>

                      {/* Customer Location */}
                      <td className="py-3 px-3 text-ink-muted whitespace-nowrap">
                        <div>{order.customerCity || order.customerState}</div>
                        {order.customerCity && order.customerState && order.customerCity !== order.customerState && (
                          <div className="text-[10px] text-ink-muted/70">{order.customerState}</div>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                        ₹{order.salePrice.toFixed(2)}
                      </td>

                      {/* Actual Payout */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {isSettled ? (
                          <span className="text-emerald-700 font-bold">
                            ₹{order.actualPayout.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium text-[11px]">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Logistics & Courier */}
                      <td className="py-3 px-3 text-[11px] whitespace-nowrap">
                        {order.courier ? (
                          <div>
                            <span className="font-bold text-ink">{order.courier}</span>
                            {order.awbNumber && (
                              <div className="font-mono text-[10px] text-sky-deep hover:underline">
                                {order.awbNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-muted">-</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        <button className="text-sky-deep font-bold hover:underline text-xs flex items-center gap-1 mx-auto">
                          <span>Details</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > 100 && (
          <div className="p-3 bg-surface-sunken text-center text-xs font-bold text-ink-muted border-t border-outline">
            Showing first 100 rows. Use search or filters to narrow down, or click "Export CSV" to view all {filteredOrders.length} records.
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 7. SLIDE-OVER ORDER DETAIL MODAL: Rupee-by-Rupee Breakdown     */}
      {/* ============================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-elevated rounded-2xl border border-outline shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-outline flex items-center justify-between bg-surface-sunken">
              <div>
                <span className="text-[10px] uppercase font-bold text-ink-muted">Order Financial Breakdown</span>
                <h3 className="text-base font-bold font-mono text-ink">{selectedOrder.orderId}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-lg bg-surface border border-outline hover:bg-surface-sunken flex items-center justify-center text-ink-muted hover:text-ink transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              
              {/* Product Info */}
              <div className="p-3 rounded-xl bg-surface-sunken border border-outline space-y-1">
                <div className="font-bold text-ink text-sm">{selectedOrder.title}</div>
                <div className="flex items-center gap-3 text-ink-muted font-mono text-xs">
                  <span>SKU: {selectedOrder.sku}</span>
                  <span>•</span>
                  <span>Qty: {selectedOrder.quantity || 1}</span>
                  <span>•</span>
                  <span>Date: {selectedOrder.orderDate}</span>
                </div>
              </div>

              {/* Delivery & Tracking */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-outline bg-surface">
                <div>
                  <div className="text-ink-muted text-[11px]">Customer Destination</div>
                  <div className="font-bold text-ink mt-0.5">{selectedOrder.customerCity || selectedOrder.customerState}</div>
                  <div className="text-[10px] text-ink-muted">{selectedOrder.customerState}</div>
                </div>
                <div>
                  <div className="text-ink-muted text-[11px]">Courier & Tracking</div>
                  <div className="font-bold text-ink mt-0.5">{selectedOrder.courier || 'Pending Allocation'}</div>
                  <div className="font-mono text-[10px] text-sky-deep">{selectedOrder.awbNumber || '-'}</div>
                </div>
              </div>

              {/* Rupee by Rupee Accounting Breakdown */}
              <div className="space-y-2 border-t border-outline pt-3">
                <div className="font-bold text-ink text-xs uppercase tracking-wider mb-1">
                  Rupee-by-Rupee P&L Audit
                </div>

                <div className="flex justify-between py-1 text-ink">
                  <span>Customer Paid / Listed Selling Price:</span>
                  <span className="font-mono font-bold text-emerald-600">+₹{selectedOrder.salePrice.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 text-ink-muted">
                  <span>Product Manufacturing / Purchase Cost (COGS):</span>
                  <span className="font-mono">-₹{selectedOrder.productCost.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 text-ink-muted">
                  <span>Packaging & Material:</span>
                  <span className="font-mono">-₹{selectedOrder.packagingCost.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-1 text-ink-muted">
                  <span>Forward Shipping Charge:</span>
                  <span className="font-mono">-₹{selectedOrder.shippingFee.toFixed(2)}</span>
                </div>

                {/* RTO vs Customer Return Logistics Fee */}
                {selectedOrder.returnType === 'RTO' ? (
                  <div className="flex justify-between py-1 text-emerald-700 bg-emerald-50 px-2 rounded-lg font-bold">
                    <span>Reverse Shipping Fee (Courier Return RTO):</span>
                    <span className="font-mono">₹0.00 (Free Return)</span>
                  </div>
                ) : selectedOrder.reverseShippingFee > 0 ? (
                  <div className="flex justify-between py-1 text-rose-700 bg-rose-50 px-2 rounded-lg font-bold">
                    <span>Customer Return Logistics Fee:</span>
                    <span className="font-mono">-₹{selectedOrder.reverseShippingFee.toFixed(2)}</span>
                  </div>
                ) : null}

                {selectedOrder.returnPriceType && (
                  <div className="flex justify-between py-1 text-ink-muted text-[11px]">
                    <span>Return Price Classification:</span>
                    <span className="font-bold text-ink">{selectedOrder.returnPriceType}</span>
                  </div>
                )}

                <div className="flex justify-between py-2 border-t border-outline font-bold text-sm">
                  <span>Net Bank Settlement Received:</span>
                  <span className={`font-mono ${selectedOrder.actualPayout < 0 ? 'text-coral' : 'text-emerald-600'}`}>
                    ₹{selectedOrder.actualPayout.toFixed(2)}
                  </span>
                </div>

                {selectedOrder.bankDepositDate && (
                  <div className="text-[11px] text-ink-muted text-right">
                    Deposited into bank on: <strong className="text-ink">{selectedOrder.bankDepositDate}</strong>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline bg-surface-sunken flex items-center justify-between">
              {selectedOrder.claimEligible ? (
                <button
                  onClick={() => {
                    onOpenClaim(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="flex items-center gap-1.5 bg-coral text-white hover:bg-red-600 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-soft"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>File Dispute Ticket</span>
                </button>
              ) : (
                <span className="text-xs text-ink-muted">Status: {selectedOrder.reconciliationStatus}</span>
              )}

              <div className="flex items-center gap-2">
                {onDeleteOrder && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete order ${selectedOrder.orderId}?`)) {
                        onDeleteOrder(selectedOrder.orderId);
                        setSelectedOrder(null);
                      }
                    }}
                    className="bg-surface text-coral hover:bg-coral-soft/50 border border-coral/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Delete Order
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="bg-surface text-ink hover:bg-surface-elevated border border-outline px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
