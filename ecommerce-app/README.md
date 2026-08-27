# ZenBlue — Custom E-Commerce Website

Premium menswear storefront and admin panel, built against the Geoloide final
quotation for Zen Blue Clothing Co.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · MongoDB (Mongoose) ·
Cloudinary · Razorpay. There is no separate Express server — API routes under
`app/api/**` are the backend.

---

## Quick start

```bash
npm install
cp .env.local.example .env.local     # fill in MONGODB_URI + the two JWT secrets
npm run seed                          # catalogue, content pages, FAQs, admin user
npm run dev
```

Then sign in at `/login` with the credentials the seed script prints
(`admin@zenblue.in` / `ChangeMe123!` by default). **Change that password
immediately.**

Only three environment variables are needed to boot: `MONGODB_URI`,
`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Everything else degrades
gracefully — with no SMTP configured, emails are logged rather than sent; with
no WhatsApp or SMS provider, those messages are recorded as `skipped`; with no
courier API, shipping runs in manual AWB mode.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Colour directions

The brand deck offers four colour directions. All four ship as token sets in
`lib/theme.ts`, and **Direction B (Ivory & Navy)** is the selected default.

Switch direction at **Admin → Settings → Theme**. It re-skins the whole site —
storefront and admin — with no rebuild, because every component reads semantic
CSS variables (`bg-surface`, `text-heading`, `border-line`) rather than hex
values.

> Direction B is a light ground, so the logo asset uploaded in Settings must be
> the **dark-on-light** variant, per the deck's note on that direction.

---

## Project layout

```
app/
  (storefront)/         Customer-facing pages
  admin/                Admin panel (permission-gated)
  api/                  All backend routes
components/
  storefront/           Customer UI
  admin/                Admin UI + shared primitives (AdminPage.tsx)
lib/
  theme.ts              The four brand colour directions
  site-settings.ts      CMS settings shape, defaults and helpers
  permissions.ts        Admin/staff roles and per-section grants
  inventory.ts          The ONLY sanctioned path for stock changes
  wallet.ts             Store credit as a derived-balance ledger
  returns.ts            Return eligibility, transitions and refund maths
  notifications/        Email + WhatsApp + SMS behind one dispatcher
  shipping/provider.ts  Courier aggregator abstraction
  invoice/              GST invoices and credit notes
models/                 Mongoose schemas
scripts/seed.ts         Seeds the ZenBlue catalogue and content
```

---

## Architectural rules

A handful of invariants hold the system together. Breaking one of these will
produce a store whose books, shelf and customers disagree.

**Stock only ever changes through `lib/inventory.ts`.** Every sale, cancellation,
return, import and manual correction writes an immutable `StockLog` row. If a
number is wrong, the movement that made it wrong is always on record.

**The wallet has no balance field.** A customer's store credit is the sum of
their ledger rows. Read it with `getWalletBalance()`, change it with
`creditWallet()` / `debitWallet()` — never by writing a total.

**Prices are recomputed server-side at checkout.** The cart tells the server
*which* products and how many; price, stock, tax and discount are always read
from the database. Nothing in the cart payload is trusted.

**Invoices and credit notes are frozen snapshots.** They store everything they
print rather than re-deriving it, so a later price or GST-rate change cannot
silently rewrite an issued financial document.

**Hidden UI is not access control.** The admin sidebar renders only what the
signed-in user may open, but every admin API route independently re-checks the
same permission with `requireAdmin(req, PERMISSIONS.X)`.

---

## Roles and permissions

| Role | Access |
| --- | --- |
| `customer` | Storefront and their own account |
| `staff` | The admin sections listed in their `permissions` array |
| `admin` | Everything, implicitly — cannot be restricted |

Staff are created at **Admin → Staff & permissions**, which requires a full
admin. That is deliberate: if managing staff were itself a grantable
permission, a staff member holding it could promote themselves.

Two-factor authentication is on by default for new staff accounts. With 2FA
enabled, a correct password issues no session — the login response asks for a
one-time code, and the verify step re-checks the password alongside it.

---

## Scheduled jobs

One endpoint runs the recurring work:

```
POST /api/cron/abandoned-cart
Authorization: Bearer $CRON_SECRET
```

It runs the abandoned-cart recovery sweep and retries failed notifications.
Point any scheduler at it (Vercel Cron, GitHub Actions, cron-job.org) on a
15–30 minute cadence. Without `CRON_SECRET` set, the bearer path is refused
outright — an unauthenticated endpoint that sends customer email is not
something to leave open. An admin session also authorises it, which is how the
"Retry failed" button in the notification log works.

---

## Third-party setup

All accounts are registered in the client's name per the quotation's handover
terms. Each is optional — the store runs without it.

| Service | Environment variables | Without it |
| --- | --- | --- |
| **Cloudinary** | `CLOUDINARY_*` | Image upload is unavailable; existing URLs still render |
| **Razorpay** | `RAZORPAY_*`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | COD only |
| **SMTP** | `EMAIL_SERVER_*`, `EMAIL_FROM` | Emails logged to the console |
| **WhatsApp Cloud API** | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_*` | WhatsApp sends recorded as `skipped` |
| **DLT SMS gateway** | `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_TEMPLATE_*` | SMS sends recorded as `skipped` |
| **Shiprocket** | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | Manual AWB entry (fully functional) |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Password and OTP sign-in still work |

