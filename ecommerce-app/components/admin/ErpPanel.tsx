"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  IndianRupee,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Truck,
  UploadCloud,
  Users,
  XCircle,
} from "lucide-react";
import { Card } from "./AdminPage";

interface SyncReport {
  examined: number;
  updated: number;
  skipped: number;
  errors: string[];
  created?: number;
  matched?: number;
  sourceCount?: number;
  note?: string;
}

interface ScopeProbe {
  key: string;
  endpoint: string;
  reachable: boolean;
  status?: number;
  count?: number;
  error?: string;
}

interface ErpStatus {
  configured?: boolean;
  reachable?: boolean;
  error?: string;
  scopes?: ScopeProbe[];
  orderPush?: { ready: boolean; missing: string[] };
}

interface MappingData {
  erpItems: { id: string; name: string; nativeSku: string; mappedSku: string }[];
  websiteSkus: { sku: string; label: string }[];
}

const OPERATIONS = [
  {
    key: "products",
    probeKey: "products",
    label: "Products & SKU",
    action: "Pull item master",
    direction: "ERP → Store",
    hint: "Creates inactive products and updates master fields by SKU. Rows without SKU are skipped.",
    icon: PackageSearch,
  },
  {
    key: "prices",
    probeKey: "prices",
    label: "Prices",
    action: "Pull prices",
    direction: "ERP → Store",
    hint: "Applies MRP and selling price from the ERP item master to matching SKUs.",
    icon: IndianRupee,
  },
  {
    key: "stock",
    probeKey: "stock",
    label: "Inventory",
    action: "Pull closing stock",
    direction: "ERP → Store",
    hint: "Sets product or variant quantity by SKU and records every change in Stock Ledger.",
    icon: Boxes,
  },
  {
    key: "customers",
    probeKey: "customers",
    label: "Customers",
    action: "Reconcile ledgers",
    direction: "ERP → Store",
    hint: "Links customer ledger IDs to existing accounts by email or phone. It never creates login accounts.",
    icon: Users,
  },
  {
    key: "order_status",
    probeKey: "order_status",
    label: "Orders & payment status",
    action: "Pull sale status",
    direction: "ERP → Store",
    hint: "Matches invoice number to order number and reconciles ERP transaction, payment and cancellation state.",
    icon: ReceiptText,
  },
  {
    key: "dispatch",
    probeKey: "dispatch",
    label: "Dispatch",
    action: "Pull challan status",
    direction: "ERP → Store",
    hint: "Reconciles delivery challans. Courier AWB movement still comes from Shiprocket or Delhivery.",
    icon: Truck,
  },
  {
    key: "returns",
    probeKey: "returns",
    label: "Returns & exchanges",
    action: "Pull sale returns",
    direction: "ERP → Store",
    hint: "Matches sale-return invoice numbers to RMAs. Exchanges are represented as return plus replacement sale.",
    icon: RotateCcw,
  },
] as const;

