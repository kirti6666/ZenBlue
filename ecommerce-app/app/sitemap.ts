import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/db";
import { Product, Category, BlogPost, ContentPage } from "@/models";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/shop",
    "/new-arrivals",
    "/blog",
    "/about",
    "/faq",
    "/contact",
    "/bulk-orders",
    "/customization",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/shop" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/shop" ? 0.9 : 0.65,
  }));

  try {
    await connectDB();
    const [products, categories, posts, pages] = await Promise.all([
      Product.find({ isActive: true }).select("slug updatedAt").lean(),
      Category.find({ isActive: true }).select("slug updatedAt").lean(),
      BlogPost.find({ isPublished: true, publishedAt: { $lte: new Date() } }).select("slug updatedAt").lean(),
      ContentPage.find({ isPublished: true }).select("slug updatedAt").lean(),
    ]);

    const productRoutes: MetadataRoute.Sitemap = products.map((item: any) => ({
      url: `${baseUrl}/product/${item.slug}`,
      lastModified: item.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    const categoryRoutes: MetadataRoute.Sitemap = categories.map((item: any) => ({
      url: `${baseUrl}/category/${item.slug}`,
      lastModified: item.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    const blogRoutes: MetadataRoute.Sitemap = posts.map((item: any) => ({
      url: `${baseUrl}/blog/${item.slug}`,
      lastModified: item.updatedAt ?? new Date(),
      changeFrequency: "monthly",
      priority: 0.65,
    }));
    const contentRoutes: MetadataRoute.Sitemap = pages
      .filter((item: any) => item.slug !== "about")
      .map((item: any) => ({
        url: `${baseUrl}/pages/${item.slug}`,
        lastModified: item.updatedAt ?? new Date(),
        changeFrequency: "monthly",
        priority: 0.45,
      }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...blogRoutes, ...contentRoutes];
  } catch (error) {
    console.error("Sitemap generation error:", error);
    return staticRoutes;
  }
}
