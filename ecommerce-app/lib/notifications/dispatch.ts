import { connectDB } from "@/lib/db";
import { NotificationLog } from "@/models";
import { getSiteSettings, type SiteSettingsData } from "@/lib/site-settings";
import { sendViaEmail, sendViaSms, sendViaWhatsApp } from "./providers";
import { messages, type MessageKey, type OrderMessageContext } from "./templates";

/**
 * The one entry point for sending a customer notification.
 *
 * Responsibilities, in order:
 *   1. Look up which channels the admin has enabled for this event
 *      (SiteSettings → notifications), so a trigger can be switched per channel
 *      with no code change — a requirement in the quotation.
 *   2. Render the message once per enabled channel from lib/notifications/templates.
 *   3. Write a NotificationLog row per channel BEFORE dispatching, then mark it
 *      sent/failed/skipped, so nothing can be sent without a trace.
 *
 * It never throws. A notification failure must not roll back the order, return
 * or refund that triggered it — the log row plus the retry sweep is the
 * recovery path, not an exception.
 */

export const CHANNELS = ["email", "whatsapp", "sms"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Maps an event to the toggle group that governs it. */
const EVENT_TOGGLE: Record<MessageKey, keyof SiteSettingsData["notifications"]> = {
  order_placed: "orderPlaced",
  payment_confirmed: "paymentConfirmed",
  order_confirmed: "orderConfirmed",
  order_shipped: "orderShipped",
  out_for_delivery: "outForDelivery",
  order_delivered: "orderDelivered",
  order_cancelled: "orderCancelled",
  return_requested: "returnUpdate",
  return_approved: "returnUpdate",
  return_rejected: "returnUpdate",
  refund_issued: "refundIssued",
  store_credit_issued: "refundIssued",
  back_in_stock: "backInStock",
};

export interface NotifyRecipient {
  email?: string;
  phone?: string;
  userId?: string;
}

export interface NotifyOptions {
  event: MessageKey;
  recipient: NotifyRecipient;
  context: Omit<OrderMessageContext, "storeName" | "currencySymbol">;
  orderId?: string;
  /** Bypass the admin toggles — used for OTP and other security messages. */
  force?: boolean;
  settings?: SiteSettingsData;
}

const MAX_ATTEMPTS = 3;

export async function notify(opts: NotifyOptions): Promise<void> {
  try {
    await connectDB();
    const settings = opts.settings ?? (await getSiteSettings());

    const toggles = settings.notifications[EVENT_TOGGLE[opts.event]] ?? {
      email: true,
      whatsapp: false,
      sms: false,
    };

    const rendered = messages[opts.event]({
      ...opts.context,
      storeName: settings.brand.storeName,
      currencySymbol: settings.commerce.currencySymbol,
      supportEmail: settings.contact.supportEmail || settings.contact.email,
    });

    for (const channel of CHANNELS) {
      const enabled = opts.force || toggles[channel];
      if (!enabled) continue;

      const recipient = channel === "email" ? opts.recipient.email : opts.recipient.phone;
      if (!recipient) continue;

      await dispatchOne({
        event: opts.event,
        channel,
        recipient,
        rendered,
        userId: opts.recipient.userId,
        orderId: opts.orderId,
      });
    }
  } catch (err) {
    // Deliberately swallowed: see the note in the file header.
    console.error(`[notify] ${opts.event} failed:`, err);
  }
}

async function dispatchOne(args: {
  event: MessageKey;
  channel: Channel;
  recipient: string;
  rendered: ReturnType<(typeof messages)[MessageKey]>;
  userId?: string;
  orderId?: string;
  existingLogId?: string;
}) {
  const { event, channel, recipient, rendered, userId, orderId } = args;

  const log =
    args.existingLogId
      ? await NotificationLog.findById(args.existingLogId)
      : await NotificationLog.create({
          event,
          channel,
          recipient,
          user: userId,
          order: orderId,
          subject: channel === "email" ? rendered.email.subject : "",
          preview:
            channel === "email"
              ? stripHtml(rendered.email.html).slice(0, 300)
              : channel === "sms"
                ? rendered.sms.text.slice(0, 300)
                : rendered.whatsapp.bodyParams.join(" | ").slice(0, 300),
          templateName:
            channel === "whatsapp"
              ? rendered.whatsapp.templateName
              : channel === "sms"
                ? rendered.sms.templateId
                : "",
          status: "queued",
        });

  if (!log) return;

  const result =
    channel === "email"
      ? await sendViaEmail({
          to: recipient,
          subject: rendered.email.subject,
          html: rendered.email.html,
        })
      : channel === "whatsapp"
        ? await sendViaWhatsApp({
            to: recipient,
            templateName: rendered.whatsapp.templateName,
            bodyParams: rendered.whatsapp.bodyParams,
          })
        : await sendViaSms({
            to: recipient,
            templateId: rendered.sms.templateId,
            variables: rendered.sms.variables,
            fallbackText: rendered.sms.text,
          });

  log.attempts = (log.attempts ?? 0) + 1;
  log.lastAttemptAt = new Date();
  // A provider that is simply not configured is `skipped`, not `failed` — it
  // should never be picked up by the retry sweep, because retrying cannot help.
  log.status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
  log.error = result.error ?? "";
  if (result.messageId) log.providerMessageId = result.messageId;
  await log.save();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retry sweep for failed sends — call from a cron/scheduled route.
 *
 * Only rows with status `failed` and fewer than MAX_ATTEMPTS tries are picked
 * up; `skipped` rows (unconfigured provider) and `sent` rows are left alone.
 * Re-rendering the message is not possible after the fact, so the stored
 * preview/subject is re-sent for email and the stored template id for the
 * others — which is exactly what the customer was meant to receive.
 */
export async function retryFailedNotifications(limit = 50): Promise<{ retried: number; sent: number }> {
  await connectDB();
  const rows = await NotificationLog.find({
    status: "failed",
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  let sent = 0;
  for (const row of rows) {
    const result =
      row.channel === "email"
        ? await sendViaEmail({ to: row.recipient, subject: row.subject, html: row.preview })
        : row.channel === "whatsapp"
          ? await sendViaWhatsApp({
              to: row.recipient,
              templateName: row.templateName,
              bodyParams: [],
            })
          : await sendViaSms({
              to: row.recipient,
              templateId: row.templateName,
              variables: {},
              fallbackText: row.preview,
            });

    row.attempts = (row.attempts ?? 0) + 1;
    row.lastAttemptAt = new Date();
    row.status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
    row.error = result.error ?? "";
    await row.save();
    if (result.ok) sent += 1;
  }

  return { retried: rows.length, sent };
}
