import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ContactMessage } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { getSiteSettings } from "@/lib/site-settings";
import { sendEmail } from "@/lib/email";
import { emailShell } from "@/lib/notifications/templates";

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name").max(120),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().max(20).optional().default(""),
  subject: z.string().max(160).optional().default(""),
  message: z.string().min(10, "Please tell us a little more").max(4000),
  /** Honeypot — bots fill hidden fields, humans never see this one. */
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = contactSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    // A filled honeypot is a bot. Return success so it does not retry or adapt.
    if (parsed.data.website) return NextResponse.json({ ok: true });

    await connectDB();
    const user = await getCurrentUser(req);
    const { name, email, phone, subject, message } = parsed.data;

    const doc = await ContactMessage.create({
      name,
      email,
      phone,
      subject,
      message,
      user: user?.id,
    });

    // The message is persisted first, so an SMTP failure below can never lose it.
    const settings = await getSiteSettings();
    const inbox = settings.contact.supportEmail || settings.contact.email;
    if (inbox) {
      await sendEmail({
        to: inbox,
        subject: `New enquiry: ${subject || "Contact form"} — ${name}`,
        html: emailShell({
          storeName: settings.brand.storeName,
          heading: "New contact enquiry",
          intro: `<strong>${name}</strong> (${email}${phone ? `, ${phone}` : ""}) wrote:`,
          bodyHtml: `<p style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(
            message
          )}</p>`,
          footerNote: `Reference ${String(doc._id).slice(-6).toUpperCase()}`,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Could not send your message" }, { status: 500 });
  }
}

/** Admin: the enquiry queue. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CONTENT);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const messages = await ContactMessage.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  return NextResponse.json({ messages });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
