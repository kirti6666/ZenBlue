import { sendEmail } from "@/lib/email";

/**
 * Channel providers.
 *
 * Each returns a `{ ok, messageId, error }` result rather than throwing, so the
 * dispatcher can log the outcome uniformly and decide about retries. A missing
 * provider configuration is NOT an error — it returns `ok: false` with a clear
 * reason and the dispatcher records the row as `skipped`, so a store running
 * without WhatsApp onboarding still functions end to end.
 */

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendViaEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!process.env.EMAIL_SERVER_HOST) {
    return { ok: false, skipped: true, error: "SMTP not configured" };
  }
  try {
    await sendEmail(params);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * WhatsApp Business Cloud API.
 *
 * Business-initiated messages outside the 24-hour service window must use a
 * Meta-approved template, which is why this takes a template name plus ordered
 * body parameters rather than free text — sending free text would silently fail
 * for exactly the transactional cases we care about.
 */
export async function sendViaWhatsApp(params: {
  to: string; // E.164 without "+"
  templateName: string;
  bodyParams: string[];
  languageCode?: string;
}): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, skipped: true, error: "WhatsApp Business API not configured" };
  }

  const to = params.to.replace(/\D/g, "");
  if (!to) return { ok: false, error: "No WhatsApp number for recipient" };

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode ?? "en" },
          components: params.bodyParams.length
            ? [
                {
                  type: "body",
                  parameters: params.bodyParams.map((text) => ({ type: "text", text })),
                },
              ]
            : [],
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Transactional SMS through a DLT-registered Indian gateway.
 *
 * Indian regulation requires the sender id and the exact template to be
 * pre-registered on the DLT platform, and the template id to be passed on every
 * send — an unregistered template is rejected at the operator, not by us. The
 * request shape below matches MSG91's flow API; swapping providers means
 * editing this one function.
 */
export async function sendViaSms(params: {
  to: string; // 10-digit or E.164
  templateId: string; // DLT-approved template id
  variables: Record<string, string>;
  fallbackText?: string;
}): Promise<SendResult> {
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID;
  if (!apiKey || !senderId) {
    return { ok: false, skipped: true, error: "SMS gateway not configured" };
  }

  const digits = params.to.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  if (!to) return { ok: false, error: "No phone number for recipient" };

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: params.templateId,
        sender: senderId,
        short_url: "0",
        recipients: [{ mobiles: to, ...params.variables }],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.type === "error") {
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data?.request_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
