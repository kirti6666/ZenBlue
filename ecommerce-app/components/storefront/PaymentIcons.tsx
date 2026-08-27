/**
 * Payment method badges for the footer.
 *
 * Drawn as inline SVG type rather than loaded as brand logo files: the marks
 * are trademarked and each carries its own usage rules, so the safe, licence-
 * clean version is a plain wordmark chip. It also costs zero extra requests,
 * which matters on the mobile-first budget.
 */
const METHODS = ["UPI", "VISA", "Mastercard", "RuPay", "Net Banking", "Wallets"];

export function PaymentIcons() {
  return (
    <div>
      <p className="eyebrow mb-1.5 sm:mb-2.5">We accept</p>
      <ul className="flex flex-wrap justify-start gap-1">
        {METHODS.map((m) => (
          <li
            key={m}
            className="rounded border border-line bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted sm:px-2 sm:py-1 sm:text-[10px]"
          >
            {m}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted sm:mt-2.5 sm:text-[11px]">
        Secured by Razorpay · 128-bit SSL encrypted
      </p>
    </div>
  );
}
