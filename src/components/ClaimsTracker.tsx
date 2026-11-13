import React, { useState } from 'react';
import { ClaimItem, OrderItem } from '../types';
import { Plus, CheckCircle2, Clock, X, Download, ShieldCheck } from 'lucide-react';

interface ClaimsTrackerProps {
  claims: ClaimItem[];
  orders: OrderItem[];
  onAddClaim: (claim: ClaimItem) => void;
  onUpdateClaimStatus?: (claimId: string, status: ClaimItem['status'], amountApproved: number) => void;
}

export const ClaimsTracker: React.FC<ClaimsTrackerProps> = ({ 
  claims, 
  orders, 
  onAddClaim,
  onUpdateClaimStatus 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [claimType, setClaimType] = useState<ClaimItem['claimType']>('Wrong Return');
  const [claimAmount, setClaimAmount] = useState<number>(150);
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Filed' | 'Approved' | 'Rejected'>('All');

  const totalRecovered = claims
    .filter((c) => c.status === 'Approved')
    .reduce((sum, c) => sum + c.amountApproved, 0);

  const pendingAmount = claims
    .filter((c) => c.status === 'Filed' || c.status === 'Draft')
    .reduce((sum, c) => sum + c.amountClaimed, 0);

  const filteredClaims = claims.filter((c) => {
    if (statusFilter === 'All') return true;
    return c.status === statusFilter;
  });

  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const order = orders.find((o) => o.orderId === selectedOrderId);

    const newClaim: ClaimItem = {
      id: `clm-${Date.now()}`,
      orderId: selectedOrderId || (orders[0]?.orderId ?? 'ORD-NEW'),
      marketplace: order?.marketplace ?? 'meesho',
      sku: order?.sku ?? 'PRODUCT-SKU',
      claimType,
      amountClaimed: Number(claimAmount) || 100,
      amountApproved: 0,
      filingDate: new Date().toISOString().split('T')[0],
      status: 'Filed',
      ticketId: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      deadlineDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      evidenceNotes: notes,
    };

    onAddClaim(newClaim);
    setIsModalOpen(false);
    setSelectedOrderId('');
    setNotes('');
  };

  // Export dispute package for Meesho/Flipkart ticket filing
  const handleExportDisputeCsv = () => {
    if (claims.length === 0) return;

    const headers = [
      'Ticket ID',
      'Order ID',
      'Marketplace',
      'SKU',
      'Claim Type',
      'Amount Claimed',
      'Amount Approved',
      'Filing Date',
      'Deadline Date',
      'Status',
      'Evidence Notes'
    ];

    const rows = filteredClaims.map((c) => [
      `"${c.ticketId || ''}"`,
      `"${c.orderId}"`,
      `"${c.marketplace.toUpperCase()}"`,
      `"${c.sku}"`,
      `"${c.claimType}"`,
      c.amountClaimed,
      c.amountApproved,
      `"${c.filingDate}"`,
      `"${c.deadlineDate}"`,
      `"${c.status}"`,
      `"${(c.evidenceNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SellWise_Dispute_Claims_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface-elevated rounded-card p-5 border border-outline shadow-soft">
          <div className="flex items-center justify-between text-xs font-bold text-ink-muted">
            <span>Total Recovered</span>
            <CheckCircle2 className="w-4 h-4 text-leaf" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-leaf-deep font-mono">
            ₹{totalRecovered.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-ink-muted mt-1">Successfully claimed and credited</p>
        </div>

        <div className="bg-surface-elevated rounded-card p-5 border border-outline shadow-soft">
          <div className="flex items-center justify-between text-xs font-bold text-ink-muted">
            <span>Pending Resolution</span>
            <Clock className="w-4 h-4 text-sun-deep" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-sun-deep font-mono">
            ₹{pendingAmount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-ink-muted mt-1">Under review with marketplace teams</p>
        </div>

        <div className="bg-surface-elevated rounded-card p-5 border border-outline shadow-soft">
          <div className="flex items-center justify-between text-xs font-bold text-ink-muted">
            <span>Total Claims Filed</span>
            <ShieldCheck className="w-4 h-4 text-sky" />
          </div>
          <div className="mt-2 text-2xl font-bold font-display text-ink font-mono">
            {claims.length} Cases
          </div>
          <p className="text-[11px] text-ink-muted mt-1">Wrong returns & weight overcharges</p>
        </div>
      </div>

      {/* Main Claims Ledger */}
      <div className="bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden">
        <div className="p-5 border-b border-outline flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold font-display text-ink">Dispute & Claims Center</h3>
            <p className="text-xs text-ink-muted">
              File, manage, and track SPF (Seller Protection Fund) & discrepancy claims before deadlines lapse
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportDisputeCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-outline bg-surface-sunken text-ink hover:bg-surface-elevated hover:border-sky transition-all"
            >
              <Download className="w-3.5 h-3.5 text-sky" />
              <span>Export Dispute Sheet</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-sky text-white px-4 py-2 rounded-button text-xs font-bold shadow-soft hover:bg-sky-deep transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Claim Ticket</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="px-5 py-3 border-b border-outline bg-surface-sunken/40 flex items-center gap-2 overflow-x-auto text-xs">
          {(['All', 'Filed', 'Approved', 'Draft', 'Rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                statusFilter === s
                  ? 'bg-surface-elevated text-sky-deep shadow-soft border border-outline'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Claims Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline bg-surface-sunken/70 text-ink-muted font-bold">
                <th className="py-3 px-4">Ticket / Order ID</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Claim Type</th>
                <th className="py-3 px-4 text-right">Claimed</th>
                <th className="py-3 px-4 text-right">Approved</th>
                <th className="py-3 px-4 text-center">Deadline</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-muted">
                    <ShieldCheck className="w-8 h-8 mx-auto text-ink-muted/50 mb-2" />
                    <p className="font-bold">No claims found in this view</p>
                    <p className="text-[11px]">Click &quot;New Claim Ticket&quot; or scan a damaged return parcel.</p>
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-surface-sunken/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-ink font-mono">{claim.ticketId || 'DRAFT'}</div>
                      <div className="text-[11px] text-ink-muted font-mono">{claim.orderId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        claim.marketplace === 'meesho'
                          ? 'bg-pink-100 text-pink-700'
                          : claim.marketplace === 'flipkart'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {claim.marketplace}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-ink">{claim.claimType}</div>
                      <div className="text-[11px] text-ink-muted truncate max-w-[200px]">
                        {claim.evidenceNotes || claim.sku}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-ink">
                      ₹{claim.amountClaimed.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-leaf-deep">
                      ₹{claim.amountApproved.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center text-ink-muted font-mono">
                      {claim.deadlineDate}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        claim.status === 'Approved'
                          ? 'bg-leaf-soft text-leaf-deep border border-leaf/20'
                          : claim.status === 'Filed'
                          ? 'bg-sky-soft text-sky-deep border border-sky/20'
                          : claim.status === 'Rejected'
                          ? 'bg-coral-soft text-coral border border-coral/20'
                          : 'bg-surface-sunken text-ink-muted'
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      {claim.status === 'Filed' && onUpdateClaimStatus && (
                        <>
                          <button
                            onClick={() => onUpdateClaimStatus(claim.id, 'Approved', claim.amountClaimed)}
                            className="px-2 py-1 rounded bg-leaf-soft text-leaf-deep text-[10px] font-bold hover:bg-leaf hover:text-white transition-all"
                            title="Mark as Approved by Marketplace"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onUpdateClaimStatus(claim.id, 'Rejected', 0)}
                            className="px-2 py-1 rounded bg-coral-soft text-coral text-[10px] font-bold hover:bg-coral hover:text-white transition-all"
                            title="Mark as Rejected"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for manual ticket creation */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-modal max-w-md w-full border border-outline shadow-2xl p-6 animate-scaleUp">
            <div className="flex items-center justify-between mb-4 border-b border-outline pb-3">
              <h3 className="text-base font-bold font-display text-ink">Raise Marketplace SPF Claim</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Select Order ID *</label>
                <input
                  type="text"
                  required
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  placeholder="e.g. 129384729182 / SW-101"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Claim Reason</label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value as ClaimItem['claimType'])}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky"
                >
                  <option value="Wrong Return">Wrong Item Returned (Fraud Return)</option>
                  <option value="Damaged in Transit">Damaged in Logistics / Transit</option>
                  <option value="Weight Mismatch Overcharge">Weight Mismatch Courier Overcharge</option>
                  <option value="Payment Not Credited">Payment / Settlement Not Credited</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Claim Amount ₹</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Ticket Evidence Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add video proof reference, tracking number, or ticket details..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-ink-muted hover:bg-surface-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-button text-xs font-bold bg-sky text-white shadow-soft hover:bg-sky-deep"
                >
                  Save & File Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
