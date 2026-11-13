import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import Papa from 'papaparse';
import { OrderItem, SkuMasterItem } from '../types';

export interface ParseResult {
  orders: OrderItem[];
  totalRows: number;
  recognizedMarketplace: 'meesho' | 'flipkart' | 'amazon' | 'unknown';
  reportType?: 'single_report' | 'two_way_settlement' | 'order_report';
  error?: string;
}

export async function parseMarketplaceReport(file: File, skuMaster: SkuMasterItem[] = []): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileName.endsWith('.csv')) {
      return parseCsvReport(file, skuMaster);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return parseExcelReport(file, skuMaster);
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

async function parseExcelReport(file: File, skuMaster: SkuMasterItem[]): Promise<ParseResult> {
  try {
    // Attempt to read all sheets to find 'Order Payments' (Meesho) or fall back to default sheet
    let targetRows: unknown[][] | null = null;
    try {
      const allSheets = await readXlsxFile(file);
      if (Array.isArray(allSheets) && allSheets.length > 0) {
        const found = allSheets.find(s => 
          s.sheet && (
            s.sheet.toLowerCase().includes('order payments') ||
            s.sheet.toLowerCase().includes('payments') ||
            s.sheet.toLowerCase().includes('settlement')
          )
        );
        targetRows = (found ? found.data : allSheets[0].data) as unknown[][];
      }
    } catch {
      // If reading all sheets fails, fall back to readSheet
      const sheetData = await readSheet(file);
      targetRows = sheetData as unknown[][];
    }

    if (!targetRows || targetRows.length < 2) {
      return { orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: 'Empty or invalid spreadsheet' };
    }

    // Find the real header row (in Meesho files, row 0 or 1 might be title or disclaimer)
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(targetRows.length, 6); r++) {
      const rowStrings = (targetRows[r] as unknown as (string | number | null)[]).map(c => String(c || '').toLowerCase());
      const hasKeywords = rowStrings.some(c => 
        c.includes('sub-order') || c.includes('sub order') || c.includes('order id') || c.includes('order no') ||
        c.includes('fsn') || c.includes('asin') || c.includes('sku') || c.includes('settlement') || c.includes('payout')
      );
      if (hasKeywords) {
        headerRowIndex = r;
        break;
      }
    }

    const headers = (targetRows[headerRowIndex] as unknown as (string | number | null)[]).map(h => String(h || '').trim().toLowerCase());
    const dataRows = targetRows.slice(headerRowIndex + 1);
    return mapRowsToOrders(headers, dataRows as unknown as (string | number | null)[][], file.name, skuMaster);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Excel parsing failure';
    return { orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: message };
  }
}

async function parseCsvReport(file: File, skuMaster: SkuMasterItem[]): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length < 2) {
          resolve({ orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: 'Empty or invalid CSV file' });
          return;
        }

        // Detect real header row
        let headerRowIndex = 0;
        for (let r = 0; r < Math.min(results.data.length, 6); r++) {
          const rowStrings = results.data[r].map(c => String(c || '').toLowerCase());
          const hasKeywords = rowStrings.some(c => 
            c.includes('sub-order') || c.includes('sub order') || c.includes('order id') || c.includes('order no') ||
            c.includes('fsn') || c.includes('asin') || c.includes('sku') || c.includes('settlement') || c.includes('payout')
          );
          if (hasKeywords) {
            headerRowIndex = r;
            break;
          }
        }

        const headers = results.data[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
        const dataRows = results.data.slice(headerRowIndex + 1);
        resolve(mapRowsToOrders(headers, dataRows, file.name, skuMaster));
      },
      error: (err) => {
        resolve({ orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: err.message });
      }
    });
  });
}

