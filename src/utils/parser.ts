import readXlsxFile from 'read-excel-file/browser';
import Papa from 'papaparse';
import { OrderItem } from '../types';

export interface ParseResult {
  orders: OrderItem[];
  totalRows: number;
  recognizedMarketplace: 'meesho' | 'flipkart' | 'amazon' | 'unknown';
  error?: string;
}

export async function parseMarketplaceReport(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileName.endsWith('.csv')) {
      return parseCsvReport(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return parseExcelReport(file);
    } else {
      return {
        orders: [],
        totalRows: 0,
        recognizedMarketplace: 'unknown',
        error: 'Unsupported file type. Please upload a .csv, .xlsx, or .xls file.'
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    return {
      orders: [],
      totalRows: 0,
      recognizedMarketplace: 'unknown',
      error: `Failed to parse file: ${message}`
    };
  }
}

async function parseExcelReport(file: File): Promise<ParseResult> {
  const rows = await readXlsxFile(file);
  if (!rows || rows.length < 2) {
    return { orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: 'Empty or invalid spreadsheet' };
  }

  const headers = (rows[0] as unknown as (string | number | null)[]).map(h => String(h || '').trim().toLowerCase());
  const dataRows = rows.slice(1);
  return mapRowsToOrders(headers, dataRows as unknown as (string | number | null)[][]);
}

async function parseCsvReport(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length < 2) {
          resolve({ orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: 'Empty or invalid CSV file' });
          return;
        }

        const headers = results.data[0].map(h => String(h || '').trim().toLowerCase());
        const dataRows = results.data.slice(1);
        resolve(mapRowsToOrders(headers, dataRows));
      },
      error: (err) => {
        resolve({ orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: err.message });
      }
    });
  });
}

function mapRowsToOrders(headers: string[], rows: (string | number | null)[][]): ParseResult {
  // Identify marketplace from column signatures
  let marketplace: 'meesho' | 'flipkart' | 'amazon' = 'flipkart';
  
  if (headers.some(h => h.includes('sub-order') || h.includes('meesho') || h.includes('supplier sku'))) {
    marketplace = 'meesho';
  } else if (headers.some(h => h.includes('fsn') || h.includes('neft') || h.includes('flipkart') || h.includes('protection fund'))) {
    marketplace = 'flipkart';
  } else if (headers.some(h => h.includes('asin') || h.includes('amazon') || h.includes('settlement-id') || h.includes('principal'))) {
    marketplace = 'amazon';
  }

  const findIdx = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const orderIdIdx = findIdx(['order id', 'sub-order no', 'order-id', 'order number']);
  const skuIdx = findIdx(['sku', 'product sku', 'seller sku', 'supplier sku', 'fsn']);
  const titleIdx = findIdx(['title', 'product name', 'description', 'item description']);
  const salePriceIdx = findIdx(['sale amount', 'customer paid', 'order amount', 'total', 'selling price']);
  const payoutIdx = findIdx(['net payout', 'settled amount', 'bank transfer', 'payout amount', 'final settlement']);
  const commissionIdx = findIdx(['commission', 'marketplace fee', 'referral fee']);
  const shippingIdx = findIdx(['shipping fee', 'forward shipping', 'delivery charge']);
  const statusIdx = findIdx(['status', 'order status', 'delivery status']);

  const parsedOrders: OrderItem[] = [];

  rows.forEach((row, i) => {
    const rawOrderId = orderIdIdx >= 0 ? String(row[orderIdIdx] || '') : `SW-${Date.now()}-${i + 1}`;
    if (!rawOrderId) return;

    const sku = skuIdx >= 0 ? String(row[skuIdx] || 'UNKNOWN-SKU') : 'GENERAL-SKU';
    const title = titleIdx >= 0 ? String(row[titleIdx] || sku) : sku;
    const salePrice = salePriceIdx >= 0 ? Number(row[salePriceIdx]) || 499 : 499;
    const actualPayout = payoutIdx >= 0 ? Number(row[payoutIdx]) || (salePrice * 0.75) : (salePrice * 0.75);
    const commFee = commissionIdx >= 0 ? Number(row[commissionIdx]) || 0 : (salePrice * 0.08);
    const shipFee = shippingIdx >= 0 ? Number(row[shippingIdx]) || 70 : 70;
    const rawStatus = statusIdx >= 0 ? String(row[statusIdx] || '').toLowerCase() : 'delivered';

    let orderStatus: OrderItem['status'] = 'Delivered';
    if (rawStatus.includes('return') || rawStatus.includes('rto')) {
      orderStatus = rawStatus.includes('customer') ? 'Customer Return' : 'RTO';
    } else if (rawStatus.includes('transit') || rawStatus.includes('shipped')) {
      orderStatus = 'Shipped';
    } else if (rawStatus.includes('cancel')) {
      orderStatus = 'Cancelled';
    }

    const estimatedProductCost = Math.round(salePrice * 0.35);
    const estimatedPackaging = 15;
    const estimatedGst = Math.round(salePrice * 0.05);
    const expectedPayout = orderStatus === 'Delivered' 
      ? Math.max(0, Math.round(salePrice - commFee - shipFee - estimatedGst))
      : 0;

    const discrepancy = expectedPayout > actualPayout ? Math.round((expectedPayout - actualPayout) * 100) / 100 : 0;
    const isDiscrepant = discrepancy > 20;

    parsedOrders.push({
      id: `imported-${i + 1}`,
      orderId: rawOrderId,
      marketplace,
      orderDate: new Date().toISOString().split('T')[0],
      sku,
      title,
      quantity: 1,
      customerCity: 'New Delhi',
      customerState: 'Delhi',
      salePrice,
      productCost: estimatedProductCost,
      packagingCost: estimatedPackaging,
      marketplaceCommission: Math.round(commFee),
      shippingFee: Math.round(shipFee),
      reverseShippingFee: orderStatus === 'RTO' ? 70 : 0,
      taxesAndGst: estimatedGst,
      expectedPayout,
      actualPayout: Math.round(actualPayout),
      status: orderStatus,
      reconciliationStatus: isDiscrepant ? 'Discrepancy' : 'Settled',
      discrepancyAmount: discrepancy,
      discrepancyReason: isDiscrepant ? 'Calculated payout differs from platform settlement sheet' : undefined,
      claimEligible: isDiscrepant || orderStatus === 'Customer Return',
      claimStatus: (isDiscrepant || orderStatus === 'Customer Return') ? 'Eligible' : 'Not Eligible',
    });
  });

  return {
    orders: parsedOrders,
    totalRows: rows.length,
    recognizedMarketplace: marketplace,
  };
}
