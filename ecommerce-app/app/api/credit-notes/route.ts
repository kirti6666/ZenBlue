import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CreditNote } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.INVOICES);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const notes = await CreditNote.find({})
    .select("creditNoteNumber issuedAt buyerName grandTotal totalTax originalInvoiceNumber order")
    .sort({ issuedAt: -1 })
    .limit(100)
    .lean();
  return NextResponse.json({ creditNotes: notes });
}
