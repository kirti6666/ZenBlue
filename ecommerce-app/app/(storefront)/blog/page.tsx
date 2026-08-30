import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { connectDB } from "@/lib/db";
import { BlogPost } from "@/models";
import { StoreImage } from "@/components/storefront/StoreImage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal",
  description: "Style guides, fabric knowledge and considered advice for dressing well from ZenBlue.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "ZenBlue Journal", description: "Style guides, fabric knowledge and considered advice for dressing well.", url: "/blog", type: "website" },
  twitter: { card: "summary_large_image", title: "ZenBlue Journal", description: "Style guides, fabric knowledge and considered advice for dressing well." },
};

export default async function BlogPage() {
  await connectDB();
  const posts = await BlogPost.find({ isPublished: true, publishedAt: { $lte: new Date() } }).sort({ isFeatured: -1, publishedAt: -1 }).lean();
  return <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-9">
    <header className="mx-auto mb-6 max-w-2xl border-b border-line pb-6 text-center sm:mb-8 sm:pb-8">
      <p className="eyebrow">ZenBlue journal</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-heading sm:text-4xl">Ideas for dressing well, every day.</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-body">Style guides, fabric knowledge and considered advice from the ZenBlue team.</p>
    </header>
    <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {posts.map((post: any, index) => <article key={String(post._id)} className="overflow-hidden rounded-xl border border-line bg-background transition-shadow hover:shadow-md">
        <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col">
          <div className="aspect-[3/2] overflow-hidden bg-surface-alt"><StoreImage src={post.coverImage} alt={post.title} width={680} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" aspect="3/2" priority={index < 2} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"/></div>
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{post.category} · {new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            <h2 className="mt-2 font-display text-lg font-semibold leading-snug text-heading sm:text-xl">{post.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-body">{post.excerpt}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-link">Read article <ArrowRight size={14}/></span>
          </div>
        </Link>
      </article>)}
    </div>
    {!posts.length && <div className="rounded-lg border border-line py-16 text-center text-body">Stories are coming soon.</div>}
  </main>;
}
