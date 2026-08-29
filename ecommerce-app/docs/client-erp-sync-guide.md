# ZenBlue ERP Synchronisation — Client Guide

This guide is for the ZenBlue inventory/accounts team responsible for HisabKitab.
The website developer should not guess product mappings because an incorrect
mapping can update the wrong product's price or stock.

## What the integration does

The ERP integration connects HisabKitab with the ZenBlue website for:

- finished-product details and HSN/GST information;
- selling prices;
- product and variant stock;
- customer ledger matching;
- website sales orders;
- sale/payment and cancellation status;
- dispatch/challan status; and
- return/exchange accounting status.

## Responsibilities

### Client inventory/accounts team

- Decide which HisabKitab finished item matches each website SKU/variant.
- Keep HisabKitab item names, SKUs, GST, unit and ledger information correct.
- Save mappings and run synchronisation from the admin panel.
- Verify prices and quantities after every first-time or large sync.
- Push website orders only when accounting mappings are ready.

### Developer/deployment administrator

- Maintain ERP API credentials and endpoint configuration.
- Configure country, state and city IDs.
- Configure a default customer ledger for guest orders when required.
- Investigate API, authentication or software errors.

Never send ERP API keys or passwords over ordinary email or chat.

## Before the first sync

Confirm the following in HisabKitab:

1. Every finished product has a unique SKU where possible.
2. Every sellable size/colour variant is represented by the correct ERP item.
3. GST mapping, HSN, unit of measurement and income ledger are correct.
4. Opening/closing stock has been checked physically or against the stock ledger.
5. Raw materials can be identified separately from finished goods.
6. A customer ledger exists for registered customers, or a default website/guest
   customer ledger has been supplied to the developer.

## Step 1 — Open the ERP screen

1. Sign in to the ZenBlue admin panel.
2. Open **Configure → ERP sync**.
3. Confirm the Connection card says **Connected with apikey authentication**.
4. Check that Products, Prices, Inventory, Customers, Orders, Dispatch and
   Returns show reachable endpoints.

If the connection is red or an endpoint is unavailable, stop and inform the
developer. Do not change mappings to solve a connection error.

## Step 2 — Map finished products

The **ERP item mapping** section is required when a HisabKitab item has no SKU.

For each ERP item:

1. Read the ERP item name and item ID on the left.
2. If it is a finished garment sold on the website, open the dropdown.
3. Select the exact website product, size and colour.
4. If it is fabric, yarn, packaging, trims, buttons or another raw material,
   leave it as **Not mapped**.
5. Click **Save mappings** after completing a checked group of items.

### Mapping rules

- One ERP finished item must map to only one website SKU.
- One website SKU must map to only one ERP item.
- Match the product, size and colour exactly.
- Never choose the nearest-looking product merely to remove “Not mapped”.
- “Not mapped” is correct for raw materials and items not sold online.
- When unsure, confirm with the stock/accounting owner before saving.

Example: an ERP item for a navy medium polo must map to that exact navy medium
polo variant—not the product's small size, another colour or a different tee.

## Step 3 — Run the first safe sync

Run the operations in this order:

1. **Pull item master** — refreshes product name, description, HSN and GST data.
2. **Pull prices** — updates the price of the mapped product/variant.
3. **Pull closing stock** — sets website inventory to HisabKitab closing stock
   and records the adjustment in the website Stock Ledger.
4. **Reconcile ledgers** — links website customers to ERP customer ledgers.
5. **Pull sale status** — reconciles existing ERP sale/payment status.
6. **Pull challan status** — reconciles dispatch information.
7. **Pull sale returns** — reconciles ERP sale-return records.

The **Run all safe pulls** button performs these safe pull/reconciliation steps.
It does not create ERP sales invoices.

## Step 4 — Verify the result

Before pushing orders, check at least three representative products:

1. Open **Admin → Inventory** and compare website stock with HisabKitab.
2. Check multiple size/colour variants, not only the product total.
3. Open each product page and confirm its displayed price and stock message.
4. Check the Stock Ledger for an `erp_sync` entry when a quantity changed.
5. Confirm that no raw material has appeared as a website product.
6. Review the ERP screen's **Last run** section for skipped rows or errors.

If a wrong product changed, stop further syncing, correct the mapping and inform
the developer before making manual stock adjustments.

## Step 5 — Test one website order

Use one controlled test order before enabling routine order pushing:

1. Place or identify one eligible website order.
2. Confirm every order-line SKU has a valid ERP mapping.
3. Confirm the customer has an ERP ledger mapping or the guest fallback ledger
   is configured.
4. Confirm country, state, city, GST, income ledger and unit mappings.
5. In **Admin → ERP sync**, click **Push website orders**.
6. Open HisabKitab and confirm one sale invoice was created with the correct:
   - website order number;
   - customer ledger;
   - items and quantities;
   - rates and GST;
   - billing/shipping address; and
   - grand total.
7. Do not repeatedly click the button while a request is still processing.

The website checks for an existing ERP invoice with the same order number before
creating another one, but the accounting team should still verify the test sale.

## Step 6 — Dispatch and returns test

1. Create/update a delivery challan for the test order in HisabKitab.
2. Run **Pull challan status** and confirm the website order is reconciled.
3. When a real test return is available, create the corresponding sale return.
4. Run **Pull sale returns** and confirm the matching website RMA is updated.
5. For an exchange, verify both the return and its replacement sale/order.

If there are currently zero sale returns in HisabKitab, endpoint connectivity can
be confirmed but full return matching must be validated when the first test
return exists.

## Regular operating routine

Recommended routine for the inventory/accounts team:

1. Add and verify new finished items in HisabKitab.
2. Map only newly added website products/variants.
3. Save mappings.
4. Run safe pulls at the agreed frequency.
5. Review errors and unmapped finished items.
6. Verify a sample of price and variant stock changes.
7. Push eligible website orders.
8. Confirm created sales in HisabKitab.
9. Pull dispatch and return statuses.

Existing mappings remain saved; they do not need to be selected again unless an
ERP item or website SKU is replaced.

## When to contact the developer

Contact the developer when:

- connection/authentication shows an error;
- an ERP endpoint is unavailable;
- a correct ERP item or website SKU is missing from the dropdown;
- saving mappings reports a duplicate or database error;
- a sync changes the wrong website product despite a correct mapping;
- an order fails because a required country/state/city, ledger, unit or GST ID
  is missing;
- an invoice was duplicated; or
- scheduled synchronisation fails.

Provide the operation name, website order number or SKU, ERP item ID, time of
the error and a screenshot. Never include the ERP API key or password.

## Sign-off checklist

- [ ] ERP connection and all required endpoints are green.
- [ ] Finished products are mapped to exact website variants.
- [ ] Raw materials remain unmapped.
- [ ] Product details and HSN/GST were sampled.
- [ ] Prices were sampled.
- [ ] Variant stock was sampled against HisabKitab.
- [ ] Stock Ledger entries were reviewed.
- [ ] Customer ledger matching was tested.
- [ ] One website order was pushed and checked in HisabKitab.
- [ ] Dispatch reconciliation was tested.
- [ ] Return/exchange reconciliation was tested or scheduled for the first return.
- [ ] The inventory/accounts owner approved routine operation.
