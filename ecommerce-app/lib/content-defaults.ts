/**
 * ZEN BLUE launch content.
 *
 * Transcribed from the brand's supplied PDFs: About Us, Shipping Policy,
 * Return / Exchange Policy, Terms & Conditions and the FAQ set. These are
 * seeded into the database by `npm run seed` and are ALSO used as a runtime
 * fallback by /pages/[slug], so the footer's policy links resolve on a fresh
 * deploy before anyone has opened the admin. Once a row exists in ContentPage,
 * the database always wins.
 *
 * Placeholders in square brackets (address, GSTIN, support email) are as they
 * appear in the source documents and must be filled in before go-live — they
 * are deliberately left visible rather than invented.
 */

export interface DefaultContentPage {
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  isSystem: boolean;
}

export const DEFAULT_CONTENT_PAGES: DefaultContentPage[] = [
  {
    slug: "about",
    title: "About ZEN BLUE",
    subtitle: "Minimal by design. Distinct by identity.",
    metaTitle: "About ZEN BLUE — Premium Menswear",
    metaDescription:
      "ZEN BLUE is a modern menswear brand built around clean, versatile and contemporary clothing for men who value confidence, comfort and understated style.",
    isSystem: true,
    body: `ZEN BLUE is a modern menswear brand built around a simple idea: great style does not need to be loud. We create clean, versatile and contemporary clothing for men who value confidence, comfort and understated style.

Our design language is rooted in minimalism, modern masculinity and quiet luxury. From silhouettes and colour choices to the smallest details, every element is considered to feel refined without feeling overdone.

## Simplicity

Clean design. Nothing unnecessary.

## Confidence

Modern pieces made to feel effortless.

## Quality

Thoughtful details with a premium finish.

## Our philosophy

We believe clothing should work with you, not compete for attention. ZEN BLUE focuses on timeless foundations with a contemporary edge — pieces that can move from everyday moments to elevated occasions while staying true to a clean, masculine aesthetic.

## Designed for the modern man

ZEN BLUE is for men who appreciate sharp simplicity: balanced proportions, refined colour palettes and details that reveal themselves over time. Our aim is to make getting dressed feel easier, with pieces that look considered, feel comfortable and remain relevant beyond a single trend.

## Our promise

We are committed to building ZEN BLUE with consistency and intention. Every collection is an opportunity to refine our design language, improve the experience and create menswear that feels premium, accessible and unmistakably ZEN BLUE.

**The art of simplicity.** Minimal by design. Distinct by identity.`,
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    subtitle: "How orders are processed, dispatched and delivered.",
    metaTitle: "Shipping Policy — ZEN BLUE",
    metaDescription:
      "Order processing, dispatch, delivery timelines, shipping charges and tracking information for ZEN BLUE orders.",
    isSystem: true,
    body: `At ZEN BLUE, we aim to make every order experience simple, reliable and transparent. This policy explains how orders are processed, dispatched and delivered.

## 1. Order processing

Orders are processed after successful payment and order confirmation. Orders are prepared for dispatch within the processing timeline displayed on the website. During launches, promotions, high order volumes or unforeseen circumstances, processing may take additional time.

## 2. Shipping & delivery

Once dispatched, your order is handed to a shipping carrier. Delivery timelines may vary based on destination, courier service, weather, public holidays and circumstances beyond our control.

## 3. Shipping charges

Applicable shipping charges are shown at checkout before you place your order. ZEN BLUE may offer free-shipping promotions subject to the terms of the applicable offer.

## 4. Order tracking

After dispatch, tracking details will be shared through the contact information provided at checkout, where tracking is available. Tracking updates may take some time to appear after courier handover.

## 5. Delivery address

Customers are responsible for providing a complete and accurate delivery address, phone number and postal code. ZEN BLUE is not responsible for delays caused by incorrect or incomplete address information.

## 6. Delivery attempts

Courier partners may make multiple delivery attempts according to their operational policy. If delivery cannot be completed, the shipment may be returned to the sender.

## 7. Shipping delays

Delivery may be delayed by severe weather, natural events, transportation disruptions, strikes, public holidays, high-volume periods or other circumstances outside ZEN BLUE's reasonable control.

## 8. Damaged packages

If a package arrives visibly damaged, please photograph the package and product and contact ZEN BLUE as soon as possible. Please retain the original packaging until the issue has been reviewed.

## 9. Lost or undelivered shipments

If tracking shows an unusual delay, failed delivery or a shipment that appears lost, contact ZEN BLUE with your order number and tracking details so we can assist with the courier.

## 10. International shipping

If international shipping is offered, delivery timelines, customs duties, import taxes and local charges may vary by destination. Applicable customs or import charges are generally the recipient's responsibility unless stated otherwise at checkout.

## 11. Contact us

For shipping-related questions, use the contact details provided on the official ZEN BLUE website. Please keep your order number and tracking information ready.

**Important:** delivery estimates are indicative and are not guaranteed unless expressly stated otherwise at checkout.`,
  },
  {
    slug: "return-exchange-policy",
    title: "Return / Exchange Policy",
    subtitle: "Conditions and process for an eligible return or exchange.",
    metaTitle: "Return & Exchange Policy — ZEN BLUE",
    metaDescription:
      "Eligibility, timelines, product condition and the process for requesting a return or exchange with ZEN BLUE.",
    isSystem: true,
    body: `At ZEN BLUE, we want you to feel confident about every purchase. This policy explains the conditions and process for requesting an eligible return or exchange.

## 1. Eligibility

ZEN BLUE accepts eligible returns or exchanges only when the product meets the conditions in this policy. Items must be unused, unworn, unwashed and in original condition.

## 2. Return / exchange window

Requests must be raised within 7 days of delivery. After 7 days, the return or exchange option is no longer available for the order.

## 3. Product condition

Products must be returned with original tags, labels, packaging and accessories intact. Items showing signs of wear, washing, alteration, damage or misuse may be rejected.

## 4. How to request

Contact ZEN BLUE through the contact details provided on the website with your order number, product details and reason for the request. Our team will review the request and share the next steps.

## 5. Size exchange

For eligible products, customers may request a size exchange within the applicable exchange window. Exchanges are subject to stock availability.

## 6. Product exchange

Where permitted, an eligible product may be exchanged for another eligible product, subject to availability and any applicable price difference or policy conditions.

## 7. Sale & promotional products

Products purchased during sale, clearance or promotional campaigns may have different return or exchange conditions. Please check the terms shown at the time of purchase.

## 8. Damaged or incorrect product

If you receive a damaged, defective or incorrect product, contact ZEN BLUE promptly with clear photographs of the product, packaging and tags. The issue will be reviewed and an appropriate resolution provided where applicable.

## 9. Non-returnable conditions

Returns or exchanges may not be accepted for worn, washed, altered or damaged-after-delivery products, products missing original tags or packaging, or products otherwise failing the eligibility requirements.

## 10. Return shipping

Return or exchange shipping arrangements and applicable charges depend on the reason for the request and the terms communicated by ZEN BLUE when the request is approved.

## 11. Refunds

Where a refund is approved, it will be processed through the applicable payment method or refund mechanism after the returned product is received and inspected. Processing time may vary by payment provider or bank.

## 12. Inspection & approval

All returned products are subject to inspection. Approval is determined after verifying that the product meets the conditions of this policy.

## 13. Contact us

For return or exchange assistance, use the contact details provided on the official ZEN BLUE website. Keep your order number and relevant photographs ready for faster assistance.

**Important:** please check the product-specific return and exchange terms shown on the website at the time of purchase, as certain products or promotions may have different conditions.`,
  },
  {
    slug: "terms-of-service",
    title: "Terms & Conditions",
    subtitle: "The agreement between you and ZEN BLUE.",
    metaTitle: "Terms & Conditions — ZEN BLUE",
    metaDescription:
      "The terms governing your use of the ZEN BLUE website and the purchase of products from it.",
    isSystem: true,
    body: `## 1. About ZEN BLUE

ZEN BLUE is a menswear clothing brand offering apparel and related products through its website and other authorized channels. In these Terms, "ZEN BLUE", "we", "us" and "our" refer to the business operating the ZEN BLUE website. "You" or "customer" means any person who visits, uses or purchases through the website.

## 2. Acceptance of terms

By accessing or using the ZEN BLUE website, placing an order, creating an account, or otherwise using our services, you agree to these Terms & Conditions and our applicable Privacy Policy, Shipping Policy and Return/Refund Policy. If you do not agree, please do not use the website.

## 3. Eligibility

You must have the legal capacity to enter into a binding contract under applicable law. If you are under the applicable age of majority, you may use the website only with the involvement and consent of a parent or legal guardian.

## 4. Product information

We make reasonable efforts to display product descriptions, photographs, colours, sizes, measurements and prices accurately. However, minor variations may occur due to screen settings, lighting, photography, manufacturing processes or material characteristics. Product availability is subject to change without notice.

## 5. Prices, taxes and charges

All prices displayed on the website will be in Indian Rupees unless otherwise stated. Applicable taxes and delivery or other charges, if any, will be disclosed at checkout or as required by applicable law. ZEN BLUE reserves the right to correct pricing or listing errors. If an order is affected by a material pricing error, we may cancel the affected order and refund any amount paid.

## 6. Orders and order acceptance

Placing an order constitutes an offer to purchase the selected products. An order confirmation does not necessarily mean that the order has been finally accepted. ZEN BLUE may decline, cancel or limit an order for reasons including product unavailability, suspected fraud, incorrect pricing or listing information, delivery limitations, or other legitimate business or legal reasons. If payment has already been received for a cancelled order, the applicable amount will be refunded through the original or an appropriate payment method.

## 7. Payments

Payments may be processed through third-party payment providers. You agree to provide accurate billing and payment information and authorize the applicable payment provider to process the transaction. ZEN BLUE does not store complete payment-card information unless expressly stated and legally permitted.

## 8. Shipping and delivery

Delivery timelines displayed on the website are estimates unless expressly stated otherwise. Delays may occur because of courier issues, weather, public holidays, strikes, force majeure events, incorrect addresses, or other circumstances beyond reasonable control. Customers are responsible for providing accurate delivery information. Please refer to the Shipping Policy for detailed delivery terms.

## 9. Returns, exchanges and refunds

Returns, exchanges and refunds are governed by ZEN BLUE's then-current Return/Refund Policy displayed on the website. Eligibility may depend on product category, condition, tags, packaging, proof of purchase and the applicable return window. Nothing in these Terms is intended to exclude or restrict any consumer right that cannot lawfully be excluded or restricted under applicable law.

## 10. Cancellation

Order cancellation requests may be accepted only where permitted by ZEN BLUE's cancellation policy and depending on the order's processing or shipment status. Once an order has been shipped or otherwise processed, cancellation may not be possible and the customer may need to follow the applicable return process.

## 11. User accounts

If the website permits account creation, you are responsible for maintaining the confidentiality of your login credentials and for activity carried out through your account. You agree to provide accurate information and to notify ZEN BLUE if you believe your account has been accessed without authorization.

## 12. Website use

You agree not to misuse the website, interfere with its operation, attempt unauthorized access, introduce malicious code, scrape or copy content in an unlawful manner, impersonate another person, submit false information, or use the website for any unlawful or fraudulent purpose.

## 13. Intellectual property

All trademarks, brand names, logos, product photographs, designs, graphics, text, layouts and other website content owned or licensed by ZEN BLUE are protected by applicable intellectual-property laws. No part of the website may be copied, reproduced, modified, distributed or commercially exploited without prior written permission, except where permitted by law.

## 14. Reviews and user content

If you submit reviews, photographs, comments or other content, you represent that you have the right to submit it and that it does not infringe another person's rights or violate applicable law. By submitting content, you grant ZEN BLUE a non-exclusive, royalty-free right to use, reproduce and display that content for legitimate business and promotional purposes, subject to applicable law.

## 15. Third-party services and links

The website may contain links to or integrations with third-party websites, payment providers, logistics providers, social-media services or other platforms. ZEN BLUE is not responsible for the independent content, policies, security or practices of third parties. Your use of third-party services may be subject to their own terms.

## 16. Privacy and personal data

ZEN BLUE may collect and process personal information required to operate the website, process orders, provide customer support, deliver products, prevent fraud and comply with legal obligations. Such processing will be governed by the ZEN BLUE Privacy Policy and applicable Indian data-protection laws and rules, including the Digital Personal Data Protection Act, 2023 and related rules.

## 17. Promotions and discounts

Promotional offers, discount codes, cashback, gifts and other campaigns may have additional terms, eligibility requirements, validity periods or exclusions. ZEN BLUE may withdraw or modify a promotion where permitted by law. Promotions cannot be combined unless expressly stated.

## 18. Force majeure

ZEN BLUE will not be responsible for delay or failure to perform obligations caused by events beyond reasonable control, including natural disasters, war, government action, epidemic or pandemic restrictions, strikes, transportation disruptions, internet or technology failures, or other force majeure events.

## 19. Disclaimer and limitation of liability

To the maximum extent permitted by applicable law, ZEN BLUE will not be liable for indirect, incidental, special or consequential losses arising from use of the website or products. Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited under applicable law, including applicable consumer protections.

## 20. Indemnity

To the extent permitted by applicable law, you agree to indemnify and hold ZEN BLUE harmless from claims, losses, liabilities and reasonable expenses arising from your unlawful use of the website, violation of these Terms, fraud, or infringement of another person's rights.

## 21. Suspension or termination

ZEN BLUE may suspend or terminate access to an account or website features where reasonably necessary for security, fraud prevention, legal compliance, misuse, or violation of these Terms. Any rights that by their nature should survive termination will continue to apply.

## 22. Governing law and jurisdiction

These Terms shall be governed by the laws of India. Subject to applicable consumer-protection laws and any mandatory jurisdictional rights available to customers, disputes shall be subject to the jurisdiction of the competent courts having jurisdiction over the place of ZEN BLUE's registered or principal office, as applicable.

## 23. Changes to these terms

ZEN BLUE may update these Terms from time to time to reflect changes in products, services, technology, business practices or applicable law. The updated version will be posted on the website with an updated effective date. Your continued use of the website after an update constitutes acceptance of the revised Terms, to the extent permitted by law.

## 24. Grievance and customer support

For questions, complaints, returns, order issues or other concerns, customers should contact ZEN BLUE through the customer-support details published on the website.

## 25. Contact information

- **Business name:** ZEN BLUE
- **Website:** [Insert Website URL]
- **Email:** [Insert Official Customer Support Email]
- **Phone:** [Insert Customer Support Number]
- **Registered / principal address:** [Insert Full Business Address]
- **Grievance Officer:** [Insert Name and Contact Details, if applicable]

*Legal note: this document is a general template for an Indian online menswear business. Before publishing, ZEN BLUE should have an Indian legal professional verify the business entity details, return and refund rules, grievance mechanism, privacy and data-protection wording, taxes, payment terms, and jurisdiction.*`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    subtitle: "What we collect, why, and how it is protected.",
    metaTitle: "Privacy Policy — ZEN BLUE",
    metaDescription:
      "How ZEN BLUE collects, uses, stores and protects your personal data, and the rights you have over it.",
    isSystem: true,
    body: `ZEN BLUE collects and processes personal information required to operate the website, process orders, provide customer support, deliver products, prevent fraud and comply with legal obligations. This policy explains what is collected and why.

## What we collect

- **Account details** — your name, email address, phone number and password. Passwords are stored only as a one-way hash and cannot be read by us.
- **Order details** — shipping and billing addresses, order history and payment status.
- **Usage data** — pages viewed and actions taken on the site, through analytics tools.
- **Communication** — messages you send us through the contact form, email or WhatsApp.

## What we do not collect

We never see or store your full card number, CVV, UPI PIN or netbanking credentials. Payments are handled entirely by our payment provider on their own infrastructure. We receive only a payment reference and a success or failure result.

## Why we use it

- To process, pack, ship and invoice your orders
- To send transactional updates about your orders and returns
- To provide customer support
- To improve the store, our sizing and our product mix
- To send marketing messages, only where you have opted in

## Sharing

We share data only with the parties needed to fulfil your order: our payment gateway, our courier partners, our email, SMS and WhatsApp providers, and our accountants for statutory filings. We do not sell your personal data.

## Cookies

We use cookies to keep you signed in, remember your cart, and measure how the site is used. You can block cookies in your browser, but the cart and login will stop working.

## Data retention

Order and invoice records are retained for the period required under applicable Indian tax law. Marketing consent records are kept until you withdraw them.

## Your rights

Write to us using the details on the Contact page to request a copy of the data we hold about you, correct anything inaccurate, withdraw marketing consent, or ask us to delete your account, subject to the statutory retention above.

## Security

The site runs entirely over HTTPS. Passwords are hashed. Access to customer data in our admin panel is restricted by role, protected by two-factor authentication, and every administrative action is written to an audit log.

## Governing law

This policy is governed by applicable Indian data-protection law, including the Digital Personal Data Protection Act, 2023 and related rules.

*This document should be reviewed by a qualified Indian legal professional before publication.*`,
  },
];

