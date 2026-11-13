import React, { useState } from 'react';
import { SkuMasterItem } from '../types';
import { Plus, Package, Save, Trash2, Edit2, Scale, Info } from 'lucide-react';

interface SkuManagerProps {
  skuMasterList: SkuMasterItem[];
  onSaveSku: (skuItem: SkuMasterItem) => void;
  onDeleteSku: (skuCode: string) => void;
}

export const SkuManager: React.FC<SkuManagerProps> = ({
  skuMasterList,
  onSaveSku,
  onDeleteSku,
}) => {
  const [skuCode, setSkuCode] = useState('');
  const [title, setTitle] = useState('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [packagingCost, setPackagingCost] = useState<number | ''>(15);
  const [weightGrams, setWeightGrams] = useState<number | ''>(350);
  const [category, setCategory] = useState('');
  const [editingSku, setEditingSku] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuCode.trim()) return;

    onSaveSku({
      sku: skuCode.trim().toUpperCase(),
      title: title.trim() || skuCode.trim().toUpperCase(),
      costPrice: Number(costPrice) || 0,
      packagingCost: Number(packagingCost) || 0,
      weightGrams: Number(weightGrams) || 0,
      category: category.trim() || 'General',
    });

    // Reset form
    setSkuCode('');
    setTitle('');
    setCostPrice('');
    setPackagingCost(15);
    setWeightGrams(350);
    setCategory('');
    setEditingSku(null);
  };

  const handleEdit = (item: SkuMasterItem) => {
    setEditingSku(item.sku);
    setSkuCode(item.sku);
    setTitle(item.title);
    setCostPrice(item.costPrice);
    setPackagingCost(item.packagingCost);
    setWeightGrams(item.weightGrams);
    setCategory(item.category || '');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-deep" />
              <h2 className="text-xl font-bold font-display text-ink">SKU Master & Cost Engine</h2>
            </div>
            <p className="text-xs text-ink-muted mt-1 max-w-2xl">
              Configure your actual Purchase Price (COGS), Packaging cost, and standard physical Weight. 
              SellWise uses this to accurately compute real net margins and automatically flag weight overcharges.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-sky-soft/60 text-sky-deep px-3 py-2 rounded-xl text-xs font-bold border border-sky/20">
            <Scale className="w-4 h-4 shrink-0" />
            <span>Auto-audits courier weight slabs</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="bg-surface-elevated rounded-card p-6 border border-outline shadow-soft h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-display text-ink flex items-center gap-2">
              {editingSku ? <Edit2 className="w-4 h-4 text-sky" /> : <Plus className="w-4 h-4 text-leaf" />}
              {editingSku ? `Edit SKU: ${editingSku}` : 'Add New Master SKU'}
            </h3>
            {editingSku && (
              <button
                type="button"
                onClick={() => {
                  setEditingSku(null);
                  setSkuCode('');
                  setTitle('');
                  setCostPrice('');
                }}
                className="text-xs text-ink-muted hover:text-ink underline"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">SKU / Code *</label>
              <input
                type="text"
                required
                disabled={Boolean(editingSku)}
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                placeholder="e.g. COT-SHIRT-M-BLUE"
                className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Product Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Men Slim Fit Cotton Shirt - Blue M"
                className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Cost Price (COGS) ₹</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="250"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Packaging Cost ₹</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="15"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Weight (Grams) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="350"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky font-mono"
                />
                <span className="text-[10px] text-ink-muted">e.g. 500g = 0.5kg</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Apparel"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline bg-surface-sunken text-ink focus:outline-none focus:border-sky"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 flex items-center justify-center gap-2 bg-sky text-white px-4 py-2.5 rounded-button text-xs font-bold shadow-soft hover:bg-sky-deep transition-all active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>{editingSku ? 'Update SKU' : 'Save Master SKU'}</span>
            </button>
          </form>
        </div>

        {/* Master Catalog Table */}
        <div className="lg:col-span-2 bg-surface-elevated rounded-card border border-outline shadow-soft overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-display text-ink">Master Catalog</h3>
              <p className="text-[11px] text-ink-muted">{skuMasterList.length} configured SKUs</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Info className="w-3.5 h-3.5 text-sky" />
              <span>Imported orders map to these entries automatically</span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline bg-surface-sunken/60 text-ink-muted font-bold">
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-4 text-right">Cost (COGS)</th>
                  <th className="py-3 px-4 text-right">Packaging</th>
                  <th className="py-3 px-4 text-right">Actual Weight</th>
                  <th className="py-3 px-4 text-center">Category</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {skuMasterList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-muted">
                      <Package className="w-8 h-8 mx-auto text-ink-muted/50 mb-2" />
                      <p className="font-bold">No master SKUs added yet</p>
                      <p className="text-[11px]">Add your products above to get 100% accurate profit margins.</p>
                    </td>
                  </tr>
                ) : (
                  skuMasterList.map((item) => (
                    <tr key={item.sku} className="hover:bg-surface-sunken/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-ink font-mono">{item.sku}</div>
                        <div className="text-[11px] text-ink-muted truncate max-w-[200px]">{item.title}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                        ₹{item.costPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-ink-muted">
                        ₹{item.packagingCost.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-ink">
                        <span className="px-2 py-0.5 rounded-md bg-sky-soft text-sky-deep font-bold">
                          {item.weightGrams}g
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-sunken text-ink-muted border border-outline">
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1 rounded-lg text-ink-muted hover:text-sky hover:bg-sky-soft transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteSku(item.sku)}
                          className="p-1 rounded-lg text-ink-muted hover:text-coral hover:bg-coral-soft transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
