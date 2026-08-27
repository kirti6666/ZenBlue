import { isErpConfigured } from "@/lib/erp/client";
import { AdminPageHeader, Card } from "@/components/admin/AdminPage";
import { ErpPanel } from "@/components/admin/ErpPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "ERP sync" };

/** ERP connection status and manual sync controls. */
export default function AdminErpPage() {
  const configured = isErpConfigured();

  return (
    <>
      <AdminPageHeader
        title="ERP sync"
        description="HisabKitab item master, prices, inventory, customers, sales, delivery challans and sale returns — each reconciled independently."
      />

      {!configured && (
        <Card className="mb-6 border-warning/40">
          <p className="text-sm font-medium text-heading">Not connected yet</p>
          <p className="mt-1 text-sm text-body">
            Add <code>ERP_BASE_URL</code> and <code>ERP_API_KEY</code> to your environment and
            restart. The adapter is written against a conventional REST ERP; if yours uses
            different paths, override them with the <code>ERP_PATH_*</code> variables rather than
            changing code.
          </p>
        </Card>
      )}

      <ErpPanel configured={configured} />
    </>
  );
}
