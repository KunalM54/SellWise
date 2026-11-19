import readXlsxFile from 'read-excel-file/browser';
import Papa from 'papaparse';
import { FeeCode, LedgerEvent, LedgerFileKind } from '../types/ledger';

/**
 * Meesho file ingestion.
 *
 * Meesho exports three different shapes for the same order:
 *   - Orders CSV          -> one row per sub-order, with its current status
 *   - Returns/tracking CSV -> one row per return / RTO attempt
 *   - Payment XLSX        -> one row per settled sub-order, money split into columns
 *
 * Everything is normalized into signed `LedgerEvent`s so the ledger engine never
 * has to know which file an event came from.
 */

export type MeeshoFileKind = LedgerFileKind;

export interface MeeshoParseResult {
  fileName: string;
  kind: MeeshoFileKind;
  /** Data rows read (excluding metadata + header rows). */
  rowCount: number;
  events: LedgerEvent[];
  warnings: string[];
}

const CHANNEL = 'meesho' as const;

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return toIsoDate(value);
  return String(value).replace(/^\uFEFF/, '').trim();
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = text(value);
  if (!raw) return '';

  // ISO already (Meesho CSVs use this)
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // dd-mm-yyyy / dd/mm/yyyy
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  return '';
}

/** Parses "1,234.50", "₹ 1,234.50", "(120)" -> number. */
function money(value: unknown): number {
  const raw = text(value);
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw);
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return 0;
  return negative ? -amount : amount;
}

