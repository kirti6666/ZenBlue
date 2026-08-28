import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CreditNote } from "@/models";
import { requireAuth } from "@/lib/middleware/requireAuth";
import { renderCreditNotePdf } from "@/lib/invoice/renderCreditNote";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const note = await CreditNote.findById(params.id).lean<any>();
  if (!note) return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
  const canManageInvoices =
    user.role === "admin" ||
    (user.role === "staff" && user.permissions?.includes(PERMISSIONS.INVOICES));
  if (String(note.user) !== user.id && !canManageInvoices) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const pdf = renderCreditNotePdf(note.snapshot);
  const safe = String(note.creditNoteNumber).replace(/[^\w.-]+/g, "-");
  const disposition = new URL(req.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safe}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
