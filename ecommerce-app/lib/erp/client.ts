import { connectDB } from "@/lib/db";
import { adjustStock, variantKey } from "@/lib/inventory";
import { slugify } from "@/lib/slugify";
import { Category, Order, Product, ReturnRequest, User } from "@/models";

/** HisabKitab third-party API adapter used by the manual Admin -> ERP sync panel. */

export interface ErpConfig {
  baseUrl: string;
  apiKey: string;
  authHeader: string;
  authScheme: string;
  timeoutMs: number;
}

export function getErpConfig(): ErpConfig | null {
  const baseUrl = process.env.ERP_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    authHeader: process.env.ERP_AUTH_HEADER || "apikey",
    authScheme: process.env.ERP_AUTH_SCHEME ?? "",
    timeoutMs: Number(process.env.ERP_TIMEOUT_MS ?? 15000),
  };
}

export function isErpConfigured(): boolean {
  return getErpConfig() !== null;
}

function envPath(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const ERP_ENDPOINTS = {
  ping: envPath("ERP_PATH_PING", "/cess-rates"),
  products: envPath("ERP_PATH_PRODUCTS", "/items"),
  stock: envPath("ERP_PATH_STOCK", "/items"),
  prices: envPath("ERP_PATH_PRICES", "/items"),
  orders: envPath("ERP_PATH_ORDERS", "/sale-transactions"),
  customers: envPath("ERP_PATH_CUSTOMERS", "/ledgers"),
  dispatch: envPath("ERP_PATH_DISPATCH", "/delivery-challan-transactions"),
  returns: envPath("ERP_PATH_RETURNS", "/sale-return-transactions"),
};

export interface ErpResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

function authValue(scheme: string, key: string): string {
  const prefix = scheme.trim();
  return prefix ? `${prefix} ${key}` : key;
}

async function call<T>(path: string, init: RequestInit = {}, attempt = 1): Promise<ErpResult<T>> {
  const config = getErpConfig();
  if (!config) return { ok: false, error: "ERP is not configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [config.authHeader]: authValue(config.authScheme, config.apiKey),
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status >= 500 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        return call<T>(path, init, attempt + 1);
      }
      return { ok: false, status: response.status, error: body?.message || body?.error || `ERP returned HTTP ${response.status}` };
    }
    return { ok: true, status: response.status, data: body as T };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    if (!timedOut && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      return call<T>(path, init, attempt + 1);
    }
    return { ok: false, error: timedOut ? "ERP request timed out" : error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function rowsOf(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? payload?.items ?? payload?.results ?? payload?.records ?? [];
}

function query(path: string, values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
  return `${path}?${params.toString()}`;
}

function formatErpDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${value.getFullYear()}`;
}

export function currentFinancialYear(): { startDate: string; endDate: string } {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { startDate: `01-04-${startYear}`, endDate: `31-03-${startYear + 1}` };
}

function transactionPath(path: string, limit = 1000): string {
  const { startDate, endDate } = currentFinancialYear();
  return query(path, { start_date: startDate, end_date: endDate, limit, skip: 0 });
}

export interface SyncReport {
  examined: number;
  updated: number;
  skipped: number;
  errors: string[];
  created?: number;
  matched?: number;
  sourceCount?: number;
  note?: string;
}

function report(note?: string): SyncReport {
  return { examined: 0, updated: 0, skipped: 0, errors: [], ...(note ? { note } : {}) };
}

function addError(result: SyncReport, message: string) {
  if (result.errors.length < 25) result.errors.push(message);
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function skuOf(raw: any): string {
  return stringValue(raw?.sku ?? raw?.SKU ?? raw?.itemCode ?? raw?.item_code ?? raw?.code);
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === "" || value === undefined || value === null) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

async function uniqueProductSlug(title: string): Promise<string> {
  const base = slugify(title) || `erp-item-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (await Product.exists({ slug: candidate })) candidate = `${base}-${suffix++}`;
  return candidate;
}

/** Pull ERP item master fields. Price and quantity remain separate explicit operations. */
export async function syncProductsFromErp(): Promise<SyncReport> {
  const result = report("Item master is matched by SKU; ERP rows without a SKU are skipped.");
  const response = await call<any>(ERP_ENDPOINTS.products);
  if (!response.ok) {
    addError(result, response.error ?? "Product fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data);
  result.sourceCount = source.length;
  const categories = await Category.find({}).select("_id name slug").lean<any[]>();
  const categoryMap = new Map<string, any>();
  for (const category of categories) {
    categoryMap.set(stringValue(category.name).toLowerCase(), category._id);
    categoryMap.set(stringValue(category.slug).toLowerCase(), category._id);
  }
  const fallbackCategory = process.env.ERP_DEFAULT_CATEGORY_SLUG ? categoryMap.get(process.env.ERP_DEFAULT_CATEGORY_SLUG.toLowerCase()) : undefined;
  let created = 0;
  for (const raw of source) {
    const sku = skuOf(raw);
    if (!sku) {
      result.skipped += 1;
      continue;
    }
    result.examined += 1;
    const title = stringValue(raw?.item_name ?? raw?.name ?? raw?.title);
    if (!title) {
      result.skipped += 1;
      addError(result, `${sku}: missing ERP item name`);
      continue;
    }
    const categoryKey = stringValue(raw?.group_name ?? raw?.category).toLowerCase();
    const categoryId = categoryMap.get(categoryKey) ?? fallbackCategory;
    const existing = await Product.findOne({ sku });
    if (!existing && !categoryId) {
      result.skipped += 1;
      addError(result, `${sku}: ERP group "${raw?.group_name ?? ""}" is not mapped to a website category`);
      continue;
    }
    const gstRate = numberValue(raw?.gst_rate);
    const masterFields = {
      title,
      description: stringValue(raw?.description) || title,
      hsnCode: stringValue(raw?.hsn_sac_code ?? raw?.hsnCode),
      ...(categoryId ? { category: categoryId } : {}),
      ...(gstRate !== undefined ? { gstRate } : {}),
    };
    if (existing) {
      Object.assign(existing, masterFields);
      if (existing.isModified()) {
        await existing.save();
        result.updated += 1;
      } else result.skipped += 1;
      continue;
    }
    const price = numberValue(raw?.mrp, raw?.selling_price_with_gst, raw?.selling_price_without_gst);
    if (!price || price <= 0) {
      result.skipped += 1;
      addError(result, `${sku}: a positive ERP price is required to create the website product`);
      continue;
    }
    await Product.create({
      ...masterFields,
      sku,
      slug: await uniqueProductSlug(title),
      price,
      stock: 0,
      images: [],
      variants: [],
      variantCombinations: [],
      tags: ["erp-import"],
      isActive: false,
      isFeatured: false,
      publishedAt: new Date(),
    });
    created += 1;
    result.updated += 1;
  }
  result.created = created;
  return result;
}

export async function syncPricesFromErp(): Promise<SyncReport> {
  const result = report("MRP and selling price are pulled from the ERP item master by SKU.");
  const response = await call<any>(ERP_ENDPOINTS.prices);
  if (!response.ok) {
    addError(result, response.error ?? "Price fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data);
  result.sourceCount = source.length;
  for (const raw of source) {
    const sku = skuOf(raw);
    const price = numberValue(raw?.mrp, raw?.price, raw?.rate);
    if (!sku || price === undefined || price <= 0) {
      result.skipped += 1;
      continue;
    }
    result.examined += 1;
    const product = await Product.findOne({ $or: [{ sku }, { "variantCombinations.sku": sku }] });
    if (!product) {
      result.skipped += 1;
      continue;
    }
    const selling = numberValue(raw?.selling_price_with_gst, raw?.selling_price_without_gst, raw?.salePrice);
    const discountPrice = selling && selling > 0 && selling < price ? selling : undefined;
    if (product.price === price && (product.discountPrice ?? undefined) === discountPrice) {
      result.skipped += 1;
      continue;
    }
    product.price = price;
    product.discountPrice = discountPrice;
    await product.save();
    result.updated += 1;
  }
  return result;
}

export async function syncStockFromErp(): Promise<SyncReport> {
  const result = report("ERP closing stock becomes the website quantity and is logged in Stock Ledger.");
  const response = await call<any>(ERP_ENDPOINTS.stock);
  if (!response.ok) {
    addError(result, response.error ?? "Stock fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data);
  result.sourceCount = source.length;
  for (const raw of source) {
    const sku = skuOf(raw);
    const quantity = numberValue(raw?.closing_stock, raw?.quantity, raw?.qty, raw?.stock);
    if (!sku || quantity === undefined || quantity < 0) {
      result.skipped += 1;
      continue;
    }
    result.examined += 1;
    const product = await Product.findOne({ $or: [{ sku }, { "variantCombinations.sku": sku }] });
    if (!product) {
      result.skipped += 1;
      continue;
    }
    const combo = product.variantCombinations?.find((entry: any) => entry.sku === sku);
    const current = combo ? combo.stock ?? 0 : product.stock ?? 0;
    const delta = quantity - current;
    if (delta === 0) {
      result.skipped += 1;
      continue;
    }
    const adjustment = await adjustStock({
      productId: String(product._id),
      variantKey: combo ? variantKey(combo.combination) : "",
      delta,
      reason: "erp_sync",
      note: `HisabKitab closing stock for ${sku}: ${quantity}`,
      suppressNotifications: false,
    });
    if (adjustment.ok) result.updated += 1;
    else addError(result, `${sku}: ${adjustment.error}`);
  }
  return result;
}

function normalizedPhone(value: unknown): string {
  return stringValue(value).replace(/\D/g, "").slice(-10);
}

/** Reconcile ERP customer ledgers to existing website users; never creates login accounts. */
export async function syncCustomersFromErp(): Promise<SyncReport> {
  const result = report("Matches customer ledgers to existing accounts by email or phone; no login accounts are auto-created.");
  const response = await call<any>(query(ERP_ENDPOINTS.customers, { limit: 2000, skip: 0 }));
  if (!response.ok) {
    addError(result, response.error ?? "Customer ledger fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data).filter((raw) => {
    const group = stringValue(raw?.group_name ?? raw?.group).toLowerCase();
    return !group || group.includes("customer") || group.includes("sundry debtor");
  });
  result.sourceCount = source.length;
  let matched = 0;
  for (const raw of source) {
    result.examined += 1;
    const email = stringValue(raw?.contact_person_email ?? raw?.email).toLowerCase();
    const phone = normalizedPhone(raw?.phone_1 ?? raw?.contact_person_phone_1 ?? raw?.phone);
    const alternatives: Record<string, unknown>[] = [];
    if (email) alternatives.push({ email });
    if (phone) alternatives.push({ phone: { $regex: `${phone}$` } });
    if (!alternatives.length) {
      result.skipped += 1;
      continue;
    }
    const user = await User.findOne({ role: "customer", $or: alternatives });
    if (!user) {
      result.skipped += 1;
      continue;
    }
    matched += 1;
    const ledgerId = stringValue(raw?.id ?? raw?.ledger_id);
    let changed = false;
    if (ledgerId && user.erpLedgerId !== ledgerId) {
      user.erpLedgerId = ledgerId;
      changed = true;
    }
    if (!user.phone && phone) {
      user.phone = phone;
      changed = true;
    }
    user.erpSyncedAt = new Date();
    if (changed) result.updated += 1;
    else result.skipped += 1;
    await user.save();
  }
  result.matched = matched;
  return result;
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || stringValue(value).toLowerCase() === "true";
}

/** Pull ERP sale/payment status into matching website orders by invoice number. */
export async function syncOrderStatusFromErp(): Promise<SyncReport> {
  const result = report("Matches ERP invoice_number to the website order number and reconciles payment/cancellation state.");
  const response = await call<any>(transactionPath(ERP_ENDPOINTS.orders));
  if (!response.ok) {
    addError(result, response.error ?? "Sale transaction fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data);
  result.sourceCount = source.length;
  let matched = 0;
  for (const raw of source) {
    result.examined += 1;
    const invoice = stringValue(raw?.invoice_number ?? raw?.invoice_no ?? raw?.reference);
    if (!invoice) {
      result.skipped += 1;
      continue;
    }
    const order = await Order.findOne({ $or: [{ orderNumber: invoice }, { erpInvoiceNumber: invoice }] });
    if (!order) {
      result.skipped += 1;
      continue;
    }
    matched += 1;
    let changed = false;
    const transactionId = stringValue(raw?.transaction_id ?? raw?.id);
    if (transactionId && order.erpTransactionId !== transactionId) {
      order.erpTransactionId = transactionId;
      changed = true;
    }
    if (order.erpInvoiceNumber !== invoice) {
      order.erpInvoiceNumber = invoice;
      changed = true;
    }
    const payment = stringValue(raw?.payment_status ?? raw?.status).toLowerCase();
    const nextPayment = payment === "paid" ? "paid" : payment === "unpaid" ? "pending" : undefined;
    if (nextPayment && order.paymentStatus !== nextPayment) {
      order.paymentStatus = nextPayment;
      changed = true;
    }
    if (truthy(raw?.is_canceled_invoice) && order.orderStatus !== "cancelled") {
      order.orderStatus = "cancelled";
      order.cancelledAt = new Date();
      order.statusHistory.push({ status: "cancelled", note: "Cancelled in HisabKitab", at: new Date() });
      changed = true;
    }
    order.erpSyncedAt = new Date();
    order.erpSyncError = "";
    await order.save();
    if (changed) result.updated += 1;
    else result.skipped += 1;
  }
  result.matched = matched;
  return result;
}

export function getOrderPushReadiness(): { ready: boolean; missing: string[] } {
  const required = ["ERP_DEFAULT_COUNTRY_ID", "ERP_DEFAULT_STATE_ID", "ERP_DEFAULT_CITY_ID", "ERP_DEFAULT_GST_TAX_ID"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return { ready: missing.length === 0, missing };
}

async function erpItemMap(): Promise<Map<string, any>> {
  const response = await call<any>(ERP_ENDPOINTS.products);
  if (!response.ok) throw new Error(response.error ?? "Could not load ERP items");
  const items = new Map<string, any>();
  for (const raw of rowsOf(response.data)) {
    const sku = skuOf(raw).toUpperCase();
    if (sku) items.set(sku, raw);
  }
  return items;
}

async function pushOneOrder(order: any, itemsBySku: Map<string, any>): Promise<ErpResult<any>> {
  const readiness = getOrderPushReadiness();
  if (!readiness.ready) return { ok: false, error: `Missing ${readiness.missing.join(", ")}` };
  const user = order.user ? await User.findById(order.user).select("erpLedgerId").lean<any>() : null;
  const customerLedgerId = stringValue(user?.erpLedgerId || process.env.ERP_DEFAULT_CUSTOMER_LEDGER_ID);
  if (!customerLedgerId) return { ok: false, error: "Customer has no ERP ledger mapping and ERP_DEFAULT_CUSTOMER_LEDGER_ID is blank" };
  const erpItems: any[] = [];
  for (const item of order.items ?? []) {
    const sku = stringValue(item.sku).toUpperCase();
    const erpItem = itemsBySku.get(sku);
    if (!sku || !erpItem) return { ok: false, error: `SKU ${sku || "(blank)"} is not mapped to an ERP item` };
    const ledgerId = erpItem.income_ledger_id || process.env.ERP_DEFAULT_SALES_LEDGER_ID;
    const unitId = erpItem.unit_of_measurement || process.env.ERP_DEFAULT_UNIT_ID;
    if (!ledgerId || !unitId) return { ok: false, error: `SKU ${sku} is missing ERP income ledger or unit id` };
    erpItems.push({ item_id: erpItem.id, additional_description: item.title, ledger_id: ledgerId, unit_id: unitId, quantity: item.quantity, mrp: item.price, rpu: item.price, with_tax: 1, discount_type: 1, discount_value: 0, discount_type_2: 1, discount_value_2: 0, gst_id: process.env.ERP_DEFAULT_GST_TAX_ID, cess: 0, total: item.price * item.quantity });
  }
  const address = order.billingAddress || order.shippingAddress;
  const shipping = order.shippingAddress;
  return call<any>(ERP_ENDPOINTS.orders, {
    method: "POST",
    body: JSON.stringify({
      invoice_number: order.orderNumber,
      date: formatErpDate(new Date(order.createdAt)),
      customer_ledger_id: customerLedgerId,
      party_phone_number: shipping?.phone || order.guestPhone || "",
      region_iso: "in",
      region_code: 91,
      billing_address: { address_1: address?.line1 || "", address_2: address?.line2 || "", country_id: process.env.ERP_DEFAULT_COUNTRY_ID, state_id: process.env.ERP_DEFAULT_STATE_ID, city_id: process.env.ERP_DEFAULT_CITY_ID, pin_code: address?.pincode || "" },
      shipping_address: { shipping_name: shipping?.fullName || "", shipping_gstin: null, address_1: shipping?.line1 || "", address_2: shipping?.line2 || "", country_id: process.env.ERP_DEFAULT_COUNTRY_ID, state_id: process.env.ERP_DEFAULT_STATE_ID, city_id: process.env.ERP_DEFAULT_CITY_ID, pin_code: shipping?.pincode || "" },
      sales_item_type: 2,
      items: erpItems,
      main_classification_nature_type: process.env.ERP_SALE_CLASSIFICATION || "Intrastate Sales Taxable",
      is_rcm_applicable: 0,
      narration: `ZenBlue website order ${order.orderNumber}`,
      gross_value: order.subtotal,
      additional_charges: [],
      taxable_value: Math.max(0, order.subtotal - order.discount),
      cgst: 0,
      sgst: 0,
      igst: order.taxAmount || 0,
      cess: 0,
      add_less: [],
      rounding_amount: 0,
      grand_total: order.total,
      payment_details: [],
      is_gst_enabled: 1,
      is_cgst_sgst_igst_calculated: 1,
      is_gst_na: 0,
      is_round_off_not_changed: 0,
    }),
  });
}

/** Manually push up to 25 eligible unsynced website orders to HisabKitab. */
export async function pushOrdersToErp(): Promise<SyncReport> {
  const result = report("Creates HisabKitab item-sale invoices. This is never part of Run all and must be triggered separately.");
  const readiness = getOrderPushReadiness();
  if (!readiness.ready) {
    addError(result, `Order push is not ready: ${readiness.missing.join(", ")}`);
    return result;
  }
  await connectDB();
  let itemsBySku: Map<string, any>;
  try {
    itemsBySku = await erpItemMap();
  } catch (error) {
    addError(result, error instanceof Error ? error.message : String(error));
    return result;
  }
  const orders = await Order.find({ orderStatus: { $in: ["placed", "confirmed", "processing"] }, $or: [{ erpTransactionId: "" }, { erpTransactionId: { $exists: false } }] }).sort({ createdAt: 1 }).limit(25).lean<any[]>();
  result.sourceCount = orders.length;
  for (const order of orders) {
    result.examined += 1;
    const pushed = await pushOneOrder(order, itemsBySku);
    if (!pushed.ok) {
      await Order.updateOne({ _id: order._id }, { erpSyncError: pushed.error ?? "ERP order push failed" });
      addError(result, `${order.orderNumber}: ${pushed.error}`);
      result.skipped += 1;
      continue;
    }
    const body: any = pushed.data;
    const transaction = body?.data?.sale_transaction ?? body?.data ?? body;
    await Order.updateOne({ _id: order._id }, { erpTransactionId: stringValue(transaction?.id ?? transaction?.transaction_id), erpInvoiceNumber: stringValue(transaction?.invoice_number) || order.orderNumber, erpSyncedAt: new Date(), erpSyncError: "" });
    result.updated += 1;
  }
  return result;
}

/** Reconcile delivery-challan records. HisabKitab does not expose courier AWB tracking here. */
export async function syncDispatchFromErp(): Promise<SyncReport> {
  const result = report("Delivery challan status is reconciled. Courier/AWB tracking remains the courier integration's responsibility.");
  const response = await call<any>(transactionPath(ERP_ENDPOINTS.dispatch));
  if (!response.ok) {
    addError(result, response.error ?? "Delivery challan fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data);
  result.sourceCount = source.length;
  let matched = 0;
  for (const raw of source) {
    result.examined += 1;
    const reference = stringValue(raw?.invoice_number ?? raw?.reference ?? raw?.challan_number);
    if (!reference) {
      result.skipped += 1;
      continue;
    }
    const order = await Order.findOne({ $or: [{ orderNumber: reference }, { erpInvoiceNumber: reference }, { erpDispatchId: stringValue(raw?.transaction_id) }] });
    if (!order) {
      result.skipped += 1;
      continue;
    }
    matched += 1;
    const dispatchId = stringValue(raw?.transaction_id ?? raw?.id);
    const status = stringValue(raw?.status);
    const changed = order.erpDispatchId !== dispatchId || order.erpDispatchStatus !== status;
    order.erpDispatchId = dispatchId;
    order.erpDispatchStatus = status;
    order.erpSyncedAt = new Date();
    const awb = stringValue(raw?.awb ?? raw?.tracking_number ?? raw?.docket);
    if (awb && order.awb !== awb) {
      order.awb = awb;
      order.courierName = stringValue(raw?.courier ?? raw?.carrier);
      if (["placed", "confirmed", "processing"].includes(order.orderStatus)) {
        order.orderStatus = "shipped";
        order.shippedAt = new Date();
        order.statusHistory.push({ status: "shipped", note: `ERP dispatch · AWB ${awb}`, at: new Date() });
      }
    }
    await order.save();
    if (changed || awb) result.updated += 1;
    else result.skipped += 1;
  }
  result.matched = matched;
  return result;
}

/** Pull HisabKitab sale-return references into matching website RMAs. */
export async function syncReturnsFromErp(): Promise<SyncReport> {
  const result = report("Matches ERP sale-return invoice numbers to website RMA numbers. Exchanges use a return plus a replacement sale.");
  const response = await call<any>(transactionPath(ERP_ENDPOINTS.returns));
  if (!response.ok) {
    addError(result, response.error ?? "Sale return fetch failed");
    return result;
  }
  await connectDB();
  const source = rowsOf(response.data);
  result.sourceCount = source.length;
  let matched = 0;
  for (const raw of source) {
    result.examined += 1;
    const invoice = stringValue(raw?.invoice_number ?? raw?.return_invoice_number ?? raw?.reference);
    if (!invoice) {
      result.skipped += 1;
      continue;
    }
    const request = await ReturnRequest.findOne({ $or: [{ rmaNumber: invoice }, { erpReturnTransactionId: stringValue(raw?.transaction_id) }] });
    if (!request) {
      result.skipped += 1;
      continue;
    }
    matched += 1;
    const transactionId = stringValue(raw?.transaction_id ?? raw?.id);
    const status = stringValue(raw?.payment_status ?? raw?.status);
    const changed = request.erpReturnTransactionId !== transactionId || request.erpReturnStatus !== status;
    request.erpReturnTransactionId = transactionId;
    request.erpReturnStatus = status;
    request.erpSyncedAt = new Date();
    request.erpSyncError = "";
    if (truthy(raw?.is_canceled_invoice) && request.status !== "cancelled") request.status = "cancelled";
    await request.save();
    if (changed) result.updated += 1;
    else result.skipped += 1;
  }
  result.matched = matched;
  return result;
}

export interface ErpScopeProbe {
  key: string;
  endpoint: string;
  reachable: boolean;
  status?: number;
  count?: number;
  error?: string;
}

/** Read-only endpoint probes used by the admin readiness table. */
export async function probeErpScopes(): Promise<ErpScopeProbe[]> {
  const [items, customers, orders, dispatch, returns] = await Promise.all([
    call<any>(ERP_ENDPOINTS.products),
    call<any>(query(ERP_ENDPOINTS.customers, { limit: 1, skip: 0 })),
    call<any>(transactionPath(ERP_ENDPOINTS.orders, 1)),
    call<any>(transactionPath(ERP_ENDPOINTS.dispatch, 1)),
    call<any>(transactionPath(ERP_ENDPOINTS.returns, 1)),
  ]);
  const make = (key: string, endpoint: string, response: ErpResult<any>): ErpScopeProbe => ({ key, endpoint, reachable: response.ok, status: response.status, count: response.ok ? Number((response.data as any)?.total_count ?? rowsOf(response.data).length) : undefined, error: response.error });
  return [
    make("products", ERP_ENDPOINTS.products, items),
    make("prices", ERP_ENDPOINTS.prices, items),
    make("stock", ERP_ENDPOINTS.stock, items),
    make("customers", ERP_ENDPOINTS.customers, customers),
    make("order_status", ERP_ENDPOINTS.orders, orders),
    make("dispatch", ERP_ENDPOINTS.dispatch, dispatch),
    make("returns", ERP_ENDPOINTS.returns, returns),
  ];
}

export async function pingErp(): Promise<ErpResult<unknown>> {
  if (!isErpConfigured()) return { ok: false, error: "ERP is not configured" };
  return call(ERP_ENDPOINTS.ping);
}
