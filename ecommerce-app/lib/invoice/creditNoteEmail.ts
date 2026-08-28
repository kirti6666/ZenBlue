import nodemailer from "nodemailer";
import { renderCreditNotePdf } from "./renderCreditNote";

export async function sendCreditNoteEmail(note: any, to: string): Promise<void> {
  if (!to || !process.env.EMAIL_SERVER_HOST) return;
  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    secure: false,
    auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
  });
  try {
    const safe = String(note.creditNoteNumber).replace(/[^\w.-]+/g, "-");
    await transport.sendMail({
      from: process.env.EMAIL_FROM || "no-reply@store.com",
      to,
      subject: `Credit note ${note.creditNoteNumber}`,
      html: `<p>Your credit note <strong>${note.creditNoteNumber}</strong> has been issued against invoice <strong>${note.originalInvoiceNumber}</strong>.</p><p>The PDF is attached for your records.</p>`,
      attachments: [{ filename: `${safe}.pdf`, content: renderCreditNotePdf(note.snapshot), contentType: "application/pdf" }],
    });
  } catch (err) {
    console.error("[credit-note] Email failed:", err);
  }
}