function mapRowsToOrders(
  headers: string[], 
  rows: (string | number | null)[][], 
  fileName: string = '', 
  skuMaster: SkuMasterItem[] = []
): ParseResult {
  const fName = fileName.toLowerCase();
  
  // 1. Identify marketplace reliably
  let marketplace: 'meesho' | 'flipkart' | 'amazon' = 'meesho';
  
  const hasMeeshoIndicators = 
    fName.includes('meesho') ||
    headers.some(h => 
      h.includes('sub-order') || 
      h.includes('sub order') || 
      h.includes('sub_order') ||
      h.includes('meesho') || 
      h.includes('supplier sku') ||
      h.includes('live order status') ||
      h.includes('final settlement amount')
    );

  const hasFlipkartIndicators = 
    fName.includes('flipkart') ||
    headers.some(h => 
      h.includes('fsn') || 
      h.includes('flipkart') || 
      h.includes('neft type') ||
      h.includes('tier') ||
      h.includes('protection fund') ||
      h.includes('marketplace fee')
    );

  const hasAmazonIndicators = 
    fName.includes('amazon') ||
    headers.some(h => 
      h.includes('asin') || 
      h.includes('amazon') || 
      h.includes('settlement-id') || 
      h.includes('principal') ||
      h.includes('item-price')
    );

  if (hasMeeshoIndicators) {
    marketplace = 'meesho';
  } else if (hasAmazonIndicators) {
    marketplace = 'amazon';
  } else if (hasFlipkartIndicators) {
    marketplace = 'flipkart';
  } else {
    // Default fallback based on column signature
    marketplace = 'meesho';
  }

  const findIdx = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  // Expanded indices covering real marketplace column variations
  const orderIdIdx = findIdx([
    'sub-order no', 'sub order no', 'sub-order id', 'sub order id', 'sub_order_no',
    'order id', 'order-id', 'order number', 'order_id'
  ]);
  
  const skuIdx = findIdx([
    'supplier sku', 'seller sku', 'product sku', 'sku code', 'sku', 'fsn', 'asin'
  ]);
  
  const titleIdx = findIdx(['product name', 'title', 'item description', 'description']);
  
  const salePriceIdx = findIdx([
    'total sale amount', 'total sale', 'sale amount', 'customer paid', 'selling price', 
    'listing price', 'order amount', 'total', 'item price'
  ]);
  
  const payoutIdx = findIdx([
    'final settlement amount', 'settled amount', 'net payout', 'bank transfer', 
    'payout amount', 'final settlement', 'net amount'
  ]);
  
  const commissionIdx = findIdx([
    'meesho commission', 'commission', 'marketplace fee', 'referral fee'
  ]);
  
  const shippingIdx = findIdx([
    'shipping charge', 'forward shipping', 'shipping fee', 'delivery charge', 'freight'
  ]);

  const reverseShippingIdx = findIdx([
    'return shipping charge', 'reverse shipping', 'rto charge', 'return freight'
  ]);
  
  const statusIdx = findIdx([
    'live order status', 'order status', 'delivery status', 'status', 'item status'
  ]);

  const billedWeightIdx = findIdx([
    'charged weight', 'applicable weight', 'billed weight', 'weight (kg)', 'weight (g)', 'weight'
  ]);

  const bankUtrIdx = findIdx([
    'bank utr', 'utr', 'neft', 'reference no', 'transaction id'
  ]);

  const dateIdx = findIdx([
    'order date', 'order placed date', 'payment date', 'settlement date', 'date'
  ]);

  const cityIdx = findIdx(['customer city', 'delivery city', 'city', 'destination city']);
  const stateIdx = findIdx(['customer state', 'delivery state', 'state', 'destination state']);

  const parsedOrders: OrderItem[] = [];

  rows.forEach((row, i) => {
    const rawOrderId = orderIdIdx >= 0 ? String(row[orderIdIdx] || '').trim() : '';
    // Skip empty lines or total summary rows at bottom of spreadsheets
    if (!rawOrderId || rawOrderId.toLowerCase() === 'total' || rawOrderId.toLowerCase().startsWith('grand total')) {
      return;
    }

    const sku = skuIdx >= 0 ? String(row[skuIdx] || 'UNKNOWN-SKU').trim() : 'GENERAL-SKU';
    const title = titleIdx >= 0 ? String(row[titleIdx] || sku).trim() : sku;
    
    // Look up in SKU Master if available, otherwise estimate
    const masterItem = skuMaster.find(m => m.sku.toLowerCase() === sku.toLowerCase());
    
    const salePrice = salePriceIdx >= 0 ? Math.abs(Number(row[salePriceIdx])) || 499 : 499;
    const actualPayout = payoutIdx >= 0 ? Number(row[payoutIdx]) || (salePrice * 0.75) : (salePrice * 0.75);
    const commFee = commissionIdx >= 0 ? Math.abs(Number(row[commissionIdx])) || 0 : (marketplace === 'meesho' ? 0 : salePrice * 0.08);
    const shipFee = shippingIdx >= 0 ? Math.abs(Number(row[shippingIdx])) || 70 : 70;
    const revShipFee = reverseShippingIdx >= 0 ? Math.abs(Number(row[reverseShippingIdx])) || 0 : 0;
    
    const rawStatus = statusIdx >= 0 ? String(row[statusIdx] || '').toLowerCase() : 'delivered';

    let orderStatus: OrderItem['status'] = 'Delivered';
    if (rawStatus.includes('customer return') || rawStatus.includes('return') && !rawStatus.includes('rto')) {
      orderStatus = 'Customer Return';
    } else if (rawStatus.includes('rto') || rawStatus.includes('return to origin')) {
      orderStatus = 'RTO';
    } else if (rawStatus.includes('transit') || rawStatus.includes('shipped') || rawStatus.includes('in-transit')) {
      orderStatus = 'Shipped';
    } else if (rawStatus.includes('cancel')) {
      orderStatus = 'Cancelled';
    } else {
      orderStatus = 'Delivered';
    }

    // Weight auditing
    let billedWeightGrams = 0;
    if (billedWeightIdx >= 0 && row[billedWeightIdx]) {
      const rawWeight = Number(row[billedWeightIdx]) || 0;
      // If <= 10, it's likely in KG, convert to grams
      billedWeightGrams = rawWeight > 0 && rawWeight < 15 ? Math.round(rawWeight * 1000) : Math.round(rawWeight);
    }
    
    const actualWeightGrams = masterItem?.weightGrams || (billedWeightGrams > 0 ? billedWeightGrams : 400);
    const weightDiscrepancy = billedWeightGrams > 0 && billedWeightGrams > (actualWeightGrams + 200);

    const productCost = masterItem ? masterItem.costPrice : Math.round(salePrice * 0.35);
    const packagingCost = masterItem ? masterItem.packagingCost : 15;
    const estimatedGst = Math.round(salePrice * 0.05);
    
    // Reverse shipping is applied for RTO / returns
    const effectiveReverseShipping = revShipFee > 0 ? revShipFee : (orderStatus === 'RTO' ? 70 : 0);

    const expectedPayout = orderStatus === 'Delivered' 
      ? Math.max(0, Math.round(salePrice - commFee - shipFee - estimatedGst))
      : 0;

    const discrepancy = expectedPayout > actualPayout ? Math.round((expectedPayout - actualPayout) * 100) / 100 : 0;
    const isDiscrepant = discrepancy > 20 || weightDiscrepancy;

    let discrepancyReason: string | undefined = undefined;
    if (weightDiscrepancy) {
      discrepancyReason = `Weight Overcharged: Courier billed ${billedWeightGrams}g vs actual ${actualWeightGrams}g`;
    } else if (isDiscrepant) {
      discrepancyReason = 'Settlement sheet payout is lower than marketplace contracted slab';
    }

    const bankUtr = bankUtrIdx >= 0 && row[bankUtrIdx] ? String(row[bankUtrIdx]).trim() : undefined;
    const orderDate = dateIdx >= 0 && row[dateIdx] ? String(row[dateIdx]).split('T')[0] : new Date().toISOString().split('T')[0];
    const customerCity = cityIdx >= 0 && row[cityIdx] ? String(row[cityIdx]).trim() : 'New Delhi';
    const customerState = stateIdx >= 0 && row[stateIdx] ? String(row[stateIdx]).trim() : 'Delhi';

    parsedOrders.push({
      id: `imported-${Date.now()}-${i + 1}`,
      orderId: rawOrderId,
      marketplace,
      orderDate,
      sku,
      title,
      quantity: 1,
      customerCity,
      customerState,
      salePrice,
      productCost,
      packagingCost,
      marketplaceCommission: Math.round(commFee),
      shippingFee: Math.round(shipFee),
      reverseShippingFee: Math.round(effectiveReverseShipping),
      taxesAndGst: estimatedGst,
      expectedPayout,
      actualPayout: Math.round(actualPayout),
      status: orderStatus,
      reconciliationStatus: isDiscrepant ? 'Discrepancy' : 'Settled',
      discrepancyAmount: discrepancy,
      discrepancyReason,
      claimEligible: isDiscrepant || orderStatus === 'Customer Return' || weightDiscrepancy,
      claimStatus: (isDiscrepant || orderStatus === 'Customer Return' || weightDiscrepancy) ? 'Eligible' : 'Not Eligible',
      billedWeightGrams: billedWeightGrams > 0 ? billedWeightGrams : undefined,
      actualWeightGrams: actualWeightGrams > 0 ? actualWeightGrams : undefined,
      weightDiscrepancy,
      bankUtr,
      bankDepositDate: bankUtr ? orderDate : undefined,
    });
  });

  return {
    orders: parsedOrders,
    totalRows: rows.length,
    recognizedMarketplace: marketplace,
    reportType: 'single_report'
  };
}