WhatsApp business-initiated messages require Meta-approved templates, and Indian
transactional SMS requires DLT-registered sender IDs and templates. Both are
onboarding steps, not code — the template identifiers are read from environment
variables so they can be filled in without a deploy.

---

## Testing checklist

**Storefront**
- Browse `/`, `/shop`, `/new-arrivals`, a category, a product
- On a product: pick a sold-out size → the back-in-stock form appears; open the
  size guide; check the fabric/care accordions
- Add to cart → `/cart` → `/checkout`
- Check out **as a guest** (sign out first) and as a signed-in customer
- Apply `WELCOME10` (needs a ₹1,499+ subtotal)
- `/track-order` with the order number and the email used at checkout

**Returns**
- Mark an order `delivered` in the admin
- Customer: **My Account → Orders → Request a return**, select items, add a photo
- Admin: **Returns** → approve → add a pickup AWB → mark received → run QC →
  issue a refund or store credit → complete (issues a credit note)
- Check the customer's **Store credit** page and the stock adjustment log

**Admin**
- Dashboard action queue, inventory low-stock list, CSV exports under Reports
- Bulk import: download the template, edit a row, **Check file**, then **Import**
- Settings → Theme: switch to Direction A and confirm the whole site re-skins

**Notifications**
- Place an order → check **Admin → Notification log** for the send record
- With no SMTP configured, entries show as `skipped` and the body is logged

---

## Deployment notes

- Set `NEXT_PUBLIC_SITE_URL` to the live origin. Canonical tags, JSON-LD and
  every link inside an email are built from it.
- MongoDB Atlas: allow-list the deployment's egress IPs.
- Razorpay webhook → `https://<domain>/api/payments/razorpay/webhook`, event
  `payment.captured`, secret in `RAZORPAY_WEBHOOK_SECRET`.
- Point the scheduler at `/api/cron/abandoned-cart`.
- After go-live: change the seeded admin password, turn on two-factor for every
  back-office account, and confirm `robots.txt` and `/api/sitemap.xml` resolve.

---

## What is not built

Stated plainly so nothing is assumed complete:

- **ERP integration.** Needs the client's ERP platform and API credentials
  before anything can be specified.
- **Automated backups.** A hosting and database concern (Atlas scheduled
  snapshots), not application code.
- **Delhivery API.** Selecting it falls back to manual AWB entry; the request
  shapes cannot be finalised until the client's account exists.
