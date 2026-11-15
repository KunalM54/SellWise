import readXlsxFile, { readSheet } from 'read-excel-file/browser';
import Papa from 'papaparse';
import { OrderItem, SkuMasterItem } from '../types';

export interface ParseResult {
  orders: OrderItem[];
  totalRows: number;
  recognizedMarketplace: 'meesho' | 'flipkart' | 'amazon' | 'unknown';
  reportType?: 'single_report' | 'two_way_settlement' | 'order_report';
  detectedFileType?: 'orders' | 'payments' | 'returns' | 'generic';
  adCostTotal?: number;
  fileSummaryMessage?: string;
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
    let targetRows: unknown[][] | null = null;
    let allSheets: Array<{ sheet: string; data: unknown[][] }> = [];
    try {
      // Read all sheets with readXlsxFile
      const sheetsResult = await readXlsxFile(file);
      if (Array.isArray(sheetsResult) && sheetsResult.length > 0) {
        allSheets = sheetsResult as Array<{ sheet: string; data: unknown[][] }>;
        const found = allSheets.find(s => 
          s.sheet && (
            s.sheet.toLowerCase().includes('order payments') ||
            s.sheet.toLowerCase().includes('order payment') ||
            s.sheet.toLowerCase().includes('payments') ||
            s.sheet.toLowerCase().includes('settlement')
          )
        );
        targetRows = (found ? found.data : allSheets[0].data) as unknown[][];
      }
    } catch {
      // Fallback
      const sheetData = await readSheet(file);
      targetRows = sheetData as unknown[][];
    }

    if (!targetRows || targetRows.length < 2) {
      return { orders: [], totalRows: 0, recognizedMarketplace: 'unknown', error: 'Empty or invalid spreadsheet' };
    }

    // Capture Ad Cost if Ads Cost sheet is present in the Excel
    let adCostTotal = 0;
    const adsSheet = allSheets.find(s => 
      s.sheet && (
        s.sheet.toLowerCase().includes('ads cost') || 
        s.sheet.toLowerCase().includes('ad cost') || 
        s.sheet.toLowerCase().trim() === 'ads'
      )
    );
    if (adsSheet && adsSheet.data && adsSheet.data.length > 2) {
      const adsHeaders = (adsSheet.data[1] || adsSheet.data[0] || []).map(h => String(h || '').toLowerCase());
      const costIdx = adsHeaders.findIndex(h => h.includes('total ads cost') || h.includes('ad cost incl'));
      if (costIdx >= 0) {
        for (let r = 2; r < adsSheet.data.length; r++) {
          const val = adsSheet.data[r][costIdx];
          if (val !== null && val !== undefined && val !== '') {
            const num = Math.abs(Number(String(val).replace(/[^0-9.-]/g, '')) || 0);
            adCostTotal += num;
          }
        }
      }
    }

