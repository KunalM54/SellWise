import { useState, useMemo } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { ReconciliationTable } from './components/ReconciliationTable';
import { SkuMatrix } from './components/SkuMatrix';
import { SkuManager } from './components/SkuManager';
import { ReturnAuditScanner } from './components/ReturnAuditScanner';
import { ClaimsTracker } from './components/ClaimsTracker';
import { OrdersExcelTable } from './components/OrdersExcelTable';
import { INITIAL_ORDERS, INITIAL_CLAIMS, INITIAL_SKU_MASTER } from './data/mockData';
import { OrderItem, SkuMetric, ClaimItem, SkuMasterItem, Marketplace, ImportedOrderFile } from './types';

const TAB_TITLES: Record<TabType, string> = {
  'overview': 'Overview & P&L',
  'reconciliation': 'Reconciliation Ledger',
  'scanner': 'Return & Barcode Audit',
  'sku-manager': 'SKU Master & Costs',
  'skus': 'SKU Profit Matrix',
  'claims': 'Dispute & SPF Claims',
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [currentMarketplace, setCurrentMarketplace] = useState<Marketplace>('all');

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sellwise_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sellwise_sidebar_collapsed', String(next));
      return next;
    });
  };

  // App Master state
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [orderFile, setOrderFile] = useState<ImportedOrderFile | null>(null);
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

  const handleOrderFileLoaded = (file: ImportedOrderFile) => {
    setOrderFile(file);

    // Map raw records to OrderItem[] preserving all original data
    const mappedOrders: OrderItem[] = file.rows.map((row, idx) => {
      const subOrderNo = row['Sub Order No'] || row['sub order no'] || `ord-${idx + 1}`;
      const sku = row['SKU'] || row['sku'] || 'GENERAL-SKU';
      const title = row['Product Name'] || row['product name'] || sku;
      const orderDate = row['Order Date'] || row['order date'] || new Date().toISOString().split('T')[0];
      const state = row['Customer State'] || row['customer state'] || '';
      const listedPrice = Number((row['Supplier Listed Price (Incl. GST + Commission)'] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const discPrice = Number((row['Supplier Discounted Price (Incl GST and Commision)'] || '0').replace(/[^0-9.-]/g, '')) || listedPrice;
      const qty = Number((row['Quantity'] || '1').replace(/[^0-9]/g, '')) || 1;
      const packetId = row['Packet Id'] || row['packet id'] || '';
      const rawStatus = (row['Reason for Credit Entry'] || row['reason for credit entry'] || '').toUpperCase();

      let status: OrderItem['status'] = 'Delivered';
      let returnType: OrderItem['returnType'] = undefined;

      if (rawStatus.includes('READY_TO_SHIP')) status = 'Ready To Ship';
      else if (rawStatus.includes('HOLD')) status = 'Hold';
      else if (rawStatus.includes('SHIPPED')) status = 'Shipped';
      else if (rawStatus.includes('RTO')) { status = 'RTO'; returnType = 'RTO'; }
      else if (rawStatus.includes('CANCEL')) { status = 'Cancelled'; returnType = 'CANCELLED'; }
      else if (rawStatus.includes('DELIVERED')) { status = 'Delivered'; returnType = 'DELIVERED'; }
      else if (rawStatus.includes('PENDING')) status = 'Ready To Ship';

      return {
        id: `ord-${subOrderNo}-${idx}`,
        orderId: subOrderNo,
        orderNumber: subOrderNo,
        marketplace: 'meesho',
        orderDate,
        sku,
        title,
        quantity: qty,
        customerCity: '',
        customerState: state,
        salePrice: discPrice || listedPrice,
        productCost: 0,
        packagingCost: 0,
        marketplaceCommission: 0,
        shippingFee: 0,
        reverseShippingFee: 0,
        taxesAndGst: 0,
        expectedPayout: discPrice || listedPrice,
        actualPayout: status === 'Delivered' ? (discPrice || listedPrice) : 0,
        status,
        returnType,
        reconciliationStatus: status === 'Delivered' ? 'Settled' : 'Pending',
        discrepancyAmount: 0,
        claimEligible: status === 'RTO',
        awbNumber: packetId,
        rawRow: row,
      };
    });

    setOrders(mappedOrders);
  };

  const handleClearOrderFile = () => {
    setOrderFile(null);
    setOrders([]);
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
        isCollapsed={isSidebarCollapsed}
      />

      {/* 2. Right Workspace Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <Header
          title={TAB_TITLES[activeTab] || 'Overview & P&L'}
          currentMarketplace={currentMarketplace}
          onSelectMarketplace={setCurrentMarketplace}
          totalOrders={orders.length}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Workspace Body */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-[1400px] w-full">
          
          {/* Tab 1: Overview & P&L - Orders Excel Table */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <OrdersExcelTable
                orderFile={orderFile}
                onFileLoaded={handleOrderFileLoaded}
                onClearFile={handleClearOrderFile}
              />
            </div>
          )}

          {/* Tab 2: Full Reconciliation Table */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6 animate-fadeIn">
              <ReconciliationTable
                orders={displayedOrders}
                onOpenClaim={handleOpenClaimFromOrder}
              />
            </div>
          )}

          {/* Tab 3: Inbound Return & Barcode Scanner */}
          {activeTab === 'scanner' && (
            <div className="space-y-6 animate-fadeIn">
              <ReturnAuditScanner
                orders={orders}
                onFileClaimFromScan={handleAddClaim}
                onUpdateOrderStatus={handleUpdateOrderStatus}
              />
            </div>
          )}

          {/* Tab 4: Master SKU & Cost Engine */}
          {activeTab === 'sku-manager' && (
            <div className="space-y-6 animate-fadeIn">
              <SkuManager
                skuMasterList={skuMasterList}
                onSaveSku={handleSaveSku}
                onDeleteSku={handleDeleteSku}
              />
            </div>
          )}

          {/* Tab 5: SKU Matrix */}
          {activeTab === 'skus' && (
            <div className="space-y-6 animate-fadeIn">
              <SkuMatrix 
                skus={skus} 
                onOpenSkuManager={() => setActiveTab('sku-manager')}
              />
            </div>
          )}

          {/* Tab 6: Claims Tracker */}
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
