/** Primary inbox that must receive every storefront enquiry. */
export const DEFAULT_ENQUIRY_EMAIL = "zenblueclothing@gmail.com";

/**
 * Build a de-duplicated recipient list while guaranteeing the primary enquiry
 * inbox is present. ENQUIRY_EMAIL allows deployments to move the inbox without
 * changing application code.
 */
export function getEnquiryRecipients(...additional: Array<string | undefined>): string {
  const primary = process.env.ENQUIRY_EMAIL?.trim() || DEFAULT_ENQUIRY_EMAIL;

  return Array.from(
    new Set(
      [primary, ...additional]
        .map((address) => address?.trim().toLowerCase())
        .filter((address): address is string => Boolean(address && address.includes("@")))
    )
  ).join(", ");
}
