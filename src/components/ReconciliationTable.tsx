import React, { useState } from 'react';
import { OrderItem } from '../types';
import { 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Scale,
  Download,
  AlertTriangle
} from 'lucide-react';

interface ReconciliationTableProps {
  orders: OrderItem[];
  onOpenClaim: (order: OrderItem) => void;
}

export const ReconciliationTable: React.FC<ReconciliationTableProps> = ({ orders, onOpenClaim }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Settled' | 'Discrepancy' | 'WeightAlert'>('All');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.bankUtr && order.bankUtr.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.customerCity.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === 'Settled') {
      matchesStatus = order.reconciliationStatus === 'Settled';
    } else if (statusFilter === 'Discrepancy') {
      matchesStatus = order.reconciliationStatus === 'Discrepancy';
    } else if (statusFilter === 'WeightAlert') {
      matchesStatus = Boolean(order.weightDiscrepancy);
    }

    return matchesSearch && matchesStatus;
  });

  const handleExportCsv = () => {
    if (orders.length === 0) return;
    const headers = [
      'Order ID',
      'Marketplace',
      'Order Date',
      'SKU',
      'Title',
      'Status',
      'Sale Price',
      'Product Cost',
      'Commission',
      'Shipping Fee',
      'Reverse Shipping',
      'Taxes GST',
      'Expected Payout',
      'Actual Payout',
      'Discrepancy Amount',
      'Discrepancy Reason',
      'Billed Weight (g)',
      'Actual Weight (g)',
      'Bank UTR',
      'Reconciliation Status'
    ];

    const rows = filteredOrders.map(o => [
      `"${o.orderId}"`,
      `"${o.marketplace}"`,
      `"${o.orderDate}"`,
      `"${o.sku}"`,
      `"${o.title.replace(/"/g, '""')}"`,
      `"${o.status}"`,
      o.salePrice,
      o.productCost,
      o.marketplaceCommission,
      o.shippingFee,
      o.reverseShippingFee,
      o.taxesAndGst,
      o.expectedPayout,
      o.actualPayout,
      o.discrepancyAmount,
      `"${(o.discrepancyReason || '').replace(/"/g, '""')}"`,
      o.billedWeightGrams || '',
      o.actualWeightGrams || '',
      `"${o.bankUtr || ''}"`,
      `"${o.reconciliationStatus}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SellWise_Reconciliation_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
      
      {/* Table Controls */}
      <div className="p-5 border-b border-outline flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold font-display text-ink">Reconciliation & Order Ledger</h3>
          <p className="text-xs text-ink-muted">
            Tracking exact marketplace payout vs expected receivable with instant discrepancy & weight leak detection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Order ID, SKU, UTR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink placeholder:text-ink-muted focus:outline-none focus:border-sky w-56 md:w-64"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-outline bg-surface-sunken text-ink hover:bg-surface-elevated hover:border-sky transition-all"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-sky" />
            <span>Export CSV</span>
          </button>

          {/* Filter Pills */}
          <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-outline">
            {(['All', 'Settled', 'Discrepancy', 'WeightAlert'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === filter
                    ? 'bg-surface-elevated text-sky-deep shadow-soft border border-outline'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {filter === 'WeightAlert' ? '⚖️ Weight Leaks' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-outline bg-surface-sunken/60 text-ink-muted font-bold">
              <th className="py-3.5 px-4">Order / Channel</th>
              <th className="py-3.5 px-4">SKU / Item</th>
              <th className="py-3.5 px-4 text-center">Weight Audit</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Sale Price</th>
              <th className="py-3.5 px-4 text-right">Expected</th>
              <th className="py-3.5 px-4 text-right">Actual Settled</th>
              <th className="py-3.5 px-4 text-right">Discrepancy</th>
              <th className="py-3.5 px-4 text-center">Bank UTR</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-ink-muted">
                  No orders found matching your search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isDiscrepant = order.reconciliationStatus === 'Discrepancy';
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-surface-sunken/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-ink font-mono">{order.orderId}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            order.marketplace === 'meesho'
                              ? 'bg-pink-100 text-pink-700'
                              : order.marketplace === 'flipkart'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.marketplace}
                        </span>
                        <span className="text-[10px] text-ink-muted">{order.orderDate}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="font-bold text-ink truncate">{order.sku}</div>
                      <div className="text-[11px] text-ink-muted truncate">{order.title}</div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {order.weightDiscrepancy ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-coral-soft text-coral border border-coral/30" title={`Billed: ${order.billedWeightGrams}g, Actual: ${order.actualWeightGrams}g`}>
                          <Scale className="w-3 h-3" />
                          <span>+{((order.billedWeightGrams || 0) - (order.actualWeightGrams || 0))}g Over</span>
                        </div>
                      ) : order.billedWeightGrams ? (
                        <span className="text-[11px] font-mono text-ink-muted">
                          {order.billedWeightGrams}g
                        </span>
                      ) : (
                        <span className="text-ink-muted/40 font-mono text-[11px]">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          order.status === 'Delivered'
                            ? 'bg-leaf-soft text-leaf-deep'
                            : order.status === 'Customer Return'
                            ? 'bg-coral-soft text-coral'
                            : order.status === 'RTO'
                            ? 'bg-sun-bright/20 text-sun-deep'
                            : 'bg-surface-sunken text-ink-muted'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-ink">
                      ₹{order.salePrice.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium text-ink-muted">
                      ₹{order.expectedPayout.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-ink">
                      ₹{order.actualPayout.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      {isDiscrepant ? (
                        <span className="text-coral flex items-center justify-end gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          -₹{order.discrepancyAmount.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-leaf-deep flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Matched
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {order.bankUtr ? (
                        <span className="font-mono text-[10px] bg-sky-soft/40 text-sky-deep px-2 py-0.5 rounded-md border border-sky/20">
                          {order.bankUtr.slice(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-muted">Direct</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {order.claimEligible ? (
                        <button
                          onClick={() => onOpenClaim(order)}
                          className="bg-coral text-white hover:bg-coral/90 px-3 py-1.5 rounded-xl font-bold text-[11px] shadow-soft transition-all"
                        >
                          Dispute SPF
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-sky hover:underline font-bold text-[11px]"
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detailed Order Breakdown Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-modal max-w-lg w-full border border-outline shadow-2xl p-6 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-outline pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-deep bg-sky-soft px-2 py-0.5 rounded-md">
                  {selectedOrder.marketplace} Order Detail
                </span>
                <h4 className="text-lg font-bold font-display text-ink mt-1 font-mono">
                  {selectedOrder.orderId}
                </h4>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-surface-sunken rounded-2xl p-4 border border-outline space-y-2 font-mono">
                <div className="flex justify-between text-ink font-bold pb-2 border-b border-outline">
                  <span>Gross Selling Price</span>
                  <span>₹{selectedOrder.salePrice}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Product Base Cost (COGS)</span>
                  <span>-₹{selectedOrder.productCost}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Packaging & Material</span>
                  <span>-₹{selectedOrder.packagingCost}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Marketplace Commission</span>
                  <span>-₹{selectedOrder.marketplaceCommission}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Forward Shipping Charge</span>
                  <span>-₹{selectedOrder.shippingFee}</span>
                </div>
                {selectedOrder.reverseShippingFee > 0 && (
                  <div className="flex justify-between text-coral font-bold">
                    <span>Reverse Shipping / RTO Penalty</span>
                    <span>-₹{selectedOrder.reverseShippingFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-ink-muted">
                  <span>Taxes & GST Deduction</span>
                  <span>-₹{selectedOrder.taxesAndGst}</span>
                </div>
                <div className="flex justify-between text-ink font-bold pt-2 border-t border-outline">
                  <span>Expected Settlement Receivable</span>
                  <span>₹{selectedOrder.expectedPayout}</span>
                </div>
                <div className="flex justify-between text-sky-deep font-bold">
                  <span>Actual Net Amount Paid</span>
                  <span>₹{selectedOrder.actualPayout}</span>
                </div>
              </div>

              {selectedOrder.weightDiscrepancy && (
                <div className="p-3 bg-coral-soft/50 rounded-xl border border-coral/30 text-coral flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Weight Overcharge Detected: </span>
                    Courier billed at {selectedOrder.billedWeightGrams}g, but master SKU physical weight is {selectedOrder.actualWeightGrams}g.
                  </div>
                </div>
              )}

              {selectedOrder.bankUtr && (
                <div className="p-3 bg-surface-sunken rounded-xl border border-outline flex items-center justify-between text-ink-muted">
                  <span className="font-bold">Bank NEFT/UTR:</span>
                  <span className="font-mono text-ink font-bold">{selectedOrder.bankUtr}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-ink-muted hover:bg-surface-sunken"
                >
                  Close
                </button>
                {selectedOrder.claimEligible && (
                  <button
                    onClick={() => {
                      onOpenClaim(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="px-5 py-2 rounded-button text-xs font-bold bg-coral text-white shadow-soft hover:bg-coral/90"
                  >
                    File SPF Dispute Claim
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
