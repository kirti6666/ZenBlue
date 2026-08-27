import { connectDB } from "@/lib/db";
import { ContentPage, Faq } from "@/models";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { ContentManager } from "@/components/admin/ContentManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Content & pages" };

/** CMS for the static pages and the FAQ. */
export default async function AdminContentPage() {
  await connectDB();
  const [pages, faqs] = await Promise.all([
    ContentPage.find({}).sort({ isSystem: -1, title: 1 }).lean(),
    Faq.find({}).sort({ category: 1, sortOrder: 1 }).lean(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Content & pages"
        description="Edit your policy pages, About copy and FAQ entries. Changes go live immediately."
      />
      <ContentManager
        initialPages={JSON.parse(JSON.stringify(pages))}
        initialFaqs={JSON.parse(JSON.stringify(faqs))}
      />
    </>
  );
}
