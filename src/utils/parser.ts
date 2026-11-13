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

// Helper: Indian Pincode to City & State lookup
function resolveFromPincode(pincode: string): { city: string; state: string } | null {
  const pin = pincode.replace(/\D/g, '').slice(0, 6);
  if (pin.length < 6) return null;

  const prefix2 = pin.slice(0, 2);
  const prefix3 = pin.slice(0, 3);

  // Exact 3-digit regional hub matching
  const prefix3Map: Record<string, { city: string; state: string }> = {
    '110': { city: 'New Delhi', state: 'Delhi' },
    '121': { city: 'Faridabad', state: 'Haryana' },
    '122': { city: 'Gurugram', state: 'Haryana' },
    '131': { city: 'Sonipat', state: 'Haryana' },
    '132': { city: 'Panipat', state: 'Haryana' },
    '133': { city: 'Ambala', state: 'Haryana' },
    '134': { city: 'Panchkula', state: 'Haryana' },
    '141': { city: 'Ludhiana', state: 'Punjab' },
    '143': { city: 'Amritsar', state: 'Punjab' },
    '144': { city: 'Jalandhar', state: 'Punjab' },
    '160': { city: 'Chandigarh', state: 'Chandigarh' },
    '201': { city: 'Noida / Ghaziabad', state: 'Uttar Pradesh' },
    '208': { city: 'Kanpur', state: 'Uttar Pradesh' },
    '211': { city: 'Prayagraj', state: 'Uttar Pradesh' },
    '221': { city: 'Varanasi', state: 'Uttar Pradesh' },
    '226': { city: 'Lucknow', state: 'Uttar Pradesh' },
    '248': { city: 'Dehradun', state: 'Uttarakhand' },
    '282': { city: 'Agra', state: 'Uttar Pradesh' },
    '302': { city: 'Jaipur', state: 'Rajasthan' },
    '324': { city: 'Kota', state: 'Rajasthan' },
    '342': { city: 'Jodhpur', state: 'Rajasthan' },
    '380': { city: 'Ahmedabad', state: 'Gujarat' },
    '390': { city: 'Vadodara', state: 'Gujarat' },
    '395': { city: 'Surat', state: 'Gujarat' },
    '360': { city: 'Rajkot', state: 'Gujarat' },
    '400': { city: 'Mumbai', state: 'Maharashtra' },
    '411': { city: 'Pune', state: 'Maharashtra' },
    '422': { city: 'Nashik', state: 'Maharashtra' },
    '431': { city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },
    '440': { city: 'Nagpur', state: 'Maharashtra' },
    '452': { city: 'Indore', state: 'Madhya Pradesh' },
    '462': { city: 'Bhopal', state: 'Madhya Pradesh' },
    '482': { city: 'Jabalpur', state: 'Madhya Pradesh' },
    '492': { city: 'Raipur', state: 'Chhattisgarh' },
    '500': { city: 'Hyderabad', state: 'Telangana' },
    '520': { city: 'Vijayawada', state: 'Andhra Pradesh' },
    '530': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
    '560': { city: 'Bengaluru', state: 'Karnataka' },
    '570': { city: 'Mysuru', state: 'Karnataka' },
    '575': { city: 'Mangaluru', state: 'Karnataka' },
    '580': { city: 'Hubli-Dharwad', state: 'Karnataka' },
    '600': { city: 'Chennai', state: 'Tamil Nadu' },
    '641': { city: 'Coimbatore', state: 'Tamil Nadu' },
    '625': { city: 'Madurai', state: 'Tamil Nadu' },
    '682': { city: 'Kochi', state: 'Kerala' },
    '695': { city: 'Thiruvananthapuram', state: 'Kerala' },
    '673': { city: 'Kozhikode', state: 'Kerala' },
    '700': { city: 'Kolkata', state: 'West Bengal' },
    '711': { city: 'Howrah', state: 'West Bengal' },
    '751': { city: 'Bhubaneswar', state: 'Odisha' },
    '781': { city: 'Guwahati', state: 'Assam' },
    '800': { city: 'Patna', state: 'Bihar' },
    '834': { city: 'Ranchi', state: 'Jharkhand' },
    '831': { city: 'Jamshedpur', state: 'Jharkhand' },
  };

  if (prefix3Map[prefix3]) {
    return prefix3Map[prefix3];
  }

  // 2-digit fallback
  const prefix2Map: Record<string, { city: string; state: string }> = {
    '11': { city: 'New Delhi', state: 'Delhi' },
    '12': { city: 'Gurugram', state: 'Haryana' },
    '13': { city: 'Ambala', state: 'Haryana' },
    '14': { city: 'Ludhiana', state: 'Punjab' },
    '15': { city: 'Bathinda', state: 'Punjab' },
    '16': { city: 'Chandigarh', state: 'Chandigarh' },
    '17': { city: 'Shimla', state: 'Himachal Pradesh' },
    '18': { city: 'Jammu', state: 'Jammu & Kashmir' },
    '19': { city: 'Srinagar', state: 'Jammu & Kashmir' },
    '20': { city: 'Noida', state: 'Uttar Pradesh' },
    '21': { city: 'Prayagraj', state: 'Uttar Pradesh' },
    '22': { city: 'Lucknow', state: 'Uttar Pradesh' },
    '23': { city: 'Mirzapur', state: 'Uttar Pradesh' },
    '24': { city: 'Dehradun', state: 'Uttarakhand' },
    '25': { city: 'Meerut', state: 'Uttar Pradesh' },
    '26': { city: 'Bareilly', state: 'Uttar Pradesh' },
    '27': { city: 'Gorakhpur', state: 'Uttar Pradesh' },
    '28': { city: 'Agra', state: 'Uttar Pradesh' },
    '30': { city: 'Jaipur', state: 'Rajasthan' },
    '31': { city: 'Udaipur', state: 'Rajasthan' },
    '32': { city: 'Kota', state: 'Rajasthan' },
    '33': { city: 'Bikaner', state: 'Rajasthan' },
    '34': { city: 'Jodhpur', state: 'Rajasthan' },
    '36': { city: 'Rajkot', state: 'Gujarat' },
    '37': { city: 'Jamnagar', state: 'Gujarat' },
    '38': { city: 'Ahmedabad', state: 'Gujarat' },
    '39': { city: 'Surat', state: 'Gujarat' },
    '40': { city: 'Mumbai', state: 'Maharashtra' },
    '41': { city: 'Pune', state: 'Maharashtra' },
    '42': { city: 'Nashik', state: 'Maharashtra' },
    '43': { city: 'Aurangabad', state: 'Maharashtra' },
    '44': { city: 'Nagpur', state: 'Maharashtra' },
    '45': { city: 'Indore', state: 'Madhya Pradesh' },
    '46': { city: 'Bhopal', state: 'Madhya Pradesh' },
    '47': { city: 'Gwalior', state: 'Madhya Pradesh' },
    '48': { city: 'Jabalpur', state: 'Madhya Pradesh' },
    '49': { city: 'Raipur', state: 'Chhattisgarh' },
    '50': { city: 'Hyderabad', state: 'Telangana' },
    '51': { city: 'Tirupati', state: 'Andhra Pradesh' },
    '52': { city: 'Vijayawada', state: 'Andhra Pradesh' },
    '53': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
    '56': { city: 'Bengaluru', state: 'Karnataka' },
    '57': { city: 'Mangaluru', state: 'Karnataka' },
    '58': { city: 'Hubli', state: 'Karnataka' },
    '59': { city: 'Belagavi', state: 'Karnataka' },
    '60': { city: 'Chennai', state: 'Tamil Nadu' },
    '61': { city: 'Tiruchirappalli', state: 'Tamil Nadu' },
    '62': { city: 'Madurai', state: 'Tamil Nadu' },
    '63': { city: 'Salem', state: 'Tamil Nadu' },
    '64': { city: 'Coimbatore', state: 'Tamil Nadu' },
    '67': { city: 'Kozhikode', state: 'Kerala' },
    '68': { city: 'Kochi', state: 'Kerala' },
    '69': { city: 'Thiruvananthapuram', state: 'Kerala' },
    '70': { city: 'Kolkata', state: 'West Bengal' },
    '71': { city: 'Howrah', state: 'West Bengal' },
    '72': { city: 'Midnapore', state: 'West Bengal' },
    '73': { city: 'Siliguri', state: 'West Bengal' },
    '74': { city: 'Barasat', state: 'West Bengal' },
    '75': { city: 'Bhubaneswar', state: 'Odisha' },
    '76': { city: 'Cuttack', state: 'Odisha' },
    '78': { city: 'Guwahati', state: 'Assam' },
    '79': { city: 'Shillong / Agartala', state: 'North East' },
    '80': { city: 'Patna', state: 'Bihar' },
    '81': { city: 'Bhagalpur', state: 'Bihar' },
    '82': { city: 'Gaya', state: 'Bihar' },
    '83': { city: 'Ranchi', state: 'Jharkhand' },
    '84': { city: 'Muzaffarpur', state: 'Bihar' },
    '85': { city: 'Purnia', state: 'Bihar' },
  };

  return prefix2Map[prefix2] || null;
}

