import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Invoice from "@/models/Invoice";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { renderInvoicePdf } from "@/lib/invoice/render";
import { createZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.INVOICES);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const params = new URL(req.url).searchParams;
    const from = params.get("from");
    const to = params.get("to");
    const issuedAt: Record<string, Date> = {};
    if (from) issuedAt.$gte = new Date(`${from}T00:00:00`);
    if (to) issuedAt.$lte = new Date(`${to}T23:59:59.999`);

    const invoices = await Invoice.find(Object.keys(issuedAt).length ? { issuedAt } : {})
      .select("invoiceNumber snapshot issuedAt")
      .sort({ issuedAt: 1 })
      .limit(500)
      .lean<any[]>();

    if (!invoices.length) {
      return NextResponse.json({ error: "No invoices found for the selected dates" }, { status: 404 });
    }

    const zip = createZip(
      invoices.map((invoice) => ({
        name: `${String(invoice.invoiceNumber).replace(/[^\w.-]+/g, "-")}.pdf`,
        data: renderInvoicePdf(invoice.snapshot),
      }))
    );
    const label = [from || "all", to || "all"].join("_to_");

    return new NextResponse(zip as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoices_${label}.zip"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Bulk invoice download error:", err);
    return NextResponse.json({ error: "Could not create invoice archive" }, { status: 500 });
  }
}