function qty(value: unknown): number {
  const n = Number(text(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parentOrderId(subOrderId: string): string {
  const idx = subOrderId.lastIndexOf('_');
  return idx > 0 ? subOrderId.slice(0, idx) : subOrderId;
}

function eventId(
  subOrderId: string,
  eventType: LedgerEvent['eventType'],
  feeCode: FeeCode | undefined,
  eventDate: string,
  settlementId: string | undefined,
  amount: number,
): string {
  return [
    CHANNEL,
    subOrderId.toLowerCase(),
    eventType,
    feeCode ?? 'na',
    eventDate,
    settlementId ?? 'na',
    Math.round(amount * 100),
  ].join('|');
}

function makeEvent(input: Omit<LedgerEvent, 'id' | 'channel'>): LedgerEvent {
  return {
    ...input,
    id: eventId(
      input.subOrderId,
      input.eventType,
      input.feeCode,
      input.eventDate,
      input.settlementId,
      input.amount,
    ),
    channel: CHANNEL,
  };
}

/* ------------------------------------------------------------------ */
/* header detection                                                    */
/* ------------------------------------------------------------------ */

const KNOWN_HEADERS = new Set([
  'reason for credit entry',
  'sub order no',
  'suborder number',
  'order number',
  'order date',
  'catalog id',
  'order source',
  'customer state',
  'product name',
  'sku',
  'supplier sku',
  'quantity',
  'supplier listed price (incl. gst + commission)',
  'supplier discounted price (incl gst and commision)',
  'packet id',
  's no',
  'type of return',
  'sub type',
  'return created date',
  'delivered date',
  'dispatch date',
  'status',
  'final settlement amount',
  'transaction id',
  'payment date',
  'live order status',
  'deduction date',
  'campaign id',
  'total ads cost',
  'ad cost incl. credits/waivers/discounts',
  'reward id',
  'net referral amount',
  'program name',
  'amount (inc gst) inr',
]);

function normalizeHeader(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, ' ');
}

/** Meesho CSVs hide the header below 5-6 metadata lines, so we score rows. */
function findHeaderRow(rows: unknown[][], minScore = 3): number {
  let bestIndex = -1;
  let bestScore = 0;

  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    let score = 0;
    for (const cell of row) {
      if (KNOWN_HEADERS.has(normalizeHeader(cell))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= minScore ? bestIndex : -1;
}

/** Counts order rows that actually carry a sub-order id (skips formula-hint and "no data" rows). */
function countOrderPaymentRows(data: unknown[][]): number {
  const headerIndex = findHeaderRow(data);
  if (headerIndex < 0) return 0;
  const columns = buildColumnIndex((data[headerIndex] ?? []).map((value) => text(value)));
  return data.slice(headerIndex + 1).filter((row) => {
    const subOrderId = text(cell(row, columns, 'sub order no'));
    return Boolean(subOrderId) && !/no data is available/i.test(subOrderId);
  }).length;
}

/** Counts rows where at least one of the money columns is non-zero. */
function countMoneyRows(data: unknown[][], amountHeaders: string[], minScore = 2): number {
  const headerIndex = findHeaderRow(data, minScore);
  if (headerIndex < 0) return 0;
  const columns = buildColumnIndex((data[headerIndex] ?? []).map((value) => text(value)));
  return data.slice(headerIndex + 1).filter((row) =>
    amountHeaders.some((header) => money(cell(row, columns, header)) !== 0),
  ).length;
}

function detectCsvKind(headers: string[]): MeeshoFileKind {
  const set = new Set(headers.map(normalizeHeader));
  if (set.has('reason for credit entry') && set.has('sub order no')) return 'orders';
  if (set.has('type of return') || (set.has('suborder number') && set.has('s no'))) return 'returns';
  if (set.has('final settlement amount')) return 'payment';
  return 'unknown';
}

/** Maps header row to column indexes; duplicates are exposed as name#2, name#3... */
function buildColumnIndex(headers: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key) return;
    const bucket = map.get(key);
    if (bucket) bucket.push(index);
    else map.set(key, [index]);
  });
  return map;
}

function cell(row: unknown[], columns: Map<string, number[]>, header: string, occurrence = 0): unknown {
  const indexes = columns.get(header);
  if (!indexes || indexes.length <= occurrence) return '';
  return row[indexes[occurrence]] ?? '';
}

function rowToRecord(headers: string[], row: unknown[]): Record<string, string> {
  const record: Record<string, string> = {};
  const seen = new Map<string, number>();
  headers.forEach((header, index) => {
    const name = text(header);
    if (!name) return;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    record[count === 1 ? name : `${name} #${count}`] = text(row[index]);
  });
  return record;
}

/* ------------------------------------------------------------------ */
/* orders + returns CSV                                                */
/* ------------------------------------------------------------------ */

function parseOrdersCsv(
  headers: string[],
  rows: unknown[][],
  fileName: string,
  warnings: string[],
): LedgerEvent[] {
  const columns = buildColumnIndex(headers);
  const bySubOrder = new Map<string, { event: LedgerEvent; date: string }>();
  let duplicateRows = 0;
  let supersededRows = 0;

  rows.forEach((row, index) => {
    const subOrderId = text(cell(row, columns, 'sub order no'));
    if (!subOrderId) return;

    const status = text(cell(row, columns, 'reason for credit entry')).toUpperCase();
    const eventDate =
      toIsoDate(cell(row, columns, 'order date')) || ''; // keeps files readable, never "today"
    const quantity = qty(cell(row, columns, 'quantity'));
    const listed = money(cell(row, columns, 'supplier listed price (incl. gst + commission)'));
    const discounted = money(cell(row, columns, 'supplier discounted price (incl gst and commision)'));
    const unitPrice = discounted > 0 ? discounted : listed;

    const record = rowToRecord(headers, row);
    record.status = status;
    record.qty = String(quantity);

    const event = makeEvent({
      subOrderId,
      orderId: parentOrderId(subOrderId),
      sku: text(cell(row, columns, 'sku')),
      eventType: 'sale',
      feeCode: 'principal',
      amount: round2(unitPrice * quantity),
      eventDate,
      sourceFile: fileName,
      sourceRow: index + 1,
      rawRow: record,
    });

    const existing = bySubOrder.get(subOrderId);
    if (!existing) {
      bySubOrder.set(subOrderId, { event, date: eventDate });
      return;
    }

    // The same sub-order appears once per status change. The newest row wins.
    if (eventDate > existing.date) {
      supersededRows += 1;
      bySubOrder.set(subOrderId, { event, date: eventDate });
    } else if (eventDate === existing.date) {
      duplicateRows += 1;
    } else {
      supersededRows += 1;
    }
  });

  if (duplicateRows > 0) warnings.push(`${duplicateRows} exact duplicate order rows ignored.`);
  if (supersededRows > 0) {
    warnings.push(`${supersededRows} older status rows for the same sub-order ignored (newest kept).`);
  }

  return [...bySubOrder.values()].map((entry) => entry.event);
}

function parseReturnsCsv(
  headers: string[],
  rows: unknown[][],
  fileName: string,
  warnings: string[],
): LedgerEvent[] {
  const columns = buildColumnIndex(headers);
  const events: LedgerEvent[] = [];
  let missingKey = 0;

  rows.forEach((row, index) => {
    const subOrderId = text(cell(row, columns, 'suborder number'));
    if (!subOrderId) {
      missingKey += 1;
      return;
    }

    const record = rowToRecord(headers, row);
    const returnType = text(cell(row, columns, 'type of return'));
    const subType = text(cell(row, columns, 'sub type'));
    record.status = returnType || subType;

    const eventDate =
      toIsoDate(cell(row, columns, 'return created date')) ||
      toIsoDate(cell(row, columns, 'delivered date')) ||
      toIsoDate(cell(row, columns, 'dispatch date'));

    events.push(
      makeEvent({
        subOrderId,
        orderId: text(cell(row, columns, 'order number')) || parentOrderId(subOrderId),
        sku: text(cell(row, columns, 'sku')),
        eventType: 'return',
        feeCode: 'refund',
        // The returns report carries no money. It marks the order as returned;
        // the actual reverse-shipping charge arrives in the payment file.
        amount: 0,
        eventDate,
        sourceFile: fileName,
        sourceRow: index + 1,
        rawRow: record,
      }),
    );
  });

  if (missingKey > 0) warnings.push(`${missingKey} return rows had no sub-order number.`);
  return events;
}

/* ------------------------------------------------------------------ */
/* payment XLSX                                                        */
/* ------------------------------------------------------------------ */

type PaymentRole = 'credit' | 'debit';

interface PaymentColumn {
  header: string;
  occurrence?: number;
  role: PaymentRole;
  feeCode: FeeCode;
  label: string;
}

/**
 * Order Payments sheet. Header names repeat ("Fixed Fee (Incl. GST)" appears
 * twice), so occurrences are addressed explicitly instead of by name.
 */
const ORDER_PAYMENT_COLUMNS: PaymentColumn[] = [
  { header: 'total sale amount (incl. shipping & gst)', role: 'credit', feeCode: 'principal', label: 'Sale amount' },
  { header: 'waivers (excl. gst)', role: 'credit', feeCode: 'other', label: 'Waiver' },
  { header: 'gst compensation (prp shipping)', role: 'credit', feeCode: 'other', label: 'GST compensation' },
  { header: 'compensation', role: 'credit', feeCode: 'other', label: 'Compensation' },
  { header: 'claims', role: 'credit', feeCode: 'other', label: 'Claim' },

  { header: 'total sale return amount (incl. shipping & gst)', role: 'debit', feeCode: 'refund', label: 'Sale return' },
  { header: 'fixed fee (incl. gst)', occurrence: 0, role: 'debit', feeCode: 'fixed_fee', label: 'Fixed fee' },
  { header: 'fixed fee (incl. gst)', occurrence: 1, role: 'debit', feeCode: 'fixed_fee', label: 'Fixed fee (platform)' },
  { header: 'warehousing fee (inc gst)', role: 'debit', feeCode: 'other', label: 'Warehousing fee' },
  { header: 'warehousing fee (incl. gst)', role: 'debit', feeCode: 'other', label: 'Warehousing fee' },
  { header: 'return premium (incl gst)', occurrence: 0, role: 'debit', feeCode: 'other', label: 'Return premium' },
  { header: 'return premium (incl gst)', occurrence: 1, role: 'debit', feeCode: 'other', label: 'Return premium (return)' },
  { header: 'meesho commission (incl. gst)', role: 'debit', feeCode: 'commission', label: 'Meesho commission' },
  { header: 'meesho gold platform fee (incl. gst)', role: 'debit', feeCode: 'commission', label: 'Meesho gold fee' },
  { header: 'meesho mall platform fee (incl. gst)', role: 'debit', feeCode: 'commission', label: 'Meesho mall fee' },
  { header: 'return shipping charge (incl. gst)', role: 'debit', feeCode: 'reverse_shipping', label: 'Return shipping' },
  { header: 'shipping charge (incl. gst)', role: 'debit', feeCode: 'shipping', label: 'Shipping' },
  { header: 'other support service charges (excl. gst)', role: 'debit', feeCode: 'other', label: 'Support service' },
  { header: 'gst on net other support service charges', role: 'debit', feeCode: 'other', label: 'GST on support service' },
  { header: 'tcs', role: 'debit', feeCode: 'tcs', label: 'TCS' },
  { header: 'tds', role: 'debit', feeCode: 'tds', label: 'TDS' },
  { header: 'recovery', role: 'debit', feeCode: 'penalty', label: 'Recovery' },
];

function parsePaymentSheet(
  data: unknown[][],
  fileName: string,
  sheetLabel: string,
  warnings: string[],
): LedgerEvent[] {
  const headerIndex = findHeaderRow(data);
  if (headerIndex < 0) {
    warnings.push(`"${sheetLabel}" sheet: could not find a header row.`);
    return [];
  }

  const headers = (data[headerIndex] ?? []).map((value) => text(value));
  const columns = buildColumnIndex(headers);
  const body = data.slice(headerIndex + 1);
  const events: LedgerEvent[] = [];
  let rows = 0;
  let noData = 0;

  body.forEach((row, offset) => {
    const sourceRow = headerIndex + offset + 2;
    const first = text(row[0]);
    if (/no data is available/i.test(first)) {
      noData += 1;
      return;
    }
    const subOrderId = text(cell(row, columns, 'sub order no'));
    if (!subOrderId) return;
    rows += 1;

    const orderDate = toIsoDate(cell(row, columns, 'order date'));
    const dispatchDate = toIsoDate(cell(row, columns, 'dispatch date'));
    const paymentDate = toIsoDate(cell(row, columns, 'payment date'));
    const eventDate = paymentDate || orderDate || dispatchDate;
    const settlementId = text(cell(row, columns, 'transaction id')) || undefined;
    const record = rowToRecord(headers, row);
    record.status = text(cell(row, columns, 'live order status'));
    record.qty = text(cell(row, columns, 'quantity')) || '1';

    let componentTotal = 0;
    let emitted = 0;

    for (const column of ORDER_PAYMENT_COLUMNS) {
      const raw = cell(row, columns, column.header, column.occurrence ?? 0);
      // Skip aliases that do not exist in this export (e.g. warehousing variants).
      if (!columns.has(column.header)) continue;
      const value = money(raw);
      if (value === 0) continue;

      const amount = column.role === 'debit' ? -Math.abs(value) : Math.abs(value);
      componentTotal += amount;
      emitted += 1;

      events.push(
        makeEvent({
          subOrderId,
          orderId: parentOrderId(subOrderId),
          sku: text(cell(row, columns, 'supplier sku')),
          eventType: 'settlement',
          feeCode: column.feeCode,
          amount: round2(amount),
          eventDate,
          settlementId,
          sourceFile: fileName,
          sourceRow,
          rawRow: {
            ...record,
            feeLabel: column.occurrence ? `${column.label} #${column.occurrence + 1}` : column.label,
          },
        }),
      );
    }

    const finalAmount = money(cell(row, columns, 'final settlement amount'));
    if (finalAmount !== 0 && emitted > 0 && Math.abs(finalAmount - componentTotal) > 1) {
      warnings.push(
        `Sub-order ${subOrderId}: settlement columns add up to ₹${round2(componentTotal)}, file says ₹${round2(finalAmount)}.`,
      );
    }
  });

  if (rows === 0 && noData > 0) {
    warnings.push(`"${sheetLabel}" sheet has no payment rows for this period.`);
  }

  return events;
}

function parseAdsSheet(data: unknown[][], fileName: string, warnings: string[]): LedgerEvent[] {
  const headerIndex = findHeaderRow(data, 2);
  if (headerIndex < 0) return [];

  const headers = (data[headerIndex] ?? []).map((value) => text(value));
  const columns = buildColumnIndex(headers);
  if (!columns.has('total ads cost') && !columns.has('ad cost incl. credits/waivers/discounts')) return [];

  const events: LedgerEvent[] = [];
  data.slice(headerIndex + 1).forEach((row, offset) => {
    const total =
      money(cell(row, columns, 'total ads cost')) ||
      money(cell(row, columns, 'ad cost incl. credits/waivers/discounts'));
    if (total === 0) return;

    const eventDate =
      toIsoDate(cell(row, columns, 'deduction date')) || toIsoDate(cell(row, columns, 'deduction duration'));

    events.push(
      makeEvent({
        subOrderId: '',
        orderId: '',
        sku: '',
        eventType: 'settlement',
        feeCode: 'ads',
        amount: round2(-Math.abs(total)),
        eventDate,
        settlementId: text(cell(row, columns, 'campaign id')) || undefined,
        sourceFile: fileName,
        sourceRow: headerIndex + offset + 2,
        rawRow: rowToRecord(headers, row),
      }),
    );
  });

  if (events.length === 0) warnings.push('"Ads Cost" sheet has no ad spend for this period.');
  return events;
}

function parseReferralSheet(data: unknown[][], fileName: string): LedgerEvent[] {
  const headerIndex = findHeaderRow(data, 2);
  if (headerIndex < 0) return [];
  const headers = (data[headerIndex] ?? []).map((value) => text(value));
  const columns = buildColumnIndex(headers);
  if (!columns.has('net referral amount')) return [];

  const events: LedgerEvent[] = [];
  data.slice(headerIndex + 1).forEach((row, offset) => {
    const amount = money(cell(row, columns, 'net referral amount'));
    if (amount === 0) return;
    events.push(
      makeEvent({
        subOrderId: '',
        orderId: '',
        sku: '',
        eventType: 'settlement',
        feeCode: 'other',
        amount: round2(Math.abs(amount)),
        eventDate: toIsoDate(cell(row, columns, 'payment date')),
        settlementId: text(cell(row, columns, 'reward id')) || undefined,
        sourceFile: fileName,
        sourceRow: headerIndex + offset + 2,
        rawRow: rowToRecord(headers, row),
      }),
    );
  });
  return events;
}

function parseCompensationSheet(data: unknown[][], fileName: string): LedgerEvent[] {
  const headerIndex = findHeaderRow(data, 2);
  if (headerIndex < 0) return [];
  const headers = (data[headerIndex] ?? []).map((value) => text(value));
  const columns = buildColumnIndex(headers);
  if (!columns.has('amount (inc gst) inr')) return [];

  const events: LedgerEvent[] = [];
  data.slice(headerIndex + 1).forEach((row, offset) => {
    const amount = money(cell(row, columns, 'amount (inc gst) inr'));
    if (amount === 0) return;
    const reason = text(cell(row, columns, 'reason'));
    events.push(
      makeEvent({
        subOrderId: '',
        orderId: '',
        sku: '',
        eventType: 'settlement',
        feeCode: /recover/i.test(reason) ? 'penalty' : 'other',
        amount: round2(amount),
        eventDate: toIsoDate(cell(row, columns, 'date')),
        sourceFile: fileName,
        sourceRow: headerIndex + offset + 2,
        rawRow: rowToRecord(headers, row),
      }),
    );
  });
  return events;
}

async function parsePaymentWorkbook(
  file: File,
  fileName: string,
  warnings: string[],
): Promise<{ events: LedgerEvent[]; rows: number }> {
  const sheets = (await readXlsxFile(file)) as unknown as Array<{ sheet: string; data: unknown[][] }>;
  if (!Array.isArray(sheets) || sheets.length === 0) {
    warnings.push('Payment workbook could not be read.');
    return { events: [], rows: 0 };
  }

  const events: LedgerEvent[] = [];
  let rows = 0;
  let sawOrdersSheet = false;

  for (const sheet of sheets) {
    const label = text(sheet.sheet);
    if (!label) continue;
    const lower = label.toLowerCase();
    if (lower.includes('order payment')) {
      sawOrdersSheet = true;
      rows += countOrderPaymentRows(sheet.data);
      events.push(...parsePaymentSheet(sheet.data, fileName, label, warnings));
    } else if (lower.includes('ads cost')) {
      rows += countMoneyRows(sheet.data, ['total ads cost', 'ad cost incl. credits/waivers/discounts']);
      events.push(...parseAdsSheet(sheet.data, fileName, warnings));
    } else if (lower.includes('referral')) {
      rows += countMoneyRows(sheet.data, ['net referral amount']);
      events.push(...parseReferralSheet(sheet.data, fileName));
    } else if (lower.includes('compensation') || lower.includes('recovery')) {
      rows += countMoneyRows(sheet.data, ['amount (inc gst) inr']);
      events.push(...parseCompensationSheet(sheet.data, fileName));
    }
  }

  if (!sawOrdersSheet) warnings.push('No "Order Payments" sheet found in the workbook.');
  return { events, rows };
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

function parseCsvText(raw: string): unknown[][] {
  const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: 'greedy' });
  return (parsed.data ?? []) as unknown[][];
}

