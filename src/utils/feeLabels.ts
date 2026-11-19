import { FeeCode } from '../types/ledger';

export const FEE_ORDER: FeeCode[] = [
  'commission',
  'fixed_fee',
  'shipping',
  'reverse_shipping',
  'weight_surcharge',
  'collection_fee',
  'penalty',
  'tcs',
  'tds',
  'ads',
  'refund',
  'other',
];

export const FEE_LABELS: Record<FeeCode, string> = {
  principal: 'Product value',
  commission: 'Commission',
  fixed_fee: 'Fixed fee',
  collection_fee: 'Collection fee',
  shipping: 'Shipping',
  reverse_shipping: 'Reverse shipping',
  weight_surcharge: 'Weight surcharge',
  penalty: 'Penalty / recovery',
  tcs: 'TCS',
  tds: 'TDS',
  ads: 'Ads spend',
  refund: 'Return / refund',
  other: 'Other charges',
};
