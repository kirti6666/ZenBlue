import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Category, Product } from "@/models";
import { ProductForm } from "@/components/admin/ProductForm";
import { getSiteSettings } from "@/lib/site-settings";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await connectDB();
  const [categories, product, settings] = await Promise.all([
    Category.find({ isActive: true }).sort({ name: 1 }).lean(),
    Product.findById(params.id).lean<any>(),
    getSiteSettings(),
  ]);

  if (!product) notFound();

  return (
    <>
      <AdminPageHeader title="Edit product" description={product.title} />
      <ProductForm
        categories={JSON.parse(JSON.stringify(categories))}
        initialData={JSON.parse(JSON.stringify(product))}
        productId={params.id}
        sizeCharts={settings.sizeCharts.map((c) => ({ key: c.key, title: c.title }))}
      />
    </>
  );
}
