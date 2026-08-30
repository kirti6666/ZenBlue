import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { BlogPost } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";

const blogSchema = z.object({
  title: z.string().min(2, "Title is required").max(180),
  slug: z.string().max(180).optional().default(""),
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().max(100000).optional().default(""),
  coverImage: z.string().max(2000).optional().default(""),
  category: z.string().max(80).optional().default("Style guide"),
  author: z.string().max(100).optional().default("ZenBlue Editorial"),
  isPublished: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  publishedAt: z.coerce.date().optional().default(() => new Date()),
  metaTitle: z.string().max(180).optional().default(""),
  metaDescription: z.string().max(320).optional().default(""),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const posts = await BlogPost.find({}).sort({ publishedAt: -1 }).lean();
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = blogSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    await connectDB();
    const base = slugify(parsed.data.slug || parsed.data.title) || `post-${Date.now()}`;
    let slug = base;
    let suffix = 2;
    while (await BlogPost.exists({ slug })) slug = `${base}-${suffix++}`;

    const post = await BlogPost.create({ ...parsed.data, slug, updatedBy: admin.id });
    await logAdminAction({
      adminId: admin.id,
      action: "CONTENT_UPDATE",
      targetType: "BlogPost",
      targetId: String(post._id),
      changes: { after: { slug, title: post.title } },
      ipAddress: getClientIp(req),
    });
    return NextResponse.json({ post: post.toObject() }, { status: 201 });
  } catch (error) {
    console.error("Create blog post error:", error);
    return NextResponse.json({ error: "Could not create the blog post" }, { status: 500 });
  }
}
