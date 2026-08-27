# ZEN BLUE — handover

Everything needed to run, seed and deploy the site. Written for someone opening
this folder cold.

---

## 1. Run it locally

```bash
npm install
cp .env.local.example .env.local
npm run seed
npm run dev            # http://localhost:3000
```

`.env.local` needs only three values to boot:

| Variable | Where it comes from |
|---|---|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `JWT_ACCESS_SECRET` | generate (below) |
| `JWT_REFRESH_SECRET` | generate (below) — must differ from the access secret |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Everything else degrades rather than breaks: no SMTP means mail is logged to the
console, no courier key means shipping runs in manual AWB mode, no ERP URL means
that section is simply off.

The seed prints the admin login (`admin@zenblue.in` / `ChangeMe123!` unless you
set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). **Change that password on first
sign-in.**

`.env.local` is gitignored and is NOT in this archive — those values never travel
with the code.

---

## 2. What is finished

**Storefront** — homepage with a 3:2 hero slider (up to 15 image or video
slides, autoplay, arrows on pointer devices, swipe on touch), circular category
shortcuts, product listing and detail with size/variant selection and a gallery
that takes video, cart, guest and signed-in checkout, order tracking, wishlist,
reviews, store credit, returns and exchanges.

**Account** — sidebar area covering Overview, Orders, Returns, Wallet, Wishlist,
Addresses and Profile, plus an OTP sign-in popup (mobile number, no password).

**Bulk & Customization** — two enquiry pages with a shared form that also hands
off to WhatsApp pre-filled. Submissions are written to the database first, then
emailed, so an SMTP outage cannot lose one.

**Admin** — products (with CSV bulk import), inventory on an immutable stock
ledger, orders, invoices with HSN-wise GST and credit notes, returns, coupons,
customers, staff with per-section permissions, content pages, FAQs, site
settings (branding, logo, palette, navigation, homepage, contact, social,
integrations), reports and an activity log.

## 3. What is still open

- **Product catalogue.** The 14 seeded products are placeholders. Export the
  real catalogue from Meta Commerce Manager (Catalogue → Items → Export items),
  run `npx tsx scripts/meta-catalog-to-csv.ts <export.csv>`, then upload the
  result at Admin → Products → Bulk import (tick Dry run first). The WhatsApp
  `wa.me/c/...` link cannot be read programmatically — it is a deep link into
  the app, not a data source.
- **Hero artwork.** The slides carry their campaign copy but no images. Upload
  the banners at Admin → Settings → Homepage → Hero slider. If a banner already
  has its headline set into the artwork, leave Heading blank — the slide then
  renders as pure artwork with no overlay or scrim.
- **Keys.** Razorpay, Shiprocket, Cloudinary and SMTP are all read from the
  environment and left blank here.

---

## 4. Deploying

Vercel is the path of least resistance for a Next.js App Router project:

1. Push this folder to a Git repository.
2. Import it in Vercel.
3. Add every variable from `.env.local.example` that you actually use, under
   Project → Settings → Environment Variables.
4. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the deployed domain.
5. In MongoDB Atlas → Network Access, allow Vercel's egress (or `0.0.0.0/0`
   while you are testing).

`npm run build` must pass before deploying — it does at the time of writing.

---

## 5. Notes for whoever picks this up

- `app/api/**` is the entire backend. There is no separate server.
- Stock only ever moves through `adjustStock()` in `lib/inventory.ts`, so every
  change lands in the ledger. Never write `stock` directly.
- The wallet has no stored balance — it is derived from `WalletTransaction`.
  See `lib/wallet.ts`.
- Invoices and credit notes freeze a snapshot of the order. They must not
  re-derive totals later, or a reprint would silently disagree with the original.
- `requireAdmin(req)` with no permission argument means admin only. Staff need
  an explicit `PERMISSIONS.*` argument. Widening it silently opens every route
  that calls it.
- Palette lives in `lib/theme.ts` as CSS custom properties; Direction B (Ivory &
  Navy) is live. Switch it at Admin → Settings → Theme.