export async function parseMeeshoFile(file: File): Promise<MeeshoParseResult> {
  const fileName = file.name;
  const warnings: string[] = [];
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.xlsx')) {
    const { events, rows } = await parsePaymentWorkbook(file, fileName, warnings);
    return { fileName, kind: 'payment', rowCount: rows, events, warnings };
  }

  if (!lower.endsWith('.csv')) {
    return {
      fileName,
      kind: 'unknown',
      rowCount: 0,
      events: [],
      warnings: ['Unsupported file. Upload a Meesho orders CSV, returns CSV, or payment XLSX.'],
    };
  }

  const rows = parseCsvText(await file.text());
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) {
    return {
      fileName,
      kind: 'unknown',
      rowCount: 0,
      events: [],
      warnings: ['Could not find a Meesho header row in this file.'],
    };
  }

  const headers = (rows[headerIndex] ?? []).map((value) => text(value));
  const kind = detectCsvKind(headers);
  const body = rows.slice(headerIndex + 1);

  if (kind === 'orders') {
    const events = parseOrdersCsv(headers, body, fileName, warnings);
    return { fileName, kind, rowCount: body.length, events, warnings };
  }

  if (kind === 'returns') {
    const events = parseReturnsCsv(headers, body, fileName, warnings);
    return { fileName, kind, rowCount: body.length, events, warnings };
  }

  return {
    fileName,
    kind: 'unknown',
    rowCount: body.length,
    events: [],
    warnings: ['Unrecognised Meesho report: expected orders, returns, or payment columns.'],
  };
}
