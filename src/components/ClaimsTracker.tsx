import React, { useState } from 'react';
import { ClaimItem, OrderItem } from '../types';
import { Plus, CheckCircle2, Clock, X } from 'lucide-react';

interface ClaimsTrackerProps {
  claims: ClaimItem[];
  orders: OrderItem[];
  onAddClaim: (claim: ClaimItem) => void;
}

export const ClaimsTracker: React.FC<ClaimsTrackerProps> = ({ claims, orders, onAddClaim }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [claimType, setClaimType] = useState<ClaimItem['claimType']>('Wrong Return');
  const [claimAmount, setClaimAmount] = useState<number>(150);
  const [notes, setNotes] = useState('');

  const totalRecovered = claims
    .filter((c) => c.status === 'Approved')
    .reduce((sum, c) => sum + c.amountApproved, 0);

  const pendingAmount = claims
    .filter((c) => c.status === 'Filed' || c.status === 'Draft')
    .reduce((sum, c) => sum + c.amountClaimed, 0);

  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const order = orders.find((o) => o.orderId === selectedOrderId);

    const newClaim: ClaimItem = {
      id: `clm-${Date.now()}`,
      orderId: selectedOrderId || (orders[0]?.orderId ?? 'ORD-NEW'),
      marketplace: order?.marketplace ?? 'flipkart',
      sku: order?.sku ?? 'PRODUCT-SKU',
      claimType,
      amountClaimed: Number(claimAmount) || 100,
      amountApproved: 0,
      filingDate: new Date().toISOString().split('T')[0],
      status: 'Filed',
      ticketId: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    onAddClaim(newClaim);
    setIsModalOpen(false);
    setSelectedOrderId('');
  };

  return (
    <div className="space-y-6">
      
      {/* Recovery Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface-elevated rounded-card p-5 border border-leaf/30 shadow-soft">
          <span className="text-xs font-bold text-ink-muted uppercase">Recovered Funds</span>
          <div className="mt-2 text-2xl font-bold font-mono text-leaf-deep">
            ₹{totalRecovered.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-ink-muted mt-2">Money approved and returned to your bank</p>
        </div>

        <div className="bg-surface-elevated rounded-card p-5 border border-sun/30 shadow-soft">
          <span className="text-xs font-bold text-ink-muted uppercase">Pending Under Review</span>
          <div className="mt-2 text-2xl font-bold font-mono text-sun-deep">
            ₹{pendingAmount.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-ink-muted mt-2">Awaiting marketplace ticket resolution</p>
        </div>

        <div className="bg-surface-elevated rounded-card p-5 border border-outline shadow-soft flex flex-col justify-between">
          <span className="text-xs font-bold text-ink-muted uppercase">Action</span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-sky text-white py-2.5 rounded-button font-bold text-sm shadow-soft hover:bg-sky-deep transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>File New Claim</span>
          </button>
        </div>
      </div>

      {/* Claims List */}
      <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
        <div className="p-5 border-b border-outline flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold font-display text-ink">Active Dispute & SPF Claims</h3>
            <p className="text-xs text-ink-muted">
              Never let damaged returns, wrong returns, or weight overcharges slip through
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-sunken text-xs font-bold text-ink-muted uppercase border-b border-outline">
              <tr>
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Order ID & Channel</th>
                <th className="py-3 px-4">Claim Type</th>
                <th className="py-3 px-4 text-right">Claimed</th>
                <th className="py-3 px-4 text-right">Approved</th>
                <th className="py-3 px-4 text-center">Deadline</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted text-xs">
                    No active dispute claims filed. Upload your returns or settlement report to auto-detect claimable items.
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-surface/80">
                  <td className="py-3.5 px-4 font-mono font-bold text-xs text-ink">
                    {claim.ticketId || 'DRAFT'}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-mono text-xs font-bold text-sky-deep">{claim.orderId}</div>
                    <span className="text-[11px] text-ink-muted capitalize">{claim.marketplace}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="text-xs font-semibold text-ink">{claim.claimType}</span>
                    <div className="text-[11px] text-ink-muted font-mono">{claim.sku}</div>
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono font-medium">
                    ₹{claim.amountClaimed}
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono font-bold text-leaf-deep">
                    ₹{claim.amountApproved}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono text-xs text-ink-muted">
                    {claim.deadlineDate}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        claim.status === 'Approved'
                          ? 'bg-leaf-soft text-leaf-deep border border-leaf/20'
                          : claim.status === 'Filed'
                          ? 'bg-sun-bright/20 text-sun-deep border border-sun/30'
                          : 'bg-surface-sunken text-ink-muted border border-outline'
                      }`}
                    >
                      {claim.status === 'Approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {claim.status === 'Filed' && <Clock className="w-3.5 h-3.5" />}
                      <span>{claim.status}</span>
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal to File New Claim */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-panel border border-outline shadow-modal w-full max-w-md p-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-outline">
              <h3 className="text-lg font-bold font-display text-ink">File Marketplace Claim</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-sunken text-ink-muted hover:text-ink flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
                  Select Order
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full bg-surface border border-outline rounded-xl p-2.5 text-sm font-mono text-ink focus:outline-none focus:border-sky"
                  required
                >
                  <option value="">Select an order ID...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.orderId}>
                      {o.orderId} - {o.sku} ({o.marketplace})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
                  Dispute Reason
                </label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value as ClaimItem['claimType'])}
                  className="w-full bg-surface border border-outline rounded-xl p-2.5 text-sm text-ink focus:outline-none focus:border-sky"
                >
                  <option value="Wrong Return">Wrong Return (Received different item)</option>
                  <option value="Damaged in Transit">Damaged in Transit (Broken item)</option>
                  <option value="Weight Mismatch Overcharge">Weight Mismatch Overcharge</option>
                  <option value="Payment Not Credited">Payment Not Credited (Past 14 days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
                  Amount to Claim (₹)
                </label>
                <input
                  type="number"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(Number(e.target.value))}
                  className="w-full bg-surface border border-outline rounded-xl p-2.5 text-sm font-mono text-ink focus:outline-none focus:border-sky"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
                  Unboxing Video / Image Proof Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Paste local evidence file path or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface border border-outline rounded-xl p-2.5 text-sm text-ink focus:outline-none focus:border-sky resize-none"
                />
              </div>

              <div className="pt-3 border-t border-outline flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-ink-muted bg-surface border border-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-button text-xs font-bold text-white bg-sky hover:bg-sky-deep shadow-soft"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
