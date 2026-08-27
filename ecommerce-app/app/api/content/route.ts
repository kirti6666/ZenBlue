import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ContentPage } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const pages = await ContentPage.find({}).sort({ isSystem: -1, title: 1 }).lean();
  return NextResponse.json({ pages });
}

const createSchema = z.object({
  title: z.string().min(2, "Title is required").max(160),
  slug: z.string().max(160).optional(),
  subtitle: z.string().max(300).optional().default(""),
  body: z.string().max(60000).optional().default(""),
  metaTitle: z.string().max(160).optional().default(""),
  metaDescription: z.string().max(300).optional().default(""),
  isPublished: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();

    // Slugs are the page's public URL, so a collision would silently shadow an
    // existing page — suffix until it is unique rather than failing the save.
    const base = slugify(parsed.data.slug || parsed.data.title);
    let slug = base;
    let suffix = 2;
    while (await ContentPage.findOne({ slug })) slug = `${base}-${suffix++}`;

    const page = await ContentPage.create({
      ...parsed.data,
      slug,
      isSystem: false,
      updatedBy: admin.id,
    });

    await logAdminAction({
      adminId: admin.id,
      action: "CONTENT_UPDATE",
      targetType: "ContentPage",
      targetId: String(page._id),
      changes: { after: { slug, title: page.title } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ page: page.toObject() }, { status: 201 });
  } catch (err) {
    console.error("Create content page error:", err);
    return NextResponse.json({ error: "Could not create the page" }, { status: 500 });
  }
}
