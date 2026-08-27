import { connectDB } from "@/lib/db";
import { Category } from "@/models";
import { ProductForm } from "@/components/admin/ProductForm";
import { getSiteSettings } from "@/lib/site-settings";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await connectDB();
  const [categories, settings] = await Promise.all([
    Category.find({ isActive: true }).sort({ name: 1 }).lean(),
    getSiteSettings(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="New product"
        description="Fabric, HSN and package weight are worth filling in now — they drive the invoice and the courier rate later."
      />
      <ProductForm
        categories={JSON.parse(JSON.stringify(categories))}
        sizeCharts={settings.sizeCharts.map((c) => ({ key: c.key, title: c.title }))}
      />
    </>
  );
}