export interface DefaultFaq {
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
}

/** The eleven questions from the supplied FAQ document, grouped for the page. */
export const DEFAULT_FAQS: DefaultFaq[] = [
  {
    category: "The Brand",
    sortOrder: 1,
    question: "What is ZEN BLUE?",
    answer:
      "ZEN BLUE is a modern menswear brand focused on premium-looking, versatile and minimal clothing designed for the contemporary man.",
  },
  {
    category: "Orders",
    sortOrder: 1,
    question: "How do I place an order?",
    answer:
      "Select your preferred product and size, add it to your cart, and proceed through checkout. Once your order is successfully placed, you will receive an order confirmation.",
  },
  {
    category: "Orders",
    sortOrder: 2,
    question: "How do I choose the right size?",
    answer:
      "Please refer to the size guide available on the product page before ordering. If you are between sizes, compare the garment measurements with a well-fitting piece you already own.",
  },
  {
    category: "Orders",
    sortOrder: 3,
    question: "Can I cancel or change my order?",
    answer:
      "If you need to change or cancel an order, contact ZEN BLUE as soon as possible. Requests can only be accommodated before the order enters processing or dispatch, where applicable.",
  },
  {
    category: "Payments",
    sortOrder: 1,
    question: "What payment methods are available?",
    answer:
      "Available payment options are displayed securely at checkout. The options shown may vary depending on your location and the payment gateway.",
  },
  {
    category: "Shipping",
    sortOrder: 1,
    question: "When will my order be dispatched?",
    answer:
      "Orders are processed and dispatched according to the current processing timeline shown on the website. During launches, high-demand periods or unforeseen circumstances, dispatch may take longer.",
  },
  {
    category: "Shipping",
    sortOrder: 2,
    question: "How can I track my order?",
    answer:
      "Once your order is dispatched, tracking details will be shared through the contact information provided during checkout, where applicable.",
  },
  {
    category: "Returns",
    sortOrder: 1,
    question: "What is the return or exchange policy?",
    answer:
      "Eligible items can be returned or exchanged within 7 days of delivery. After 7 days, the return or exchange option is no longer available. Items must be unused, unwashed and have their original tags.",
  },
  {
    category: "Returns",
    sortOrder: 2,
    question: "What if I receive a damaged or incorrect product?",
    answer:
      "Please contact ZEN BLUE promptly with your order details and clear photographs of the issue. The support team will review the request and guide you through the next steps.",
  },
  {
    category: "Support",
    sortOrder: 1,
    question: "Do you offer discounts or promotions?",
    answer:
      "ZEN BLUE may run limited-time offers, launches and promotional campaigns. Follow the brand's official channels and website for current offers and terms.",
  },
  {
    category: "Support",
    sortOrder: 2,
    question: "How can I contact ZEN BLUE?",
    answer:
      "Use the contact details provided on the official website or the Contact Us page. Please keep your order number ready for faster assistance.",
  },
];
