import { connectDB } from "@/lib/db";
import { BlogPost } from "@/models";
import { BlogManager } from "@/components/admin/BlogManager";

export const dynamic = "force-dynamic";

export default async function AdminBlogsPage() {
  await connectDB();
  const posts = await BlogPost.find({}).sort({ publishedAt: -1 }).lean();
  return <BlogManager initialPosts={JSON.parse(JSON.stringify(posts))} />;
}
