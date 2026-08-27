import { formatPrice } from "@/lib/site-settings";

/**
 * Message content for every notification event, in one place.
 *
 * Each event returns the three channel renderings side by side — the email
 * HTML, the WhatsApp template name plus its ordered parameters, and the SMS
 * DLT template id plus its variables. Keeping them together means adding an
 * event is one edit, and a copy change can never leave the channels saying
 * different things.
 *
 * WhatsApp/SMS template identifiers are read from env because they are issued
 * by Meta and the DLT registrar during onboarding, and differ per client
 * account — they are configuration, not code.
 */

export interface RenderedMessage {
  email: { subject: string; html: string };
  whatsapp: { templateName: string; bodyParams: string[] };
  sms: { templateId: string; variables: Record<string, string>; text: string };
}

const BRAND_NAVY = "#16233B";
const BRAND_INK = "#2B2F35";
const BRAND_LINE = "#DEE2E6";
const BRAND_MUTED = "#626B76";

/** Shared HTML chrome so every transactional email looks like one system. */
export function emailShell(opts: {
  storeName: string;
  heading: string;
  intro: string;
  bodyHtml?: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { storeName, heading, intro, bodyHtml = "", ctaText, ctaUrl, footerNote } = opts;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F6F5F2;font-family:Helvetica,Arial,sans-serif;color:${BRAND_INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BRAND_LINE};border-radius:12px;overflow:hidden;">
        <tr><td style="background:${BRAND_NAVY};padding:20px 28px;">
          <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:0.08em;">${storeName.toUpperCase()}</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND_NAVY};">${heading}</h1>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${BRAND_INK};">${intro}</p>
          ${bodyHtml}
          ${
            ctaText && ctaUrl
              ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:${BRAND_NAVY};color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">${ctaText}</a></p>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid ${BRAND_LINE};font-size:12px;color:${BRAND_MUTED};">
          ${footerNote ?? `You are receiving this because you placed an order with ${storeName}.`}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Renders an order's line items as an email-safe table. */
export function itemsTable(
  items: { title: string; quantity: number; price: number; variantLabel?: string }[],
  symbol: string
): string {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;font-size:13px;border-bottom:1px solid ${BRAND_LINE};">
          ${i.title}${i.variantLabel ? `<br><span style="color:${BRAND_MUTED};font-size:12px;">${i.variantLabel}</span>` : ""}
        </td>
        <td style="padding:8px 0;font-size:13px;text-align:center;border-bottom:1px solid ${BRAND_LINE};">×${i.quantity}</td>
        <td style="padding:8px 0;font-size:13px;text-align:right;border-bottom:1px solid ${BRAND_LINE};">${formatPrice(
          i.price * i.quantity,
          symbol
        )}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">${rows}</table>`;
}

export function summaryRows(
  rows: { label: string; value: string; strong?: boolean }[]
): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
    ${rows
      .map(
        (r) => `<tr>
          <td style="padding:4px 0;font-size:13px;color:${r.strong ? BRAND_NAVY : BRAND_MUTED};font-weight:${
            r.strong ? 700 : 400
          };">${r.label}</td>
          <td style="padding:4px 0;font-size:13px;text-align:right;color:${
            r.strong ? BRAND_NAVY : BRAND_INK
          };font-weight:${r.strong ? 700 : 400};">${r.value}</td>
        </tr>`
      )
      .join("")}
  </table>`;
}

/** Template ids issued during WhatsApp/DLT onboarding, supplied via env. */
const wa = (key: string) => process.env[`WHATSAPP_TEMPLATE_${key}`] ?? key.toLowerCase();
const dlt = (key: string) => process.env[`SMS_TEMPLATE_${key}`] ?? "";

export interface OrderMessageContext {
  storeName: string;
  currencySymbol: string;
  customerName: string;
  orderNumber: string;
  orderUrl: string;
  total: number;
  itemsHtml?: string;
  summaryHtml?: string;
  awb?: string;
  courierName?: string;
  trackingUrl?: string;
  amount?: number;
  reason?: string;
  supportEmail?: string;
}

export const messages = {
  order_placed: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Order ${c.orderNumber} confirmed · ${c.storeName}`,
      html: emailShell({
        storeName: c.storeName,
        heading: `Thanks, ${c.customerName.split(" ")[0]} — we have your order.`,
        intro: `Order <strong>${c.orderNumber}</strong> is confirmed. We will email you again the moment it ships.`,
        bodyHtml: (c.itemsHtml ?? "") + (c.summaryHtml ?? ""),
        ctaText: "View your order",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: {
      templateName: wa("ORDER_PLACED"),
      bodyParams: [c.customerName, c.orderNumber, formatPrice(c.total, c.currencySymbol)],
    },
    sms: {
      templateId: dlt("ORDER_PLACED"),
      variables: { name: c.customerName, order: c.orderNumber },
      text: `${c.storeName}: Order ${c.orderNumber} confirmed for ${formatPrice(
        c.total,
        c.currencySymbol
      )}. Track it at ${c.orderUrl}`,
    },
  }),

  payment_confirmed: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Payment received for ${c.orderNumber}`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Payment received",
        intro: `We have received ${formatPrice(c.total, c.currencySymbol)} against order <strong>${
          c.orderNumber
        }</strong>. Your GST invoice is attached.`,
        ctaText: "View your order",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: {
      templateName: wa("PAYMENT_CONFIRMED"),
      bodyParams: [c.orderNumber, formatPrice(c.total, c.currencySymbol)],
    },
    sms: {
      templateId: dlt("PAYMENT_CONFIRMED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Payment of ${formatPrice(c.total, c.currencySymbol)} received for order ${
        c.orderNumber
      }.`,
    },
  }),

  order_confirmed: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Order ${c.orderNumber} is being packed`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Your order is being packed",
        intro: `Order <strong>${c.orderNumber}</strong> has been confirmed and is now with our packing team.`,
        ctaText: "View your order",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: { templateName: wa("ORDER_CONFIRMED"), bodyParams: [c.orderNumber] },
    sms: {
      templateId: dlt("ORDER_CONFIRMED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Order ${c.orderNumber} confirmed and being packed.`,
    },
  }),

  order_shipped: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Order ${c.orderNumber} has shipped`,
      html: emailShell({
        storeName: c.storeName,
        heading: "On its way",
        intro: `Order <strong>${c.orderNumber}</strong> has been handed to ${
          c.courierName || "our courier"
        }.${c.awb ? ` Your tracking number is <strong>${c.awb}</strong>.` : ""}`,
        ctaText: "Track your parcel",
        ctaUrl: c.trackingUrl || c.orderUrl,
      }),
    },
    whatsapp: {
      templateName: wa("ORDER_SHIPPED"),
      bodyParams: [c.orderNumber, c.courierName ?? "", c.awb ?? "", c.trackingUrl ?? c.orderUrl],
    },
    sms: {
      templateId: dlt("ORDER_SHIPPED"),
      variables: { order: c.orderNumber, awb: c.awb ?? "" },
      text: `${c.storeName}: Order ${c.orderNumber} shipped via ${c.courierName ?? ""}. AWB ${
        c.awb ?? ""
      }. Track: ${c.trackingUrl ?? c.orderUrl}`,
    },
  }),

  out_for_delivery: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Order ${c.orderNumber} is out for delivery`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Out for delivery today",
        intro: `Order <strong>${c.orderNumber}</strong> is with the delivery agent and should reach you today.`,
        ctaText: "Track your parcel",
        ctaUrl: c.trackingUrl || c.orderUrl,
      }),
    },
    whatsapp: { templateName: wa("OUT_FOR_DELIVERY"), bodyParams: [c.orderNumber] },
    sms: {
      templateId: dlt("OUT_FOR_DELIVERY"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Order ${c.orderNumber} is out for delivery today.`,
    },
  }),

  order_delivered: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Order ${c.orderNumber} delivered`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Delivered",
        intro: `Order <strong>${c.orderNumber}</strong> has been delivered. If anything is not right, you can raise a return from your account within the return window.`,
        ctaText: "Review your purchase",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: { templateName: wa("ORDER_DELIVERED"), bodyParams: [c.orderNumber] },
    sms: {
      templateId: dlt("ORDER_DELIVERED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Order ${c.orderNumber} delivered. Thank you.`,
    },
  }),

  order_cancelled: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Order ${c.orderNumber} cancelled`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Order cancelled",
        intro: `Order <strong>${c.orderNumber}</strong> has been cancelled.${
          c.reason ? ` Reason: ${c.reason}.` : ""
        } Any amount already paid will be refunded to the original payment method.`,
        ctaText: "View your order",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: { templateName: wa("ORDER_CANCELLED"), bodyParams: [c.orderNumber] },
    sms: {
      templateId: dlt("ORDER_CANCELLED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Order ${c.orderNumber} has been cancelled.`,
    },
  }),

  return_requested: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Return request received for ${c.orderNumber}`,
      html: emailShell({
        storeName: c.storeName,
        heading: "We have your return request",
        intro: `Your request against order <strong>${c.orderNumber}</strong> is with our team. We usually approve within one business day.`,
        ctaText: "View request",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: { templateName: wa("RETURN_REQUESTED"), bodyParams: [c.orderNumber] },
    sms: {
      templateId: dlt("RETURN_REQUESTED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Return request received for order ${c.orderNumber}.`,
    },
  }),

  return_approved: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Return approved for ${c.orderNumber}`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Return approved",
        intro: `Your return against order <strong>${c.orderNumber}</strong> is approved. ${
          c.awb
            ? `Reverse pickup is scheduled with ${c.courierName ?? "our courier"} (AWB ${c.awb}).`
            : "We will schedule a reverse pickup shortly."
        } Please keep the item unworn with its tags.`,
        ctaText: "View request",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: {
      templateName: wa("RETURN_APPROVED"),
      bodyParams: [c.orderNumber, c.awb ?? ""],
    },
    sms: {
      templateId: dlt("RETURN_APPROVED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Return approved for order ${c.orderNumber}. Pickup will be scheduled.`,
    },
  }),

  return_rejected: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Return request update for ${c.orderNumber}`,
      html: emailShell({
        storeName: c.storeName,
        heading: "We could not approve this return",
        intro: `Your return request against order <strong>${c.orderNumber}</strong> was not approved.${
          c.reason ? ` Reason: ${c.reason}.` : ""
        } Reply to this email if you would like us to look again.`,
        ctaText: "View request",
        ctaUrl: c.orderUrl,
        footerNote: c.supportEmail ? `Questions? Write to ${c.supportEmail}.` : undefined,
      }),
    },
    whatsapp: {
      templateName: wa("RETURN_REJECTED"),
      bodyParams: [c.orderNumber, c.reason ?? ""],
    },
    sms: {
      templateId: dlt("RETURN_REJECTED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Return request for order ${c.orderNumber} was not approved.`,
    },
  }),

  refund_issued: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Refund issued for ${c.orderNumber}`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Refund on its way",
        intro: `We have issued a refund of <strong>${formatPrice(
          c.amount ?? 0,
          c.currencySymbol
        )}</strong> against order <strong>${c.orderNumber}</strong>. Banks typically take 3–7 working days to post it.`,
        ctaText: "View your order",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: {
      templateName: wa("REFUND_ISSUED"),
      bodyParams: [c.orderNumber, formatPrice(c.amount ?? 0, c.currencySymbol)],
    },
    sms: {
      templateId: dlt("REFUND_ISSUED"),
      variables: { order: c.orderNumber },
      text: `${c.storeName}: Refund of ${formatPrice(
        c.amount ?? 0,
        c.currencySymbol
      )} issued for order ${c.orderNumber}.`,
    },
  }),

  store_credit_issued: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `${formatPrice(c.amount ?? 0, c.currencySymbol)} store credit added`,
      html: emailShell({
        storeName: c.storeName,
        heading: "Store credit added",
        intro: `<strong>${formatPrice(
          c.amount ?? 0,
          c.currencySymbol
        )}</strong> has been added to your ${c.storeName} wallet. It applies automatically at checkout.`,
        ctaText: "View wallet",
        ctaUrl: c.orderUrl,
      }),
    },
    whatsapp: {
      templateName: wa("STORE_CREDIT"),
      bodyParams: [formatPrice(c.amount ?? 0, c.currencySymbol)],
    },
    sms: {
      templateId: dlt("STORE_CREDIT"),
      variables: { amount: String(c.amount ?? 0) },
      text: `${c.storeName}: ${formatPrice(
        c.amount ?? 0,
        c.currencySymbol
      )} store credit added to your account.`,
    },
  }),

  back_in_stock: (c: OrderMessageContext): RenderedMessage => ({
    email: {
      subject: `Back in stock at ${c.storeName}`,
      html: emailShell({
        storeName: c.storeName,
        heading: "It's back",
        intro: `The piece you asked about is available again. Stock on restocks moves quickly.`,
        ctaText: "Shop it now",
        ctaUrl: c.orderUrl,
        footerNote: "You asked to be notified when this item returned.",
      }),
    },
    whatsapp: { templateName: wa("BACK_IN_STOCK"), bodyParams: [c.orderNumber] },
    sms: {
      templateId: dlt("BACK_IN_STOCK"),
      variables: { product: c.orderNumber },
      text: `${c.storeName}: The item you wanted is back in stock. ${c.orderUrl}`,
    },
  }),
};

export type MessageKey = keyof typeof messages;
