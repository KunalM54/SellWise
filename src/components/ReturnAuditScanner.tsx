import React, { useState } from 'react';
import { OrderItem, ClaimItem } from '../types';
import { Barcode, Scan, CheckCircle2, AlertOctagon, ShieldAlert, ArrowRight, Clock } from 'lucide-react';

interface ReturnAuditScannerProps {
  orders: OrderItem[];
  onFileClaimFromScan: (claim: ClaimItem) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderItem['status']) => void;
}

export const ReturnAuditScanner: React.FC<ReturnAuditScannerProps> = ({
  orders,
  onFileClaimFromScan,
  onUpdateOrderStatus,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedOrder, setScannedOrder] = useState<OrderItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [returnCondition, setReturnCondition] = useState<'Intact' | 'Damaged' | 'Wrong Product' | 'Empty Box'>('Damaged');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    const query = barcodeInput.trim();
    if (!query) return;

    // Search across orderId, SKU, or bankUtr
    const match = orders.find(
      (o) =>
        o.orderId.toLowerCase() === query.toLowerCase() ||
        o.id.toLowerCase() === query.toLowerCase() ||
        o.sku.toLowerCase() === query.toLowerCase()
    );

    if (match) {
      setScannedOrder(match);
      setNotFound(false);
    } else {
      setScannedOrder(null);
      setNotFound(true);
    }
  };

  const handleProcessReturn = () => {
    if (!scannedOrder) return;

    if (returnCondition === 'Intact') {
      // Return received in good order, mark restocked
      onUpdateOrderStatus(scannedOrder.orderId, 'Customer Return');
      setSuccessMessage(`Order ${scannedOrder.orderId} verified & restocked successfully.`);
      setScannedOrder(null);
      setBarcodeInput('');
    } else {
      // Damaged / Wrong / Empty box -> Automatically raise dispute claim
      const claimType: ClaimItem['claimType'] =
        returnCondition === 'Damaged'
          ? 'Damaged in Transit'
          : 'Wrong Return';

      const newClaim: ClaimItem = {
        id: `clm-${Date.now()}`,
        orderId: scannedOrder.orderId,
        marketplace: scannedOrder.marketplace,
        sku: scannedOrder.sku,
        claimType,
        amountClaimed: scannedOrder.salePrice,
        amountApproved: 0,
        filingDate: new Date().toISOString().split('T')[0],
        status: 'Filed',
        ticketId: `SPF-${Math.floor(100000 + Math.random() * 900000)}`,
        deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 day return claim window
        evidenceNotes: `Return Scanner Check: ${returnCondition}. Notes: ${evidenceNotes || 'Flagged during warehouse physical inbound scan.'}`,
        barcode: barcodeInput,
      };

      onFileClaimFromScan(newClaim);
      onUpdateOrderStatus(scannedOrder.orderId, 'Customer Return');
      setSuccessMessage(`Claim Ticket ${newClaim.ticketId} created! Dispute recorded under Claims Tracker.`);
      setScannedOrder(null);
      setBarcodeInput('');
      setEvidenceNotes('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Barcode className="w-5 h-5 text-sky-deep" />
              <h2 className="text-xl font-bold font-display text-ink">Inbound Return & Barcode Scanner</h2>
            </div>
            <p className="text-xs text-ink-muted mt-1 max-w-2xl">
              Inspect physical RTO and Customer Return parcels as they land at your warehouse.
              Scan the courier tracking barcode or Order ID to instantly verify legitimacy and raise dispute claims before marketplace SPF deadlines expire.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-coral-soft text-coral px-3 py-2 rounded-xl text-xs font-bold border border-coral/20">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Meesho/Flipkart claim window: 7-14 Days</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Input Panel */}
        <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft">
          <h3 className="text-sm font-bold font-display text-ink mb-3 flex items-center gap-2">
            <Scan className="w-4 h-4 text-sky" />
            Scan Inbound Package Barcode
          </h3>

          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                AWB / Tracking Number / Order ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  required
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode or enter Order ID..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono font-bold"
                />
                <Barcode className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-ink-muted mt-1">
                Tip: Plug in any standard USB/Bluetooth handheld barcode scanner.
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-sky text-white px-4 py-2.5 rounded-button text-xs font-bold shadow-soft hover:bg-sky-deep transition-all"
            >
              <Scan className="w-4 h-4" />
              <span>Verify Parcel</span>
            </button>
          </form>

          {notFound && (
            <div className="mt-4 p-3 rounded-xl bg-coral-soft/50 border border-coral/20 text-coral text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>No order matched ID &quot;{barcodeInput}&quot;. Please verify the report was imported.</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 rounded-xl bg-leaf-soft/50 border border-leaf/20 text-leaf-deep text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Verification Result Area */}
        <div className="lg:col-span-2 bg-surface-elevated rounded-card p-6 border border-outline shadow-soft">
          {scannedOrder ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-outline pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-deep bg-sky-soft px-2 py-0.5 rounded-md">
                    {scannedOrder.marketplace} Order
                  </span>
                  <h3 className="text-base font-bold font-display text-ink mt-1 font-mono">
                    {scannedOrder.orderId}
                  </h3>
                  <p className="text-xs text-ink-muted">{scannedOrder.title} ({scannedOrder.sku})</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-ink-muted">Order Value</div>
                  <div className="text-base font-bold font-mono text-ink">₹{scannedOrder.salePrice}</div>
                </div>
              </div>

              {/* Order Meta Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-outline">
                  <span className="text-[10px] text-ink-muted block">Status</span>
                  <span className="text-xs font-bold text-coral">{scannedOrder.status}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-outline">
                  <span className="text-[10px] text-ink-muted block">Order Date</span>
                  <span className="text-xs font-bold text-ink">{scannedOrder.orderDate}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-outline">
                  <span className="text-[10px] text-ink-muted block">Destination</span>
                  <span className="text-xs font-bold text-ink truncate">{scannedOrder.customerCity}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-sunken border border-outline">
                  <span className="text-[10px] text-ink-muted block">Expected Payout</span>
                  <span className="text-xs font-bold text-ink">₹{scannedOrder.expectedPayout}</span>
                </div>
              </div>

              {/* Physical Condition Selector */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-ink mb-2">
                  What is the physical condition of the returned item?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Intact', 'Damaged', 'Wrong Product', 'Empty Box'] as const).map((cond) => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => setReturnCondition(cond)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                        returnCondition === cond
                          ? cond === 'Intact'
                            ? 'bg-leaf-soft border-leaf text-leaf-deep shadow-soft'
                            : 'bg-coral-soft border-coral text-coral shadow-soft'
                          : 'border-outline bg-surface-sunken text-ink-muted hover:border-outline-strong'
                      }`}
                    >
                      <span>{cond === 'Intact' ? '✅' : cond === 'Damaged' ? '💥' : cond === 'Wrong Product' ? '🔄' : '📦❌'}</span>
                      <span>{cond}</span>
                    </button>
                  ))}
                </div>
              </div>

              {returnCondition !== 'Intact' && (
                <div className="space-y-3 p-4 rounded-2xl bg-coral-soft/30 border border-coral/30">
                  <div className="flex items-center gap-2 text-coral text-xs font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Dispute Claim Will Be Automatically Filed</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink mb-1">
                      Evidence / Unboxing notes (e.g. video recorded, wrong soap instead of shirt)
                    </label>
                    <input
                      type="text"
                      value={evidenceNotes}
                      onChange={(e) => setEvidenceNotes(e.target.value)}
                      placeholder="e.g. Unboxing video recorded, received torn packaging and incorrect item."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-elevated text-ink focus:outline-none focus:border-coral"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleProcessReturn}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-button text-xs font-bold text-white shadow-soft transition-all ${
                    returnCondition === 'Intact'
                      ? 'bg-leaf hover:bg-leaf-deep'
                      : 'bg-coral hover:bg-coral-deep'
                  }`}
                >
                  <span>{returnCondition === 'Intact' ? 'Confirm Restocking' : 'File Marketplace SPF Claim'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-ink-muted flex flex-col items-center justify-center">
              <Scan className="w-12 h-12 text-ink-muted/40 mb-3" />
              <h4 className="text-sm font-bold text-ink">Ready for Barcode Input</h4>
              <p className="text-xs text-ink-muted max-w-sm mt-1">
                Scan or type a tracking AWB / Order ID to audit the parcel status, check weight, and flag return damage.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
