# ERP and inventory workflow

The website treats HisabKitab as the accounting/product-master source and the
website inventory ledger as the storefront availability source between syncs.

## Data flow

1. **Product master (ERP → website):** items match by SKU. Existing product
   titles, descriptions, HSN and GST rates are refreshed. New SKUs are created
   inactive so an admin can add imagery/category details before publishing.
   When HisabKitab has no SKU, Admin → ERP sync provides a one-time ERP item ID
   to website SKU mapping; all later product, price, stock and order operations
   use that stable mapping.
2. **Price master (ERP → website):** simple-product SKUs update the base MRP and
   selling price; variant SKUs update only that size/colour combination.
3. **Closing stock (ERP → website):** each simple or variant SKU is set to the
   ERP closing quantity. The delta is written through `adjustStock`, so every
   reconciliation appears in the Stock Ledger and back-in-stock alerts work.
4. **Checkout (website):** stock is checked at checkout and decremented through
   the same inventory service when an order is confirmed. The PDP reads this
   live product/variant quantity, including the low-stock message.
5. **Customer master (ERP → website):** existing customer accounts are linked
   to ERP ledger IDs by email or phone. Login accounts are never created from
   accounting records.
6. **Website orders (website → ERP):** eligible unsynced orders create sale
   invoices. Each order line must have an ERP SKU, ledger, unit and GST mapping;
   each buyer needs a mapped customer ledger or configured fallback. Before a
   POST, existing ERP invoice numbers are checked to prevent duplicate sales.
7. **Payment/order status (ERP → website):** ERP sales reconcile transaction,
   invoice, payment and cancellation metadata to the website order.
8. **Dispatch (ERP → website):** delivery challans reconcile by order/invoice
   reference. If an AWB is present the order becomes shipped; courier tracking
   otherwise remains the Shiprocket/Delhivery integration's responsibility.
9. **Returns/exchanges (ERP → website):** sale returns reconcile to website RMAs.
   An exchange is a return plus its linked replacement website order/sale.

## Operating it

- Admin → ERP sync shows endpoint health and lets staff run each sync or all
  safe pulls. Pushing website orders is deliberately a separate action.
- For automation, schedule `GET /api/cron/erp-sync` and send
  `Authorization: Bearer <CRON_SECRET>`.
- Scheduled sale creation is off by default. Set `ERP_AUTO_PUSH_ORDERS=true`
  only after the country/state/city IDs and ledger/unit/GST mappings pass a
  manual order push.

## Required production configuration

`ERP_BASE_URL`, `ERP_API_KEY`, `ERP_DEFAULT_COUNTRY_ID`,
`ERP_DEFAULT_STATE_ID`, and `ERP_DEFAULT_CITY_ID` are required. Product-specific
ERP item mappings are preferred; the default customer, sales ledger, unit and
GST IDs are fallbacks for records where HisabKitab does not provide them.
