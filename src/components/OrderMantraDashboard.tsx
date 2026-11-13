import React, { useMemo } from 'react';
import { OrderItem, ClaimItem, SkuMasterItem, Marketplace } from '../types';
import { OrderMantraCategoryInfo } from './OrderMantraDetailModal';
import { 
  Package, 
  CheckCircle2, 
  RefreshCw,
  Upload,
  Barcode
} from 'lucide-react';

interface OrderMantraDashboardProps {
  orders: OrderItem[];
  claims: ClaimItem[];
  skuMasterList: SkuMasterItem[];
  currentMarketplace: Marketplace;
  storeName?: string;
  onSelectCategory: (category: OrderMantraCategoryInfo) => void;
  onOpenImport: () => void;
  onOpenScanner: () => void;
  onOpenSkuManager: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const OrderMantraDashboard: React.FC<OrderMantraDashboardProps> = ({
  orders,
  claims,
  skuMasterList,
  currentMarketplace,
  storeName = 'Seller Store',
  onSelectCategory,
  onOpenImport,
  onOpenScanner,
  onOpenSkuManager,
  onRefresh,
  isRefreshing = false,
}) => {
  // Aggregate all metrics dynamically from actual orders
  const metrics = useMemo(() => {
    const totalOrders = orders.length;

    // Filter status counts
    const cancelledOrders = orders.filter(o => o.status === 'Cancelled');
    const readyToShipOrders = orders.filter(o => o.status === 'Ready To Ship');
    const shippedOrders = orders.filter(o => o.status === 'Shipped');
    const returnInTransitOrders = orders.filter(o => o.status === 'Return In Transit' || o.status === 'In-Transit');
    const outForDeliveryOrders = orders.filter(o => o.status === 'Out For Delivery');
    
    const returnReceivedOrders = orders.filter(o => 
      o.status === 'Return Received' || 
      o.returnType === 'CUSTOMER RETURN' || 
      o.returnType === 'RTO' ||
      o.status === 'Customer Return' ||
      o.status === 'RTO'
    );

    const returnNotReceivedOrders = orders.filter(o => 
      o.status === 'Return Not Received' || 
      ((o.status === 'Return In Transit' || o.status === 'In-Transit' || o.returnType === 'RTO') && (o.daysInTransit || 0) > 15)
    );

    const returnMismatchOrders = orders.filter(o => 
      o.status === 'Return Mismatch' || 
      (o.discrepancyReason && o.discrepancyReason.toLowerCase().includes('wrong'))
    );

    const paymentMismatchOrders = orders.filter(o => 
      o.reconciliationStatus === 'Discrepancy' || 
      o.discrepancyAmount > 0
    );

    const receivedPaymentOrders = orders.filter(o => o.actualPayout > 0 && o.reconciliationStatus === 'Settled');
    const pendingPaymentOrders = orders.filter(o => o.actualPayout === 0 || o.reconciliationStatus === 'Pending');
    const unsettledPickupOrders = orders.filter(o => o.status === 'Unsettled Pickup' || o.status === 'Ready To Ship');
    const cancelPickupOrders = orders.filter(o => o.status === 'Cancel Pickup');

    // Cost Amounts (Base cost + packaging)
    const sumCost = (list: OrderItem[]) => list.reduce((acc, o) => acc + (o.productCost + o.packagingCost), 0);
    const sumSale = (list: OrderItem[]) => list.reduce((acc, o) => acc + o.salePrice, 0);
    const sumPayout = (list: OrderItem[]) => list.reduce((acc, o) => acc + o.actualPayout, 0);
    const sumDiscrepancy = (list: OrderItem[]) => list.reduce((acc, o) => acc + o.discrepancyAmount, 0);

    // Business insights
    const deliveredOrders = orders.filter(o => o.status === 'Delivered');
    const customerReturns = orders.filter(o => o.status === 'Customer Return' || o.returnType === 'CUSTOMER RETURN');
    const rtoOrders = orders.filter(o => o.status === 'RTO' || o.returnType === 'RTO');

    const totalRevenue = sumSale(orders);
    const totalCostOfGoods = sumCost(orders);
    const totalActualPayout = sumPayout(orders);
    const grossProfit = totalActualPayout - totalCostOfGoods;

    // Real Ad spend (0 until ad file uploaded)
    const adSpend = 0;
    const netProfit = grossProfit - adSpend;
    const netProfitPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : '0.00';
    const salesProfitPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : '0.00';

    // Last order date
    const sortedDates = orders.map(o => o.orderDate).filter(Boolean).sort().reverse();
    const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : '-';

    // Claim stats
    const draftClaims = claims.filter(c => c.status === 'Draft');
    const openClaims = claims.filter(c => c.status === 'Filed');
    const closedClaims = claims.filter(c => c.status === 'Approved' || c.status === 'Rejected');
    const approvedClaims = claims.filter(c => c.status === 'Approved');

    const draftClaimAmount = draftClaims.reduce((a, b) => a + b.amountClaimed, 0);
    const openClaimAmount = openClaims.reduce((a, b) => a + b.amountClaimed, 0);
    const closedClaimAmount = closedClaims.reduce((a, b) => a + (b.amountApproved || b.amountClaimed), 0);
    const approvedClaimAmount = approvedClaims.reduce((a, b) => a + b.amountApproved, 0);

    // Return Not Received loss (items overdue > 15 days)
    const returnNotReceivedLoss = sumCost(returnNotReceivedOrders);
    const payoutLoss = sumDiscrepancy(paymentMismatchOrders);
    const rtoPackingLoss = rtoOrders.reduce((a, b) => a + b.packagingCost, 0);
    const wrongReturnLoss = returnMismatchOrders.reduce((a, b) => a + b.salePrice, 0);

    const withoutCostCount = orders.filter(o => o.productCost === 0).length;

    return {
      all: { count: totalOrders, cost: sumCost(orders), lastOrder: lastOrderDate },
      cancelled: { 
        count: cancelledOrders.length, 
        cost: sumCost(cancelledOrders), 
        percent: totalOrders > 0 ? ((cancelledOrders.length / totalOrders) * 100).toFixed(2) : '0.00' 
      },
      readyToShip: { count: readyToShipOrders.length, cost: sumCost(readyToShipOrders) },
      shipped: { count: shippedOrders.length, cost: sumCost(shippedOrders) },
      returnInTransit: { 
        count: returnInTransitOrders.length, 
        cost: sumCost(returnInTransitOrders), 
        percent: totalOrders > 0 ? ((returnInTransitOrders.length / totalOrders) * 100).toFixed(2) : '0.00' 
      },
      outForDelivery: { count: outForDeliveryOrders.length, cost: sumCost(outForDeliveryOrders) },
      returnReceived: { 
        count: returnReceivedOrders.length, 
        cost: sumCost(returnReceivedOrders), 
        percent: totalOrders > 0 ? ((returnReceivedOrders.length / totalOrders) * 100).toFixed(2) : '0.00' 
      },
      returnNotReceived: { 
        count: returnNotReceivedOrders.length, 
        cost: sumCost(returnNotReceivedOrders), 
        percent: totalOrders > 0 ? ((returnNotReceivedOrders.length / totalOrders) * 100).toFixed(2) : '0.00' 
      },
      returnMismatch: { count: returnMismatchOrders.length, cost: sumCost(returnMismatchOrders) },
      paymentMismatch: { count: paymentMismatchOrders.length, cost: sumDiscrepancy(paymentMismatchOrders) },
      receivedPayment: { count: receivedPaymentOrders.length, amount: sumPayout(receivedPaymentOrders) },
      pendingPayment: { count: pendingPaymentOrders.length, cost: sumCost(pendingPaymentOrders) },
      unsettledPickup: { count: unsettledPickupOrders.length, cost: sumCost(unsettledPickupOrders) },
      cancelPickup: { 
        count: cancelPickupOrders.length, 
        cost: sumCost(cancelPickupOrders), 
        percent: totalOrders > 0 ? ((cancelPickupOrders.length / totalOrders) * 100).toFixed(2) : '0.00' 
      },
      claimApproved: { count: approvedClaims.length, amount: approvedClaimAmount },
      claimPending: { count: openClaims.length, amount: openClaimAmount },
      smartTickets: {
        newCount: draftClaims.length,
        newAmount: draftClaimAmount,
        openCount: openClaims.length,
        openAmount: openClaimAmount,
        closedCount: closedClaims.length,
        closedAmount: closedClaimAmount
      },
      bankReceived: { amount: sumPayout(receivedPaymentOrders), lastDate: lastOrderDate },
      financials: {
        salesProfit: grossProfit,
        salesProfitPercent,
        advertisement: adSpend,
        grossProfit,
        wrongReturnLoss,
        returnNotReceivedLoss,
        payoutLoss,
        rtoLoss: rtoPackingLoss,
        customerReturnRecovery: 0,
        netProfit,
        netProfitPercent
      },
      insights: {
        picked: totalOrders,
        shipped: shippedOrders.length,
        rto: rtoOrders.length,
        delivered: deliveredOrders.length,
        returnCount: customerReturns.length,
        deliveryPercent: totalOrders > 0 ? (((deliveredOrders.length) / (totalOrders)) * 100).toFixed(2) : '0.00'
      },
      withoutCostCount
    };
  }, [orders, claims]);

  // Dynamic Date Range from Orders
  const dateRangeLabel = useMemo(() => {
    if (orders.length === 0) return 'No Orders Uploaded';
    const dates = orders.map(o => o.orderDate).filter(Boolean).sort();
    if (dates.length === 0) return 'All Dates';
    return `From ${dates[0]} To ${dates[dates.length - 1]}`;
  }, [orders]);

  return (
    <div className="space-y-4 font-sans select-none animate-fadeIn">
      
      {/* Top Banner Bar (Order Mantra Desktop Look) */}
      <div className="bg-white border border-[#cbd5e1] rounded-xl px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-800 text-sm">
            {storeName}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-gray-600 font-medium border-l pl-3">
            <button className="hover:text-blue-600">About Us</button>
            <span>•</span>
            <button className="hover:text-blue-600">Packing Material Buy</button>
            <span>•</span>
            <button className="hover:text-blue-600">Shortcut Key</button>
            <span>•</span>
            <span className="text-blue-600 font-bold">Business Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-sky-50 text-sky-700 font-bold px-2.5 py-1 rounded border border-sky-200 text-[11px] uppercase">
            Channel: {currentMarketplace.toUpperCase()}
          </span>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1 bg-[#10b981] hover:bg-emerald-600 text-white font-bold px-3 py-1 rounded shadow-xs transition-all text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh (F5)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Category Grid (4 columns x 5 rows) + Right Account Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* ============================================================== */}
        {/* LEFT / CENTER: CATEGORY BOXES GRID (Order Mantra 4x5 Layout)   */}
        {/* ============================================================== */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Box 1: All Received Orders */}
            <div
              onClick={() => onSelectCategory({ key: 'all', title: 'All Received Orders', colorScheme: 'darkgreen' })}
              className="bg-[#1b7e6d] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-[#146356]"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">All Received Orders</span>
                <span className="text-[10px] bg-black/20 px-1 rounded font-mono">F1</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-emerald-100">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.all.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-emerald-200">Last: {metrics.all.lastOrder}</div>
                  <div className="text-xl font-bold font-mono tracking-tight leading-none mt-0.5">{metrics.all.count}</div>
                </div>
              </div>
            </div>

            {/* Box 2: Cancelled */}
            <div
              onClick={() => onSelectCategory({ key: 'cancelled', title: 'Cancelled Orders', colorScheme: 'gray' })}
              className="bg-[#5c6870] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-[#48535a]"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Cancelled</span>
                <span className="text-[10px] text-amber-300 font-bold">{metrics.cancelled.percent}%</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.cancelled.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.cancelled.count}</div>
              </div>
            </div>

            {/* Box 3: Ready To Ship */}
            <div
              onClick={() => onSelectCategory({ key: 'ready_to_ship', title: 'Ready To Ship Orders', colorScheme: 'gray' })}
              className="bg-[#5b6964] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-[#47544f]"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Ready To Ship</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.readyToShip.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.readyToShip.count}</div>
              </div>
            </div>

            {/* Box 4: Shipped */}
            <div
              onClick={() => onSelectCategory({ key: 'shipped', title: 'Shipped Orders', colorScheme: 'gray' })}
              className="bg-[#54656f] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-[#42525a]"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Shipped</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.shipped.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.shipped.count}</div>
              </div>
            </div>

          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Box 5: Return In Transit */}
            <div
              onClick={() => onSelectCategory({ key: 'return_in_transit', title: 'Return In Transit Orders', colorScheme: 'gray' })}
              className="bg-[#546069] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-[#414b53]"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Return In Transit</span>
                <span className="text-[10px] text-amber-300 font-bold">{metrics.returnInTransit.percent}%</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.returnInTransit.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.returnInTransit.count}</div>
              </div>
            </div>

            {/* Box 6: Out For Delivery */}
            <div
              onClick={() => onSelectCategory({ key: 'out_for_delivery', title: 'Out For Delivery Orders', colorScheme: 'gray' })}
              className="bg-[#5c6b73] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-[#48565d]"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Out For Delivery</span>
                <span className="text-[10px] bg-black/20 px-1 rounded font-mono">F4</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.outForDelivery.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.outForDelivery.count}</div>
              </div>
            </div>

            {/* Box 7: Return Received (HIGHLIGHT GREEN) */}
            <div
              onClick={() => onSelectCategory({ key: 'return_received', title: 'Received Returns', colorScheme: 'green' })}
              className="bg-[#008b38] hover:bg-[#009b3e] active:scale-[0.99] text-white p-3 rounded-lg shadow-md cursor-pointer transition-all flex flex-col justify-between h-24 border-2 border-emerald-400 ring-2 ring-emerald-400/30"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Return Received</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-emerald-100 font-bold">{metrics.returnReceived.percent}%</span>
                  <span className="text-[9px] bg-black/20 px-1 rounded font-mono">F6</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-emerald-100">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.returnReceived.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.returnReceived.count}</div>
              </div>
            </div>

            {/* Box 8: Return Not Received (VIBRANT RED) */}
            <div
              onClick={() => onSelectCategory({ key: 'return_not_received', title: 'Return Not Received', colorScheme: 'red' })}
              className="bg-[#e02424] hover:bg-red-700 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-red-700"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Return Not Received</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-red-200 font-bold">{metrics.returnNotReceived.percent}%</span>
                  <span className="text-[9px] bg-black/20 px-1 rounded font-mono">F7</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-red-100">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.returnNotReceived.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.returnNotReceived.count}</div>
              </div>
            </div>

          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Box 9: Return Mismatch */}
            <div
              onClick={() => onSelectCategory({ key: 'return_mismatch', title: 'Return Mismatch', colorScheme: 'darkred' })}
              className="bg-[#b91c1c] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-red-900"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Return Mismatch</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-red-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.returnMismatch.cost.toFixed(2)}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.returnMismatch.count}</div>
              </div>
            </div>

            {/* Box 10: Payment Mismatch */}
            <div
              onClick={() => onSelectCategory({ key: 'payment_mismatch', title: 'Payment Mismatch & Discrepancies', colorScheme: 'darkred' })}
              className="bg-[#b91c1c] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-red-900"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Payment Mismatch</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-red-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.paymentMismatch.cost.toFixed(2)}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.paymentMismatch.count}</div>
              </div>
            </div>

            {/* Box 11: Received Payment */}
            <div
              onClick={() => onSelectCategory({ key: 'received_payment', title: 'Received Payment Orders', colorScheme: 'darkgreen' })}
              className="bg-[#065f46] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-emerald-900"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Received Payment</span>
                <span className="text-[9px] bg-black/20 px-1 rounded font-mono">F8</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-emerald-200">
                  <div>Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.receivedPayment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.receivedPayment.count}</div>
              </div>
            </div>

            {/* Box 12: Pending Payment */}
            <div
              onClick={() => onSelectCategory({ key: 'pending_payment', title: 'Pending Payment Orders', colorScheme: 'navy' })}
              className="bg-[#1e3a8a] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-blue-950"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Pending Payment</span>
                <span className="text-[9px] bg-black/20 px-1 rounded font-mono">F9</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-blue-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.pendingPayment.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.pendingPayment.count}</div>
              </div>
            </div>

          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Box 13: Unsettled Pickup */}
            <div
              onClick={() => onSelectCategory({ key: 'unsettled_pickup', title: 'Unsettled Pickup Orders', colorScheme: 'red' })}
              className="bg-[#dc2626] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-red-800"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Unsettled Pickup</span>
                <span className="text-[9px] bg-black/20 px-1 rounded font-mono">F10</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-red-200">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.unsettledPickup.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight leading-none">{metrics.unsettledPickup.count}</div>
              </div>
            </div>

            {/* Box 14: Cancel Pickup */}
            <div
              onClick={() => onSelectCategory({ key: 'cancel_pickup', title: 'Cancel Pickup Orders', colorScheme: 'orange' })}
              className="bg-[#f87171] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-rose-400"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight text-rose-950">Cancel Pickup</span>
                <span className="text-[10px] text-amber-900 font-bold">{metrics.cancelPickup.percent}%</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-rose-950">
                  <div>Cost Amount</div>
                  <div className="font-mono font-bold text-xs">{metrics.cancelPickup.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="text-2xl font-bold font-mono text-rose-950 tracking-tight leading-none">{metrics.cancelPickup.count}</div>
              </div>
            </div>

            {/* Box 15: Claim */}
            <div
              onClick={() => onSelectCategory({ key: 'claim', title: 'SPF Claims', colorScheme: 'teal' })}
              className="bg-[#475569] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-slate-700"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Claim</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] border-t border-slate-500/50 pt-1">
                <div>
                  <div className="text-emerald-300 font-bold">Approved ({metrics.claimApproved.count})</div>
                  <div className="font-mono font-bold">₹{metrics.claimApproved.amount.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-300 font-bold">Pending ({metrics.claimPending.count})</div>
                  <div className="font-mono font-bold">₹{metrics.claimPending.amount.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Box 16: Smart Tickets */}
            <div
              onClick={() => onSelectCategory({ key: 'smart_tickets', title: 'Smart Tickets & Disputes', colorScheme: 'teal' })}
              className="bg-[#0d9488] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-teal-800"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Smart Tickets</span>
                <span className="text-[9px] bg-black/20 px-1 rounded font-mono">F12</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] text-teal-100 font-mono border-t border-teal-700/60 pt-1">
                <div>
                  <div className="text-[8px] uppercase">New</div>
                  <div className="font-bold">{metrics.smartTickets.newCount} (₹{metrics.smartTickets.newAmount.toFixed(0)})</div>
                </div>
                <div>
                  <div className="text-[8px] uppercase">Open</div>
                  <div className="font-bold">{metrics.smartTickets.openCount} (₹{metrics.smartTickets.openAmount.toFixed(0)})</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] uppercase">Closed</div>
                  <div className="font-bold">{metrics.smartTickets.closedCount} (₹{metrics.smartTickets.closedAmount.toFixed(0)})</div>
                </div>
              </div>
            </div>

          </div>

          {/* Row 5: Advertisement + Received In Bank + Business Insights Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Box 17: Advertisement */}
            <div className="bg-[#3f4f22] text-white p-3 rounded-lg shadow flex flex-col justify-between h-24 border border-[#303d19]">
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Advertisement</span>
                <span className="text-[9px] text-lime-300 font-mono font-bold">₹0.00 / Order</span>
              </div>
              <div className="flex justify-between items-end text-xs font-mono">
                <div>
                  <div className="text-[9px] text-lime-200">Paid</div>
                  <div className="font-bold">₹{metrics.financials.advertisement.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-lime-200">Used</div>
                  <div className="font-bold">₹{metrics.financials.advertisement.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Box 18: Received In Bank Acc. */}
            <div
              onClick={() => onSelectCategory({ key: 'received_payment', title: 'Received In Bank Account', colorScheme: 'darkgreen' })}
              className="bg-[#064e3b] hover:brightness-110 active:scale-[0.99] text-white p-3 rounded-lg shadow cursor-pointer transition-all flex flex-col justify-between h-24 border border-emerald-950"
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-xs tracking-tight">Received In Bank Acc.</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[9px] text-emerald-200">Last Payment: {metrics.bankReceived.lastDate}</div>
                  <div className="text-xl font-bold font-mono tracking-tight text-emerald-100">
                    ₹{metrics.bankReceived.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mb-1" />
              </div>
            </div>

            {/* Box 19: Quick Shortcut Action */}
            <div className="bg-white border border-[#cbd5e1] p-3 rounded-lg shadow flex items-center justify-around h-24">
              <button
                onClick={onOpenImport}
                className="flex flex-col items-center gap-1 text-sky-700 hover:text-sky-900 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold">Import Data</span>
              </button>

              <button
                onClick={onOpenScanner}
                className="flex flex-col items-center gap-1 text-emerald-700 hover:text-emerald-900 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Barcode className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold">Scan Return</span>
              </button>

              <button
                onClick={onOpenSkuManager}
                className="flex flex-col items-center gap-1 text-indigo-700 hover:text-indigo-900 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold">SKU Costs</span>
              </button>
            </div>

          </div>

          {/* Business Insights Bar (Wide Card as in Screenshot 1) */}
          <div className="bg-white border border-[#cbd5e1] rounded-lg p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800 border-b pb-1.5">
              <span>Business Insights</span>
              <button
                onClick={() => onSelectCategory({ key: 'all', title: 'Business Insights All Orders', colorScheme: 'darkgreen' })}
                className="text-[11px] text-blue-600 hover:underline font-normal"
              >
                Click here for more details
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-mono">
              <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                <div className="text-[10px] text-gray-500 font-sans font-bold">PICKED</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{metrics.insights.picked}</div>
              </div>
              <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                <div className="text-[10px] text-gray-500 font-sans font-bold">SHIPPED</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{metrics.insights.shipped}</div>
              </div>
              <div className="bg-orange-50 p-1.5 rounded border border-orange-200">
                <div className="text-[10px] text-orange-700 font-sans font-bold">RTO</div>
                <div className="font-bold text-orange-950 text-sm mt-0.5">{metrics.insights.rto}</div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200">
                <div className="text-[10px] text-emerald-700 font-sans font-bold">DELIVERED</div>
                <div className="font-bold text-emerald-950 text-sm mt-0.5">{metrics.insights.delivered}</div>
              </div>
              <div className="bg-red-50 p-1.5 rounded border border-red-200">
                <div className="text-[10px] text-red-700 font-sans font-bold">RETURN</div>
                <div className="font-bold text-red-950 text-sm mt-0.5">{metrics.insights.returnCount}</div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded border border-blue-200">
                <div className="text-[10px] text-blue-700 font-sans font-bold">DELIVERY %</div>
                <div className="font-bold text-blue-950 text-sm mt-0.5">{metrics.insights.deliveryPercent}%</div>
              </div>
            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* RIGHT SIDE PANEL: STORE ACCOUNT & P&L STATUS (Order Mantra)    */}
        {/* ============================================================== */}
        <div className="space-y-3">
          
          {/* Account Card */}
          <div className="bg-white border border-[#cbd5e1] rounded-lg shadow-sm p-3.5 space-y-3 text-xs">
            
            {/* Store & GST Details */}
            <div className="border-b border-gray-200 pb-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-900 font-sans">{storeName}</h3>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 uppercase">
                  {currentMarketplace === 'all' ? 'All Channels' : currentMarketplace}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                GST - Active
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5 flex justify-between">
                <span>Fulfilment By: <strong className="text-gray-800">SELLER</strong></span>
                <span className="text-blue-600 hover:underline cursor-pointer">Change</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1 bg-gray-50 p-1 rounded font-mono">
                {dateRangeLabel}
              </div>
            </div>

            {/* Account Status Breakdown (Exact from Order Mantra Screenshot 1) */}
            <div className="space-y-1.5 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 pb-1">
                Account Status
              </div>

              <div className="flex justify-between py-0.5 text-gray-800 font-medium">
                <span>SALES PROFIT ({metrics.financials.salesProfitPercent} %)</span>
                <span className="font-mono font-bold text-emerald-700">
                  {metrics.financials.salesProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-0.5 text-gray-700">
                <span>Advertisement</span>
                <span className="font-mono text-gray-900">
                  {metrics.financials.advertisement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-0.5 text-emerald-800 font-bold border-t border-gray-200 pt-1">
                <span>GROSS PROFIT</span>
                <span className="font-mono">
                  {metrics.financials.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-0.5 text-gray-600">
                <span>Wrong/Damage/Missing Returns</span>
                <span className="font-mono text-gray-800">{metrics.financials.wrongReturnLoss.toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-0.5 text-red-600">
                <span>Return Not Received Loss</span>
                <span className="font-mono">{metrics.financials.returnNotReceivedLoss.toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-0.5 text-red-600">
                <span>Payout Loss</span>
                <span className="font-mono">{metrics.financials.payoutLoss.toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-0.5 text-gray-600">
                <span>RTO Returns Packing Loss</span>
                <span className="font-mono">{metrics.financials.rtoLoss.toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-0.5 text-gray-600">
                <span>Customer Return Recovery Pending</span>
                <span className="font-mono">{metrics.financials.customerReturnRecovery.toFixed(2)}</span>
              </div>

              {/* NET PROFIT HIGHLIGHT */}
              <div className="bg-[#10b981]/10 border border-emerald-400 p-2 rounded text-emerald-900 flex justify-between items-center font-bold text-xs mt-2">
                <span>NET PROFIT ({metrics.financials.netProfitPercent} %)</span>
                <span className="font-mono text-sm">
                  ₹{metrics.financials.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Total SKU Red Banner (Order Mantra Style) */}
            <div className="bg-[#cc0000] text-white text-center py-1.5 rounded font-bold text-xs tracking-tight shadow-xs">
              TOTAL SKU - {skuMasterList.length} / Without Cost - {metrics.withoutCostCount}
            </div>

            {/* Daily Task Buttons */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                Daily Task
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onOpenScanner}
                  className="bg-[#fce7f3] hover:bg-pink-200 text-pink-900 border border-pink-300 font-bold py-1.5 px-2 rounded text-xs transition-all"
                >
                  Pick-up Entry
                </button>
                <button
                  onClick={onOpenScanner}
                  className="bg-[#fce7f3] hover:bg-pink-200 text-pink-900 border border-pink-300 font-bold py-1.5 px-2 rounded text-xs transition-all"
                >
                  Return Entry
                </button>
              </div>

              <button
                onClick={onOpenImport}
                className="w-full bg-[#f1f5f9] hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold py-2 rounded text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import Data (.xlsx / .csv)</span>
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