    // Find the real header row (scan up to row 15)
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(targetRows.length, 15); r++) {
      const rowStrings = (targetRows[r] as unknown as (string | number | null)[]).map(c => String(c || '').toLowerCase().trim());
      const hasKeywords = rowStrings.some(c => 
        c.includes('sub-order') || c.includes('sub order') || c.includes('suborder') ||
        c.includes('reason for credit entry') || c.includes('order id') || c.includes('order no') ||
        c.includes('order number') || c.includes('type of return') || c.includes('courier partner') ||
        c.includes('supplier sku') || c.includes('supplier listed price') || c.includes('fsn') ||
        c.includes('asin') || c.includes('sku') || c.includes('settlement') || c.includes('payout')
      );
      if (hasKeywords) {
        headerRowIndex = r;
        break;
      }
    }

    const headers = (targetRows[headerRowIndex] as unknown as (string | number | null)[]).map(h => String(h || '').trim().toLowerCase());
    const dataRows = targetRows.slice(headerRowIndex + 1);
    const result = mapRowsToOrders(headers, dataRows as unknown as (string | number | null)[][], file.name, skuMaster);
    if (adCostTotal > 0) {
      result.adCostTotal = Math.round(adCostTotal * 100) / 100;
    }
    return result;
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

        // Detect real header row (scan up to row 15)
        let headerRowIndex = 0;
        for (let r = 0; r < Math.min(results.data.length, 15); r++) {
          const rowStrings = results.data[r].map(c => String(c || '').toLowerCase().trim());
          const hasKeywords = rowStrings.some(c => 
            c.includes('sub-order') || c.includes('sub order') || c.includes('suborder') ||
            c.includes('reason for credit entry') || c.includes('order id') || c.includes('order no') ||
            c.includes('order number') || c.includes('type of return') || c.includes('courier partner') ||
            c.includes('supplier sku') || c.includes('supplier listed price') || c.includes('fsn') ||
            c.includes('asin') || c.includes('sku') || c.includes('settlement') || c.includes('payout')
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
    fName.includes('intransit') ||
    headers.some(h => 
      h.includes('sub-order') || 
      h.includes('sub order') || 
      h.includes('suborder') ||
      h.includes('reason for credit entry') ||
      h.includes('meesho') || 
      h.includes('supplier sku') ||
      h.includes('supplier listed price') ||
      h.includes('live order status') ||
      h.includes('final settlement amount') ||
      h.includes('packet id') ||
      h.includes('type of return')
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

  // 2. Identify exact file type (Orders, Payments/Settlement, Returns/Tracking)
  let detectedFileType: 'orders' | 'payments' | 'returns' | 'generic' = 'generic';

  const isReturnsFile = headers.some(h => 
    h.includes('type of return') || 
    h.includes('suborder number') || 
    h.includes('return reason') || 
    (h.includes('courier partner') && h.includes('awb number'))
  );

  const isPaymentsFile = headers.some(h => 
    h.includes('final settlement amount') || 
    h.includes('settled amount') || 
    h.includes('net payout') || 
    (h.includes('total sale amount') && h.includes('payment date')) ||
    h.includes('bank transfer')
  );

  const isOrdersFile = !isReturnsFile && !isPaymentsFile && headers.some(h => 
    h.includes('reason for credit entry') || 
    h.includes('supplier listed price') || 
    h.includes('supplier discounted price') || 
    h.includes('customer state') ||
    h.includes('packet id') ||
    h.includes('order source')
  );

  if (isReturnsFile) detectedFileType = 'returns';
  else if (isPaymentsFile) detectedFileType = 'payments';
  else if (isOrdersFile) detectedFileType = 'orders';

  const findIdx = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  // Expanded indices covering real marketplace column variations
  const orderIdIdx = findIdx([
    'sub order no', 'sub-order no', 'suborder number', 'suborder no', 'sub_order_no',
    'sub order number', 'sub-order number', 'sub order id', 'sub-order id', 'order id', 'order-id', 'order number', 'order_id'
  ]);
  
  const skuIdx = findIdx([
    'supplier sku', 'seller sku', 'product sku', 'sku code', 'sku', 'fsn', 'asin'
  ]);
  
  const titleIdx = findIdx(['product name', 'title', 'item description', 'description']);
  
  const salePriceIdx = findIdx([
    'supplier listed price', 'supplier discounted price', 'listing price', 'product price',
    'total sale amount', 'total sale', 'sale amount', 'customer paid', 'selling price', 
    'order amount', 'total price', 'unit price', 'item price'
  ]);
  
  const payoutIdx = findIdx([
    'final settlement amount', 'settled amount', 'net payout', 'bank transfer amount', 'bank transfer', 
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
    'reason for credit entry', 'live order status', 'order status', 'delivery status', 'status', 'item status', 'type of return'
  ]);

  const billedWeightIdx = findIdx([
    'charged weight', 'applicable weight', 'billed weight', 'weight (kg)', 'weight (g)', 'weight'
  ]);

  const bankUtrIdx = findIdx([
    'transaction id', 'bank utr', 'utr', 'neft', 'reference no'
  ]);

  const dateIdx = findIdx([
    'order date', 'order placed date', 'dispatch date', 'payment date', 'settlement date', 'date'
  ]);

  const paymentDateIdx = findIdx([
    'payment date', 'settlement date', 'bank deposit date'
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
    'tracking id', 'tracking number', 'packet id', 'tracking no'
  ]);

  const courierIdx = findIdx([
    'courier partner', 'logistics partner', 'courier name', 'delivery partner', 'courier', 'carrier', '3pl'
  ]);

  const returnTypeIdx = findIdx([
    'type of return', 'return type', 'sub type'
  ]);

  const returnPriceTypeIdx = findIdx([
    'return price type', 'price type'
  ]);

  const returnReasonIdx = findIdx([
    'detailed return reason', 'return reason', 'reason'
  ]);

  const scanDateIdx = findIdx([
    'return created date', 'receive scan time', 'scan time', 'scan date', 'return date', 'delivery date'
  ]);

  const qtyIdx = findIdx([
    'quantity', 'qty', 'ordered qty', 'item quantity'
  ]);

  const parsedOrders: OrderItem[] = [];

  rows.forEach((row, i) => {
    const rawOrderId = orderIdIdx >= 0 ? String(row[orderIdIdx] || '').trim() : '';
    // Skip empty lines, formulas, or total summary rows at bottom of spreadsheets
    if (
      !rawOrderId || 
      rawOrderId.toLowerCase() === 'total' || 
      rawOrderId.toLowerCase().startsWith('grand total') ||
      rawOrderId.includes('(b + c') ||
      rawOrderId.toLowerCase().includes('track which')
    ) {
      return;
    }

    const sku = skuIdx >= 0 ? String(row[skuIdx] || 'UNKNOWN-SKU').trim() : 'GENERAL-SKU';
    const title = titleIdx >= 0 ? String(row[titleIdx] || sku).trim() : sku;
    
    // Look up in SKU Master if available
    const masterItem = skuMaster.find(m => m.sku.toLowerCase() === sku.toLowerCase());
    
    // Real Selling Price from file
    let salePrice = 0;
    if (salePriceIdx >= 0 && row[salePriceIdx] !== null && row[salePriceIdx] !== '') {
      const pStr = String(row[salePriceIdx]).replace(/[^0-9.-]/g, '');
      const pNum = Number(pStr);
      if (!isNaN(pNum) && pNum > 0) {
        salePrice = Math.abs(pNum);
      }
    }
    if (salePrice === 0 && masterItem?.costPrice) {
      salePrice = masterItem.costPrice * 1.5;
    }

    // Real Payout extraction
    let actualPayout = 0;
    if (detectedFileType === 'payments' && payoutIdx >= 0 && row[payoutIdx] !== null && row[payoutIdx] !== '') {
      const payStr = String(row[payoutIdx]).replace(/[^0-9.-]/g, '');
      const payNum = Number(payStr);
      actualPayout = isNaN(payNum) ? 0 : Math.round(payNum * 100) / 100;
    } else if (detectedFileType === 'orders' || detectedFileType === 'returns') {
      // In Orders and Returns reports, payment has NOT arrived yet!
      actualPayout = 0;
    } else if (payoutIdx >= 0 && row[payoutIdx] !== null && row[payoutIdx] !== '') {
      const payStr = String(row[payoutIdx]).replace(/[^0-9.-]/g, '');
      const payNum = Number(payStr);
      actualPayout = isNaN(payNum) ? 0 : Math.round(payNum * 100) / 100;
    }

    // Shipping & Fees
    let shipFee = 0;
    if (shippingIdx >= 0 && row[shippingIdx] !== null && row[shippingIdx] !== '') {
      shipFee = Math.abs(Number(String(row[shippingIdx]).replace(/[^0-9.-]/g, '')) || 0);
    } else {
      shipFee = detectedFileType === 'orders' ? 70 : 0;
    }

    let revShipFee = 0;
    if (reverseShippingIdx >= 0 && row[reverseShippingIdx] !== null && row[reverseShippingIdx] !== '') {
      revShipFee = Math.abs(Number(String(row[reverseShippingIdx]).replace(/[^0-9.-]/g, '')) || 0);
    }

    const commFee = commissionIdx >= 0 && row[commissionIdx] 
      ? Math.abs(Number(String(row[commissionIdx]).replace(/[^0-9.-]/g, '')) || 0)
      : (marketplace === 'meesho' ? 0 : salePrice * 0.08);

    const quantity = qtyIdx >= 0 ? Math.max(1, Number(String(row[qtyIdx]).replace(/[^0-9]/g, '')) || 1) : 1;
    
    // Status mapping with exact support for all Meesho lifecycle states
    const rawStatus = (statusIdx >= 0 ? String(row[statusIdx] || '') : '').toLowerCase().trim();

    let orderStatus: OrderItem['status'] = 'Delivered';
    let returnType: OrderItem['returnType'] = undefined;

    if (rawStatus.includes('ready_to_ship') || rawStatus.includes('ready to ship') || rawStatus === 'pending') {
      orderStatus = 'Ready To Ship';
    } else if (rawStatus.includes('hold') || rawStatus.includes('on_hold')) {
      orderStatus = 'Hold';
    } else if (rawStatus.includes('shipped') || rawStatus.includes('in-transit') || rawStatus.includes('in transit') || rawStatus.includes('dispatched')) {
      orderStatus = 'Shipped';
    } else if (rawStatus.includes('picked up')) {
      orderStatus = detectedFileType === 'returns' ? 'Return In Transit' : 'Shipped';
    } else if (rawStatus.includes('out for delivery') || rawStatus.includes('out_for_delivery')) {
      orderStatus = 'Out For Delivery';
    } else if (rawStatus.includes('returned') || rawStatus.includes('return received') || rawStatus.includes('return_delivered')) {
      orderStatus = 'Return Received';
      returnType = rawStatus.includes('rto') ? 'RTO' : 'CUSTOMER RETURN';
    } else if (rawStatus.includes('rto') || rawStatus.includes('return to origin') || rawStatus.includes('courier return')) {
      orderStatus = 'RTO';
      returnType = 'RTO';
    } else if (rawStatus.includes('customer return') || rawStatus.includes('return') || rawStatus.includes('first_ret')) {
      orderStatus = 'Customer Return';
      returnType = 'CUSTOMER RETURN';
    } else if (rawStatus.includes('cancel')) {
      orderStatus = 'Cancelled';
      returnType = 'CANCELLED';
    } else if (rawStatus.includes('delivered')) {
      orderStatus = 'Delivered';
      returnType = 'DELIVERED';
    } else {
      orderStatus = detectedFileType === 'orders' ? 'Ready To Ship' : 'Delivered';
    }

    if (returnTypeIdx >= 0 && row[returnTypeIdx]) {
      const rt = String(row[returnTypeIdx]).toLowerCase();
      if (rt.includes('rto') || rt.includes('courier return')) {
        returnType = 'RTO';
        if (orderStatus !== 'Return Received') orderStatus = 'RTO';
      } else if (rt.includes('customer') || rt.includes('first_ret')) {
        returnType = 'CUSTOMER RETURN';
        if (orderStatus !== 'Return Received') orderStatus = 'Customer Return';
      }
    }

    // Inspect Return Price Type from Meesho Return Tracking Sheet
    let rawReturnPriceType = returnPriceTypeIdx >= 0 && row[returnPriceTypeIdx]
      ? String(row[returnPriceTypeIdx]).trim()
      : '';
    if (rawReturnPriceType.toLowerCase() === 'na' || rawReturnPriceType.toLowerCase() === 'null') {
      rawReturnPriceType = '';
    }

    // In Meesho: If Return Price Type is blank/empty, it is a Courier Return (RTO) with ₹0 Return Shipping Fee!
    // Never assume "Meesho Price" when the cell is empty/blank!
    const isRto = 
      orderStatus === 'RTO' || 
      returnType === 'RTO' || 
      (detectedFileType === 'returns' && !rawReturnPriceType);

    let returnPriceType = rawReturnPriceType;
    if (isRto) {
      returnType = 'RTO';
      if (orderStatus !== 'Return Received') orderStatus = 'RTO';
      returnPriceType = '₹0 (Courier Return RTO)';
      // RTO Courier Return in Meesho is 100% free return (Return Shipping Fee = 0)
      revShipFee = 0;
      shipFee = 0;
    } else if (rawReturnPriceType.toLowerCase().includes('meesho price') || orderStatus === 'Customer Return' || returnType === 'CUSTOMER RETURN') {
      returnType = 'CUSTOMER RETURN';
      if (orderStatus !== 'Return Received') orderStatus = 'Customer Return';
      returnPriceType = 'Meesho Price (Customer Return)';
    }

    // Weight auditing
    let billedWeightGrams = 0;
    if (billedWeightIdx >= 0 && row[billedWeightIdx]) {
      const rawWeight = Number(String(row[billedWeightIdx]).replace(/[^0-9.]/g, '')) || 0;
      billedWeightGrams = rawWeight > 0 && rawWeight < 15 ? Math.round(rawWeight * 1000) : Math.round(rawWeight);
    }
    
    const actualWeightGrams = masterItem?.weightGrams || (billedWeightGrams > 0 ? billedWeightGrams : 400);
    const weightDiscrepancy = billedWeightGrams > 0 && billedWeightGrams > (actualWeightGrams + 200);

    const productCost = masterItem ? masterItem.costPrice : Math.round(salePrice * 0.35);
    const packagingCost = masterItem ? masterItem.packagingCost : 15;
    const estimatedGst = Math.round(salePrice * 0.05);
    
    // For RTO courier return, Meesho charges ₹0 return shipping fee!
    // Reverse shipping is ONLY applicable for Customer Returns (or as billed in payment sheet)
    const effectiveReverseShipping = isRto ? 0 : (revShipFee > 0 ? revShipFee : (orderStatus === 'Customer Return' ? 70 : 0));

    const expectedPayout = orderStatus === 'Delivered' 
      ? Math.max(0, Math.round(salePrice - commFee - shipFee - estimatedGst))
      : 0;

    const discrepancy = (expectedPayout > actualPayout && actualPayout > 0) 
      ? Math.round((expectedPayout - actualPayout) * 100) / 100 
      : 0;
    const isDiscrepant = (discrepancy > 20 && actualPayout > 0) || weightDiscrepancy;

    let discrepancyReason: string | undefined = undefined;
    if (returnReasonIdx >= 0 && row[returnReasonIdx]) {
      const rReason = String(row[returnReasonIdx]).trim();
      if (rReason && rReason !== 'NA' && rReason !== '-') {
        discrepancyReason = rReason;
      }
    }
    if (!discrepancyReason) {
      if (weightDiscrepancy) {
        discrepancyReason = `Weight Overcharged: Courier billed ${billedWeightGrams}g vs actual ${actualWeightGrams}g`;
      } else if (isDiscrepant) {
        discrepancyReason = 'Settlement sheet payout is lower than marketplace contracted slab';
      }
    }

    // Reconciliation status
    let reconciliationStatus: OrderItem['reconciliationStatus'] = 'Pending';
    if (detectedFileType === 'payments') {
      reconciliationStatus = isDiscrepant ? 'Discrepancy' : 'Settled';
    } else if (actualPayout !== 0) {
      reconciliationStatus = isDiscrepant ? 'Discrepancy' : 'Settled';
    } else {
      reconciliationStatus = 'Pending';
    }

    const bankUtr = bankUtrIdx >= 0 && row[bankUtrIdx] ? String(row[bankUtrIdx]).trim() : undefined;
    const orderDate = dateIdx >= 0 && row[dateIdx] ? String(row[dateIdx]).split('T')[0].split(' ')[0] : new Date().toISOString().split('T')[0];

    // Bank deposit date
    let bankDepositDate: string | undefined = undefined;
    if (paymentDateIdx >= 0 && row[paymentDateIdx]) {
      const pDate = String(row[paymentDateIdx]).trim().split('T')[0].split(' ')[0];
      if (pDate && pDate.toLowerCase() !== 'unscheduled' && pDate !== '-') {
        bankDepositDate = pDate;
      }
    } else if (bankUtr) {
      bankDepositDate = orderDate;
    }

    // Location resolution
    let resolvedCity = '';
    let resolvedState = '';

    if (stateIdx >= 0 && row[stateIdx]) {
      const rawState = String(row[stateIdx]).trim();
      if (rawState && rawState.toLowerCase() !== 'null' && rawState.toLowerCase() !== 'undefined' && rawState !== '-') {
        resolvedState = rawState;
      }
    }

    if (cityIdx >= 0 && row[cityIdx]) {
      const rawCity = String(row[cityIdx]).trim();
      if (rawCity && rawCity.toLowerCase() !== 'null' && rawCity.toLowerCase() !== 'undefined' && rawCity !== '-') {
        resolvedCity = rawCity;
      }
    }

    if (pincodeIdx >= 0 && row[pincodeIdx]) {
      const rawPin = String(row[pincodeIdx]).trim();
      const pinResult = resolveFromPincode(rawPin);
      if (pinResult) {
        if (!resolvedCity) resolvedCity = pinResult.city;
        if (!resolvedState) resolvedState = pinResult.state;
      }
    }

    if (!resolvedCity && addressIdx >= 0 && row[addressIdx]) {
      const rawAddr = String(row[addressIdx]).trim();
      const extracted = extractCityFromAddress(rawAddr);
      if (extracted) {
        resolvedCity = extracted;
      }
    }

    if (!resolvedCity) {
      if (resolvedState) {
        if (resolvedState.toLowerCase().includes('delhi')) {
          resolvedCity = 'New Delhi';
          resolvedState = 'Delhi';
        } else {
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

    const awbNumber = awbIdx >= 0 && row[awbIdx] ? String(row[awbIdx]).trim() : undefined;
    const courier = courierIdx >= 0 && row[courierIdx] ? String(row[courierIdx]).trim() : undefined;
    const scanDate = scanDateIdx >= 0 && row[scanDateIdx] ? String(row[scanDateIdx]).trim() : undefined;

    let daysInTransit: number | undefined = undefined;
    if (scanDate && orderDate) {
      try {
        const d1 = new Date(orderDate).getTime();
        const d2 = new Date(scanDate).getTime();
        if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
          daysInTransit = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        }
      } catch {
        // ignore
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
      actualPayout: Math.round(actualPayout * 100) / 100,
      status: orderStatus,
      reconciliationStatus,
      discrepancyAmount: discrepancy,
      discrepancyReason,
      claimEligible: isDiscrepant || orderStatus === 'Customer Return' || weightDiscrepancy,
      claimStatus: (isDiscrepant || orderStatus === 'Customer Return' || weightDiscrepancy) ? 'Eligible' : 'Not Eligible',
      billedWeightGrams: billedWeightGrams > 0 ? billedWeightGrams : undefined,
      actualWeightGrams: actualWeightGrams > 0 ? actualWeightGrams : undefined,
      weightDiscrepancy,
      bankUtr,
      bankDepositDate,
      awbNumber,
      courier,
      returnType,
      returnPriceType,
      scanDate,
      daysInTransit,
    });
  });

  return {
    orders: parsedOrders,
    totalRows: rows.length,
    recognizedMarketplace: marketplace,
    detectedFileType,
    reportType: isPaymentsFile ? 'two_way_settlement' : (isOrdersFile ? 'order_report' : 'single_report'),
    fileSummaryMessage: `Mapped ${parsedOrders.length} records [Type: ${detectedFileType.toUpperCase()}]`
  };
}
