import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Faq } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  question: z.string().min(5).max(300).optional(),
  answer: z.string().min(5).max(4000).optional(),
  category: z.string().max(60).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const faq = await Faq.findByIdAndUpdate(params.id, { $set: parsed.data }, { new: true });
    if (!faq) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    return NextResponse.json({ faq: faq.toObject() });
  } catch (err) {
    console.error("Update FAQ error:", err);
    return NextResponse.json({ error: "Could not save the entry" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const faq = await Faq.findByIdAndDelete(params.id);
    if (!faq) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    await logAdminAction({
      adminId: admin.id,
      action: "FAQ_UPDATE",
      targetType: "Faq",
      targetId: params.id,
      changes: { before: { question: faq.question }, after: { deleted: true } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete FAQ error:", err);
    return NextResponse.json({ error: "Could not delete the entry" }, { status: 500 });
  }
}