export function ErpPanel({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<ErpStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<Record<string, SyncReport> | null>(null);
  const [error, setError] = useState("");
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [mappingBusy, setMappingBusy] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!configured) return;
    setChecking(true);
    try {
      const response = await fetch("/api/erp/sync", { cache: "no-store" });
      const json = await response.json();
      setStatus(response.ok ? json : { reachable: false, error: json.error ?? "Status check failed" });
    } catch {
      setStatus({ reachable: false, error: "Could not reach the ERP status endpoint" });
    } finally {
      setChecking(false);
    }
  }, [configured]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const loadMappings = useCallback(async () => {
    if (!configured) return;
    try {
      const response = await fetch("/api/erp/mappings", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load SKU mappings");
      setMappingData(json);
      setMappingDraft(Object.fromEntries(json.erpItems.map((item: MappingData["erpItems"][number]) => [item.id, item.mappedSku])));
    } catch (mappingError) {
      setError(mappingError instanceof Error ? mappingError.message : "Could not load SKU mappings");
    }
  }, [configured]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  async function saveMappings() {
    setMappingBusy(true);
    setError("");
    try {
      const mappings = Object.entries(mappingDraft)
        .filter(([, websiteSku]) => Boolean(websiteSku))
        .map(([erpItemId, websiteSku]) => ({ erpItemId, websiteSku }));
      const response = await fetch("/api/erp/mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save SKU mappings");
      await loadMappings();
    } catch (mappingError) {
      setError(mappingError instanceof Error ? mappingError.message : "Could not save SKU mappings");
    } finally {
      setMappingBusy(false);
    }
  }

  async function run(operation: string) {
    setBusy(operation);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/erp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Sync failed");
      setResult(json);
      await checkStatus();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Sync failed");
    } finally {
      setBusy("");
    }
  }

  const probe = (key: string) => status?.scopes?.find((scope) => scope.key === key);
  const canRun = configured && status?.reachable !== false && !busy;
  const orderPushReady = Boolean(status?.orderPush?.ready);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Connection</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-heading">
              {!status || checking ? (
                <><RefreshCw size={15} className="animate-spin text-muted" /> Checking HisabKitab endpoints…</>
              ) : status.reachable ? (
                <><CheckCircle2 size={16} className="text-success" /> Connected with <code>apikey</code> authentication</>
              ) : (
                <><XCircle size={16} className="text-error" /> Not responding{status.error ? ` — ${status.error}` : ""}</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={checkStatus}
              disabled={!configured || checking || Boolean(busy)}
              className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-heading hover:border-primary disabled:opacity-50"
            >
              Recheck APIs
            </button>
            <button
              type="button"
              onClick={() => run("all")}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy === "all" ? "animate-spin" : ""} />
              Run all safe pulls
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          “Run all” never creates ERP invoices. Order push is isolated below and always requires a separate click.
        </p>
      </Card>

      {mappingData && mappingData.erpItems.some((item) => !item.nativeSku) && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">ERP item mapping</p>
              <p className="mt-2 max-w-3xl text-sm text-heading">
                HisabKitab items without a SKU must be linked once to a website product or variant. Price, stock and order sync then use this stable ERP item ID mapping.
              </p>
            </div>
            <button
              type="button"
              onClick={saveMappings}
              disabled={mappingBusy || Boolean(busy)}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {mappingBusy ? "Saving…" : "Save mappings"}
            </button>
          </div>
          <div className="mt-4 max-h-[34rem] divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {mappingData.erpItems.filter((item) => !item.nativeSku).map((item) => (
              <label key={item.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,1fr)] sm:items-center">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-heading">{item.name}</span>
                  <span className="block text-[11px] text-muted">ERP item {item.id}</span>
                </span>
                <select
                  value={mappingDraft[item.id] ?? ""}
                  onChange={(event) => setMappingDraft((current) => ({ ...current, [item.id]: event.target.value }))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                >
                  <option value="">Not mapped</option>
                  {mappingData.websiteSkus.map((option) => (
                    <option key={option.sku} value={option.sku}>{option.label} · {option.sku}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {OPERATIONS.map((operation) => {
          const Icon = operation.icon;
          const endpoint = probe(operation.probeKey);
          return (
            <Card key={operation.key} className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-heading">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-heading">{operation.label}</p>
                      <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {operation.direction}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{operation.hint}</p>
                  </div>
                </div>
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    endpoint?.reachable ? "bg-success" : endpoint ? "bg-error" : "bg-line"
                  }`}
                  title={endpoint?.reachable ? "Endpoint reachable" : endpoint?.error ?? "Not checked"}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="min-w-0 text-[11px] text-muted">
                  <code className="break-all">{endpoint?.endpoint ?? "Checking endpoint…"}</code>
                  {endpoint?.reachable && <span className="ml-2">HTTP {endpoint.status} · {endpoint.count ?? 0} records</span>}
                </div>
                <button
                  type="button"
                  disabled={!canRun || endpoint?.reachable === false}
                  onClick={() => run(operation.key)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-heading hover:border-primary disabled:opacity-50"
                >
                  <RefreshCw size={13} className={busy === operation.key ? "animate-spin" : ""} />
                  {operation.action}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className={orderPushReady ? "border-warning/40" : ""}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <UploadCloud size={17} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-heading">Push website orders</p>
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">Store → ERP</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Creates HisabKitab item-sale invoices for up to 25 eligible unsynced orders. Products must have matching ERP SKUs and customers need a ledger mapping or fallback ledger.
              </p>
              {!orderPushReady && status?.orderPush && (
                <p className="mt-2 text-xs text-error">Missing configuration: {status.orderPush.missing.join(", ")}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={!canRun || !orderPushReady}
            onClick={() => run("push_orders")}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-warning px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <UploadCloud size={14} /> {busy === "push_orders" ? "Pushing…" : "Push unsynced orders"}
          </button>
        </div>
      </Card>

      {error && <p className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {result && (
        <Card>
          <p className="eyebrow mb-4">Last run</p>
          <div className="space-y-4">
            {Object.entries(result).map(([key, run]) => (
              <div key={key} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold capitalize text-heading">{key.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted">
                    {run.sourceCount !== undefined && `${run.sourceCount} received · `}
                    {run.examined} examined · {run.matched !== undefined && `${run.matched} matched · `}
                    {run.created !== undefined && `${run.created} created · `}
                    {run.updated} updated · {run.skipped} skipped
                  </p>
                </div>
                {run.note && <p className="mt-1 text-xs text-muted">{run.note}</p>}
                {run.errors?.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-lg bg-error/5 p-3">
                    {run.errors.slice(0, 10).map((message, index) => (
                      <li key={index} className="text-xs text-error">{message}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
