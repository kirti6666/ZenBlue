import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Faq } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";

export const dynamic = "force-dynamic";

/** Public read is fine — these are published to the FAQ page anyway. */
export async function GET() {
  await connectDB();
  const faqs = await Faq.find({}).sort({ category: 1, sortOrder: 1 }).lean();
  return NextResponse.json({ faqs });
}

const faqSchema = z.object({
  question: z.string().min(5, "Question is required").max(300),
  answer: z.string().min(5, "Answer is required").max(4000),
  category: z.string().max(60).optional().default("General"),
  sortOrder: z.number().int().optional().default(0),
  isPublished: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = faqSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const faq = await Faq.create(parsed.data);

    await logAdminAction({
      adminId: admin.id,
      action: "FAQ_UPDATE",
      targetType: "Faq",
      targetId: String(faq._id),
      changes: { after: { question: faq.question } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ faq: faq.toObject() }, { status: 201 });
  } catch (err) {
    console.error("Create FAQ error:", err);
    return NextResponse.json({ error: "Could not create the entry" }, { status: 500 });
  }
}
