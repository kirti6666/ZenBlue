import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ContactMessage } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { getSiteSettings, DEFAULT_SETTINGS } from "@/lib/site-settings";
import { sendEmail } from "@/lib/email";
import { emailShell } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d[\d\s-]{7,17}$/, "Enter a valid mobile number"),
  company: z.string().trim().max(160).default(""),
  productInterest: z.string().trim().max(300).default(""),
  quantity: z.string().trim().max(60).default(""),
  budget: z.string().trim().max(60).default(""),
  needByDate: z.string().trim().max(60).default(""),
  customisation: z.string().trim().max(1000).default(""),
  message: z.string().trim().max(4000).default(""),
  /** Which form this came from — same fields, different framing and inbox subject. */
  kind: z.enum(["bulk", "custom"]).default("bulk"),
  /** Honeypot — bots fill hidden fields, humans never see this one. */
  website: z.string().max(0).optional(),
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bulk / corporate order enquiries.
 *
 * Written to the database before any mail is attempted: a corporate enquiry is
 * the highest-value message this site receives, and losing one to an SMTP
 * outage is not an acceptable failure mode. The email is a notification, not
 * the record.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bulkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    // A filled honeypot is a bot. Return success so it does not retry or adapt.
    if (parsed.data.website) return NextResponse.json({ ok: true });

    const d = parsed.data;

    await connectDB();
    const user = await getCurrentUser(req);

    const isCustom = d.kind === "custom";

    const doc = await ContactMessage.create({
      type: d.kind,
      name: d.name,
      email: d.email,
      phone: d.phone,
      subject: `${isCustom ? "Customisation" : "Bulk order"} enquiry${
        d.company ? ` — ${d.company}` : ""
      }`,
      message: d.message,
      company: d.company,
      productInterest: d.productInterest,
      quantity: d.quantity,
      budget: d.budget,
      needByDate: d.needByDate,
      customisation: d.customisation,
      user: user?.id,
    });

    const reference = String(doc._id).slice(-6).toUpperCase();

    const settings = await getSiteSettings();

    // Every address that should hear about a bulk enquiry, de-duplicated:
    // the support inbox, the general contact address, and an optional
    // BULK_ENQUIRY_EMAIL for a sales desk that is not either of those. If the
    // settings document has been saved with those fields blank, the shipped
    // default is used rather than dropping the enquiry silently — this is the
    // one message on the site where "no recipient configured" is not an
    // acceptable outcome.
    const recipients = Array.from(
      new Set(
        [
          settings.contact.supportEmail,
          settings.contact.email,
          process.env.BULK_ENQUIRY_EMAIL,
        ]
          .map((a) => a?.trim().toLowerCase())
          .filter((a): a is string => !!a && a.includes("@"))
      )
    );
    if (recipients.length === 0) {
      const fallback = DEFAULT_SETTINGS.contact.supportEmail || DEFAULT_SETTINGS.contact.email;
      if (fallback) recipients.push(fallback);
    }
    const inbox = recipients.join(", ");

    if (inbox) {
      const rows: [string, string][] = [
        ["Company", d.company],
        ["Looking for", d.productInterest],
        ["Quantity", d.quantity],
        ["Budget", d.budget],
        ["Needed by", d.needByDate],
        ["Customisation", d.customisation],
      ].filter(([, v]) => !!v) as [string, string][];

      await sendEmail({
        to: inbox,
        subject: `${
          isCustom ? "Customisation" : "Bulk order"
        } enquiry ${reference} — ${d.name}${d.company ? ` (${d.company})` : ""}`,
        html: emailShell({
          storeName: settings.brand.storeName,
          heading: isCustom ? "New customisation enquiry" : "New bulk order enquiry",
          intro: `<strong>${escapeHtml(d.name)}</strong> (${escapeHtml(d.email)}, ${escapeHtml(
            d.phone
          )}) is asking about ${isCustom ? "a customised order" : "a bulk order"}.`,
          bodyHtml: `
            <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;">
              ${rows
                .map(
                  ([k, v]) =>
                    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">${k}</td><td style="padding:4px 0;">${escapeHtml(
                      v
                    )}</td></tr>`
                )
                .join("")}
            </table>
            ${
              d.message
                ? `<p style="white-space:pre-wrap;font-size:14px;line-height:1.6;margin-top:16px;">${escapeHtml(
                    d.message
                  )}</p>`
                : ""
            }`,
          footerNote: `Reference ${reference}`,
        }),
      });
    }

    return NextResponse.json({ ok: true, reference });
  } catch (err) {
    console.error("Bulk enquiry error:", err);
    return NextResponse.json({ error: "Could not send your enquiry" }, { status: 500 });
  }
}