// Helper: Extract city from raw address string (e.g. "Flat 101, Galaxy Apt, Ring Road, Surat, Gujarat - 395002")
function extractCityFromAddress(address: string): string {
  if (!address) return '';
  const clean = address.replace(/[\r\n]+/g, ', ').trim();
  
  // Look for 6-digit pincode in the address
  const pinMatch = clean.match(/\b([1-9][0-9]{5})\b/);
  if (pinMatch) {
    const pinResolved = resolveFromPincode(pinMatch[1]);
    if (pinResolved) return pinResolved.city;
  }

  // Split by comma
  const segments = clean.split(',').map(s => s.trim()).filter(Boolean);
  if (segments.length >= 2) {
    // Usually the second to last or third to last segment is the city
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i].replace(/\d+/g, '').replace(/[-–_]/g, '').trim();
      // Skip if it looks like state or country or pincode
      if (
        seg.length > 2 &&
        !seg.toLowerCase().includes('india') &&
        !seg.toLowerCase().includes('pin') &&
        !seg.toLowerCase().includes('district')
      ) {
        return seg;
      }
    }
  }

  return segments[segments.length - 1] || '';
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
    marketplace = 'meesho';
  }

  const findIdx = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  // Expanded indices covering real marketplace column variations
  const orderIdIdx = findIdx([
    'sub-order no', 'sub order no', 'sub-order id', 'sub order id', 'sub_order_no',
    'sub order number', 'sub-order number', 'order id', 'order-id', 'order number', 'order_id'
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
    'payout amount', 'final settlement', 'net amount', 'bank transfer amount'
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
    'live order status', 'order status', 'delivery status', 'status', 'item status', 'return type'
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

  // Comprehensive city and location column matchers for Meesho/Flipkart/Amazon
  const cityIdx = findIdx([
    'customer city', 'delivery city', 'destination city', 'dest city', 'cust city',
    'shipping city', 'ship to city', 'ship city', 'buyer city', 'consignee city',
    'city/town', 'city name', 'delivery location', 'destination location', 'town', 'city', 'destination'
  ]);

  const stateIdx = findIdx([
    'customer delivery state', 'customer state', 'delivery state', 'destination state',
    'dest state', 'cust state', 'shipping state', 'ship state', 'buyer state',
    'consignee state', 'place of supply', 'state of supply', 'state name', 'state'
  ]);

  const addressIdx = findIdx([
    'customer delivery address', 'customer address', 'delivery address', 'shipping address',
    'consignee address', 'destination address', 'shipping details', 'address'
  ]);

  const pincodeIdx = findIdx([
    'customer pincode', 'delivery pincode', 'destination pincode', 'dest pincode',
    'pincode', 'pin code', 'postal code', 'zip code', 'destination pin code', 'customer pin code'
  ]);

  const awbIdx = findIdx([
    'awb number', 'awb no', 'awb', 'waybill number', 'waybill no', 'waybill',
    'tracking id', 'tracking number', 'tracking no'
  ]);

  const courierIdx = findIdx([
    'courier', 'logistics partner', 'courier partner', 'carrier', 'courier name',
    'delivery partner', '3pl'
  ]);

  const scanDateIdx = findIdx([
    'receive scan time', 'scan time', 'scan date', 'return date', 'return creation date', 'delivery date'
  ]);

  const qtyIdx = findIdx([
    'quantity', 'qty', 'ordered qty', 'item quantity'
  ]);

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
    const quantity = qtyIdx >= 0 ? Math.max(1, Number(row[qtyIdx]) || 1) : 1;
    
    const rawStatus = statusIdx >= 0 ? String(row[statusIdx] || '').toLowerCase() : 'delivered';

    let orderStatus: OrderItem['status'] = 'Delivered';
    let returnType: OrderItem['returnType'] = undefined;

    if (rawStatus.includes('customer return') || (rawStatus.includes('return') && !rawStatus.includes('rto'))) {
      orderStatus = 'Customer Return';
      returnType = 'CUSTOMER RETURN';
    } else if (rawStatus.includes('rto') || rawStatus.includes('return to origin')) {
      orderStatus = 'RTO';
      returnType = 'RTO';
    } else if (rawStatus.includes('transit') || rawStatus.includes('shipped') || rawStatus.includes('in-transit')) {
      orderStatus = 'Shipped';
    } else if (rawStatus.includes('cancel')) {
      orderStatus = 'Cancelled';
      returnType = 'CANCELLED';
    } else {
      orderStatus = 'Delivered';
      returnType = 'DELIVERED';
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

    // ==========================================
    // ACCURATE CUSTOMER CITY & STATE RESOLUTION
    // (Fixes the issue where all Meesho orders defaulted to "New Delhi")
    // ==========================================
    let resolvedCity = '';
    let resolvedState = '';

    // Step 1: Check dedicated State column first
    if (stateIdx >= 0 && row[stateIdx]) {
      const rawState = String(row[stateIdx]).trim();
      if (rawState && rawState.toLowerCase() !== 'null' && rawState.toLowerCase() !== 'undefined' && rawState !== '-') {
        resolvedState = rawState;
      }
    }

    // Step 2: Check direct City column
    if (cityIdx >= 0 && row[cityIdx]) {
      const rawCity = String(row[cityIdx]).trim();
      if (rawCity && rawCity.toLowerCase() !== 'null' && rawCity.toLowerCase() !== 'undefined' && rawCity !== '-') {
        resolvedCity = rawCity;
      }
    }

    // Step 3: Check dedicated Pincode column
    if (pincodeIdx >= 0 && row[pincodeIdx]) {
      const rawPin = String(row[pincodeIdx]).trim();
      const pinResult = resolveFromPincode(rawPin);
      if (pinResult) {
        if (!resolvedCity) resolvedCity = pinResult.city;
        if (!resolvedState) resolvedState = pinResult.state;
      }
    }

    // Step 4: If city is still not found, check Address column
    if (!resolvedCity && addressIdx >= 0 && row[addressIdx]) {
      const rawAddr = String(row[addressIdx]).trim();
      const extracted = extractCityFromAddress(rawAddr);
      if (extracted) {
        resolvedCity = extracted;
      }
    }

    // Step 5: If city is STILL empty but State was found:
    // DO NOT hardcode "New Delhi" unless the state actually is Delhi!
    if (!resolvedCity) {
      if (resolvedState) {
        if (resolvedState.toLowerCase().includes('delhi')) {
          resolvedCity = 'New Delhi';
          resolvedState = 'Delhi';
        } else {
          // Use the real state name so the seller knows the exact customer destination state
          resolvedCity = resolvedState;
        }
      } else {
        resolvedCity = 'N/A';
        resolvedState = 'N/A';
      }
    }

    if (!resolvedState) {
      if (resolvedCity.toLowerCase().includes('delhi')) {
        resolvedState = 'Delhi';
      } else {
        resolvedState = resolvedCity;
      }
    }

    // Courier, AWB, Scan dates from Meesho/Courier sheets
    const awbNumber = awbIdx >= 0 && row[awbIdx] ? String(row[awbIdx]).trim() : undefined;
    const courier = courierIdx >= 0 && row[courierIdx] ? String(row[courierIdx]).trim() : undefined;
    const scanDate = scanDateIdx >= 0 && row[scanDateIdx] ? String(row[scanDateIdx]).trim() : undefined;

    // Calculate days in transit if dates are present
    let daysInTransit: number | undefined = undefined;
    if (scanDate && orderDate) {
      try {
        const d1 = new Date(orderDate).getTime();
        const d2 = new Date(scanDate).getTime();
        if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
          daysInTransit = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        }
      } catch {
        // ignore date math failure
      }
    }

    parsedOrders.push({
      id: `imported-${Date.now()}-${i + 1}`,
      orderId: rawOrderId,
      orderNumber: rawOrderId,
      marketplace,
      orderDate,
      sku,
      title,
      quantity,
      customerCity: resolvedCity,
      customerState: resolvedState,
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
      awbNumber,
      courier,
      returnType,
      scanDate,
      daysInTransit,
    });
  });

  return {
    orders: parsedOrders,
    totalRows: rows.length,
    recognizedMarketplace: marketplace,
    reportType: 'single_report'
  };
}
