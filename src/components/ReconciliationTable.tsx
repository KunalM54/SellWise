import React, { useState } from 'react';
import { OrderItem } from '../types';
import { 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  X,
} from 'lucide-react';

interface ReconciliationTableProps {
  orders: OrderItem[];
  onOpenClaim: (order: OrderItem) => void;
}

export const ReconciliationTable: React.FC<ReconciliationTableProps> = ({ orders, onOpenClaim }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Settled' | 'Discrepancy'>('All');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerCity.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ? true : order.reconciliationStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
      
      {/* Table Controls */}
      <div className="p-5 border-b border-outline flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold font-display text-ink">Reconciliation & Order Ledger</h3>
          <p className="text-xs text-ink-muted">
            Tracking exact marketplace payout vs expected receivable with instant discrepancy detection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Order ID or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface border border-outline rounded-xl pl-9 pr-4 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-sky focus:ring-2 focus:ring-sky-soft w-64"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-outline">
            {(['All', 'Settled', 'Discrepancy'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-surface-elevated text-sky-deep shadow-soft border border-outline'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-sunken text-xs font-bold text-ink-muted uppercase border-b border-outline">
            <tr>
              <th className="py-3 px-4">Order ID & Date</th>
              <th className="py-3 px-4">Marketplace</th>
              <th className="py-3 px-4">SKU / Product</th>
              <th className="py-3 px-4 text-right">Sale Price</th>
              <th className="py-3 px-4 text-right">Expected Payout</th>
              <th className="py-3 px-4 text-right">Actual Payout</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Reconciliation</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-ink-muted text-sm">
                  No orders match your filter criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isDiscrepant = order.reconciliationStatus === 'Discrepancy';
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-surface/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-ink text-xs">{order.orderId}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5">{order.orderDate}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="capitalize px-2.5 py-1 rounded-lg text-xs font-bold bg-surface border border-outline inline-block">
                        {order.marketplace}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="font-mono text-xs font-bold text-sky-deep truncate">{order.sku}</div>
                      <div className="text-[11px] text-ink-muted truncate">{order.title}</div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium">
                      ₹{order.salePrice}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium text-ink">
                      ₹{order.expectedPayout}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span className={order.actualPayout < 0 ? 'text-coral' : 'text-leaf-deep'}>
                        ₹{order.actualPayout}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                          order.status === 'Delivered'
                            ? 'bg-leaf-soft text-leaf-deep'
                            : order.status === 'RTO'
                            ? 'bg-coral-soft text-coral'
                            : order.status === 'Customer Return'
                            ? 'bg-coral-soft text-coral font-bold'
                            : 'bg-sky-soft text-sky-deep'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {isDiscrepant ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-coral-soft text-coral border border-coral/20">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>-₹{order.discrepancyAmount}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-leaf-soft text-leaf-deep border border-leaf/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Matched</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {order.claimEligible ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenClaim(order);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sun-bright/20 text-sun-deep text-xs font-bold border border-sun/30 hover:bg-sun-bright/40 transition-all"
                        >
                          Claim SPF
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                          className="text-xs text-ink-muted hover:text-sky font-bold"
                        >
                          View Breakdown
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

      {/* Order Financial Breakdown Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-panel border border-outline shadow-modal w-full max-w-lg p-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-outline">
              <div>
                <span className="text-xs font-bold text-ink-muted uppercase">P&L Breakdown</span>
                <h3 className="text-lg font-bold font-display text-ink">{selectedOrder.orderId}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-surface-sunken text-ink-muted hover:text-ink flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Calculations List */}
            <div className="py-4 space-y-2.5 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-ink-muted">Gross Selling Price</span>
                <span className="font-bold text-ink">₹{selectedOrder.salePrice}</span>
              </div>
              <div className="flex justify-between font-mono text-coral">
                <span>Product Base Cost</span>
                <span>-₹{selectedOrder.productCost}</span>
              </div>
              <div className="flex justify-between font-mono text-coral">
                <span>Packaging & Material</span>
                <span>-₹{selectedOrder.packagingCost}</span>
              </div>
              <div className="flex justify-between font-mono text-coral">
                <span>Marketplace Commission</span>
                <span>-₹{selectedOrder.marketplaceCommission}</span>
              </div>
              <div className="flex justify-between font-mono text-coral">
                <span>Forward Shipping Fee</span>
                <span>-₹{selectedOrder.shippingFee}</span>
              </div>
              {selectedOrder.reverseShippingFee > 0 && (
                <div className="flex justify-between font-mono text-coral font-bold">
                  <span>Reverse RTO Penalty</span>
                  <span>-₹{selectedOrder.reverseShippingFee}</span>
                </div>
              )}
              <div className="flex justify-between font-mono text-coral">
                <span>GST & TCS/TDS</span>
                <span>-₹{selectedOrder.taxesAndGst}</span>
              </div>

              <div className="pt-3 border-t border-outline flex justify-between font-mono font-bold text-base">
                <span>Net Profit / Loss</span>
                <span
                  className={
                    selectedOrder.actualPayout - selectedOrder.productCost - selectedOrder.packagingCost < 0
                      ? 'text-coral'
                      : 'text-leaf-deep'
                  }
                >
                  ₹{selectedOrder.actualPayout - selectedOrder.productCost - selectedOrder.packagingCost}
                </span>
              </div>

              {selectedOrder.discrepancyReason && (
                <div className="mt-4 p-3 rounded-xl bg-coral-soft border border-coral/20 text-xs text-coral">
                  <strong>Discrepancy Note:</strong> {selectedOrder.discrepancyReason}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-outline flex justify-end gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-ink-muted hover:text-ink bg-surface border border-outline"
              >
                Close
              </button>
              {selectedOrder.claimEligible && (
                <button
                  onClick={() => {
                    const ord = selectedOrder;
                    setSelectedOrder(null);
                    onOpenClaim(ord);
                  }}
                  className="px-4 py-2 rounded-button text-xs font-bold text-white bg-sky hover:bg-sky-deep transition-all shadow-soft"
                >
                  File Dispute Claim
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
