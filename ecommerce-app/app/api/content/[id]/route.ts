import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ContentPage } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  subtitle: z.string().max(300).optional(),
  body: z.string().max(60000).optional(),
  metaTitle: z.string().max(160).optional(),
  metaDescription: z.string().max(300).optional(),
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
    const page = await ContentPage.findByIdAndUpdate(
      params.id,
      { $set: { ...parsed.data, updatedBy: admin.id } },
      { new: true }
    );
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    await logAdminAction({
      adminId: admin.id,
      action: "CONTENT_UPDATE",
      targetType: "ContentPage",
      targetId: params.id,
      changes: { after: { slug: page.slug } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ page: page.toObject() });
  } catch (err) {
    console.error("Update content page error:", err);
    return NextResponse.json({ error: "Could not save the page" }, { status: 500 });
  }
}

/**
 * Deletes a page.
 *
 * System pages (the four policies and About) can be edited or unpublished but
 * never deleted — the footer links to them by slug, so removing one would leave
 * a 404 in the footer of every page on the site.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const page = await ContentPage.findById(params.id);
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    if (page.isSystem) {
      return NextResponse.json(
        { error: "This page is linked from the footer and cannot be deleted — unpublish it instead" },
        { status: 400 }
      );
    }

    await page.deleteOne();

    await logAdminAction({
      adminId: admin.id,
      action: "CONTENT_UPDATE",
      targetType: "ContentPage",
      targetId: params.id,
      changes: { before: { slug: page.slug }, after: { deleted: true } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete content page error:", err);
    return NextResponse.json({ error: "Could not delete the page" }, { status: 500 });
  }
}
