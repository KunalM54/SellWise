import React, { useState, useMemo, useEffect } from 'react';
import { OrderItem } from '../types';
import { 
  Search, 
  X, 
  Download, 
  FileText, 
  Truck, 
  Trash2, 
  Calendar,
  SlidersHorizontal,
  ArrowLeft
} from 'lucide-react';

export interface OrderMantraCategoryInfo {
  key: string;
  title: string;
  colorScheme: 'green' | 'red' | 'darkgreen' | 'teal' | 'gray' | 'darkred' | 'navy' | 'orange' | 'olive';
}

interface OrderMantraDetailModalProps {
  category: OrderMantraCategoryInfo;
  orders: OrderItem[];
  storeName?: string;
  onClose: () => void;
  onOpenClaim?: (order: OrderItem) => void;
  onDeleteOrder?: (orderId: string) => void;
}

export const OrderMantraDetailModal: React.FC<OrderMantraDetailModalProps> = ({
  category,
  orders,
  storeName = 'Seller Store',
  onClose,
  onOpenClaim,
  onDeleteOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturnType, setSelectedReturnType] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(orders[0] || null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);

  // Keyboard shortcut to close or go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter orders according to category definition
  const categoryOrders = useMemo(() => {
    switch (category.key) {
      case 'all':
        return orders;
      case 'cancelled':
        return orders.filter(o => o.status === 'Cancelled');
      case 'ready_to_ship':
        return orders.filter(o => o.status === 'Ready To Ship');
      case 'shipped':
        return orders.filter(o => o.status === 'Shipped');
      case 'return_in_transit':
        return orders.filter(o => o.status === 'Return In Transit' || o.status === 'In-Transit');
      case 'out_for_delivery':
        return orders.filter(o => o.status === 'Out For Delivery');
      case 'return_received':
        return orders.filter(o => 
          o.status === 'Return Received' || 
          o.returnType === 'CUSTOMER RETURN' || 
          o.returnType === 'RTO' ||
          o.status === 'Customer Return' ||
          o.status === 'RTO'
        );
      case 'return_not_received':
        return orders.filter(o => 
          o.status === 'Return Not Received' || 
          ((o.status === 'Return In Transit' || o.status === 'In-Transit' || o.returnType === 'RTO') && (o.daysInTransit || 0) > 15)
        );
      case 'return_mismatch':
        return orders.filter(o => o.status === 'Return Mismatch' || (o.discrepancyReason && o.discrepancyReason.toLowerCase().includes('wrong')));
      case 'payment_mismatch':
        return orders.filter(o => o.reconciliationStatus === 'Discrepancy' || o.discrepancyAmount > 0);
      case 'received_payment':
        return orders.filter(o => o.actualPayout > 0 && o.reconciliationStatus === 'Settled');
      case 'pending_payment':
        return orders.filter(o => o.actualPayout === 0 || o.reconciliationStatus === 'Pending');
      case 'unsettled_pickup':
        return orders.filter(o => o.status === 'Unsettled Pickup' || o.status === 'Ready To Ship');
      case 'cancel_pickup':
        return orders.filter(o => o.status === 'Cancel Pickup');
      case 'claim':
        return orders.filter(o => o.claimEligible || (o.claimStatus && o.claimStatus !== 'Not Eligible'));
      case 'smart_tickets':
        return orders.filter(o => o.claimEligible);
      default:
        return orders;
    }
  }, [category.key, orders]);

  // Secondary sidebar breakdowns
  const returnTypeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; costAmt: number }> = {
      'RTO': { count: 0, costAmt: 0 },
      'CUSTOMER RETURN': { count: 0, costAmt: 0 },
      'DELIVERED': { count: 0, costAmt: 0 },
      'CANCELLED': { count: 0, costAmt: 0 }
    };

    categoryOrders.forEach(o => {
      let type = 'DELIVERED';
      if (o.returnType) {
        type = o.returnType;
      } else if (o.status === 'Customer Return' || o.status === 'Return Received') {
        type = 'CUSTOMER RETURN';
      } else if (o.status === 'RTO') {
        type = 'RTO';
      } else if (o.status === 'Cancelled') {
        type = 'CANCELLED';
      }

      if (!map[type]) {
        map[type] = { count: 0, costAmt: 0 };
      }
      map[type].count += 1;
      map[type].costAmt += (o.productCost + o.packagingCost);
    });

    return Object.entries(map).map(([type, data]) => ({
      type,
      count: data.count,
      costAmt: data.costAmt
    }));
  }, [categoryOrders]);

  const courierBreakdown = useMemo(() => {
    const map: Record<string, { count: number; costAmt: number }> = {};
    categoryOrders.forEach(o => {
      const courier = o.courier || 'Standard Logistics';
      if (!map[courier]) {
        map[courier] = { count: 0, costAmt: 0 };
      }
      map[courier].count += 1;
      map[courier].costAmt += (o.productCost + o.packagingCost);
    });

    return Object.entries(map).map(([courier, data]) => ({
      courier,
      count: data.count,
      costAmt: data.costAmt
    })).sort((a, b) => b.count - a.count);
  }, [categoryOrders]);

  const dateWiseBreakdown = useMemo(() => {
    const map: Record<string, { count: number; costAmt: number }> = {};
    categoryOrders.forEach(o => {
      const date = o.orderDate || 'Unknown';
      if (!map[date]) {
        map[date] = { count: 0, costAmt: 0 };
      }
      map[date].count += 1;
      map[date].costAmt += (o.productCost + o.packagingCost);
    });

    return Object.entries(map).map(([date, data]) => ({
      date,
      count: data.count,
      costAmt: data.costAmt
    })).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 8);
  }, [categoryOrders]);

  // Statistics
  const stats = useMemo(() => {
    const payouts = categoryOrders.map(o => o.actualPayout);
    const max = payouts.length > 0 ? Math.max(...payouts) : 0;
    const min = payouts.length > 0 ? Math.min(...payouts) : 0;
    const sum = payouts.reduce((a, b) => a + b, 0);
    const avg = payouts.length > 0 ? Math.round((sum / payouts.length) * 100) / 100 : 0;
    return { max, min, avg };
  }, [categoryOrders]);

  // Main table filter
  const filteredOrders = useMemo(() => {
    return categoryOrders.filter(o => {
      const matchesSearch = 
        searchTerm.trim() === '' ||
        o.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.awbNumber && o.awbNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        o.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerCity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.courier && o.courier.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesType = true;
      if (selectedReturnType) {
        const type = o.returnType || (o.status === 'Customer Return' ? 'CUSTOMER RETURN' : o.status === 'RTO' ? 'RTO' : o.status === 'Cancelled' ? 'CANCELLED' : 'DELIVERED');
        matchesType = type === selectedReturnType;
      }

      let matchesCourier = true;
      if (selectedCourier) {
        matchesCourier = (o.courier || 'Standard Logistics') === selectedCourier;
      }

      let matchesDate = true;
      if (selectedDate) {
        matchesDate = o.orderDate === selectedDate;
      }

      return matchesSearch && matchesType && matchesCourier && matchesDate;
    });
  }, [categoryOrders, searchTerm, selectedReturnType, selectedCourier, selectedDate]);

  // Export filtered rows to CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) return;
    const headers = [
      'Order Number',
      'Order Date',
      'Order Status',
      'Receive Scan Time',
      'Days',
      'AWB Number',
      'Courier',
      'Customer City',
      'Customer State',
      'Selling Price',
      'Qty',
      'Payout',
      'Claim'
    ];

    const rows = filteredOrders.map(o => [
      `"${o.orderId}"`,
      `"${o.orderDate}"`,
      `"${o.status}"`,
      `"${o.scanDate || '-'}"`,
      o.daysInTransit || 0,
      `"${o.awbNumber || '-'}"`,
      `"${o.courier || '-'}"`,
      `"${o.customerCity}"`,
      `"${o.customerState}"`,
      o.salePrice,
      o.quantity || 1,
      o.actualPayout,
      o.discrepancyAmount || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${category.key}_orders_${storeName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFilters = () => {
    setSelectedReturnType(null);
    setSelectedCourier(null);
    setSelectedDate(null);
    setSearchTerm('');
  };

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-[#f0f2f5] flex flex-col font-sans select-none overflow-hidden text-[#1e293b] animate-fadeIn">
      
      {/* ============================================================== */}
      {/* 1. TOP TITLE BANNER (Order Mantra Style with Red Accent Header) */}
      {/* ============================================================== */}
      <div className="bg-[#cc0000] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm border-b border-red-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-red-800 hover:bg-red-900 active:scale-95 text-white text-xs font-bold px-2.5 py-1 rounded transition-all shadow-xs"
            title="Return to Dashboard (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <div className="h-4 w-px bg-red-400/50 hidden sm:block" />
          <span className="font-bold text-sm tracking-wide">
            {category.title} - {storeName}
          </span>
        </div>

        {/* Search box right aligned */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <span className="text-white text-xs font-semibold mr-2 hidden sm:inline">
              Search On Order Number (F1)
            </span>
            <div className="relative">
              <input
                type="text"
                placeholder="Order ID / AWB / SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white text-black text-xs font-mono px-2 py-1 pl-7 rounded border border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-64 shadow-inner"
              />
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="bg-red-800 hover:bg-red-900 active:scale-95 text-white rounded px-2.5 py-1 text-xs font-bold transition-all ml-1 flex items-center gap-1"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="text-[11px] hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

        {/* ============================================================== */}
        {/* 2. SUB-BAR: Date Range & Row Counter                            */}
        {/* ============================================================== */}
        <div className="bg-[#faf5eb] border-b border-[#e2d9c8] px-4 py-1.5 flex flex-wrap items-center justify-between text-xs text-[#7c2d12] font-semibold shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-amber-900">
              <Calendar className="w-3.5 h-3.5" />
              <span>Orders Date Filter: Active Store Range</span>
              <span className="text-[11px] font-normal text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                Live Synced
              </span>
            </div>

            {(selectedReturnType || selectedCourier || selectedDate || searchTerm) && (
              <button
                onClick={handleClearFilters}
                className="text-[11px] bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 px-2 py-0.5 rounded font-bold transition-all"
              >
                Clear Active Filters ✕
              </button>
            )}
          </div>

          <div className="font-mono text-gray-700 font-bold text-xs">
            Total Rows - {filteredOrders.length} / {categoryOrders.length}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. MAIN WORKSPACE: Left Tabular Breakdowns + Right Excel Grid    */}
        {/* ============================================================== */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ------------------------------------------------------------ */}
          {/* LEFT SIDEBAR: Order Mantra Breakdown Tables                  */}
          {/* ------------------------------------------------------------ */}
          <div className="w-64 sm:w-72 border-r border-[#cbd5e1] bg-[#f8fafc] flex flex-col shrink-0 overflow-y-auto text-xs divide-y divide-[#cbd5e1]">
            
            {/* Table A: Return Type Breakdown */}
            <div className="p-2">
              <div className="bg-[#fde047]/40 px-2 py-1 text-[11px] font-bold text-gray-800 uppercase tracking-wider border border-amber-300 rounded-t flex justify-between">
                <span>Return Type</span>
                <span className="text-[10px] text-gray-600">Click to filter</span>
              </div>
              <table className="w-full border-collapse border border-t-0 border-[#cbd5e1] bg-white text-[11px]">
                <thead>
                  <tr className="bg-[#f1f5f9] text-gray-700 font-bold border-b border-[#cbd5e1]">
                    <th className="py-1 px-2 text-left">Type</th>
                    <th className="py-1 px-2 text-right">Count</th>
                    <th className="py-1 px-2 text-right">Cost AMT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {returnTypeBreakdown.map((row) => (
                    <tr
                      key={row.type}
                      onClick={() => setSelectedReturnType(selectedReturnType === row.type ? null : row.type)}
                      className={`cursor-pointer transition-colors ${
                        selectedReturnType === row.type
                          ? 'bg-blue-100 font-bold text-blue-900'
                          : 'hover:bg-amber-50 text-gray-800'
                      }`}
                    >
                      <td className="py-1 px-2">{row.type}</td>
                      <td className="py-1 px-2 text-right font-mono">{row.count}</td>
                      <td className="py-1 px-2 text-right font-mono">{row.costAmt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table B: Courier Breakdown */}
            <div className="p-2">
              <div className="bg-[#fed7aa]/50 px-2 py-1 text-[11px] font-bold text-orange-950 uppercase tracking-wider border border-orange-300 rounded-t flex justify-between">
                <span>Courier</span>
                <span className="text-[10px] text-gray-600">Click to filter</span>
              </div>
              <table className="w-full border-collapse border border-t-0 border-[#cbd5e1] bg-white text-[11px]">
                <thead>
                  <tr className="bg-[#f1f5f9] text-gray-700 font-bold border-b border-[#cbd5e1]">
                    <th className="py-1 px-2 text-left">Courier</th>
                    <th className="py-1 px-2 text-right">Count</th>
                    <th className="py-1 px-2 text-right">Cost AMT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {courierBreakdown.map((row) => (
                    <tr
                      key={row.courier}
                      onClick={() => setSelectedCourier(selectedCourier === row.courier ? null : row.courier)}
                      className={`cursor-pointer transition-colors ${
                        selectedCourier === row.courier
                          ? 'bg-blue-100 font-bold text-blue-900'
                          : 'hover:bg-orange-50 text-gray-800'
                      }`}
                    >
                      <td className="py-1 px-2 font-medium">{row.courier}</td>
                      <td className="py-1 px-2 text-right font-mono">{row.count}</td>
                      <td className="py-1 px-2 text-right font-mono">{row.costAmt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table C: Date Wise Breakdown */}
            <div className="p-2">
              <div className="bg-[#e2e8f0] px-2 py-1 text-[11px] font-bold text-gray-700 uppercase tracking-wider border border-slate-300 rounded-t">
                <span>Date Wise</span>
              </div>
              <table className="w-full border-collapse border border-t-0 border-[#cbd5e1] bg-white text-[11px]">
                <thead>
                  <tr className="bg-[#f1f5f9] text-gray-700 font-bold border-b border-[#cbd5e1]">
                    <th className="py-1 px-2 text-left">Date</th>
                    <th className="py-1 px-2 text-right">Count</th>
                    <th className="py-1 px-2 text-right">Cost AMT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {dateWiseBreakdown.map((row) => (
                    <tr
                      key={row.date}
                      onClick={() => setSelectedDate(selectedDate === row.date ? null : row.date)}
                      className={`cursor-pointer transition-colors ${
                        selectedDate === row.date
                          ? 'bg-blue-100 font-bold text-blue-900'
                          : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <td className="py-1 px-2 font-mono">{row.date}</td>
                      <td className="py-1 px-2 text-right font-mono">{row.count}</td>
                      <td className="py-1 px-2 text-right font-mono">{row.costAmt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Mini Cards: Wrong Rec, Claim Rec, etc. */}
            <div className="p-2 space-y-2 text-[11px]">
              <div className="bg-amber-50 p-2 rounded border border-amber-200">
                <div className="text-amber-800 font-bold">Wrong Return / Claim Status</div>
                <div className="flex justify-between mt-1 text-gray-700">
                  <span>Wrong Rec.: {categoryOrders.filter(o => o.discrepancyReason?.toLowerCase().includes('wrong')).length}</span>
                  <span className="font-mono font-bold text-red-600">
                    ₹{categoryOrders.filter(o => o.discrepancyReason?.toLowerCase().includes('wrong')).reduce((a, b) => a + b.salePrice, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mt-0.5 text-gray-700">
                  <span>Claim Rec.: {categoryOrders.filter(o => o.claimStatus === 'Approved').length}</span>
                  <span className="font-mono font-bold text-green-700">
                    ₹{categoryOrders.filter(o => o.claimStatus === 'Approved').reduce((a, b) => a + b.discrepancyAmount, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[10px]">
                <div className="font-sans font-bold text-slate-700">Return Charges Range</div>
                <div className="flex justify-between mt-1">
                  <span>Max: ₹{stats.max.toFixed(2)}</span>
                  <span>Min: ₹{stats.min.toFixed(2)}</span>
                  <span>Avg: ₹{stats.avg.toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ------------------------------------------------------------ */}
          {/* RIGHT: High-Density Excel-Like Table Grid                    */}
          {/* ------------------------------------------------------------ */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            
            {/* Spreadsheet Table Scroll Container */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-[11px] font-sans">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#fef3c7] text-[#78350f] font-bold border-b border-[#d97706] shadow-xs">
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">Order Number (F1)</th>
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">Order Date (F2)</th>
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">Order Status</th>
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">Receive Scan Time (F3)</th>
                    <th className="py-2 px-2 text-center border-r border-[#fcd34d] whitespace-nowrap">Days</th>
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">AWB Number (F4)</th>
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">Courier</th>
                    <th className="py-2 px-2.5 text-left border-r border-[#fcd34d] whitespace-nowrap">Customer City</th>
                    <th className="py-2 px-2.5 text-right border-r border-[#fcd34d] whitespace-nowrap">Selling</th>
                    <th className="py-2 px-2 text-center border-r border-[#fcd34d] whitespace-nowrap">Qty</th>
                    <th className="py-2 px-2.5 text-right border-r border-[#fcd34d] whitespace-nowrap">Payout</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Claim / Dispute</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-gray-500 font-sans">
                        <div className="flex flex-col items-center gap-2">
                          <SlidersHorizontal className="w-8 h-8 text-gray-400 stroke-[1.5]" />
                          <span className="font-bold text-sm">No orders found in this category / filter</span>
                          <span className="text-xs text-gray-400">Try clearing active search or filters</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order, idx) => {
                      const isSelected = selectedOrder?.id === order.id;
                      const isEven = idx % 2 === 0;

                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`cursor-pointer transition-colors border-b border-[#e2e8f0] ${
                            isSelected
                              ? 'bg-[#38bdf8]/30 font-semibold text-blue-950'
                              : isEven
                              ? 'bg-white hover:bg-[#f0f9ff]'
                              : 'bg-[#f8fafc] hover:bg-[#f0f9ff]'
                          }`}
                        >
                          {/* Order Number */}
                          <td className="py-1.5 px-2.5 font-mono border-r border-[#e2e8f0] text-blue-700 whitespace-nowrap">
                            {order.orderId}
                          </td>

                          {/* Order Date */}
                          <td className="py-1.5 px-2.5 font-mono border-r border-[#e2e8f0] whitespace-nowrap text-gray-700">
                            {order.orderDate}
                          </td>

                          {/* Order Status */}
                          <td className="py-1.5 px-2.5 border-r border-[#e2e8f0] whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                                order.status === 'Delivered'
                                  ? 'bg-green-100 text-green-800'
                                  : order.status === 'Customer Return' || order.returnType === 'CUSTOMER RETURN'
                                  ? 'bg-amber-100 text-amber-800'
                                  : order.status === 'RTO' || order.returnType === 'RTO'
                                  ? 'bg-orange-100 text-orange-800'
                                  : order.status === 'Cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {order.returnType || order.status}
                            </span>
                          </td>

                          {/* Receive Scan Time */}
                          <td className="py-1.5 px-2.5 font-mono text-[10px] text-gray-600 border-r border-[#e2e8f0] whitespace-nowrap">
                            {order.scanDate || '-'}
                          </td>

                          {/* Days */}
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-gray-700 border-r border-[#e2e8f0]">
                            {order.daysInTransit !== undefined ? order.daysInTransit : '-'}
                          </td>

                          {/* AWB Number */}
                          <td className="py-1.5 px-2.5 font-mono text-[11px] text-gray-800 border-r border-[#e2e8f0] whitespace-nowrap">
                            {order.awbNumber || '-'}
                          </td>

                          {/* Courier */}
                          <td className="py-1.5 px-2.5 border-r border-[#e2e8f0] text-gray-700 whitespace-nowrap font-medium">
                            {order.courier || '-'}
                          </td>

                          {/* Customer City & State (REAL ADDRESS) */}
                          <td className="py-1.5 px-2.5 border-r border-[#e2e8f0] whitespace-nowrap">
                            <span className="font-semibold text-gray-900">{order.customerCity}</span>
                            {order.customerState && order.customerState !== order.customerCity && (
                              <span className="text-[10px] text-gray-500 ml-1">({order.customerState})</span>
                            )}
                          </td>

                          {/* Selling Price */}
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900 border-r border-[#e2e8f0]">
                            {order.salePrice.toFixed(2)}
                          </td>

                          {/* Qty */}
                          <td className="py-1.5 px-2 text-center font-mono text-gray-700 border-r border-[#e2e8f0]">
                            {order.quantity || 1}
                          </td>

                          {/* Payout */}
                          <td
                            className={`py-1.5 px-2.5 text-right font-mono font-bold border-r border-[#e2e8f0] ${
                              order.actualPayout < 0
                                ? 'text-red-600'
                                : order.actualPayout > 0
                                ? 'text-green-700'
                                : 'text-gray-600'
                            }`}
                          >
                            {order.actualPayout.toFixed(2)}
                          </td>

                          {/* Claim / Dispute */}
                          <td className="py-1.5 px-2.5 text-right">
                            {order.claimEligible ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenClaim) onOpenClaim(order);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-xs transition-all"
                              >
                                Dispute SPF
                              </button>
                            ) : order.reconciliationStatus === 'Discrepancy' ? (
                              <span className="text-red-600 font-mono text-[10px] font-bold">
                                -₹{order.discrepancyAmount}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-mono text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ============================================================== */}
            {/* 4. BOTTOM TOOLBAR (Excel / Order Mantra Desktop Actions)       */}
            {/* ============================================================== */}
            <div className="bg-[#f8fafc] border-t border-[#cbd5e1] p-2 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
              
              {/* Left stats */}
              <div className="flex items-center gap-3 font-mono text-gray-700 font-semibold px-2">
                <span>Max: <strong className="text-gray-900">{stats.max.toFixed(2)}</strong></span>
                <span className="text-gray-400">|</span>
                <span>Min: <strong className="text-gray-900">{stats.min.toFixed(2)}</strong></span>
                <span className="text-gray-400">|</span>
                <span>Avg: <strong className="text-gray-900">{stats.avg.toFixed(2)}</strong></span>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleExportCsv}
                  className="bg-white hover:bg-gray-100 text-gray-800 font-semibold px-3 py-1.5 rounded border border-gray-300 shadow-xs flex items-center gap-1 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => {
                    if (selectedOrder) setShowOrderDetailsModal(true);
                  }}
                  disabled={!selectedOrder}
                  className="bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-800 font-semibold px-3 py-1.5 rounded border border-gray-300 shadow-xs flex items-center gap-1 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Order Details</span>
                </button>

                <button
                  onClick={() => {
                    if (selectedOrder?.awbNumber) {
                      window.open(`https://www.google.com/search?q=${selectedOrder.courier || ''}+tracking+${selectedOrder.awbNumber}`, '_blank');
                    } else {
                      alert('Selected order does not have an AWB tracking number recorded.');
                    }
                  }}
                  className="bg-white hover:bg-gray-100 text-gray-800 font-semibold px-3 py-1.5 rounded border border-gray-300 shadow-xs flex items-center gap-1 transition-all"
                >
                  <Truck className="w-3.5 h-3.5 text-green-600" />
                  <span>Track POD</span>
                </button>

                {onDeleteOrder && selectedOrder && (
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete order ${selectedOrder.orderId}?`)) {
                        onDeleteOrder(selectedOrder.orderId);
                        setSelectedOrder(null);
                      }
                    }}
                    className="bg-white hover:bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded border border-red-200 shadow-xs flex items-center gap-1 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="bg-[#cc0000] hover:bg-[#b30000] text-white font-bold px-4 py-1.5 rounded shadow-xs transition-all ml-2"
                >
                  Close
                </button>
              </div>

            </div>

          </div>

        </div>

      {/* Item Detail Popover */}
      {showOrderDetailsModal && selectedOrder && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full border border-gray-300 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedOrder.marketplace.toUpperCase()} ORDER
                </span>
                <h4 className="text-base font-bold font-mono text-gray-900 mt-1">
                  {selectedOrder.orderId}
                </h4>
              </div>
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600 font-sans">Customer Destination:</span>
                <span className="font-bold text-gray-900">{selectedOrder.customerCity}, {selectedOrder.customerState}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600 font-sans">AWB & Courier:</span>
                <span className="font-bold text-gray-900">{selectedOrder.courier || '-'} ({selectedOrder.awbNumber || 'No AWB'})</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600 font-sans">Selling Price:</span>
                <span className="font-bold text-gray-900">₹{selectedOrder.salePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600 font-sans">Product Cost (COGS):</span>
                <span className="text-gray-700">-₹{selectedOrder.productCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600 font-sans">Packaging Cost:</span>
                <span className="text-gray-700">-₹{selectedOrder.packagingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600 font-sans">Shipping Fee:</span>
                <span className="text-gray-700">-₹{selectedOrder.shippingFee.toFixed(2)}</span>
              </div>
              {selectedOrder.reverseShippingFee > 0 && (
                <div className="flex justify-between py-1 border-b text-red-600 font-bold">
                  <span className="font-sans">Reverse Shipping / RTO:</span>
                  <span>-₹{selectedOrder.reverseShippingFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-t border-gray-400 font-bold text-gray-900">
                <span className="font-sans">Actual Bank Payout:</span>
                <span className={selectedOrder.actualPayout < 0 ? 'text-red-600' : 'text-green-700'}>
                  ₹{selectedOrder.actualPayout.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {selectedOrder.claimEligible && onOpenClaim && (
                <button
                  onClick={() => {
                    onOpenClaim(selectedOrder);
                    setShowOrderDetailsModal(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded"
                >
                  File Dispute Claim
                </button>
              )}
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs px-4 py-1.5 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
