import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { BlogPost } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(2).max(180).optional(),
  slug: z.string().max(180).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().max(100000).optional(),
  coverImage: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  author: z.string().max(100).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.coerce.date().optional(),
  metaTitle: z.string().max(180).optional(),
  metaDescription: z.string().max(320).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    await connectDB();
    const changes = { ...parsed.data };
    if (changes.slug) {
      const normalized = slugify(changes.slug);
      const collision = await BlogPost.exists({ slug: normalized, _id: { $ne: params.id } });
      if (collision) return NextResponse.json({ error: "That blog URL is already in use" }, { status: 409 });
      changes.slug = normalized;
    }
    const post = await BlogPost.findByIdAndUpdate(
      params.id,
      { $set: { ...changes, updatedBy: admin.id } },
      { new: true }
    );
    if (!post) return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    await logAdminAction({
      adminId: admin.id,
      action: "CONTENT_UPDATE",
      targetType: "BlogPost",
      targetId: params.id,
      changes: { after: { slug: post.slug, title: post.title } },
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ post: post.toObject() });
  } catch (error) {
    console.error("Update blog post error:", error);
    return NextResponse.json({ error: "Could not save the blog post" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await connectDB();
    const post = await BlogPost.findByIdAndDelete(params.id);
    if (!post) return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    await logAdminAction({
      adminId: admin.id,
      action: "CONTENT_UPDATE",
      targetType: "BlogPost",
      targetId: params.id,
      changes: { before: { slug: post.slug }, after: { deleted: true } },
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete blog post error:", error);
    return NextResponse.json({ error: "Could not delete the blog post" }, { status: 500 });
  }
}
