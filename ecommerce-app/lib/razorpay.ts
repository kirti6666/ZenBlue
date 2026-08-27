import Razorpay from "razorpay";

/**
 * Razorpay client, created lazily on first use.
 *
 * The SDK throws from its constructor when `key_id` is missing. Constructing it
 * at module scope therefore made the whole route un-importable without keys,
 * which broke `next build` on any machine or CI runner that did not have
 * production payment credentials. Deferring construction keeps the build (and
 * every non-payment route) working, and surfaces the misconfiguration at the
 * point where a payment is actually attempted.
 */
let client: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error(
      "Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local"
    );
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });
  }
  return client;
}

/**
 * Back-compat default export. Existing call sites do `razorpay.orders.create(…)`
 * — the proxy resolves the real client at property access time, so those keep
 * working unchanged while still deferring construction.
 */
const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    return (getRazorpay() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export default razorpay;
