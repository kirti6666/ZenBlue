import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Script from "next/script";
import { ArrowLeft } from "lucide-react";
import { connectDB } from "@/lib/db";
import { BlogPost } from "@/models";
import { StoreImage } from "@/components/storefront/StoreImage";
import { RichText } from "@/components/storefront/RichText";
import { absoluteUrl, breadcrumbSchema, jsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";
async function getPost(slug: string) { await connectDB(); return BlogPost.findOne({ slug, isPublished: true, publishedAt: { $lte: new Date() } }).lean<any>(); }
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Article not found", robots: { index: false, follow: false } };
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title, description, url: absoluteUrl(`/blog/${post.slug}`), publishedTime: new Date(post.publishedAt).toISOString(), modifiedTime: new Date(post.updatedAt).toISOString(), authors: [post.author], images: post.coverImage ? [post.coverImage] : undefined },
    twitter: { card: "summary_large_image", title, description, images: post.coverImage ? [post.coverImage] : undefined },
  };
}

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug); if (!post) notFound();
  const related = await BlogPost.find({ _id: { $ne: post._id }, isPublished: true, publishedAt: { $lte: new Date() } }).sort({ publishedAt: -1 }).limit(3).lean<any[]>();
  const readingMinutes = Math.max(1, Math.ceil((post.content || "").trim().split(/\s+/).length / 220));
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      image: post.coverImage ? [absoluteUrl(post.coverImage)] : [],
      datePublished: new Date(post.publishedAt).toISOString(),
      dateModified: new Date(post.updatedAt).toISOString(),
      author: { "@type": "Organization", name: post.author || "ZenBlue Editorial" },
      publisher: { "@type": "Organization", name: "ZenBlue", url: absoluteUrl("/") },
      mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    },
    breadcrumbSchema([
      { name: "Journal", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]),
  ];

  return <main className="mx-auto max-w-[980px] px-4 py-6 sm:px-6 sm:py-9">
    <Script id="blog-post-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
    <Link href="/blog" className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline"><ArrowLeft size={14}/>Journal</Link>
    <header className="mx-auto mt-5 max-w-[760px] text-center">
      <p className="eyebrow">{post.category}</p>
      <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.12] text-heading sm:text-4xl">{post.title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-body sm:text-base">{post.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted">
        <span>By {post.author}</span><span aria-hidden="true">·</span>
        <time dateTime={new Date(post.publishedAt).toISOString()}>{new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>
        <span aria-hidden="true">·</span><span>{readingMinutes} min read</span>
      </div>
    </header>
    <div className="mt-7 aspect-[3/2] overflow-hidden rounded-xl bg-surface-alt sm:mt-8"><StoreImage src={post.coverImage} alt={post.title} width={1200} sizes="(max-width: 1024px) 100vw, 980px" aspect="3/2" priority className="h-full w-full object-cover"/></div>
    <article className="mx-auto mt-7 max-w-[700px] border-b border-line pb-8 sm:mt-9 sm:pb-10"><RichText content={post.content} className="[&_p]:leading-7" /></article>

    {related.length > 0 && <section className="mt-8 sm:mt-10">
      <div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">Keep reading</p><h2 className="mt-1 font-display text-xl font-semibold text-heading">More from the journal</h2></div><Link href="/blog" className="text-xs font-semibold text-link">View all</Link></div>
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">{related.map((item) => <article key={String(item._id)} className="overflow-hidden rounded-lg border border-line bg-background">
        <Link href={`/blog/${item.slug}`} className="group block">
          <div className="aspect-[3/2] overflow-hidden bg-surface-alt"><StoreImage src={item.coverImage} alt={item.title} width={420} sizes="(max-width: 640px) 100vw, 33vw" aspect="3/2" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"/></div>
          <div className="p-3.5"><p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">{item.category}</p><h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-heading">{item.title}</h3></div>
        </Link>
      </article>)}</div>
    </section>}
  </main>;
}
