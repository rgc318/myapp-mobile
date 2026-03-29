# Mobile Development

## Role

`myapp-mobile` is the primary business client for field and transaction workflows.

Main scenarios:

- sales order creation
- delivery
- sales invoicing
- payment collection
- purchase order creation
- receiving
- purchase invoicing
- supplier payment
- returns

## Tech Stack

- React Native
- Expo
- Expo Router
- TypeScript

## Related Backend Docs

Backend docs remain the source of truth.

- API reference:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/API_GATEWAY.zh-CN.md`
- Backend overview:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/README.zh-CN.md`
- Current handoff/context:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/HANDOFF.zh-CN.md`
- Sales design:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/WHOLESALE_TECH_DESIGN.zh-CN.md`
- Purchase design:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/PURCHASE_TECH_DESIGN.zh-CN.md`

## API Mapping

Frontend should use the existing gateway APIs instead of calling ERPNext write endpoints directly.

- Product search page:
  - `myapp.api.gateway.search_product`
- Sales order page:
  - `myapp.api.gateway.create_order`
- Delivery page:
  - `myapp.api.gateway.submit_delivery`
- Sales invoice page:
  - `myapp.api.gateway.create_sales_invoice`
- Payment page:
  - `myapp.api.gateway.update_payment_status`
- Sales return page:
  - `myapp.api.gateway.process_sales_return`
- Purchase order page:
  - `myapp.api.gateway.create_purchase_order`
- Receiving page:
  - `myapp.api.gateway.receive_purchase_order`
- Purchase invoice page:
  - `myapp.api.gateway.create_purchase_invoice_from_receipt`
- Supplier payment page:
  - `myapp.api.gateway.record_supplier_payment`
- Purchase return page:
  - `myapp.api.gateway.process_purchase_return`

Detailed request and response fields should be checked in the backend API document.

## Frontend Upgrade Summary (2026-03-17)

This round focused on aligning the mobile frontend with the completed sales v2 backend interfaces and reducing repeated request/auth logic.

### Completed

- request/auth infrastructure
  - added a unified request layer in:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/api-client.ts`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/frappe-http.ts`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/auth-storage.ts`
  - added shared error and form helpers:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/app-error.ts`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/form-utils.ts`
  - added global feedback provider:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/providers/feedback-provider.tsx`

- service-layer reorganization
  - added domain services:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/customers.ts`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/products.ts`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/sales.ts`
  - existing auth/user/master-data/gateway modules were adjusted to use the unified request layer where relevant

- sales v2 backend alignment
  - product search page now uses `search_product_v2`
  - product search page supports quick create-and-stock from mobile
  - sales-order page now uses:
    - `get_customer_sales_context`
    - `create_order_v2`
  - sales-order detail page now uses `get_sales_order_detail`
  - document query page now uses `get_sales_order_status_summary`

- order and document UX updates
  - customer defaults and recent addresses are now loaded into the sales-order page
  - current order draft remains shared between the order page and product search page
  - order list status display now prefers business-facing labels instead of raw technical status text
  - sales-order detail item image rendering is aligned with the backend aggregated image field

### Not Completed Yet

- sales order update flow is still not fully v2
  - the sales-order detail page still uses a legacy direct update path for edit/save
  - backend currently does not yet provide an order update v2 interface

- legacy helper cleanup is not complete
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/master-data.ts`
    still contains older sales-order and customer-shipping helpers
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/gateway.ts`
    still keeps legacy order creation helpers for backward compatibility

- product workbench is only first-phase complete
  - quick product creation is available
  - full product edit/detail flows are not yet aligned to new backend contracts

- downstream business pages are still pending
  - delivery
  - sales invoice
  - payment
  - return
  - purchase flow pages

### Problems Encountered In This Round

- CSRF/session mismatch on web
  - session login succeeded, but later POST requests could still fail with `CSRFTokenError`
  - this required adding persistent CSRF handling and desk bootstrap fallback logic

- mixed old/new data paths
  - some screens had already moved to gateway aggregation, while others were still using raw `frappe.client.*`
  - this caused inconsistent field availability, especially for status display and sales-order detail rendering

- gateway response shape confusion
  - `callGatewayMethod()` already unwraps `message.data`
  - one document-list path accidentally tried to read `data.data`, which made valid list responses look empty

- image rendering regression after detail-page migration
  - the old page used to backfill item images through separate `Item` reads
  - after switching to the aggregated order-detail API, image rendering disappeared until the backend contract was updated to return item image fields

- local Android build environment friction
  - `npx expo prebuild -p android` only generates the native Android project and does not produce an APK by itself
  - actual APK generation still requires running Gradle inside the generated `android/` project
  - local Android build requires at least:
    - JDK 17
    - `JAVA_HOME`
    - Android SDK / Gradle environment
  - in this environment, `sdkman` was used to install and switch Java versions
  - `sdkman` installation additionally required system packages:
    - `unzip`
    - `zip`

- Gradle network/proxy behavior
  - Gradle/JVM download traffic should not be assumed to automatically follow Windows or browser-level system proxy settings
  - even when `npm`, `npx`, or Expo CLI can reach the network, Gradle may still fail while downloading its distribution or Android dependencies
  - local Android build may therefore require explicit proxy configuration for Gradle/JVM, for example through:
    - `android/gradle.properties`
    - `GRADLE_OPTS`
  - this is especially important in WSL or mixed Windows + WSL development setups

### Current Recommended Next Steps

1. add a sales-order update v2 backend interface and migrate the detail-page save flow to it
2. remove or explicitly mark legacy sales helpers in `master-data.ts` and old gateway wrappers
3. continue aligning delivery/invoice/payment pages to the sales v2 contract
4. finish product detail/edit paths on top of the new product service split

## Product Module Summary (2026-03-21)

This round turned the mobile product flow from "search-only helper pages" into a first usable product workbench.

### Completed

- formal product workbench page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/products.tsx`
  - supports:
    - product search
    - enabled / disabled filter
    - stock summary
    - price summary
    - first-level warehouse stock distribution preview

- formal product create page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/create.tsx`
  - supports:
    - item name / code / nickname / description / image
    - stock UOM
    - wholesale default UOM
    - retail default UOM
    - standard selling / wholesale / retail / buying prices

- product detail page was rebuilt into a real management page
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
  - supports:
    - product overview
    - price-system display
    - warehouse stock breakdown
    - current warehouse stock editing
    - basic info edit
    - enable / disable action

- product service layer was expanded
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/products.ts`
  - now supports:
    - `fetchProducts()`
    - `fetchProductDetail()`
    - `createProduct()`
    - `saveProductBasicInfo()`
    - `toggleProductDisabled()`
    - `setProductDisabled()` alias
    - `createProductAndStock()`
  - product mapping now also carries:
    - `totalQty`
    - `warehouseStockDetails`
    - `priceSummary`
    - `salesProfiles`
    - default wholesale / retail UOM

- home/product entry points were updated
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`
  - `商品` shortcut now goes to the formal product workbench
  - homepage keyword search now also routes into the product workbench

### Current Product Module Boundaries

- "delete" is still handled as enable / disable, not physical removal

## Product UOM Alignment (2026-03-25)

This round aligned the mobile product module with the backend rule that inventory is always settled in `stock_uom`, while wholesale / retail only define default business-facing transaction UOMs.

### Completed

- product create page no longer assumes "retail UOM = inventory UOM"
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/create.tsx`
  - now supports the same unit-rule editor structure as the detail page:
    - stock base UOM
    - wholesale default transaction UOM
    - retail default transaction UOM
    - `manual / sync with wholesale / sync with retail`
    - formula-style conversion rows instead of separate scattered fields
  - create flow now defaults to `sync with wholesale` to better match the current wholesale-first operating model
  - save logic now follows the same conversion semantics as detail edit, including the reversed readable retail rule when stock base is synced to wholesale

- product detail edit page now preserves and edits `stockUom` as an independent field

## Customer Module UX And Address Submission Fixes (2026-03-26)

This round focused on making customer management forms safer to submit and reducing accidental address-validation failures from the mobile frontend.

### Completed

- customer create/edit forms no longer treat the default country placeholder as a real address payload
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customer/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customer/[customerName].tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/customers.ts`
  - result:
    - creating a customer with only `customer_name` is now supported cleanly from mobile
    - frontend no longer sends `default_address` just because `country` had a default display value

- customer address payload construction is now stricter
  - address payload is only submitted when the user has entered meaningful address content
  - partial address input is blocked earlier with a clearer frontend error instead of relying on backend `Address` validation noise
  - current minimum rule for frontend submission:
    - `address_line1`
    - `city`
    - `country`

- customer list quick action card received a small alignment pass
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customers.tsx`
  - result:
    - icon and text block spacing was adjusted
    - subtitle visibility is still configurable in the component without changing page structure

### Why This Was Needed

- backend customer APIs already allow customer creation without an address
- mobile frontend previously made it too easy to accidentally send a half-filled address object
- that mismatch surfaced as ERPNext `Address` validation errors such as missing `city`

## Purchase Module Design Baseline (2026-03-26)

This round reviewed the current backend purchase documents and compared them with the already-landed sales v2 chain.

### Current Backend Reality

Backend purchase write-path APIs are already available:

- `myapp.api.gateway.create_purchase_order`
- `myapp.api.gateway.receive_purchase_order`
- `myapp.api.gateway.create_purchase_invoice`
- `myapp.api.gateway.create_purchase_invoice_from_receipt`
- `myapp.api.gateway.record_supplier_payment`
- `myapp.api.gateway.process_purchase_return`

Backend design and handoff documents confirm that these purchase actions already support:

- real HTTP validation
- `request_id` idempotency
- partial receiving
- partial invoicing from receipt
- partial purchase return from receipt
- price override checks around `Buying Settings.maintain_same_rate`

### Why Purchase Still Needs More Custom Interfaces

Sales v2 is not only using write APIs. It also depends on frontend-oriented aggregation interfaces such as:

- `get_sales_order_detail`
- `get_sales_order_status_summary`
- `get_delivery_note_detail_v2`
- `get_sales_invoice_detail_v2`
- `get_customer_sales_context`
- `quick_create_order_v2`
- `quick_cancel_order_v2`

Those interfaces were added because the frontend should not reconstruct business state by manually stitching together raw ERPNext documents.

Purchase has now reached the same architectural point.

If mobile purchase pages only call the current write APIs, the frontend will still need to guess or recompute:

- whether a purchase order is fully received
- whether it is partially invoiced
- whether payment is completed
- whether receipt or invoice can still be cancelled or returned
- which next action should be exposed to the user

That is the same problem the sales aggregation layer was created to solve.

### Recommended Purchase Interfaces To Add

First-priority aggregation/detail interfaces:

- `get_purchase_order_detail_v2`
  - for purchase-order detail page
  - for receive-confirmation page
  - for purchase-invoice confirmation page
- `get_purchase_order_status_summary`
  - for purchase list cards and status badges
- `get_purchase_receipt_detail_v2`
  - for receipt detail page
  - for return-confirmation page
- `get_purchase_invoice_detail_v2`
  - for purchase-invoice detail page
  - for supplier-payment confirmation page

Second-priority supplier context/master-data interfaces:

- `get_supplier_purchase_context`
  - purchase equivalent of `get_customer_sales_context`
  - should aggregate supplier basics, default contact, default address, and suggested defaults such as company / warehouse / currency
- `list_suppliers_v2`
- `get_supplier_detail_v2`

Third-priority purchase action interfaces:

- `cancel_purchase_order_v2`
- `cancel_purchase_receipt_v2`
- `cancel_purchase_invoice_v2`
- `cancel_supplier_payment_v2`

Optional later-stage convenience interfaces:

- `quick_create_purchase_flow_v2`
- `update_purchase_order_v2`
- `update_purchase_order_items_v2`

### Mobile Planning Implication

The purchase module should follow the same layered strategy as sales:

1. use the existing purchase write APIs as the workflow action layer
2. add purchase aggregation/detail APIs as the page data layer
3. only then complete the mobile purchase pages end-to-end

Recommended mobile page order:

1. purchase order create page
2. purchase order detail page
3. receiving confirmation page
4. purchase receipt detail page
5. purchase invoice confirmation / detail page
6. supplier payment page
7. purchase return page

### Working Rule

For purchase workflows, mobile should prefer backend-computed business semantics over raw ERPNext field assembly.

In practice this means:

- detail pages should consume purchase aggregation interfaces
- list pages should consume purchase status-summary interfaces
- action buttons should follow backend-returned allowed actions and hints
- frontend should avoid inferring purchase completion, invoicing, or payment state from raw DocType fields alone

## Purchase Frontend First Usable Flow (2026-03-28)

This round moved the mobile purchase module from "placeholder-level pages" into a first usable workflow set.

### Completed

- formal purchase workbench was added and aligned to the current mobile system language
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/purchase.tsx`
  - supports:
    - purchase entry and workbench overview
    - purchase order summary cards
    - purchase workflow shortcuts

- supplier selection page was added for purchase flows
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/supplier-select.tsx`
  - supports:
    - supplier search
    - return-to-flow selection
    - reuse by purchase order creation

- purchase order create page was rebuilt into a real grouped-entry workflow
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/order/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/order/item-search.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/purchase-order-draft.ts`
  - supports:
    - supplier + company + date + remarks entry
    - product search page feeding a persistent purchase draft
    - grouped item display by product instead of flat repeated rows
    - multiple warehouse rows under the same product group
    - image / total stock / warehouse stock / projected stock display
    - manual purchase-price override per warehouse row
    - UOM selection from product-aware options
    - supplier context display after item entry
    - submit-time scroll-to-first-invalid-section behavior similar to sales order create

- purchase order detail page was upgraded to consume backend aggregated order data
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/order/[orderName].tsx`
  - supports:
    - business status display
    - item summary
    - related receipt / invoice / payment references
    - next-action entry points

- downstream purchase action pages were moved beyond placeholders
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/receipt/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/invoice/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/payment/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/return/create.tsx`
  - result:
    - purchase receiving, supplier invoice, supplier payment, and purchase return pages now connect to the current purchase service layer instead of remaining static placeholders

- purchase service layer was formalized
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/purchases.ts`
  - now supports:
    - supplier search / detail / context
    - purchase order creation
    - purchase order / receipt / invoice detail reads
    - receiving / invoice / payment / return submission helpers
    - company-scoped warehouse search

### Important Current Rules

- purchase `company` means the internal company on our side, not the supplier
- selected warehouses must belong to the same internal company as the purchase order
- warehouse pickers on purchase pages now prefer company-scoped options instead of waiting for backend rejection at submit time
- if the company changes and existing warehouse rows no longer match that company, the frontend clears those warehouse values and requires reselection

### Current UX Direction

- product search page is responsible for selecting products and quick quantity entry
- warehouse splitting remains in the purchase order draft page, not in the search page
- one product group may contain multiple warehouse rows
- final payload is still expanded into backend-compatible purchase order item rows

### Current Boundaries

- purchase item entry now follows a grouped pattern, but the warehouse-row editor has not yet been extracted into a shared internal component
- company-aware warehouse filtering currently exists in purchase flows; other warehouse pickers in unrelated modules may still use generic link search
- purchase order update / edit-after-create behavior still needs future refinement if we later expose a richer in-place editing workflow on the detail page

## UOM Module Frontend (2026-03-26)

This round added a lightweight UOM master-data module for mobile, following the same "small but business-important" pattern as the product workbench.

### Completed

- formal UOM list page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/uoms.tsx`
  - supports:
    - keyword search by name / code / symbol
    - enabled status filter
    - whole-number rule filter
    - quick entry into detail / edit

- formal UOM create page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/uom/create.tsx`
  - supports:
    - UOM name
    - symbol
    - description
    - whole-number rule
    - enabled state

- formal UOM detail / edit page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/uom/[uomName].tsx`
  - supports:
    - usage summary display
    - symbol / description edit
    - enabled / disabled toggle
    - whole-number rule edit
    - delete with backend protection awareness

- service layer was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/uoms.ts`
  - now supports:
    - `fetchUoms()`
    - `fetchUomDetail()`
    - `createUom()`
    - `saveUom()`
    - `setUomDisabled()`
    - `deleteUom()`

- home entry was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`
  - homepage shortcuts now include a `单位` entry

### Current UOM Module Boundaries

- mobile only supports a lightweight business-facing UOM master-data experience
- rename is intentionally not exposed in frontend because backend does not support direct rename
- delete remains guarded by backend reference checks; frontend only surfaces the result more clearly

## Customer Module Frontend (2026-03-26)

This round added a lightweight customer master-data module for mobile so sales, invoicing and payment flows no longer depend only on ad-hoc customer lookup.

### Completed

- formal customer list page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customers.tsx`
  - supports:
    - keyword search by customer name / code / mobile / email
    - enabled status filter
    - lightweight search-result cards with only name / code / customer group / enabled status
    - enabled status fixed to the top-right corner of the card
    - quick entry into detail / edit

- formal customer create page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customer/create.tsx`
  - supports:
    - customer basic data
    - customer type
    - customer group / territory
    - default currency / default price list
    - default contact
    - default address

- formal customer detail / edit page was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customer/[customerName].tsx`
  - supports:
    - customer overview
    - default contact / address summary
    - basic data edit
    - default contact / address edit
    - enabled / disabled toggle

- customer service layer was expanded
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/customers.ts`
  - now supports:
    - `fetchCustomers()`
    - `fetchCustomerDetail()`
    - `createCustomer()`
    - `saveCustomer()`
    - `setCustomerDisabled()`
  - existing helpers remain available for sales order flow:
    - `searchCustomers()`
    - `customerExists()`
    - `fetchCustomerSalesContext()`

- legacy customer select placeholder was removed
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/customer-select.tsx`
  - now redirects into the formal customer module instead of staying as a placeholder page

- home entry was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`
  - homepage shortcuts now include a `客户` entry

### Current Customer Module Boundaries

- customer defaults remain "future order suggestions", not document snapshot truth
- order / delivery / invoice snapshot fields still belong to the document itself
- mobile customer module is intentionally business-master-data focused, not a CRM pipeline module
- customer list cards should stay lightweight
  - contact, address, and default price list belong to detail view instead of search-result cards
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
  - save flow no longer silently rewrites stock base UOM back to retail UOM
  - both wholesale and retail conversion factors are now validated against the current stock base UOM before save
  - stock-base editing now also supports:
    - `manual`
    - `sync with wholesale`
    - `sync with retail`
  - in sync modes, the editor hides the redundant rule row and only keeps the side that still needs explicit conversion input
  - rule rows were refactored into formula-like single-line layouts instead of the earlier three-block stacked presentation

- product detail read-only messaging was updated
  - inventory wording now makes it explicit that:
    - inventory truth = `stock_uom`
    - wholesale / retail = default transaction UOMs
  - the old "inventory defaults to retail UOM" wording was removed

- product detail rule summary now follows draft values in edit mode
  - changing stock base UOM / wholesale UOM / retail UOM immediately updates the rule summary instead of continuing to show stale `detail.*` values

- sync-mode safety was tightened
  - switching stock-base sync mode no longer blindly keeps old factors that belonged to the previous base UOM
  - the remaining editable side is reset to a re-confirm state when needed
  - formula preview text is used to keep the direction readable for operators, especially in wholesale-sync mode
  - create page and detail page now share the same sync-mode behavior so operators do not have to relearn unit rules between "new product" and "edit product"

- required-field signaling was aligned across create and detail editors
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/product-form-controls.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
  - key required fields now show a red `*` directly in the field title before the operator starts typing
  - conditional rule rows also show the same marker when the current sync mode means an explicit conversion is required
  - this reduces trial-and-error on mobile and helps operators fill the minimum valid product data faster

- a real backend constraint was confirmed during manual testing
  - once an item already has historical transactions under an existing unit system, backend validation may reject direct stock/default-UOM changes
  - the mobile frontend currently surfaces that backend validation message directly
  - this is a business-safety restriction, not a frontend-only bug

### Resulting Frontend Rule

- `stock_uom` is the inventory truth
- `wholesale_default_uom` is only the default wholesale transaction UOM
- `retail_default_uom` is only the default retail transaction UOM
- any default transaction UOM that differs from `stock_uom` must provide a conversion path back to `stock_uom`
- when stock base is synced to wholesale or retail, only the opposite side should continue asking for explicit conversion input

## Cross-Document UOM Display Rule (2026-03-25)

After the backend inventory rule was confirmed again, frontend display logic also needs a stable shared rule:

- system truth:
  - inventory always settles in `stock_uom`
- business-facing display:
  - operators and customers may still read quantities in wholesale / retail transaction UOMs
- frontend must not let every page invent its own wording for:
  - line UOM summary
  - quantity totals
  - warehouse remaining stock
  - entry-to-stock conversion hints

### Shared Display Layer

- a shared display helper was added:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/uom-display.ts`
- it centralizes:
  - line unit summary
  - entry-to-stock conversion summary
  - stock reference summary
  - warehouse remaining stock display
  - quantity-summary wording for grouped rows and page-level totals

This avoids repeating slightly different logic in:

- sales order create
- sales order detail
- later purchase order pages
- later delivery / invoice / receipt detail pages

### Document Granularity Rule

Not every document should expose warehouse and UOM detail at the same level.

- sales order:
  - keep `item + warehouse` split lines
  - this is an internal execution and checking document
  - warehouse detail must remain visible for editing and fulfillment reasoning

- delivery note:
  - default recommendation is "product summary + warehouse detail retained"
  - warehouse still matters for internal fulfillment
  - customer-facing printable delivery views may hide warehouse as a later variant

- sales invoice:
  - should prefer customer-facing product aggregation
  - warehouse is internal execution detail and should not be the main invoice row identity

### Aggregation Rule

- same product rows may only be safely merged into one formal display row when commercial meaning still matches
- at minimum, merge candidates should keep the same:
  - item
  - UOM
  - rate
  - tax / discount semantics if those are part of the page

- if UOM differs, do not force a mathematical regrouping into another unit
  - example:
    - keep `100 箱 + 50 瓶`
    - do not rewrite it into `102 箱 2 瓶`

The reason is:

- stock conversion is for internal settlement
- customer-facing quantity display should preserve the original transaction facts

So:

- internal stock reasoning:
  - can convert to `stock_uom`
- outward or customer-readable quantity summary:
  - should preserve the original recorded transaction UOMs

### Why This Matters

- it matches the backend validation added on 2026-03-25
- it prevents the mobile UI from teaching operators the wrong unit mental model
- it gives the order module a cleaner source of truth for later inventory / remaining-stock display refinements
- it avoids letting the mobile editor silently generate misleading conversions after stock-base mode changes

## Sales Order Edit Polish (2026-03-24)

This round focused on reducing confusion in the mobile sales-order detail page after backend UOM conversion and stock validation were tightened.

### Background

- backend order creation / order-item update / delivery now consistently convert `qty + uom` into stock-facing values
- the mobile detail page therefore needs to make the "business UOM vs stock UOM" distinction clearer for operators
- at the same time, the combined "save all" path on the order detail page still had a parameter gap:
  - item-level `salesMode` was not forwarded during the combined save flow

### Completed

- fixed the combined order save path
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
- `handleSaveAll()` now forwards item-level `salesMode` together with:
    - `qty`
    - `uom`

## Product Search And Mobile Typography Polish (2026-03-24)

This round focused on the mobile product-search page used during sales order item selection.

The work had two goals:

- make the add-item flow more suitable for a multi-warehouse order-entry scenario
- correct several UI decisions that looked acceptable on desktop inspection but were too small or too dense for an actual phone app

### Completed

- product-search warehouse filtering and selection were expanded
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
  - supports:
    - warehouse filtering
    - explicit `全部仓库` entry
    - in-stock-only toggle
    - per-product warehouse switching before adding into the draft

- product-search card information hierarchy was rebuilt
  - item search cards now prioritize:
    - product name
    - current warehouse
    - total stock
    - wholesale / retail prices
    - current warehouse picker
    - total selected quantity
    - current-warehouse quantity action
  - low-value repeated hints were removed where they duplicated information already visible in the warehouse selector or right-side action area

- pricing display was changed from compressed pills to more readable inline price rows
  - `批发价` and `零售价` are now easier to scan
  - price amount is visually stronger than descriptive text
  - warehouse selector now explicitly shows:
    - `该仓库库存：xx`

- several child-page return paths were made explicit instead of depending on browser/app history
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/preview.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/payment/create.tsx`
  - this avoids the common failure mode where:
    - the user refreshes a subpage
    - navigation history is lost
    - `router.back()` returns to the app home page instead of the real business source page

### Mobile UI Rule Clarified

`myapp-mobile` is a phone app, not a desktop admin page squeezed into a mobile frame.

Going forward, typography and spacing should follow these rules:

- key operational text must be sized for direct phone reading
  - examples:
    - product name
    - current warehouse
    - total selected quantity
    - current warehouse quantity label
    - price amount
- avoid desktop-style tiny helper labels for core business information
- if an operator must make a decision based on a piece of text, that text should not be visually treated like metadata
- repeated small labels are worse than one clear, larger label in the correct place
- prefer fewer blocks with stronger hierarchy over many small pills or low-contrast helper rows

In short:

- mobile business UI should optimize for thumb-speed scanning on a phone
- not for fitting the maximum possible number of labels into one card

### Problems Encountered In This Round

- product-search page originally over-relied on repeated helper text
  - the same quantity meaning appeared in several positions
  - users could not quickly distinguish:
    - total selected quantity
    - current warehouse quantity
    - warehouse stock quantity

- warehouse filtering had an implicit "all warehouses" behavior
  - technically leaving the field empty already searched all warehouses
  - but this was not obvious in the UI
  - explicit options were needed

- several return flows depended on history state instead of business source context
  - this became visible after page refresh during testing

### Current Recommended Next Steps

1. continue checking other order-related child pages for refresh-safe return behavior
2. keep reducing low-value helper text in product-search cards if it does not support a real operator decision
3. maintain phone-first typography when adding new sales and purchase pages
    - `price`
    - `warehouse`
  - this keeps the "save all" path aligned with the dedicated item-save path

- clarified unit messaging in the order detail page
  - each item row now shows a clearer line-level summary such as:
    - current entry mode
    - current sales UOM
    - stock-settlement UOM
  - this is meant to reduce the "did I enter boxes or pieces?" ambiguity during final order confirmation

- removed the misleading fixed `件` summary from order totals
  - the order summary no longer assumes all lines share the same UOM
  - when multiple UOMs are present, the page now explicitly tells the operator to confirm quantities line by line

- kept amendment navigation continuity explicit
  - when item replacement generates a new amended order, the detail page continues to redirect to the returned order name
  - this remains important because `update_order_items_v2` may cancel the original submitted order and create a new amended one

### Problems Addressed

- fixed-unit summary text was misleading in mixed `Box / Nos` scenarios
- operators could see correct line UOMs but still see an incorrect page-level "total X 件" summary
- combined save and single-section save were not fully aligned in the parameters they sent to the backend

### Validation

- lint passed for the edited order detail screen:

```bash
cd /home/rgc318/python-project/frappe_docker/frontend/myapp-mobile
npm run lint -- app/sales/order/[orderName].tsx components/sales-order-item-editor.tsx
```

### Recommended Next Steps

1. make line-level quantity / amount changes more visually obvious after switching sales mode
2. consider showing a stronger stock-settlement hint only for lines where `uom !== stockUom`
3. continue reviewing the product-search to order-detail handoff, but keep unit confirmation centered on the order page rather than the search page
- warehouse stock is currently shown as:
  - total stock
  - current warehouse
  - top warehouse breakdown preview
- product detail edit can now adjust current warehouse stock directly
  - frontend edits a single numeric target value for the currently selected warehouse
  - backend computes the quantity delta and writes a formal stock adjustment entry
  - this is not a direct `Bin` table overwrite
- order-side "select product and warehouse together" interaction is still a later phase
- product-search page still remains the fast lookup / add-to-order tool
- product workbench is now the management entry, not a replacement for sales-order product search

## Product Detail Refinement (2026-03-22)

This round focused on turning the product detail page from a basic CRUD form into a more practical mobile management page, while keeping the current backend contract unchanged.

### Completed

- inventory area was rebuilt around a single current-warehouse context
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
  - current page behavior now prefers:
    - one selected warehouse
    - one target stock input
    - one delta preview
  - this avoids the earlier confusion where users could see multiple warehouses and misread which warehouse the input was editing

- warehouse switching was changed from inline dropdown/chip sprawl to a dedicated picker flow
  - warehouse switching now uses a bottom-sheet style modal with:
    - search
    - scrollable list
    - separation between stocked warehouses and other selectable warehouses
  - invalid warehouse choices such as `All Warehouses` style group nodes are filtered out on the frontend

- product detail inventory information was consolidated
  - the old top-level stock summary cards were removed
  - stock-related information is now concentrated in the `库存` module
  - total stock, current warehouse stock, stock unit, and warehouse switching all live in one area

- dangerous actions were moved away from the main edit flow
  - enable / disable is no longer placed near common edit actions
  - the product disable action now lives in a dedicated danger area near the bottom of the page

- wholesale / retail UOM editing was upgraded from free-text input to controlled selection
  - product detail now opens a dedicated UOM picker instead of relying on free typing
  - UOM choices prefer the product's own `all_uoms`
  - global `UOM` options are still used as supplemental candidates

- core product master data editing was expanded
  - product detail and product create now support:
    - item group selection
    - brand selection
    - primary barcode editing
  - item group / brand now use searchable master-data pickers instead of free typing
  - barcode remains a direct text field because it is business input rather than a shared link master

- existing UOM display mapping was reused instead of duplicating new logic
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/display-uom.ts`
  - product detail now uses the same display mapping as the order pages
  - examples:
    - `Box -> 箱`
    - `Nos -> 件`

- UOM conversion data already returned by backend is now surfaced on the page
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/products.ts`
  - product service now preserves `conversion_factor` from `all_uoms`
  - product detail can now show business-readable conversion hints such as:
    - `1 箱 = 12 件`
    - `库存按 件 记账`

### Clarified Product-Page Rules

- product detail inventory editing remains single-warehouse adjustment
  - one save only updates one warehouse target stock
  - this matches the current backend `warehouse + warehouse_stock_qty` contract

- stock/base UOM is not treated as the same thing as wholesale / retail default UOM
  - stock/base UOM is the inventory bookkeeping unit
  - wholesale / retail UOM are business-facing default transaction units

- the current page intentionally weakens stock/base UOM in the visual hierarchy
  - the field still matters for inventory reasoning
  - but it should not dominate the business-facing product management flow

### Current Boundaries After This Round

- product detail can display UOM conversion information, but cannot yet edit conversion factors
- product detail still does not support editing `stock_uom`
- product create page still uses an older UOM-input experience and is now behind the updated detail page in unit handling
- category / brand / barcode are now available in both product detail and product create
- variant / batch-expiry / reorder controls are still not fully integrated into the mobile product workbench

### Recommended Next Steps

1. align the product create page with the current detail-page UOM picker experience
2. design a formal `单位与换算` module instead of only showing conversion hints
3. evaluate product-spec / variant support for size-capacity scenarios such as `500ml / 750ml / 1L`
4. continue integrating ERPNext item master capabilities such as reorder, batch, and expiry controls

## Frontend Alignment Summary (2026-03-18)

This round completed the main frontend migration for product detail and sales-order detail editing on top of the new backend v2 interfaces.

### Completed

- product detail page now uses product v2 interfaces
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
  - reads:
    - `get_product_detail_v2`
  - writes:
    - `update_product_v2`
  - formal product nickname is now treated as first-class data instead of only relying on description fallback

- sales-order detail page now uses the v2 edit/cancel flow
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
  - saves order header through:
    - `update_order_v2`
  - saves item changes through:
    - `update_order_items_v2`
  - cancels order through:
    - `cancel_order_v2`
  - page structure was rebuilt around:
    - order overview
    - delivery/contact snapshot
    - item list
    - settlement
    - order remark

- product selection in order-detail edit mode now follows the same mental model as create-order
  - product search is no longer rendered inline inside the order detail page
  - order detail now jumps to the dedicated product search page:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
  - this keeps create-order and edit-order on the same interaction pattern

- scoped draft support was added for order-item editing
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/sales-order-draft.ts`
  - draft storage now supports an optional scope key
  - create-order continues to use the default scope
  - order-detail edit uses a dedicated scope such as:
    - `order-edit:<orderName>`
  - this prevents order-detail edits from polluting the create-order draft

- mobile default backend URL was updated for the standalone LAN proxy path
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/config.ts`
  - current mobile default:
    - `http://192.168.31.63:18081`
  - web default remains:
    - `http://localhost:8080`

### Important Interaction Detail

When order-detail edit mode opens the dedicated product-search page, returning from search must use browser/navigation back behavior instead of pushing a fresh order-detail route.

Reason:

- order-detail uses focus-based scoped-draft synchronization
- if product-search returns with `router.push(...)`, a new detail page instance is created
- the original editing page does not regain focus in the expected way
- item additions then appear to be "not synced back"

Current rule:

- order-mode product search returns with:
  - `router.back()`
- order-detail still refreshes backend detail on focus
- but if item-edit mode is active and scoped draft already exists
  - the page now prefers draft items over the freshly fetched server list
- this prevents:
  - added products disappearing after returning from product search
  - quantity changes being silently reset by the follow-up detail request

This detail is important and should be preserved if order-product search flow is refactored again later.

### Current Known Boundaries

- order-detail item editing is now aligned to the dedicated product-search workflow, but the create-order page and order-detail page still do not share a fully extracted common item-editor component
- legacy helpers still exist in some older modules even though core detail flows are now on v2
- delivery / invoice / payment pages still need similar contract cleanup later

## Address Display Refinement (2026-03-20)

This round tightened how customer shipping addresses are carried into mobile order and document pages.

### Problem

- backend customer context may return ERP-style `address_display`
- that string can contain:
  - street address
  - city / province
  - postcode
  - country
  - phone / email
- directly showing or re-submitting the full display string made mobile pages look noisy and duplicated data that is already shown in dedicated contact fields

Typical bad result on mobile:

- `北京市朝阳区测试客户路 100 号`
- `北京`
- `100000`
- `China`

### Current Rule

- if structured address fields exist, mobile now prefers:
  - `address_line1`
  - `address_line2`
- `address_display` is now only a fallback source
- fallback display is compacted to the address body only
- phone, email, postcode, country, and standalone city/province lines should not appear inside the mobile `收货地址` field

### Affected Flows

- sales order create
- customer sales context default address
- recent address chips
- sales order detail
- delivery note detail
- sales invoice detail

### Intent

Mobile business pages should treat `收货人` / `联系电话` / `收货地址` as separate fields.

For mobile display, `收货地址` should read like a usable street address, not like the full ERP print-format address block.

## Sales Flow Acceptance Snapshot (2026-03-20)

This section is the current acceptance snapshot for the mobile sales chain:

- sales order create
- sales order detail and edit
- delivery confirmation / delivery detail
- sales invoice detail / preview
- payment collection

### Current Overall Judgment

The sales chain is now basically feature-complete for the main path and has moved from "prototype / contract alignment" into "acceptance and finish-up".

Current practical status:

- usable for end-to-end demonstration and continued backend integration
- most major screens and write actions are already connected to the v2 / gateway path
- still needs one focused acceptance pass before it should be treated as fully stabilized

### Confirmed Implemented

- sales order create
  - customer sales context default loading is connected
  - recent address reuse is connected
  - shared draft and product search return flow are connected
  - order submit uses `create_order_v2`

- sales order detail
  - detail read uses `get_sales_order_detail`
  - header edit uses `update_order_v2`
  - item edit uses `update_order_items_v2`
  - cancel uses `cancel_order_v2`
  - order page no longer directly executes delivery / invoicing writes from the top-right action

- delivery flow
  - order page now routes into a delivery confirmation page first
  - delivery submit uses `submit_delivery`
  - inventory-insufficient flow now escalates into explicit forced delivery handling
  - main action is fixed in the footer for long-document scenarios

- sales invoice flow
  - order page now routes into invoice creation / detail flow instead of directly executing write logic
  - invoice source order is locked when entered from an existing source document
  - invoice page now behaves more like a printable invoice preview instead of another generic card page
  - a dedicated preview route exists for later print / PDF integration

- payment flow
  - payment page uses `update_payment_status`
  - payment result handoff is connected back into order / invoice pages
  - writeoff and unallocated amount feedback is already shown in the mobile flow

- address and document readability
  - shipping address display was compacted to street-address content
  - order / delivery / invoice pages now avoid showing the full ERP-style address display block

### Acceptance Items Still Recommended

These items should be manually walked through in one continuous business run:

1. create a new sales order with customer defaults
2. edit order header and order items
3. submit delivery normally
4. trigger insufficient inventory and verify forced delivery behavior
5. create sales invoice from the order / delivery context
6. record a partial payment
7. record a full payment or writeoff
8. re-open order and invoice pages to confirm status aggregation is refreshed correctly

### Main Gaps Before Calling It "Fully Finished"

- print is not fully real yet
  - invoice preview structure exists
  - real system print / PDF / share chain is not fully wired yet

- unsaved-change protection is still worth adding
  - deep edit / confirmation pages can navigate away more easily than a production-hardened ERP-style mobile app would usually allow

- exceptional-state acceptance is still needed
  - duplicate action attempts
  - canceled document follow-up behavior
  - network failure and retry behavior
  - long item lists and long remarks

- automation coverage is still light
  - current confidence comes mainly from implementation review and lint validation
  - the sales chain still benefits from a structured manual acceptance script or future E2E coverage

### Suggested Next Work Order

1. run one full manual acceptance pass across create -> delivery -> invoice -> payment
2. fix the concrete issues found in that pass instead of adding more new UI first
3. connect real invoice print / PDF / share capability
4. add unsaved-change protection for edit-heavy pages if the acceptance pass shows users are still getting lost

## Sales Address And Payment Follow-up (2026-03-20)

This round closed the remaining gaps that were still visible after the first sales-flow acceptance pass.

### Final Address Rule On Mobile

For the mobile app, the shipping address model is intentionally simple:

- customer default address is only a suggestion source
- switching customer may auto-fill the current order form once
- after that, the order shipping address is treated as independent order data
- downstream delivery / invoice / payment pages should rely on the order or document snapshot returned by backend
- frontend should not try to re-derive document address from customer profile once the order already exists

### Current Frontend Behavior

- create-order page
  - auto-fill only happens when `customer` actually changes
  - later typing in `收货人 / 联系电话 / 收货地址` should not be overwritten by unrelated state updates
- order detail page
  - single-section contact save and full-page edit save now both expect backend to preserve the same order address snapshot
- delivery / invoice detail pages
  - display the backend document snapshot
  - do not locally fall back to customer default address

### Payment Entry Param Compatibility

Sales payment create page now accepts both of the following navigation shapes:

- order-detail style
  - `referenceName`
  - `defaultPaidAmount`
  - `currency`
- invoice-detail style
  - `salesInvoice`
  - `amount`
  - `currency`

Purpose:

- older and newer entry points can both prefill the invoice number and suggested amount
- frontend does not need temporary route-specific hacks while sales pages are still converging toward one convention

### Recommended Next Cleanup

- later unify all sales payment entry points to one parameter convention
- keep the current compatibility layer until all call sites are migrated

### Order-Detail Follow-up Notes

Additional follow-up work after the first v2 alignment focused on making the order-detail product-edit experience safer and easier to understand.

- amendment flow messaging
  - when submitted-order item changes trigger `update_order_items_v2`, the backend may cancel the original order and create a replacement order

## Order-Detail Interaction Update (2026-03-19)

This round continued refining the mobile sales-order detail page interaction model.

### Main Interaction Decisions

- keep workflow actions away from the bottom primary action area
  - delivery / invoicing actions now live in the top-right action slot
  - this avoids the common mobile misunderstanding where the largest bottom button is assumed to mean "save"

- restore a bottom-level order-edit entry
  - non-edit mode bottom actions are now:
    - `作废订单`
    - `编辑订单`
  - this keeps the page aligned with common mobile habits where the main bottom-right button is the main edit entry

- keep section-level edit affordances
  - each editable block still keeps its own local `修改` entry:
    - delivery/contact snapshot
    - sales items
    - order remark
  - these entries allow focused partial edits without forcing the whole page into edit mode

- support full-order edit from the bottom button
  - `编辑订单` now enters a true all-section edit state
  - it enables:
    - contact / address / delivery-date editing
    - item editing
    - remark editing
  - the bottom bar then switches to:
    - `取消修改`
    - `保存修改`

- bottom save now represents the active edit context correctly
  - if the user entered edit through one local module, bottom save only saves that module
  - if the user entered edit through `编辑订单`, bottom save performs a full-order save:
    - `update_order_v2`
    - then `update_order_items_v2`
  - amendment replacement behavior is preserved when item updates require a new order revision

### Why This Was Chosen

- fully section-only editing made the page feel fragmented and removed the expected main edit entrance
- fully global editing made it too easy to confuse edit/save actions with workflow actions such as delivery
- the adopted hybrid model matches the current backend split better:
  - order-header updates
  - order-item updates
  - workflow actions

### Current Order-Detail UX Rule

- top-right:
  - workflow action such as `出货` / `开票`
- section header:
  - local `修改`
- bottom in browse mode:
  - `作废订单`
  - `编辑订单`
- bottom in edit mode:
  - `取消修改`
  - `保存修改`

This rule should be preserved unless the whole order-detail IA is redesigned again.

## Roll Back And Edit (2026-03-20)

The order-detail page now treats downstream documents as an edit blocker that can be actively resolved from the same screen.

### Current rule

- if the order has no delivery note, invoice, or payment:
  - the bottom primary action remains `编辑订单`
- if the order already has downstream documents:
  - the bottom primary action switches to `回退并修改`
  - tapping it opens a centered explanation dialog
  - the dialog explains which downstream documents will be rolled back in order:
    - payment entry first, when present
    - sales invoice next, when present
    - delivery note last, when present
- after rollback succeeds:
  - the page does not leave the user on a blocked order state
  - it directly enters the all-section edit mode on the same order page
- the same rollback rule now also applies to section-level edit entries:
  - `收货与联系人 -> 修改`
  - `销售商品 -> 修改商品`
  - `订单备注 -> 修改`
  - these local actions no longer stop at a dead-end warning dialog
  - after rollback succeeds, each action returns to its own corresponding edit context instead of always forcing full-page edit

### Why this matters

- the user intent at that moment is usually not "manage history documents"
- the real goal is "remove blockers and continue editing the order"
- moving rollback into the edit entrance is more direct than forcing users to visit invoice and delivery pages one by one
  - the frontend should not present this as "save turned the order into a cancelled order"
  - current behavior:
    - the detail page now shows a clearer amendment message when a new order is generated
  - the document query list also hides cancelled sales orders from the normal default flow so voided historical documents do not mix with active working orders

- contact editing fix
  - custom receiver names must not be written into ERPNext `contact_person` link fields unless they actually refer to a real Contact record
  - order-detail save flow now only sends display name / phone / address snapshot for ad-hoc receiver edits
  - this avoids validation errors such as:
    - `找不到联系人: 张三213`

- item editor interaction cleanup
  - the quick action inside order-detail now clearly points users to the dedicated product-search page instead of rendering inline search results
  - quantity editing now uses a `- / input / +` stepper pattern
  - browsing mode and editing mode are intentionally different:
    - browsing mode:
      - light dividers between items inside one section card
    - editing mode:
      - each item is visually grouped as its own card
  - this reduces the chance that users confuse one product's quantity/price/unit with the next product

- current unit editing status
  - backend already provides `uom` and `all_uoms` in product search/detail responses
  - order create/update requests also accept `uom`
  - frontend order-detail editor now supports simple unit switching for items with multiple available units
  - however, full unit + pricing linkage is still not a complete business model yet
  - open question for later:
    - whether unit changes should also auto-recalculate price and quantity using conversion factors

### Recommended Next Steps After This Round

1. extract a shared sales-item editor component for create-order and order-detail
2. continue removing old direct `frappe.client.*` usage from legacy service modules
3. align downstream sales pages such as delivery and invoice to the same v2 pattern

## Business Document Flow Update (2026-03-19)

This round further aligned the order-detail page with the actual ERP-style downstream document flow.

### Backend-aligned order-detail behavior

- sales-order detail now consumes downstream document references from the backend
  - `references.delivery_notes`
  - `references.sales_invoices`
- frontend detail mapping now exposes:
  - `deliveryStatus`
  - `deliveryNotes`
  - `salesInvoices`
  - `latestDeliveryNote`
  - `latestSalesInvoice`

### Workflow rule in the order-detail page

- after shipping succeeds
  - the page should no longer continue showing `出货`
  - it should instead surface the generated delivery note and move the next primary action forward
- after invoicing succeeds
  - the page should no longer continue showing `开票`
  - it should instead surface the generated sales invoice
  - the next primary action should become `收款`

### Current mobile implementation

- top-right action now follows the real workflow priority:
  - `出货`
  - `开票`
  - `收款`
  - `查看发票`
  - `查看发货单`
- order-detail now includes a dedicated `业务单据` section
  - latest delivery note is shown there
  - latest sales invoice is shown there
- after successful shipping from order-detail
  - mobile navigates to:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
  - the generated delivery note number is passed as navigation context
- after successful invoicing from order-detail
  - mobile navigates to:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - the generated sales invoice number and source order are passed as navigation context
- when payment is the next step
  - mobile jumps to:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/payment/create.tsx`
  - the current sales invoice number is prefilled

### Current implementation

- `/sales/delivery/create` now serves dual purpose:
  - create-success landing surface after shipping
  - delivery-note detail page when `deliveryNote` is present in route params
- `/sales/invoice/create` now serves dual purpose:
  - create-success landing surface after invoicing
  - sales-invoice detail page when `salesInvoice` is present in route params
- both pages now read backend aggregate APIs instead of acting as pure placeholders:
  - `get_delivery_note_detail_v2`
  - `get_sales_invoice_detail_v2`
- current backend compatibility note:
  - if invoice creation still happens from `Sales Order` instead of directly from `Delivery Note`
  - document detail pages now rely on backend fallback references by source order
  - this keeps `查看发票` on the delivery-note page and `查看发货单` on the invoice page usable even without direct `dn_detail` linkage

### Current limitation

- mobile still does not have a dedicated document list or print action for delivery notes and sales invoices
- current design prioritizes:
  - document content viewing
  - returning to the source order flow
  - continuing payment flow
- later iterations can still split these dual-purpose routes into separate detail/read pages if printing and audit browsing become first-class requirements

## Create-Order Handoff Update (2026-03-19)

The create-order page should not remain the main working surface after a sales order is successfully created.

### Current rule

- after `create_order_v2` succeeds
  - mobile now reads the returned order number
  - clears the local create-order draft
  - immediately navigates to the created order detail page
- this keeps the user on the real downstream workflow path:
  - review order detail
  - ship
  - invoice
  - collect payment

### Why this matters

- keeping the user on `/sales/order/create` after success looks like the order is still only a draft form
- downstream workflow actions belong to the order detail page, not the create form
- clearing the draft avoids stale goods remaining in local state when the user returns later

## Payment Page UX Update (2026-03-19)

The sales payment page was refined to reduce mis-entry risk and make the result of payment submission much more explicit.

### Amount input behavior

- the page now shows `应收金额` as a business label, not an implementation-oriented "default amount"
- the real outstanding amount is prefilled into `本次实收金额`
- users may enter a smaller amount for partial collection
- users may not submit an amount greater than the receivable amount
- if the user types an amount greater than receivable
  - the value is automatically corrected back to the receivable amount
  - a visible helper card explains:
    - the collected amount cannot exceed receivable
    - the page has auto-corrected the number
- when the amount differs from receivable but is still valid
  - the page keeps a persistent warning card explaining that this changes settlement behavior
- when the user submits a mismatched-but-valid amount
  - a centered confirmation dialog is shown before final submission

### Submission result behavior

- payment submission no longer relies only on top toast feedback
- success now shows a centered success dialog
  - after confirmation, the page returns to the source screen
- failure now shows a centered error dialog
  - the user stays on the payment page and can keep editing

### Settlement result behavior

- the payment page now distinguishes four outcomes:
  - full collection
  - partial collection
  - under-collection with write-off settlement
  - over-collection with unallocated amount
- order detail should not treat `paid_amount` as the only display truth
- the preferred order-detail display fields are now:
  - `payment.actual_paid_amount`
  - `payment.total_writeoff_amount`
  - `payment.latest_unallocated_amount`
- this keeps `实收金额` separate from:
  - `核销金额`
  - `额外收款`
  - `未收金额`

### Payment mode behavior

- payment modes are still backed by ERPNext `Mode of Payment`
- the page now uses a two-level interaction:
  - featured payment modes as quick buttons
    - currently favors:
      - `微信支付`
      - `现金`
      - `支付宝`
  - `额外支付方式` as the fallback selector
- default selection now prefers `微信支付`
- display labels are localized in mobile UI while preserving ERPNext raw values for submission
  - examples:
    - `Cash -> 现金`
    - `Wire Transfer -> 银行转账`
    - `WeChat Pay -> 微信支付`
    - `Alipay -> 支付宝`

### Current operational assumption

- adding new payment modes is still handled as ERPNext master data management
- the payment page should only select existing payment modes, not create them on the fly

## Forced Delivery Notes (2026-03-20)

The order-detail page now treats stock-shortage failures as a business decision point instead of a dead-end generic error.

### Current rule

- normal `出货` still follows strict stock validation
- when shipping fails because of available-stock shortage
  - the page shows a centered warning dialog instead of only a top toast
  - the dialog explains this is a high-risk action
  - the user can choose `强制出货`
- forced delivery is not exposed as a default top-level button
  - it only appears after a stock-shortage failure path

### Why this matters

- normal users should not casually bypass stock discipline
- some real-world warehouse scenarios still require urgent shipment before stock bookkeeping catches up
- the current interaction keeps the safe path as default while still letting privileged users proceed when necessary

## Quick Create With Forced Delivery (2026-03-20)

The create-order page now uses the same risk-handling principle for `快速开单`.

### Current rule

- `快速开单` remains the default fast path:
  - create order
  - auto submit delivery note
  - auto create sales invoice
- when quick create is blocked by stock shortage:
  - the page does not silently fall back
  - it shows a centered confirmation dialog with the backend stock-shortage reason
  - the user can choose:
    - `返回检查`
    - `强制出货并开票`
- the second step retries quick create with `force_delivery=1`

### Why this matters

- frequent operators keep the one-tap fast path when stock is normal
- dangerous stock bypass is still hidden behind an explicit failure and confirmation step
- the mobile UI now keeps `快速开单` and manual `出货` aligned under the same forced-delivery business rule

## Customer Context Notes (2026-03-20)

The create-order page now handles customer defaults more defensively.

### Backend source of truth

- `get_customer_sales_context` remains the backend source for:
  - default contact
  - default address
  - recent addresses
  - suggested company and warehouse

### Frontend fallback

- the create-order page no longer assumes `defaultAddress.addressDisplay` is always populated
- if `addressDisplay` is empty, the page now builds a readable shipping address from:
  - `addressLine1`
  - `addressLine2`
  - `city`
  - `county`
  - `state`
  - `country`
  - `pincode`
- this avoids blank shipping-address textareas when ERPNext address master data only has structured address fields

### Current local QA data

For current local testing, the following customers were manually supplemented with linked primary contacts and shipping addresses:

- `Palmer Productions Ltd.`
- `West View Software Ltd.`
- `Grant Plastics Ltd.`

These records now carry:

- linked primary contact
- linked primary shipping address
- default contact phone
- default contact email

## Local Android Build Notes

If the team wants to produce a local Android development APK instead of using Expo Go:

### What should be ready before packaging

- Node.js
  - current project should preferably use Node 20+
- npm dependencies
  - run `npm install` in `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile`
- JDK
  - recommended: JDK 17
  - current local setup used `sdkman`
- Android SDK
  - for WSL-local packaging, install Android command-line tools, platform-tools, build-tools, platforms, and CMake in WSL
- required system packages in WSL
  - `zip`
  - `unzip`

### Current recommended local packaging route

This project can be packaged fully inside WSL. The recommended sequence is:

1. install and switch Java
   - recommended tool: `sdkman`
   - current verified version: `Temurin 17`

2. generate the native Android project
   - `npx expo prebuild -p android`
   - note:
     - this only generates the `android/` project
     - it does **not** output an APK by itself

3. install Android SDK components in WSL
   - Android command-line tools
   - `platform-tools`
   - `platforms;android-36`
   - `build-tools;36.0.0`
   - `cmake;3.22.1`

4. point the Android project to the SDK path
   - file:
     - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/local.properties`
   - current WSL example:
     - `sdk.dir=/home/rgc318/Android/Sdk`

5. build the debug APK
   - `cd android`
   - `./gradlew assembleDebug`

6. expected APK output
   - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### Example environment variables for WSL

Before running `sdkmanager` or `./gradlew`, the following environment is recommended:

```bash
export JAVA_HOME="$HOME/.sdkman/candidates/java/current"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

### Minimal command reference

Generate native Android project:

```bash
cd /home/rgc318/python-project/frappe_docker/frontend/myapp-mobile
npx expo prebuild -p android
```

Build debug APK:

```bash
cd /home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android
./gradlew assembleDebug
```

Check output:

```bash
ls -l /home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build/outputs/apk/debug/
```

### Proxy and network notes

- Gradle/JVM network access should not be assumed to automatically follow browser, Windows system proxy, or Node/Expo proxy behavior
- even if `npm install` works, Gradle may still fail to download:
  - Gradle distribution
  - Maven dependencies
  - Android SDK components
- for this project, proxy settings may need to be configured explicitly in:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/gradle.properties`
- typical configuration example:

```properties
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=10808
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=10808
systemProp.org.gradle.internal.http.connectionTimeout=120000
systemProp.org.gradle.internal.http.socketTimeout=120000
```

- in mixed Windows + WSL environments, `127.0.0.1` may or may not be correct
- if Gradle still cannot connect, verify whether the proxy process is actually reachable from WSL

### Expo start modes and what they actually mean

The mobile team should clearly distinguish the following modes:

1. Expo Go mode
   - generic Expo client
   - useful for quick preview
   - not the same as an installed development build

2. development build mode
   - a project-specific development client installed on the phone
   - opening the app does not mean a standalone release build is ready
   - it still needs to connect to the Metro development server

3. local APK / release-style packaging
   - generated from Gradle
   - intended to become closer to a standalone installable package

### `expo start` command expectations

- `npm run start` currently maps to `expo start`
- in this project, `npm run start` and `npx expo start` are equivalent in purpose
- if the CLI says:
  - `Using development build`
  - then the installed mobile app is acting as a development client and still expects a Metro connection

### LAN vs localhost vs tunnel

- `Web is waiting on http://localhost:8081`
  - this is for the browser on the current machine
  - it does not mean the phone should use `localhost`

- development build connection strings may include a LAN address such as:
  - `http://192.168.x.x:8081`
  - this is the address the phone tries to reach for the Metro server

- if the current machine can open `http://localhost:8081` but cannot open `http://192.168.x.x:8081`
  - the issue is not business code
  - the issue is likely WSL / Windows firewall / LAN exposure / network binding

- when LAN is unreliable, `expo start --tunnel` is the preferred fallback
  - tunnel is especially useful in WSL, firewall-restricted, or mixed proxy environments

### Recommended startup sequence for phone debugging

If using development build:

1. start Metro
   - `npm run start`
   - or `npx expo start --tunnel` when LAN does not work
2. keep the terminal running
3. open the installed development build app on the phone
4. connect it to the Metro project from the QR code / generated development URL

Important:

- getting the frontend bundle to open does not automatically mean backend requests will work
- after the app loads, backend API access still depends on the configured API base URL
- the mobile app must not use `http://localhost:8080` as the backend address on a real phone
- for real-device backend testing, the backend target must be reachable from the phone

### ERPNext localhost site limitation in local mobile debugging

Current local ERPNext setup uses a site named `localhost`.

Important implication:

- the built-in Frappe/ERPNext frontend nginx routes requests by `Host` / site header
- this means:
  - `Host: localhost` returns the actual ERPNext site
  - `Host: 127.0.0.1` may return `404`
  - `Host: 192.168.x.x` may also return `404`
- therefore, simply exposing `:8080` to LAN is not enough for phone access
- even when the port is reachable, ERPNext may still reject the request because the request host is no longer `localhost`

This is a site-routing behavior, not only a frontend business-code issue.

### Standalone nginx bridge for mobile/LAN access

To avoid changing the existing ERPNext Docker/frontend setup, a separate nginx container can be used as a bridge.

Current standalone proxy files:

- nginx config:
  - `/home/rgc318/python-project/frappe_docker/dev/nginx/mobile-proxy.conf`
- static probe page:
  - `/home/rgc318/python-project/frappe_docker/dev/nginx/probe.html`
- devcontainer startup:
  - `.devcontainer/docker-compose.yml` now includes `mobile-proxy`
  - `.devcontainer/devcontainer.json` now includes `mobile-proxy` in `runServices`

Current standalone proxy responsibilities:

1. expose a simple probe page at `/probe`
   - used to separate pure network issues from ERPNext/site-routing issues
2. proxy `/` to local ERPNext `8080`
3. force the upstream request host to `localhost`
   - so ERPNext still resolves the request to the existing `localhost` site

Current standalone nginx container launch pattern:

```bash
docker run -d \
  --name myapp-mobile-nginx-proxy \
  --add-host=host.docker.internal:host-gateway \
  -p 18080:80 \
  -v /home/rgc318/python-project/frappe_docker/dev/nginx/mobile-proxy.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /home/rgc318/python-project/frappe_docker/dev/nginx/probe.html:/usr/share/nginx/html/probe.html:ro \
  nginx:stable-alpine
```

Meaning of the ports:

- `18080`
  - standalone nginx on the current machine
  - works as the local bridge to ERPNext

### Why `18080` alone was still not enough on this machine

Observed behavior on the current environment:

- WSL could reach `http://192.168.31.63:18080/probe` when bypassing proxy
- Windows could reach `http://localhost:18080/probe`
- Windows could not directly reach `http://192.168.31.63:18080/probe`

This means:

- standalone nginx was working
- ERPNext host rewriting was working
- but the Windows/LAN access path to `18080` was still not open enough for other devices

### Windows portproxy bridge for LAN devices

On the current machine, the final workable solution was to keep the standalone nginx on `18080` and add a Windows-side TCP bridge for LAN devices:

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=18081 connectaddress=127.0.0.1 connectport=18080
netsh advfirewall firewall add rule name="myapp-mobile-proxy-18081" dir=in action=allow protocol=TCP localport=18081
```

Resulting access chain:

1. phone / other LAN device
   - `http://192.168.31.63:18081`
2. Windows `portproxy`
   - forwards to `127.0.0.1:18080`
3. standalone nginx
   - rewrites upstream `Host` to `localhost`
4. ERPNext local frontend
   - forwards to the existing `localhost` site

In this environment:

- `18080`
  - local standalone nginx bridge
- `18081`
  - LAN-facing Windows bridge

### Keep Expo and Windows bridge on different ports

One important pitfall observed in this environment:

- do not let Windows `portproxy` and Expo/Metro fight for the same `8081`
- if Windows is already listening on `8081`, Expo may show:
  - `Port 8081 is being used by another process`
- in mirrored WSL setups on this machine, port conflicts were easy to trigger when a Windows bridge was added on the same port that Metro wanted to use

Recommended split:

- Expo / Metro stays on:
  - `8081`
- Windows LAN bridge for the frontend should use a different listen port, for example:
  - `18082 -> 8081`
- Windows LAN bridge for the backend keeps:
  - `18081 -> 18080`

This avoids a very common failure mode:

- frontend starts on `8082` unexpectedly
- browser / phone still tries to reach `8081`
- debugging becomes confusing because some requests hit the old bridge and some hit the new Metro port

Practical rule:

- never create `8081 -> 8081` Windows `portproxy` for Expo in this environment
- keep frontend and backend LAN bridges on separate explicit ports

### Recommended LAN URL pairing

When testing from another LAN device, the safest pairing on this machine is:

- frontend web preview / Metro web entry:
  - `http://192.168.31.63:18082`
- backend ERPNext bridge:
  - `http://192.168.31.63:18081`

Do not mix:

- frontend via LAN origin
- backend via `localhost`

That combination can look half-working but still fail later due to origin/session separation.

### Recommended verification sequence for this setup

1. verify standalone nginx itself
   - `http://localhost:18080/probe`
2. verify LAN exposure
   - `http://192.168.31.63:18081/probe`
3. verify ERPNext through the bridge
   - `http://192.168.31.63:18081`
4. configure the mobile app base URL to:
   - `http://192.168.31.63:18081`

If frontend LAN preview is also used:

5. verify frontend LAN entry
   - `http://192.168.31.63:18082`
6. verify frontend and backend are paired consistently
   - frontend origin:
     - `http://192.168.31.63:18082`
   - backend base URL:
     - `http://192.168.31.63:18081`

### Proxy-related testing caution

The current shell environment uses local HTTP/HTTPS proxy variables.

This caused false negatives during local testing:

- direct `curl http://192.168.31.63:18080/...` could fail because the request was sent to the local proxy instead of the LAN address

For local verification in WSL, prefer:

```bash
curl --noproxy '*' http://192.168.31.63:18080/probe
```

or:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY curl http://192.168.31.63:18080/probe
```

### Does the mobile app need to be rebuilt after switching to the LAN bridge?

Usually no.

Reason:

- this change affects the runtime backend entry URL
- it does not change the mobile binary itself
- if the app settings page or runtime configuration can change API base URL, the installed app can simply switch to:
  - `http://192.168.31.63:18081`

Rebuild is only necessary when:

- the backend base URL is hardcoded into a non-editable release build
- native Android/iOS capabilities or packaging config changed

Operational note from recent testing:

- after changing backend base URL or switching from localhost to LAN bridge
  - Expo Go / development client may still keep old runtime state
- if the phone continues to report:
  - `无法连接后端`
  - or login/session behavior still reflects the old address
- fully close and reopen the mobile app before assuming the bridge is still broken

In this environment, restarting the phone app was enough to make a previously updated LAN backend URL start working correctly.

### Localhost and LAN do not share browser session state

Observed behavior:

- login could succeed on `localhost`
- the same account could still appear unauthenticated on the LAN frontend origin

Reason:

- `http://localhost:8081`
- and `http://192.168.31.63:18082`

are different browser origins.

Therefore:

- browser local storage is not shared between them
- cached backend URL is not shared between them
- session/cors behavior must be validated separately for each origin

If LAN login appears broken while localhost login works:

1. verify backend `allow_cors` includes the current frontend LAN origin
2. verify the LAN frontend is pointing to the LAN backend bridge, not `localhost`
3. retry from a clean app/browser session after reopening the app or refreshing the web origin

### Current CORS requirement for local + LAN preview

For the current setup, backend `allow_cors` should include at least:

- `http://localhost:8081`
- `http://192.168.31.63:18082`

This is especially important for local web preview and LAN-exposed web preview to coexist during the same development cycle.

### Tunnel failure note

`npx expo start --tunnel` can still fail even when the project code is fine.

Observed CLI error:

- `CommandError: failed to start tunnel`
- `remote gone away`

Meaning:

- this is usually an Expo/ngrok/network path issue
- not a business-code issue

Recommended response:

1. prefer LAN first when the machine can already expose the frontend successfully
2. use `--tunnel` only as fallback when LAN is truly unavailable
3. if tunnel fails, continue debugging LAN exposure instead of assuming the app bundle is broken

## Unified Top Navigation And Safe Area (2026-03-29)

The mobile app now has a shared top navigation/header layer instead of letting each page improvise its own spacing against the phone status bar.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/mobile-page-header.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/app-shell.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/_layout.tsx`

### What Changed

- a reusable `MobilePageHeader` was added
  - supports:
    - centered title
    - left back button
    - optional right-side action
    - safe-area-aware top spacing
- `SafeAreaProvider` is now mounted at app root
- stack-native headers are now hidden so they do not fight with the custom mobile header
- `AppShell` pages now inherit the shared top header automatically

### Why

- most modern mobile apps use:
  - fixed bottom tab bar
  - fixed top navigation bar
  - content body below that navigation bar
- the previous implementation let some pages start directly at the top edge
  - on full-screen phones, content could visually collide with the system status bar / cutout area

### Current Rule

- keep the shared top header for:
  - detail pages
  - create/edit pages
  - settings/account/system pages
  - list pages that benefit from a stable title/action area
- do not force the shared top header on:
  - login page
  - dashboard/home page
  - lightweight success / transition pages
  - modal / preview pages that want a more custom presentation

## Header Exceptions (2026-03-29)

Not every page should look like a standard CRUD/detail screen.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/login.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/modal.tsx`

### What Changed

- login page now keeps only safe-area handling
  - no shared top bar
- home/dashboard page now keeps only safe-area handling
  - no shared top bar
- modal keeps its own lightweight presentation

### Why

- login is a focused entry surface, not a drill-down business page
- dashboard/home usually works better as a branded top section rather than a generic title bar
- forcing the same top header everywhere made these pages look heavier instead of more native

## Safe Area Color Matching (2026-03-29)

Safe-area padding should not accidentally reveal the wrong background color.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`

### What Changed

- the top safe area on home now uses the same orange surface as the hero section
- the main body below it still returns to white
- only the top region is color-extended; the lower page no longer inherits the orange background

### Why

- a safe area should visually belong to the section it extends
- earlier, the top status-bar region and the hero region did not match
- then the whole page was over-corrected and the bottom also turned orange
- the current implementation keeps:
  - orange at the top
  - white in the body

## Source-Aware Back Navigation On Create Pages (2026-03-29)

Create pages should return to where the user came from when that source is known.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/order/create.tsx`

### What Changed

- sales-order create page now accepts `returnTo`
- purchase-order create page now accepts `returnTo`
- dashboard entry points now pass `returnTo=/(tabs)` when opening:
  - sales create
  - purchase create
- when `returnTo` is present:
  - back returns to the source page
- when `returnTo` is absent:
  - the page still falls back to its module home

### Why

- previously, create pages always returned to:
  - sales tab
  - or purchase tab
- that was acceptable when users always entered from the module itself
- but it felt wrong when entering from dashboard shortcuts

### Draft Safety

- the new back behavior does not bypass existing draft guards
- create pages still use the original leave-confirmation flow before actually navigating away

## Sales Order Detail Header Action Cleanup (2026-03-29)

The top-right workflow action on sales-order detail should behave like a secondary navigation action, not a heavy primary button.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`

### What Changed

- view-type actions such as `查看发票` / `查看发货单` were reduced from boxed button styling to a lighter text-style top action
- the header now allows a wider right-side action slot when a page needs it
- this keeps large text readable without wrapping into two lines

### Why

- `查看...` is usually a secondary action in a mobile title bar
- strong filled or boxed buttons are better reserved for main workflow progression
- without a wider header action slot, large action labels could wrap and look broken

## AppShell Intro Card Removal (2026-03-29)

The old shared intro card at the top of many module pages (`RGC WHOLESALE FLOW` + descriptive paragraph) is now considered legacy UI and has been removed from the shared shell.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/app-shell.tsx`

### What Changed

- the shared intro/description card was removed from `AppShell`
- pages that use `AppShell` now enter their real content sooner
- page title responsibility stays with the shared mobile top header

### Why

- once the unified top navigation was added, the extra intro card became repetitive
- on mobile it consumed high-value vertical space before any real action or data
- removing it simplifies module entry pages without changing business behavior

## Product Search Default Load And Card Compression (2026-03-29)

The sales-order product-search page now behaves like a real mobile picker instead of waiting for an artificial first keyword.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/products.ts`

### What Changed

- order-mode product search now auto-loads a first page of products on entry
- empty-keyword auto-load no longer incorrectly calls `search_product_v2`
- instead it uses `list_products_v2` semantics through `fetchProducts(...)`
- the result card was compressed into a flatter mobile layout:
  - title + current warehouse + code on the left
  - add/stepper actions in the header-right area
  - inventory reduced to a light summary row
  - price references reduced to short inline summaries
  - warehouse switching reduced to a shorter bottom selector row
- the extra workflow quick-nav strip is hidden on this search page

### Why

- backend `search_product_v2` is a true search endpoint and returns empty data when `search_key` is empty
- that behavior is valid for a search API, but it is the wrong tool for an auto-loaded picker
- a mobile product picker should open in a browsable state, then let users narrow with keywords
- flatter cards improve scan speed and reduce single-result vertical cost on narrow screens

## Purchase Workbench Visual Refresh (2026-03-29)

The purchase workbench top metrics and quick-action area were refined to look less like temporary placeholders and more like real mobile dashboard entry points.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/purchase.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/ui/icon-symbol.tsx`

### What Changed

- the four top metrics now use clearer colored borders plus light shadow/elevation
- this prevents pale cards such as the unfinished/yellow metric from visually melting into the hero background
- quick actions were rebuilt as compact mobile cards:
  - icon on top
  - label centered below
  - no oversized dark circular badge
- action navigation now uses plain `Pressable + router.push(...)`
  - this avoids web/runtime issues seen with `Link asChild` in this area
- purchase-specific icon mappings were added for payment and return actions

### Why

- the old quick-action cards still looked like horizontally stretched desktop blocks
- deeper badge colors created visual conflict against the lighter card backgrounds
- `Link asChild` caused unstable web/CSS behavior in this workbench section
- mobile dashboards benefit more from compact icon-first shortcuts than label-first wide rows

## Home Legacy Mode Banner Removal (2026-03-29)

The old mode reminder banner on the home dashboard was removed.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/(tabs)/index.tsx`

### What Changed

- the banner showing:
  - `销售模式`
  - `采购模式`
  - `立即设置`
  was removed from the dashboard

### Why

- this information was a legacy reminder from an earlier phase
- it no longer helps users complete the primary home-page tasks
- it consumed vertical space that is more valuable for real navigation or business data

## Sales And Purchase Mobile Entry Cleanup (2026-03-29)

This round focused on making sales and purchase creation flows behave more like real mobile task pages instead of compressed desktop forms.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/link-option-input.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/purchase/order/item-search.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/purchase-order-draft.ts`

### What Changed

- sales-order entry was simplified:
  - the outer `扫码添加` card was removed
  - sales order now keeps a single `选择商品` entry
  - the order page clearly points users into the shared product-search page for both search and future scan-add flows
  - the fixed bottom action bar was rebuilt for real mobile widths:
    - `订单总额` and amount now live on the first row
    - action buttons now live on a dedicated second row
    - multi-UOM orders no longer render misleading pseudo-totals such as `12 件 + 20 箱` in the bottom summary
    - when order lines contain multiple UOMs, the footer summary now degrades to a lighter expression such as `共 4 项 · 2 种单位`
- shared product search was rebuilt as a stronger order-mode picker:
  - top search tools were compressed into a mobile toolbar
  - scan entry moved into the search page itself
  - warehouse filter now defaults to "all warehouses" when empty
  - the confusing `全部仓库` action was removed
  - warehouse search now treats empty value as "all warehouses" by default
  - `清空仓库选项` is only shown when a warehouse filter is already active
  - a dedicated `切换` action now lives inside the warehouse selector input itself
  - the warehouse dropdown no longer depends only on native input focus
    - this avoids flashing open
    - avoids immediate reopen after closing
    - avoids reopening after selecting a warehouse
  - stock filter now uses a more explicit on/off switch treatment
  - lightweight status messaging replaced the heavier extra notice card
  - warehouse-switch rows now emphasize per-warehouse added quantity more clearly
- the shared `LinkOptionInput` component was extended:
  - right-side inline action text is now supported
  - dropdown open/close state no longer relies only on raw input focus
  - inline action can now act as a true open/close control instead of a second pseudo-input
- purchase-order create flow was tightened:
  - the top intro and repeated guidance blocks were reduced
  - optional fields moved later in the form
  - purchase item groups were changed to summary-first cards
  - warehouse sub-rows now support a compact edit/expand flow
  - quantity input now uses a stepper
  - subtotal and reference buying price are shown with clearer hierarchy
  - reference buying price is presented as product-level reference information, separate from row-level actual purchase price
  - purchase unit defaults to the stock/base unit while still remaining editable
- purchase item search was also compressed into a better mobile picker:
  - products now auto-load without forcing a first keyword
  - cards were flattened for faster scan speed
  - add/remove controls were redesigned to feel closer to a mobile cart picker

### Why

- on real mobile widths, duplicated entry points and stacked helper cards consumed too much vertical space
- sales and purchase users should enter goods selection through one clear path, then choose between searching and scanning inside that picker
- warehouse filtering should feel like a filter, not like a second workflow
- purchase creation especially benefits from:
  - fewer repeated explanations
  - stronger action hierarchy
  - clearer default unit and price semantics
- stabilizing the shared warehouse selector interaction is important because both sales and purchase search flows depend on it

### Common packaging failures already seen in this project

1. Java not found
   - symptom:
     - `JAVA_HOME is not set and no 'java' command could be found`
   - meaning:
     - JDK not installed or not exported into the current shell

2. `expo prebuild` completed but no APK exists
   - meaning:
     - this is expected
     - `prebuild` only generates native project files
     - APK comes from `./gradlew assembleDebug`

3. Android SDK location not found
   - symptom:
     - `SDK location not found`
   - meaning:
     - missing `ANDROID_HOME`
     - or missing `android/local.properties`

4. Gradle dependency download timeout
   - symptom:
     - Maven or Gradle distribution download timed out
   - meaning:
     - Gradle/JVM network path is not yet usable
     - proxy or timeout settings likely need adjustment

5. CMake executable missing
   - symptom:
     - `.../Android/Sdk/cmake/3.22.1/bin/cmake: No such file or directory`
   - meaning:
     - CMake package did not install correctly
   - action:
     - reinstall `cmake;3.22.1`

### Files that should usually remain local and not be committed

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/local.properties`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/android/app/build`
- IDE-local folders such as:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/.idea`

Important cautions:

- `expo prebuild` is not the same as APK packaging
- Gradle dependency downloads may fail even when Node-based tooling works normally
- if network access is unstable, Gradle/JVM proxy settings may need to be configured explicitly

## First Phase Pages

- Login
- Settings
- Me
- Account Info
- System Info
- Home
- Product Search
- Sales Order
- Delivery
- Sales Invoice
- Payment
- Sales Return
- Purchase Order
- Purchase Receipt
- Purchase Invoice
- Supplier Payment
- Purchase Return

## Current Reference Sources

This mobile project is now being adjusted against local screenshot references instead of abstract style guessing.

- Reference screenshots:
  - `/home/rgc318/python-project/frappe_docker/reference_photos`
- Current implementation screenshots:
  - `/home/rgc318/python-project/frappe_docker/screenshots`

Current key references for active work:

- Home workbench:
  - `/home/rgc318/python-project/frappe_docker/reference_photos/home-dashboard-overview.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/home-dashboard-overview-02.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/home-dashboard-overview-03.jpg`
- Sales order / billing:
  - `/home/rgc318/python-project/frappe_docker/reference_photos/sales-order-form-full.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/sales-order-form-full-02.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/sales-order-form-full-03.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/sales-order-form-shipping-section.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/sales-order-form-shipping-summary.jpg`
- Auxiliary reference pages:
  - `/home/rgc318/python-project/frappe_docker/reference_photos/product-list-page.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/customer-selection-page.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/settings-page.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/account-info-page.jpg`
  - `/home/rgc318/python-project/frappe_docker/reference_photos/my-profile-page.jpg`

Use references as:

- layout reference
- information hierarchy reference
- spacing-density reference
- action ordering reference

Do not use references as:

- a full visual copy target
- a branding copy target
- a reason to remove existing backend-driven business capability

## Page Requirements

### Login

- Goal:
  - authenticate the current operator before entering business flows
- Target user:
  - salesperson, buyer, warehouse staff, cashier
- Main result:
  - create a valid session for later gateway calls
- Notes:
  - current implementation uses ERPNext built-in session login
  - login endpoint: `POST /api/method/login`
  - session restore endpoint: `GET /api/method/frappe.auth.get_logged_user`
  - logout endpoint: `POST /api/method/logout`
  - auth layer already reserves optional token mode
  - if future login response contains `token` or `access_token`, frontend will automatically switch to token mode
  - if no token is returned, frontend keeps using ERPNext session mode
  - frontend should use `EXPO_PUBLIC_API_BASE_URL` to point to the current backend
  - for local web preview, default backend target is `http://localhost:8080`
  - web preview additionally stores the last logged-in username in browser local storage to improve refresh recovery
  - local web preview requires backend `allow_cors` to include `http://localhost:8081`

### Home

- Goal:
  - provide clear entry points to sales, purchase, returns, and later document lookup
- Key modules:
  - sales
  - purchase
  - returns
  - pending tasks
- Key requirement:
  - actions should be one tap away, not hidden in deep menu trees
- Current design direction:
  - top search should be a real input, not a fake navigation field
  - quick shortcuts should use icon-above/text-below layout
  - shortcut area should be compact and consistent
  - detailed explanatory text should move below the shortcut zone
  - the page should feel like a workbench, not a documentation card page

### Settings

- Goal:
  - let the operator view and adjust the current backend base URL and app-side operational defaults
- Main result:
  - avoid editing source code when switching between local, LAN, and other test environments
  - allow the app to reuse default company, default warehouse, and default flow modes
- Notes:
  - current implementation supports runtime base URL override
  - web can persist the override in browser local storage
  - current settings page also manages:
    - default company
    - default warehouse
    - sales flow mode
    - purchase flow mode
  - these values are frontend-side operator preferences, not backend system settings
  - company and warehouse are validated against backend master data before saving
  - company/warehouse candidate selection already supports backend search suggestions
  - field-level validation is preferred over weak page-level notice text
  - settings UI should use grouped-list logic rather than stacked heavy cards

### Me

- Goal:
  - act as the user-module overview page rather than carrying every detail directly
- Current structure:
  - profile summary
  - account and system entry group
  - settings/help entry group
  - sign-out action group
- Key actions:
  - open account info page
  - open system info page
  - open settings page
  - sign out
- UI direction:
  - use grouped mobile settings/list patterns
  - prefer row-based grouped lists over stacked marketing-style cards
  - keep separators light and inset

### Account Info

- Goal:
  - show current operator/account information in a dedicated page
- Required fields:
  - current username
  - display name
  - email
  - mobile number
  - login status
  - current auth mode
  - current roles
- Notes:
  - this page should stay focused on account-facing data
  - environment/system fields should not be mixed into it

### System Info

- Goal:
  - show current environment and runtime information in a dedicated page
- Required fields:
  - current backend base URL
  - current auth mode when useful for diagnosis
  - current role count
  - client/runtime values needed for troubleshooting
- Notes:
  - this page is for environment confirmation and debugging support
  - it should stay separate from user/account details

### Product Search

- Goal:
  - act as a dedicated search tool page, not the primary order container
- API:
  - `myapp.api.gateway.search_product`
- Required fields to display:
  - `item_code`
  - `item_name`
  - `uom`
  - `qty`
  - `price`
- Key actions:
  - search by code, barcode, or keyword
  - review stock/price summary
  - optionally add searched items into order draft
- Current design notes:
  - this page should visually read as a search page first
  - it should not spend too much first-screen height on large title blocks
  - the main search input should be the visual focus
  - this page is now a helper page, not the main order page

### Sales Order

- Goal:
  - create a sales order as the core document and allow the operator to confirm customer, quantity, price, warehouse, date, and remarks
- API:
  - `myapp.api.gateway.create_order`
- Required fields:
  - customer
  - item list
  - qty
  - price
  - warehouse
  - company
  - posting date
  - remarks
- Key actions:
  - create step-by-step order
  - search products inside the order page
  - add products into the current order
  - edit quantity and price directly in the order lines
  - remove order lines
  - read default company and default warehouse from app preferences as initial values
- Success result:
  - receive `order`
- Current design notes:
  - the order page is document-centered
  - product area should be the visual main body
  - customer/company/warehouse/date are supporting metadata, not the primary visual block
  - earlier iterations had the metadata section occupying too much vertical space; that layout should not be reused
  - company/warehouse should use searchable dropdown selection rather than plain text input
  - bottom fixed actions are acceptable if they improve speed for order save/settlement

## Current Implementation Notes

The current mobile implementation already includes:

- auth/session layer with optional future token reservation
- user profile and role reading
- local operator preferences:
  - backend base URL
  - default company
  - default warehouse
  - sales flow mode
  - purchase flow mode
- backend validation before saving company/warehouse preferences
- home page workbench rework in progress
- product search page rework in progress
- sales order page rework in progress

Current real business-code pieces already added:

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/gateway.ts`
  - mobile gateway request wrapper
  - product search
  - sales-order creation
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/sales-order-draft.ts`
  - local sales-order draft storage
  - line quantity/price updates
  - line removal

## Progress Snapshot (2026-03-15)

Current active implementation focus remains:

- product search page
- sales order page
- sales-order draft interaction

What is already working in code now:

- product search is now a dedicated helper page instead of an inline block inside the order page
- the sales order page uses a document-centered layout and keeps product lines as the main visual body
- the order page and product search page share the same sales-order draft state
- product search can now:
  - search products
  - show current draft quantity per product
  - add product to current order
  - decrease selected quantity directly from the search result card
- sales order lines can now:
  - edit quantity with stepper-style controls
  - edit unit price directly
  - remove a line item
  - undo a recent line removal from a lightweight in-page notice
- save success no longer auto-clears the current order draft
- returning from product search to sales order now refreshes the draft correctly
- quick action icons for product selection and barcode entry have been fixed on non-iOS platforms

Sales-order draft behavior now:

- draft storage uses a composite key:
  - `itemCode + warehouse + uom`
- this avoids merging two lines that happen to use the same item code but different warehouse or UOM
- legacy draft data without this key is normalized on read
- current storage model:
  - web: in-memory + localStorage
  - native: in-memory only

Current sales order interaction decisions:

- product selection should happen in the dedicated product search page, not inside a dropdown under the order page
- order-line deletion should not use a blocking confirmation dialog by default
- current delete behavior is:
  - remove immediately
  - show lightweight undo affordance
- order save should keep current content visible after success instead of clearing the document immediately

Shipping section status:

- the shipping section now includes editable fields for:
  - consignee / contact person
  - phone number
  - shipping address
- these values are intended to default from customer master data when a customer is selected
- the operator may override them for the current order
- override behavior is order-only and must not be treated as a customer-master update

Current boundary / known gap:

- frontend shipping fields are now present in the sales-order page
- customer default shipping/contact lookup has been added in frontend master-data helpers
- however, sales-order submit payload is not yet writing shipping/contact fields into `create_order`
- backend order-level field names for shipping address, contact person, and contact phone are still not confirmed in the current handoff/API docs
- until those backend fields are confirmed, the following feature must be treated as partial only:
  - order-page display of shipping defaults
  - order-page editing of shipping/contact values
- current implemented behavior is frontend-local only for those three fields
- this should be aligned before treating shipping-info submission as complete

Known implementation cautions:

- Chinese copy has previously been damaged by local terminal/script encoding paths during edits
- when updating user-facing copy, prefer stable UTF-safe editing paths and verify directly in the app UI
- some older sections of the order page still contain historical text that should be cleaned in a later content pass

Recommended next steps:

1. Confirm backend field names for order-level shipping address, contact person, and phone
2. Submit shipping/contact overrides together with sales-order creation
3. Continue compressing sales-order line density so more items fit on one screen
4. Normalize remaining sales-order Chinese copy that still carries encoding noise in source
5. Expand the same interaction principles to delivery and invoice pages

## Design Lessons From This Round

These points came directly from comparing our implementation screenshots with the local references:

- Referencing other apps should improve structure, not erase product identity
- Overusing a generic page shell makes very different pages look equally heavy
- Search pages, settings pages, and order pages should not share the same page hierarchy
- If metadata blocks take half a screen, the document loses focus
- If shortcuts are rendered as text rows or unstable inline layouts, the home page loses visual clarity
- Search and selection interactions must behave like real inputs and dropdowns, not fake boxes

### Delivery

- Goal:
  - create and submit delivery based on an existing sales order
- API:
  - `myapp.api.gateway.submit_delivery`
- Required fields:
  - `order_name`
  - delivery item overrides
  - qty
  - price
- Key actions:
  - allow partial delivery
  - allow price adjustment when business requires it
- Success result:
  - receive `delivery_note`

### Sales Invoice

- Goal:
  - create and submit a sales invoice based on an existing sales order
- API:
  - `myapp.api.gateway.create_sales_invoice`
- Required fields:
  - `source_name`
  - invoice item overrides
  - qty
  - price
- Key actions:
  - allow partial invoicing
  - allow invoice-time quantity and price adjustment
- Success result:
  - receive `sales_invoice`

### Payment

- Goal:
  - record customer payment against the sales invoice
- API:
  - `myapp.api.gateway.update_payment_status`
- Required fields:
  - `reference_doctype`
  - `reference_name`
  - `paid_amount`
- Key actions:
  - confirm amount
  - later support payment method and remarks in UI
- Success result:
  - receive `payment_entry`

### Sales Return

- Goal:
  - create a sales return document from delivery or invoice facts
- API:
  - `myapp.api.gateway.process_sales_return`
- Required fields:
  - `source_doctype`
  - `source_name`
  - return item detail
  - qty
- Key actions:
  - select exact return line
  - support invoice-line-based return
- Success result:
  - receive `return_document`

### Purchase Order

- Goal:
  - create the supplier-facing expected purchase document
- API:
  - `myapp.api.gateway.create_purchase_order`
- Required fields:
  - supplier
  - item list
  - qty
  - price
  - warehouse
  - company
- Key actions:
  - create printable purchase order
  - allow price and quantity confirmation before sending to supplier
  - read default company and default warehouse from app preferences as initial values
- Success result:
  - receive `purchase_order`

### Purchase Receipt

- Goal:
  - record actual received goods and complete stock inbound
- API:
  - `myapp.api.gateway.receive_purchase_order`
- Required fields:
  - `order_name`
  - receipt item overrides
  - actual qty
  - actual price
- Key actions:
  - partial receiving
  - remove unavailable items
  - adjust factual received price
  - read default warehouse and purchase flow mode from app preferences
- Success result:
  - receive `purchase_receipt`

### Purchase Invoice

- Goal:
  - create factual settlement based on purchase receipt
- API:
  - `myapp.api.gateway.create_purchase_invoice_from_receipt`
- Required fields:
  - `receipt_name`
  - invoice item overrides
  - qty
  - price
- Key actions:
  - partial invoicing
  - invoice from factual receipt, not only from purchase order
- Success result:
  - receive `purchase_invoice`

### Supplier Payment

- Goal:
  - record actual supplier payment
- API:
  - `myapp.api.gateway.record_supplier_payment`
- Required fields:
  - `reference_name`
  - `paid_amount`
- Key actions:
  - confirm amount
  - later support payment method and remarks in UI
- Success result:
  - receive `payment_entry`

### Purchase Return

- Goal:
  - create purchase return against factual receipt or purchase invoice
- API:
  - `myapp.api.gateway.process_purchase_return`
- Required fields:
  - `source_doctype`
  - `source_name`
  - return item detail
  - qty
- Key actions:
  - support partial return
  - keep original receipt/invoice untouched
- Success result:
  - receive `return_document`

## Suggested Route Order

Recommended mobile implementation order:

1. login
2. home
3. product search
4. sales order
5. delivery
6. sales invoice
7. payment
8. purchase order
9. purchase receipt
10. purchase invoice
11. supplier payment
12. sales return / purchase return

## Route Plan

Recommended Expo Router structure:

```text
app/
  _layout.tsx
  login.tsx
  account-info.tsx
  system-info.tsx
  settings.tsx

  (tabs)/
    _layout.tsx
    index.tsx
    sales.tsx
    purchase.tsx
    docs.tsx
    me.tsx

  sales/
    order/create.tsx
    order/[orderName].tsx
    delivery/create.tsx
    invoice/create.tsx
    payment/create.tsx
    return/create.tsx

  purchase/
    order/create.tsx
    order/[orderName].tsx
    receipt/create.tsx
    invoice/create.tsx
    payment/create.tsx
    return/create.tsx

  common/
    product-search.tsx
    customer-select.tsx
    supplier-select.tsx
    success.tsx
```

## Route Design Rules

- `login.tsx` should stay outside tabs
- account, system, and settings pages should stay outside tabs
- tabs should only contain first-level entry pages
- sales and purchase flows should use dedicated route groups instead of overloading tab pages
- shared picker pages should be placed under `common/*`
- detailed transaction pages should be reachable from both the home page and later document pages
- the `me` tab should remain an overview page, while detailed user information should be pushed into subpages

## Tab Plan

Recommended first-phase tabs:

- `index`
  - home and quick actions
- `sales/index`
  - sales module entry
- `purchase/index`
  - purchase module entry
- `docs/index`
  - document query and recent records
- `me/index`
  - current user, environment info, and logout

If the first release needs fewer tabs, `docs` can temporarily move into the home page and the tab count can be reduced to four.

## Current User Module Status

The current user module already includes:

- ERPNext session login
- session restore on app bootstrap
- logout
- optional token-aware auth fallback in frontend handling
- me page
- account info page
- system info page
- settings page with backend base URL override
- user profile fetch
- user role fetch

## Current Settings Module Status

The current settings module already includes:

- backend base URL override
- default company
- default warehouse
- sales flow mode
- purchase flow mode

Current behavior:

- flow mode changes can be applied directly from the option chips
- company and warehouse can be selected from backend-backed candidate suggestions
- company and warehouse are validated against backend master data before saving
- invalid company/warehouse values show field-level error state and field-level error copy
- these settings are currently stored as frontend-side operator preferences
- they are not yet written back into ERPNext user defaults or global settings

Planned boundary:

- mobile should focus on choosing and using existing company/warehouse values
- mobile should not yet create or edit warehouse master data
- warehouse/company master data maintenance remains better suited to web admin or ERPNext native backend

Current visual direction:

- login page and me page are under active UI refinement
- user-module pages should align with mainstream mobile grouped-settings patterns instead of heavy stacked-card layouts

## Run

- Web preview:
  - `npm run web`
- Android:
  - `npm run android`

Note:

- `npm run web` has already been verified in the current environment.
- `npm run android` still requires Android SDK, `adb`, and the correct `ANDROID_HOME` / `ANDROID_SDK_ROOT`.


## Progress Snapshot (2026-03-16)

Current active implementation focus has expanded from order entry into query, detail, and settlement-adjacent flows that do not require backend contract changes.

What is already working in code now:

- product search is now split into two modes:
  - lookup mode for home-page product lookup
  - order mode for sales-order item selection
- product lookup now supports:
  - tapping into a dedicated product detail page
  - basic master-data review
  - lightweight product-field editing for safe frontend-supported fields
- sales-order query is now available in the docs tab:
  - search by order number
  - search by customer
  - enter order detail from the result list
- sales-order detail page now includes:
  - order header summary
  - item list with image slots
  - quantity / unit / price / line amount display
  - shipping summary block
  - editable remarks / contact person / delivery date
- sales-order create page item cards now preserve and render product images from product search results
- legacy draft items without image metadata are now hydrated from product detail lookup when possible
- sales-invoice creation page is no longer a placeholder:
  - create invoice from an existing sales order
- sales-payment page is no longer a placeholder:
  - record customer payment against a sales invoice
- docs tab now supports two document-query branches:
  - sales orders
  - sales invoices

Current document-query interaction decisions:

- product lookup and document lookup must remain separate concerns
- product lookup is for:
  - product search
  - stock / price review
  - product detail entry
- document lookup is for:
  - sales-order lookup
  - sales-invoice lookup
  - later delivery / payment lookup
- sales-order result cards should keep:
  - left side for base document information
  - right side for result information such as amount / status / outstanding-like hints
- query-card layout changes should now stay incremental; avoid large structural rewrites unless the current layout is fully verified in UI first

Current order-detail implementation decisions:

- line-item amount, quantity, and unit now use stronger visual hierarchy than plain text rows
- order-detail money display should follow ERPNext-side currency first
- `CNY` is intentionally displayed using the Chinese yuan wording in UI
- unit display should use user-facing Chinese mappings where available

Current known boundary / not-yet-complete areas:

- settlement status is not yet a formally backend-confirmed state model
- current invoice status display in query pages is a frontend inference based on available fields
- sales-order page is still not the final accounting source of truth for settlement
- whether an order should be treated as complete / settled must later be aligned against:
  - sales invoice
  - payment entry
  - any later backend aggregation logic
- delivery page is still not implemented beyond placeholder level
- sales return page is still not implemented beyond placeholder level
- purchase-side create / receipt / invoice / payment / return pages still remain largely placeholder-level

Known implementation cautions from this round:

- Windows terminal / script edit paths have repeatedly damaged Chinese UI copy when doing bulk rewrites
- avoid large direct overwrite operations on user-facing Chinese-heavy pages unless the encoding path is fully controlled
- for web preview, `expo-router` link composition can introduce layout/runtime issues if `Link` is used as a heavy layout container
- prefer simpler navigation containers such as `Pressable + router.push(...)` when card layouts behave inconsistently on web

Recommended next steps from the current state:

1. Stabilize and lightly polish document-query card layout without changing page structure again
2. Continue delivery page implementation using existing gateway contract
3. Continue sales return implementation using existing gateway contract
4. Extend invoice query into invoice detail / continue-payment flow
5. Expand the same query/detail principles into purchase-side document pages

Notification and safety decisions added in this round:

- global action feedback on sales pages should prefer `useFeedback()` toast instead of subtle inline text
- success cases that must show a visible toast:
  - create sales order
  - save order edits
  - save contact / item / remarks sections
  - submit delivery
  - create sales invoice
  - record payment
- failure cases on the same pages should also use the same feedback toast, so users do not miss validation or API errors
- inline `message` text on detail pages should now be reserved mainly for passive load-state / missing-data hints, not for high-signal action outcomes
- dangerous operations must require explicit confirmation:
  - `作废订单` now requires a destructive confirmation dialog before the request is sent
- order-detail page should block edit / cancel earlier in UI when downstream business documents already exist:
  - delivered orders must first roll back the delivery note
  - invoiced orders must first roll back the sales invoice
  - paid/settled orders must first handle payment rollback before any order rollback
- order-amendment style saves should use stronger informational messaging:
  - when editing items or the full order generates a replacement order, show a prominent info toast explaining that a new order was created and the old order was voided
- document view pages must distinguish between:
  - just viewing an existing delivery note / invoice
  - landing on the page immediately after creating one
  only the creation path should show the `已生成...` success toast

## Workflow Confirmation And Invoice Preview Update (2026-03-20)

This round focused on reducing accidental downstream document creation, improving deep-page escape routes, and making the sales-invoice page look more like the actual printable document.

### Completed

- sales-order detail actions no longer create downstream documents immediately
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
  - `出货` now routes to the delivery confirmation page
  - `开票` now routes to the sales-invoice page
  - this replaces the older “tap action -> directly execute API -> jump to result page” behavior

- sales delivery page now supports a true confirmation flow
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
  - when there is no `deliveryNote`:
    - the page loads source order detail
    - renders a delivery confirmation view
    - uses a fixed bottom action bar for the final action
  - when there is a `deliveryNote`:
    - the page remains a delivery-note detail page

- stock-shortage handling on delivery now uses a centered warning surface plus a single fixed final action
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
  - current interaction:
    - insufficient stock opens a centered risk dialog
    - the page stays on the current document for checking
    - the fixed bottom primary action switches from normal delivery to force delivery
  - this removes the earlier split where explanation and dangerous action were scattered across different parts of the page

- deep workflow pages now expose lightweight cross-module escape routes
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/workflow-quick-nav.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/app-shell.tsx`
  - users can now jump directly to:
    - home
    - sales
    - purchase
    - docs
  - this was added to reduce the “must press back several times” problem when inside order / delivery / invoice workflows

- duplicated back arrows were removed from key custom sales pages
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/_layout.tsx`
  - the stack header is now hidden for:
    - `/sales/order/create`
    - `/sales/order/[orderName]`
  - this keeps navigation responsibility in the page itself and avoids the earlier double-back problem

- invoice source locking was added when entering invoice creation from an upstream document
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - if the invoice page is opened with `sourceName`:
    - the sales-order field becomes read-only
    - helper text explains that the source was determined by the previous page
  - manual source entry is still allowed when users enter invoice creation directly from the sales module

- sales-invoice page is now moving toward a preview-first document page
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-invoice-sheet.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/preview.tsx`
  - a reusable invoice-sheet component was added
  - the invoice detail page now renders that invoice sheet directly in the main body
  - this intentionally reduces the visual similarity between:
    - delivery detail pages
    - invoice detail pages
  - invoice pages should increasingly feel like actual printable documents rather than generic workflow cards

- invoice preview route now exists as a transitional print surface
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/preview.tsx`
  - current state:
    - preview route is navigable
    - it reuses the same invoice-sheet layout
    - it provides fixed bottom actions for:
      - return to invoice
      - print trigger
  - current limitation:
    - actual system printing / PDF export is not connected yet
    - print action still serves as a placeholder entry point

### Current Design Decisions From This Round

- invoice pages and delivery pages should not look like the same type of screen
  - delivery remains an operational confirmation/detail page
  - invoice should increasingly behave like a document-display and print-entry page

- downstream document creation should always pass through a dedicated confirmation page
  - especially for:
    - delivery
    - invoice
  - order-detail shortcut actions should route into those pages instead of directly executing write APIs

- dangerous actions should use:
  - a centered explanation surface
  - a single fixed final action area
  - no duplicate dangerous execution buttons inside the scroll body

### Current Known Boundary After This Round

- invoice preview is now structurally present, but not yet a real print/export implementation
- the invoice detail page now already shows the printable-looking sheet, so the final long-term decision may be to simplify or reduce the separate preview page later
- purchase-side pages have not yet been upgraded to the same “confirmation page + fixed bottom action + preview-first document page” standard

## Sales Rollback Flow Update (2026-03-20)

This round added the first usable rollback path for already-created sales documents.

### Completed

- delivery-note detail now supports explicit rollback handling
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
  - when viewing an existing delivery note:
    - the page can now show a destructive `作废发货单` action
    - the action is only shown when backend detail data reports that cancellation is currently allowed
  - if a submitted sales invoice still exists downstream:
    - the page shows a rollback hint instead of exposing the cancel action
    - the hint explicitly tells the user to cancel the invoice first

- sales-invoice detail now supports explicit rollback handling
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - invoice detail now has a dedicated rollback card
  - submitted invoices expose a destructive `作废销售发票` action
  - if the invoice already has payment history:
    - backend may still allow cancellation depending on ERPNext settings
    - the page shows a warning-style hint so users know cancellation may involve payment unlink behavior

- frontend sales services now understand backend rollback action flags
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/sales.ts`
  - delivery-note detail now consumes:
    - `can_cancel_delivery_note`
    - `cancel_delivery_note_hint`
  - sales-invoice detail now consumes:
    - `can_cancel_sales_invoice`
    - `cancel_sales_invoice_hint`
  - new client helpers were added:
    - `cancelDeliveryNoteV2`
    - `cancelSalesInvoiceV2`

### Current UX Rules

- sales rollback order is now intentionally explicit:
  - if invoice exists:
    - cancel invoice first
  - if delivery note still exists after invoice rollback:
    - cancel delivery note second
  - after that:
    - return to order detail or edit flow

- rollback is confirmation-based
  - both invoice and delivery cancellation use centered destructive confirmation dialogs
  - the request is not sent directly from a single unsafe tap

- rollback permissions now come from backend detail data instead of frontend guessing
  - this keeps frontend behavior aligned with ERPNext / gateway business rules

### Verified Result In This Round

- real backend verification confirmed:
  - invoice cancellation re-enables delivery-note cancellation
  - delivery-note cancellation reverts order delivery state back to pending
  - order detail then exposes delivery actions again

- current environment behavior for paid invoices:
  - a paid sales invoice can still be cancelled successfully in this environment
  - this implies the ERPNext site is currently configured to allow invoice cancellation while automatically handling payment-reference unlinking
  - frontend should still keep warning copy, because this behavior is environment-setting dependent

## Sales Invoice UX Refinement Update (2026-03-20)

This round further tightened invoice-page behavior so the page reads more clearly as a document state page, not just a generic action hub.

### Completed

- invoice detail status is now state-driven
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - the page now separates:
    - document status
    - settlement status
  - visible states are now easier to distinguish:
    - `已作废`
    - `待收款`
    - `已结清`
  - cancelled invoices now use red status semantics and are treated as historical documents

- invoice detail refreshes when returning from payment registration
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - the page now reloads invoice detail on focus
  - this fixes the case where:
    - user registers payment
    - returns to invoice detail
    - invoice page previously still showed stale `待收款` state

- paid invoices no longer expose a frontend path for “仅作废发票”
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - rationale:
    - cancelling only the invoice leaves the original payment as unallocated amount
    - this can make later re-invoicing and periodic settlement less safe for business users
  - current frontend rule:
    - unpaid invoice:
      - can cancel invoice directly
    - paid invoice:
      - must rollback payment first, then cancel invoice

- invoice detail now supports standalone payment rollback
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/sales.ts`
  - a dedicated `回退收款` action is now available when the invoice has a linked payment entry
  - this action only cancels `Payment Entry`
  - the invoice itself remains valid and returns to `待收款`

- rollback section moved lower in the page
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - dangerous rollback controls are now placed after amount-settlement information
  - this reduces accidental taps while keeping rollback available when users intentionally scroll into risk-handling actions

### Current UX Rules

- invoice detail now distinguishes between common and dangerous actions
  - common actions:
    - print preview
    - collect payment
    - view related order / delivery note
  - dangerous actions:
    - rollback payment
    - rollback payment then cancel invoice
    - cancel unpaid invoice

- paid-invoice rollback policy is intentionally conservative
  - frontend no longer treats “cancel invoice only” as a normal user-facing option
  - if payment exists but no rollbackable payment entry is found:
    - frontend blocks invoice cancellation
    - user must investigate with admin support instead of forcing an unsafe rollback path

- successful rollback actions now guide the user back into the main document flow
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
  - after cancelling a delivery note:
    - frontend no longer leaves the user with only a toast
    - a result dialog now offers:
      - `返回订单`
      - `留在本页`
  - after cancelling a sales invoice:
    - frontend now offers:
      - `返回订单`
      - `查看发货单`
      - `留在本页`
  - rationale:
    - cancelled documents are historical records
    - the next meaningful business action usually belongs on the order page, or occasionally the delivery-note page

- dangerous actions are now visually pushed lower on both invoice and delivery pages
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
  - delivery-note `作废发货单` is no longer mixed into the main “后续操作” area
  - it now lives in a dedicated lower `回退处理` section, matching the invoice-page pattern

## Sales Draft And Edit Guard Update (2026-03-20)

This round tightened two related behaviors:

- create-order local draft persistence
- order-detail unsaved-change protection

The goal is to make long editing sessions safer without forcing users through extra save dialogs for clearly internal transitions.

### Create-order draft behavior

- files:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/sales-order-draft.ts`
- the create-order page no longer stores only item lines
- local draft now persists the main form snapshot as well, including:
  - customer
  - company
  - remarks
  - shipping contact
  - shipping phone
  - shipping address
  - current item lines
- successful order creation now clears both:
  - item draft
  - form draft

### Create-order leave guard

- the create-order page now treats partially filled content as a draft session
- if the operator has entered meaningful content but has not yet created the order:
  - back navigation is intercepted
  - the user sees an explicit leave-confirm dialog
- current dialog intent:
  - remind users that current content is only a local draft
  - prevent accidental loss caused by habitual back-navigation or module switching

### Order-detail unsaved edit guard

- file:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
- order-detail now compares current edit state against the last loaded order state
- unsaved-change detection currently covers:
  - contact / shipping edits
  - remark edits
  - item-line edits
- when unsaved changes exist:
  - top back
  - module navigation
  - jumps to delivery / invoice / payment pages
  - other external document jumps
  now require a confirm-or-abandon decision first

### Safe internal navigation rule

- not every route change during editing should be treated as abandoning the edit session
- adding or replacing products from:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
  is treated as safe internal navigation
- before this jump:
  - scoped order-edit draft is synchronized
  - the page marks the transition as allowed
- rationale:
  - product search is part of the edit workflow itself
  - users should not be blocked by an “abandon edits” warning when they are simply continuing item editing in the dedicated search page

### Current interaction rule

- leaving create-order before submit:
  - warn and keep local draft
- leaving order-detail edit mode for another business page:
  - warn before abandoning edits
- navigating from order-detail into product search for item replacement:
  - do not warn
  - preserve scoped draft and continue the same edit session

## Create-order And Product Search UX Update (2026-03-20)

This round further refined the create-order page and the dedicated product-search page so frequent operators can move faster without losing context.

### Create-order bottom action rule

- file:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- the old bottom `收款` action has been removed from create-order
- current bottom actions are now:
  - `仅保存`
  - `快速开单`
- rationale:
  - create-order should only expose actions directly related to the current order form
  - payment belongs to invoice / settlement stages instead of the initial order form
- current meaning:
  - `仅保存`
    - create the order only
  - `快速开单`
    - create order
    - auto submit delivery note
    - auto create sales invoice

### Create-order validation feedback

- file:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- missing required information is no longer treated as weak inline copy only
- current validation behavior:
  - submit first shows a clear blocking message
  - the page then scrolls to the first invalid section
  - customer / product / shipping-related inline warnings clear automatically after the operator fixes the field
- rationale:
  - create-order is a long page
  - error handling must both explain the problem and bring the user back to the correct section

### Product-search draft cart behavior

- file:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
- the old middle “当前订单草稿” card has been removed
- product-search now uses a bottom summary bar instead
- current behavior:
  - left side shows current draft summary:
    - selected line count
    - total quantity
  - tapping the summary opens the current draft-cart panel
  - the draft-cart panel can directly change quantities with `- / +`
  - right side keeps a direct `返回订单页` action
- rationale:
  - the search page should focus on product finding and quick quantity adjustment
  - current selected goods should feel closer to a shopping-cart tray than a repeated explanatory card

### Workflow navigation visual rule

- file:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/workflow-quick-nav.tsx`
- the old scattered capsule buttons were redesigned into a segmented module switcher
- current navigation intent:
  - behave like lightweight module navigation
  - not like four isolated action buttons
- this same navigation now also cooperates with page-level leave guards
  - pages with unsaved edits can block cross-module jumps before the route is actually changed

## Product And Customer Module Planning (2026-03-20)

The sales flow is now largely stable enough that product and customer management can be treated as the next major frontend workstream.

### Product module target

The product module should become a complete business workbench instead of remaining only a search helper.

Current frontend goal:

- list products
- view product detail
- create product
- update product
- disable product
- inspect stock and multiple business prices

Recommended page set:

- product list page
  - search
  - status filter
  - brand / group filter
  - quick enable / disable
- product detail page
  - basic info
  - sales prices
  - buying price
  - stock summary
  - remarks / description
- product edit page
  - image
  - item name
  - nickname
  - barcode
  - item group / brand
  - sales prices
  - buying price
  - enable / disable

Current interaction rule:

- product “delete” should not be exposed as physical deletion in the mobile UI
- the safe business action should be:
  - disable / stop using product
- products that already participated in transactions should remain queryable as historical master data

### Product price presentation rule

Frontend should not treat product pricing as one single field forever.

Current planned business-facing prices:

- retail price
- wholesale price
- buying price
- valuation / cost reference

Frontend display rule:

- sales flows should prefer selling-side price lists
- purchase flows should prefer buying-side price lists
- valuation rate should be shown only as a cost reference
  - not as the same concept as editable buying quotation price

### Mixed sales mode and UOM rule

Frontend should not model wholesale / retail as a hard order-wide lock.

Current recommended interaction model:

- order header may keep a lightweight `default_sales_mode`
  - for example:
    - `wholesale`
    - `retail`
- this header value only acts as the default mode when new items are added
- the real business result should still be controlled at the order-line level

Each sales line should eventually support its own:

- `sales_mode`
- `uom`
- `rate`

This is important because one order may legitimately mix:

- wholesale-oriented goods
- retail-oriented goods

and the default UOM under the same selling mode may differ by item:

- milk:
  - wholesale default `箱`
  - retail default `瓶`
- ham:
  - wholesale default `箱`
  - retail default `根`
- sunflower seeds:
  - wholesale default `包`
  - retail default `袋`

Recommended frontend behavior:

- when the order default mode is `wholesale`
  - newly added lines should prefer each product's wholesale default UOM and wholesale price
- when the order default mode is `retail`
  - newly added lines should prefer each product's retail default UOM and retail price
- operators may still change a specific line manually
  - for example:
    - switch sales mode
    - switch UOM
    - override rate

Current product-search and order-edit UX should therefore evolve toward:

- order header controls:
  - keep a lightweight `defaultSalesMode`
  - it only affects newly added lines
- order lines:
  - should gradually carry `salesMode`
  - and keep using final `uom / price / qty` as the actual transaction values
- delivery note and invoice pages:
  - do not need to display or maintain a separate wholesale / retail mode
  - they only need the final `uom / rate / qty`

### Order sales mode backend alignment (2026-03-21)

Backend order model has now been extended and verified with real document flow:

- `Sales Order` header stores `default_sales_mode`
- `Sales Order Item` stores line-level `sales_mode`
- `Sales Order` detail API returns:
  - `meta.default_sales_mode`
  - per-line `sales_mode / uom / rate`
- downstream documents intentionally do **not** add mode semantics:
  - `Delivery Note`
  - `Sales Invoice`
  only keep final transaction values such as `uom / rate / qty`

Real validation already confirmed:

- mixed-mode order lines can coexist in one order
  - example: one `wholesale` line and one `retail` line
- line-level final `uom / rate` are preserved into:
  - Sales Order
  - Delivery Note
  - Sales Invoice
- delivery note and invoice do not carry `sales_mode`

This means frontend next-step work is an incremental adaptation, not a page rewrite:

- create / edit order pages need to add:
  - header `defaultSalesMode`
  - line `salesMode`
- product add-to-order flow should later auto-fill defaults from product sales profiles
- delivery and invoice pages do not need structural changes for sales mode
  - default mode only
- line item controls:
  - actual mode / UOM / price

### Sales mode frontend alignment (2026-03-21)

This round connected the frontend order flow to the new sales-mode-aware product and order model.

Completed:

- create-order page now supports header-level `defaultSalesMode`
  - the header mode only affects newly added items
  - it does not force all existing lines to switch together

- create-order draft items now carry sales-mode metadata
  - line `salesMode`
  - `wholesaleDefaultUom`
  - `retailDefaultUom`
  - `salesProfiles`
  - `priceSummary`
  - `allUoms`

- product search now uses the same mode-aware draft key logic as the order page
  - product matching no longer relies on the raw search-result UOM alone
  - the selected state is resolved using the effective line UOM under the current default mode
  - this avoids false “加入订单” states after the same product line has already switched UOM or sales mode inside the draft

- create-order page and order-detail item editing now both show explicit price references
  - `批发价 / 默认批发单位`
  - `零售价 / 默认零售单位`
  - this is intentionally displayed as always-visible reference copy
  - operators should not need to rely only on the mode toggle to infer the intended price

- order-detail item editing now supports line-level `salesMode`
  - each editable line can switch between:
    - `批发`
    - `零售`
  - switching mode updates the line default `uom / rate`
    using the product sales profile returned by backend

- old draft data is now auto-hydrated
  - if a local draft item lacks:
    - image
    - price summary
    - default wholesale / retail UOM
    - sales profiles
  - the create-order page fetches product detail once and enriches the draft item
  - hydration is one-shot per product code in the active draft, to avoid repeated request loops

- sales item editing is now shared by create-order and order-detail
  - both pages now use the same extracted item editor component
  - shared behaviors now include:
    - sales-mode switch
    - wholesale / retail reference price display
    - quantity editing
    - line price editing
    - delete action
  - page-level state is still separate
    - create-order continues to work on local draft state
    - order-detail edit mode continues to work on persisted order state

- draft identity was simplified
  - a draft line is now identified by:
    - `itemCode`
    - `warehouse`
  - `uom` is no longer part of the line identity
  - switching sales mode now updates the same line instead of creating a second line
  - reading old draft data will also normalize stale keys into this new identity rule
  - this prevents product-search from falsely showing the same SKU as “未加入订单” after line mode changes

- current UOM editing rule is intentionally conservative
  - the item editor currently only shows `当前单位`
  - front-end no longer exposes direct line-level UOM switching
  - UOM follows the default wholesale / retail profile when the operator switches sales mode
  - this keeps the order flow aligned with the current product data model and avoids exposing temporary-unit behavior before a dedicated packaging / conversion design exists

- item-row pricing references were visually promoted
  - the old tiny wholesale / retail pills under the mode switch were removed
  - the shared item editor now renders:
    - `批发` reference directly under the wholesale side
    - `零售` reference directly under the retail side
  - the active mode side is highlighted
  - this makes price comparison visible even on smaller mobile screens and reduces operator misreads during line-price edits

- item-row quantity / uom / price layout was rebalanced
  - `当前单位` was moved next to `数量`
  - UOM is now shown as a more visible standalone text block instead of a muted input-like box
  - the right-top line amount also uses a stronger highlight color
  - together these changes reduce vertical noise while making the current selling unit easier to verify

- create-order bottom bar was refined back toward the simpler sales-entry pattern
  - the weak helper sentence below the bottom amount was removed
  - the left side now keeps a compact:
    - `订单金额`
    - `共 X 项，合计 Y 件`
  - the right side keeps the existing action buttons
  - this preserves the clearer old rhythm while still surfacing order-scale information

- order-detail bottom bar intentionally does not fully mirror create-order
  - create-order remains a single integrated info-and-submit bar
  - order-detail keeps its original action-led footer
  - a summary strip was added above the action buttons instead of merging everything into one row
  - this better fits edit / rollback scenarios where the operator’s primary task is still action selection

- order-detail item editing now fills missing product pricing metadata before use
  - if the loaded order line does not contain `priceSummary / wholesaleDefaultUom / retailDefaultUom`
  - edit mode fetches product detail and patches the editable line once
  - reference labels therefore remain visible during order editing, even for older orders
  - switching `批发 / 零售` in edit mode now updates both:
    - the displayed mode
    - the editable line `rate`

- create-order draft hydration was tightened
  - draft enrichment now only marks a product as hydrated after a successful detail fetch
  - mode switching on create-order keeps the current line price when no default mode price is available
  - this avoids draft lines being marked as complete too early and avoids accidental price clearing during mode changes

Current product-search UI rule:

- remove the old single “价格” row
- keep only the business-facing references:
  - wholesale price + default wholesale UOM
  - retail price + default retail UOM

Current order-page UI rule:

- keep the mode switch for action
- keep controlled UOM selection on every line
- keep the price references for comparison
- the visible reference prices are guidance only
  - final transaction values still come from the editable line `uom / price / qty`

Site/master-data note:

- this round also aligned the demo catalog master data in the active site for the main sample SKUs
  - `SKU001` to `SKU010`
- the site now has:
  - `Wholesale`
  - `Retail`
  price lists
- those SKUs now have demo wholesale / retail prices and default UOM mappings
- this is runtime site data, not repository code

### UOM editing boundary

The UI should not treat UOM as free text.

Current recommended rule:

- operators may change line UOM only within the product's configured UOM set
- the allowed list should come from ERPNext item UOM definitions and conversion rules
- ad-hoc free-text unit names such as manually typing a new `袋` / `只` / `个` should be avoided
- create-order and order-detail should follow the same UOM editing rule and presentation

Rationale:

- stock conversion
- invoice quantity
- delivery quantity
- purchase quantity
- profitability

all depend on controlled UOM conversion instead of arbitrary text.

### Manual override rule

The system should keep defaults and final edits separate.

Current rule target:

- item master data provides:
  - default wholesale mode behavior
  - default retail mode behavior
- order lines may manually override:
  - mode
  - UOM
  - rate
- once a line has been manually adjusted, later header mode switches should not silently overwrite that line
- if the business later wants to restore defaults, that should be an explicit action instead of an automatic reset

### Multi-warehouse search and order-line rule

Current recommended direction for the next product-search iteration:

- product search should remain product-first instead of forcing a single warehouse as the only search scope
- warehouse is still an important execution dimension, but it should be selected at the product-result level instead of only at the page-global level
- search cards may show:
  - total stock
  - current recommended warehouse stock
  - an action such as `view stock detail`

Recommended UX path:

- operators search by product
- each product can open a warehouse stock detail panel
- the panel lists warehouse-level stock such as:
  - warehouse A
  - warehouse B
  - warehouse C
- operators add the selected warehouse quantity into the order from that panel

Order-line rule:

- the internal order model should keep `item + warehouse` as separate lines
- the same product from two warehouses should therefore appear as two order lines
- quantity and rate editing should always apply to the current `item + warehouse` line only

This rule is intentionally preferred over “one order line with multiple warehouses inside it” because it is:

- clearer for operators
- easier for draft identity and editing
- closer to delivery execution
- safer for rollback, stock checks, and later tracing

Current recommendation for future document behavior:

- sales order:
  - keep split `item + warehouse` lines
- delivery note:
  - keep warehouse-split execution lines
- sales invoice:
  - do not rush to merge backend rows
  - if needed later, provide display-only aggregation when item, UOM, rate, tax, and discount are identical

Warehouse recommendation rule:

- the system may show a recommended warehouse
- but should not automatically allocate quantities by a hard product-level “priority warehouse” strategy
- real business often needs manual balancing for reserve stock, backup warehouses, activity warehouses, or partial fulfillment
- therefore recommendation is acceptable, hard automatic warehouse allocation should not be the main behavior

### Product module vs order module responsibility

The product module and the order module should not use the same warehouse model.

Recommended product-module responsibility:

- the product module stays product-centric
- product detail should primarily show:
  - total stock
  - warehouse stock distribution
  - standard / wholesale / retail / buying price systems
- warehouse is mainly a detail dimension inside product detail, not the primary identity of the page
- stock operations in the product module should also stay warehouse-specific:
  - adjust one warehouse
  - transfer stock between warehouses
  - add stock into a new warehouse

Recommended order-module responsibility:

- the order module should use `item + warehouse` split lines for execution clarity
- the same item from warehouse A and warehouse B should be shown as two order lines
- quantity and final rate changes always apply to the current warehouse line only
- this model is preferred because it keeps fulfillment, rollback, and stock reasoning clear without forcing a heavy “one line with multi-warehouse allocation” editor

### Warehouse price boundary

Current recommendation:

- warehouse-specific default selling price is not a first-class product-module feature for now
- product prices should still primarily follow price systems:
  - standard selling
  - wholesale
  - retail
  - buying
- if the same item later appears in two different warehouse order lines with different final prices, that difference should be handled at the order-line level instead of requiring warehouse-level default price master data

This keeps the product module simpler while still allowing real transaction flexibility in the order flow.

### Customer module target

The customer module should first focus on practical master-data maintenance instead of advanced CRM workflow.

Current frontend goal:

- list customers
- view customer detail
- create customer
- update customer
- disable customer

Recommended page set:

- customer list page
  - search
  - customer group filter
  - enable / disable state
- customer detail page
  - customer basic info
  - default contact
  - default address
  - default sales price list
  - remarks
- customer edit page
  - customer name
  - contact display name
  - phone
  - email
  - default address
  - customer group
  - default sales price list
  - remarks

### Customer/address interaction rule

- customer default address remains a master-data default only
- order address remains an order snapshot
- customer editing must never be confused with editing an existing order’s shipping snapshot

This rule is especially important because the sales flow has already standardized:

- customer master data provides default suggestions
- order / delivery / invoice pages must continue to treat document address as independent business snapshot data

### Recommended implementation order

1. complete product list + detail + edit first
2. add multiple price presentation and editing
3. complete customer list + detail + edit
4. only after that, consider advanced customer-business rules such as:
  - credit control
  - customer-specific price
  - default warehouse strategy

## Frontend Progress Update (2026-03-22)

This round focused on aligning the mobile frontend with the new server-side unit conversion behavior and simplifying the product-unit model for current wholesale workflows.

### Main Decisions

- the mobile product UI now uses a simplified rule:
  - retail UOM is treated as the practical base inventory-facing unit in frontend interaction
  - wholesale UOM is configured through a conversion factor relative to the retail/base unit
- final quantity conversion is still owned by backend
- stock in order entry is shown as a reference and warning signal, not as a hard business gate

### Completed

- product detail inventory editing now supports business-UOM input
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`
  - current warehouse stock target can now be entered by:
    - wholesale UOM
    - retail/base UOM
  - the page shows a conversion reminder before save
  - save flow now sends:
    - `warehouse_stock_qty`
    - `warehouse_stock_uom`

- product detail unit area was simplified around current business needs
  - retail/base UOM remains the main inventory-facing unit in the page
  - wholesale UOM is edited together with a single conversion factor
  - the page is no longer trying to expose a generic multi-row UOM editor on mobile

- product create page now matches the same unit model
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/create.tsx`
  - create flow now directly builds:
    - `stock_uom`
    - `uom_conversions`
  - the page now treats:
    - retail UOM as the base inventory-facing unit
    - wholesale UOM as the business UOM that needs a conversion factor

- quick create-and-stock now supports input UOM
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
  - quick product creation can now send:
    - `opening_qty`
    - `opening_uom`
  - this allows field operators to create and stock by wholesale/business UOM instead of only thinking in base inventory UOM

- shared conversion helper was added
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/uom-conversion.ts`
  - current helper supports:
    - resolving conversion factor relative to stock/base UOM
    - converting current business quantity to stock/base quantity
    - formatting conversion results for display

- sales-order draft now carries conversion context
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/sales-order-draft.ts`
  - draft items now keep:
    - `uomConversions`
    - `stockQty`
    - `stockUom`

- order item cards now show conversion-aware hints
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-order-item-editor.tsx`
  - current cards can now show:
    - current business quantity
    - approximate converted base quantity
    - current reference stock reminder
  - these hints are advisory only and intentionally do not hard block the workflow

- product service and gateway mapping were updated
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/products.ts`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/gateway.ts`
  - product detail / product search rows now explicitly carry:
    - `uomConversions`
  - product save and quick-stock flows now support:
    - `warehouse_stock_uom`
    - `opening_uom`

- product pricing copy was clarified
  - `采购价` is now presented as:
    - `默认采购价`
  - current meaning is explicitly aligned to:
    - default wholesale purchasing price
  - the product detail price section now visually emphasizes:
    - wholesale price
    - retail price
    - default buying price
  - the generic standard selling price remains available, but is no longer the main visual focus

### Current Boundaries

- the current frontend model is intentionally simplified for current business reality and does not try to model every theoretical UOM case
- existing products with historical ERPNext transactions may still reject stock/base UOM changes at save time
- order entry currently shows conversion-aware reminders, but does not implement strict inventory gating
- purchase-order item cards have not yet received the same conversion-aware hint treatment as sales-order item cards

### Recommended Next Steps

1. continue the same conversion-aware display pattern in purchase order entry
2. decide whether historical items should fully hide stock/base UOM editing on mobile
3. keep simplifying price hierarchy so wholesale / retail / default buying remain primary in the UI

## Product List Layout Refinement (2026-03-22)

This round focused on making the product workbench list usable on narrow mobile widths instead of continuing to stack more data into each card.

### Completed

- product-list rows were rebuilt into a more stable management-card structure
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/products.tsx`
  - current structure is now:
    - top-left: product title
    - top-right: enabled / disabled status chip
    - left content column: code / nickname / category
    - bottom-left: fixed-size inventory summary blocks
    - bottom-right: fixed-width price column

- product-list cards now prioritize only the most useful summary data
  - removed list-level emphasis on:
    - current warehouse preview
    - expanded warehouse rows inside each card
  - retained:
    - total stock
    - warehouse-count summary
    - wholesale price
    - retail price
    - buying-price summary

- UOM display consistency was tightened in the product workbench
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/display-uom.ts`
  - additional aliases such as `YARD / YD / YDS` now map to the business-facing Chinese display unit
  - product-list prices and stock blocks therefore no longer depend on raw backend UOM text

### Current Boundaries

- the product list currently prefers stable summary cards over dense tabular detail
- long product names and metadata are intentionally truncated instead of expanding the row height without limit
- warehouse-level detail is still available in the product detail page, not in the list row itself

### Recommended Next Steps

1. keep the list row focused on summary data and resist adding warehouse/detail fields back into the card
2. if operators later need denser browsing, introduce a separate compact/table mode instead of overloading the current card design

## Product Create Alignment (2026-03-22)

This round aligned the product-create flow with the already refactored product-detail/edit page, so create and edit no longer evolve as two unrelated form experiences.

### Completed

- product create page now follows the same interaction model as product edit
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/create.tsx`
  - category and brand are now selected through the same bottom-sheet picker pattern instead of raw text entry
  - wholesale and retail UOM are now also selected through a picker instead of free-text input
  - create-page section order is now closer to detail/edit:
    - basic info
    - price and commercial UOM
  - the create page now surfaces the same business rule:
    - retail UOM is treated as the current stock-facing/base entry unit
    - wholesale UOM is configured through a conversion factor
  - redundant create-only preview blocks were removed
    - price summary preview was removed because it only repeated "未配置" before any real input happened
    - explanatory inventory cards were reduced so the page now focuses on actual creation inputs instead of pre-creation summaries

- shared product form controls were extracted
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/product-form-controls.tsx`
  - currently shared by create and detail/edit flows:
    - text field
    - selector field
    - bottom-sheet picker modal
  - this reduces drift between the two pages and matches the common React recommendation to reuse logic through shared components and hooks rather than duplicating form trees

- detail/edit page now reuses the shared text field control
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product/[itemCode].tsx`

### Current Boundaries

- create and edit now share the same field-control layer, but they do not yet share a fully centralized product-form state hook
- master-data and UOM pickers are aligned, but create/edit save payload assembly is still maintained in each page separately

### Recommended Next Steps

1. extract shared product payload builders for create/edit so unit-conversion and price mapping cannot drift
2. if product creation later needs opening stock or inventory setup, add it as a dedicated create-only section without forking the rest of the form structure

## Sales Item Grouping Alignment (2026-03-24)

This round aligned sales item presentation across:

- product-search draft sheet
- sales-order create page
- sales-order detail page

The main goal was to stop treating same-product-different-warehouse rows as unrelated cards in the UI.

### Completed

- sales item editing now uses a native grouped-item structure
  - file:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-order-item-editor.tsx`
  - the component is no longer treated as a single flat item card only
  - it now supports:
    - a normal single-item mode
    - a grouped-product mode with:
      - product-level header
      - grouped summary
      - multiple warehouse-level child rows

- warehouse-level rows still keep full editing ability where needed
  - grouped mode does not remove line editing
  - create page and detail edit page still support:
    - qty editing
    - price editing
    - sales-mode switching
    - remove line

- create page and order detail page now follow the same grouping model
  - files:
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
    - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
  - current visual model is:
    - outer level: product
    - inner level: warehouse rows carried by that product

- this replaced the earlier UI problem where:
  - the page visually grouped by product
  - but each inner row still repeated full product image / name / code
  - resulting in more height instead of less

### Component Positioning

`SalesOrderItemEditor` should now be understood as a higher-level sales item module, not a tiny flat row primitive.

It is responsible for:

- product-level presentation in grouped mode
- warehouse-level editing rows inside that grouped product
- keeping create-page and detail-page sales item editing visually consistent

In other words:

- it is no longer just a "single product row"
- it is also not a full page-level list
- it currently sits at a product-module level

### Problems Encountered In This Round

- an intermediate version grouped items at the page level but still rendered old full item cards inside each group
  - this created visual duplication
  - it made grouped layout taller instead of denser

- another intermediate version over-corrected by degrading child rows into warehouse-only cards
  - that removed too much product context
  - this was not acceptable because operators still need the original product-level identity and editing context

### Current Rule

For sales item editing on mobile:

- product identity belongs at the outer grouped level
- warehouse identity belongs at the inner line level
- child rows should not repeat full product identity once the group header already carries it
- but child rows must still preserve the editing controls needed for that warehouse line

### Recommended Next Steps

1. continue tightening grouped child-row spacing so warehouse lines read more like true sub-rows than standalone cards
2. consider extracting a dedicated internal `warehouse-line-editor` subcomponent later if sales and purchase both adopt the same grouped pattern
3. keep create page and detail page on the same grouped-item rendering path to avoid future drift

## Grouped Warehouse Row Tightening (2026-03-24)

After the first grouped-product rollout, warehouse child rows in the sales editor still looked too much like full cards and consumed too much vertical space.

### Adjustments

- file:
  - `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-order-item-editor.tsx`

- compact grouped warehouse rows were tightened further
  - reduced compact row padding and header spacing
  - reduced hint-card top margin and vertical padding
  - slightly reduced compact mode reference block height

- low-priority information in compact child rows was reduced
  - per-warehouse inline amount was hidden in compact mode
  - the literal `销售模式` label was removed in compact mode while the switch itself remains

### Why

- order operators primarily care about:
  - product-level grouped total
  - warehouse-level editable quantity, mode, unit, and price
- per-warehouse inline subtotal inside every compact child row added noise and made the grouped layout taller
- once a grouped product header already carries product identity, the child row should read more like a warehouse sub-row than a second standalone card

## Sales Calculation Safety Check (2026-03-24)

After the grouped sales-item UI changes, the critical calculation path was reviewed again to confirm that the recent frontend work did not alter pricing, quantity, or payload semantics.

### Checked Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-order-item-editor.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/sales.ts`

### Confirmed Results

- grouped rendering only changes presentation structure
  - same-product rows are grouped visually
  - warehouse-level rows are still edited individually

- create-order submission is still line-based
  - `buildOrderPayload()` still maps each draft warehouse row into a separate `items[]` entry

- order-detail item save is still line-based
  - `updateSalesOrderItemsV2()` is still called with each editable warehouse row mapped independently

- backend payload shape is unchanged
  - item code, quantity, price, warehouse, uom, and sales mode still flow to the gateway in the same structure

- recent grouped UI work did not introduce new pricing or quantity formulas
  - grouped totals are display summaries only
  - they do not overwrite the underlying warehouse rows

### Important Note

- one earlier fix did affect save correctness in a positive way
  - the combined save flow now includes `salesMode` consistently
  - this was a bug fix for persistence consistency, not a new calculation change

### Remaining Boundary

- grouped quantity summaries currently add raw `qty` values for display
  - this is acceptable for the current workflow
  - if mixed-UOM grouping becomes common later, the display summary may need a more explicit label
  - this is a presentation caution, not a business-logic or payload issue

## Warehouse Stock Remaining Reference (2026-03-25)

Operators editing warehouse-level order rows needed a stock reference close to the quantity control, without having to go back to the product search page.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/sales-order-draft.ts`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/services/gateway.ts`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-order-item-editor.tsx`

### What Was Added

- product search now carries warehouse-level stock into the sales-order draft
  - the selected warehouse stock quantity and stock uom are stored separately from the business quantity being edited

- create page and order-detail edit page now display `库存剩余` beside the warehouse header
  - this is shown on compact warehouse rows
  - the label is placed on the same line as the delete action instead of taking an extra block

- `库存剩余` now updates when the operator changes quantity
  - the display is no longer a static warehouse stock snapshot
  - it reflects the current warehouse row reservation

- old draft rows are re-hydrated if warehouse stock fields are missing
  - this prevents older draft entries from showing no stock reference while newer entries do

### Calculation Rule

- displayed stock reference is:
  - warehouse stock for the selected warehouse
  - minus the current row reservation

- the reservation is calculated in stock units when needed
  - if the selling uom differs from the stock uom, the quantity is converted before subtracting
  - this keeps `库存剩余` aligned with inventory semantics instead of raw typed quantity

### UI Rule

- `库存剩余` is a warehouse-line editing aid, not an order summary metric
- it should stay close to:
  - warehouse identity
  - delete action
  - quantity editing controls

- low-stock state is visually emphasized
  - normal remaining stock uses neutral subdued text
  - low remaining stock uses warning color
  - zero remaining stock uses danger color

## Shared UOM Display Layer (2026-03-25)

After confirming that backend inventory settlement continues to use `stock_uom`, frontend wording also needed one shared rule instead of every page inventing its own quantity text.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/uom-display.ts`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`

### What Was Added

- a shared display helper now centralizes:
  - line-level business-UOM vs stock-UOM wording
  - `X 箱约等于 Y 件` style conversion summaries
  - warehouse remaining-stock display
  - grouped quantity-summary wording

- sales-order create and detail pages now call the same shared methods instead of carrying slightly different summary strings in each page file

### Why

- backend already settles inventory through `stock_uom`
- frontend should therefore stay consistent about:
  - what is business-facing quantity
  - what is stock-facing quantity
  - when to preserve original transaction UOMs instead of regrouping them

## Readonly Warehouse Rows (2026-03-25)

Order detail has two very different states:

- edit state
- readonly review state

The readonly state should not look like an active editor.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-order-item-editor.tsx`

### Fixes

- grouped warehouse child rows now correctly pass `readOnly` through to the inner row renderer
  - this removes the misleading mode switch and quantity stepper from readonly order-detail rows

- readonly rows were tightened into a more scan-friendly one-line summary
  - left side:
    - `批发录入：箱`
    - `零售录入：件`
  - right side:
    - `¥ 4800 x 12 箱`

### Why

- operators checking an existing order should not see controls that imply direct editing
- readonly review is about confirmation, not pretending the row is still an active input form

## Mixed-UOM Product Summary (2026-03-25)

When the same product appears with multiple transaction UOMs, grouped headers should preserve the original recorded units instead of forcing a synthetic regrouping.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/uom-display.ts`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`

### Rule

- mixed-UOM grouped headers now prefer:
  - `合计 25 箱 + 9 件`
- they no longer default to a vague warning-only summary for the grouped product header

### Why

- preserving original transaction UOMs is closer to what the operator and customer actually understand
- frontend should not silently regroup:
  - `100 箱 + 50 瓶`
  into
  - `102 箱 2 瓶`
- stock conversion remains an internal settlement rule, not a reason to rewrite customer-facing quantity facts

## Delivery Page Grouped Presentation (2026-03-26)

Delivery confirmation and delivery-note detail should not reuse the same heavy card hierarchy as order editing.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`

### What Changed

- pending-delivery rows are still grouped by product, but the presentation is lighter and closer to a document-style execution list
- each grouped product now has:
  - a clearer product header
  - a visible `商品名称` label
  - a larger grouped amount on the right
  - a grouped quantity summary such as `合计 25 箱 + 9 件`
- warehouse children are shown as execution lines instead of nested mini-cards
  - warehouse name
  - row amount
  - `单价 x 数量 单位`

### Why

- delivery pages are operational confirmation pages
- they should emphasize:
  - what product is being shipped
  - how the shipment is split by warehouse
  - what amount belongs to each warehouse row
- a card-inside-card hierarchy looked too much like a generic detail editor instead of a shipment confirmation document

## Invoice Creation Confirmation (2026-03-26)

The pre-submit invoice page was previously too thin. It behaved like a plain entry form rather than a real invoice confirmation step.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-invoice-sheet.tsx`

### What Changed

- when the page is still in "create invoice" mode and has a source order:
  - it now loads the sales-order detail first
  - it shows an invoice-confirmation block before the form fields
- the confirmation block includes:
  - source order
  - customer
  - company
  - contact and address snapshot
  - order amount summary
  - product summary grouped by item
- grouped product summaries preserve original transaction UOMs
  - for example: `合计 25 箱 + 9 件`
- warehouse is intentionally not used as the main invoice summary dimension
  - invoice confirmation should read closer to a customer-facing commercial document than an internal warehouse execution view

### Why

- mainstream invoicing flows usually give the operator one more chance to confirm:
  - what order is being invoiced
  - who the invoice is for
  - what goods and amounts will appear
- the page should feel like a proper "开票确认页", not only a place to type the order number and press create

## Delivery Footer Actions (2026-03-26)

Delivery-note detail should not force operators to scroll through the whole document just to reach the next business action.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`

### What Changed

- delivery-note detail now uses the shared app-shell footer for its primary actions
- the footer exposes:
  - `返回订单`
  - `查看发票`
  - or `前往开票`
- the mid-page "后续操作" block was reduced into an explanation block instead of repeating the same buttons

### Why

- delivery note is a document page, not an endless action list
- the most common next actions should stay reachable without scrolling past the entire goods list

## Payment Page As Confirmation Page (2026-03-26)

The payment page should prioritize money and settlement action, not secondary shipping snapshot data.

### File

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/payment/create.tsx`

### What Changed

- the page now loads invoice detail first when a sales invoice is known
- the top area focuses on:
  - invoice number
  - customer
  - invoice amount
  - already paid amount
  - current outstanding amount
- the previous "本次登记后预计结果" block was removed
  - it was considered too easy to misread as actual posted settlement state
- shipping contact and address were pushed lower as secondary reference information
- the primary payment action was moved into the fixed footer
  - `返回来源页`
  - `登记收款`

### Why

- payment registration is primarily about:
  - which invoice
  - which customer
  - how much is still unpaid
  - how much is being collected now
- shipping address and contact are not the first thing the operator should see on a payment page

## Primary Total Price Emphasis (2026-03-26)

Large document pages were showing many prices, but not clearly identifying which one was the main document total.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/delivery/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/invoice/create.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/components/sales-invoice-sheet.tsx`

### What Changed

- delivery and invoice pages now distinguish:
  - document total
  - grouped product total
  - warehouse subtotal
- main amount cards use clearer wording and stronger visual emphasis
  - `订单总价`
  - `发货单总价`
  - `商品总价`
  - `仓库小计`

### Why

- users should not have to infer from layout alone whether a number is:
  - the document total
  - one product total
  - or a line subtotal
- explicit labels reduce hesitation and improve scan speed on mobile

## Sales Order Edit Return Fix (2026-03-29)

Editing an existing sales order should not lose in-progress item changes just because the operator briefly enters the shared product search page.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`

### What Changed

- returning from shared product search to an editing sales order now prefers stack back navigation instead of replacing the order detail screen
- the sales order detail screen now supports an explicit `resumeEdit=items` fallback
- when that fallback is used, the page restores item edit mode from the scoped draft `order-edit:${orderName}`
- draft item to editable item conversion was centralized so the restored rows use the same mapping in both initial load and refocus sync

### Why

- the previous `replace` flow recreated the order detail page
- recreated pages lost local `isEditingItems` state, so users were dropped back to read-only mode
- the shared product search page was already writing into the correct scoped draft, but the order page was not always re-entering item edit mode to consume that draft
- preserving the original page instance first, and restoring from scoped draft as fallback, makes the edit flow stable across search round trips

## Sales Order Edit Form Draft Alignment (2026-03-29)

The edit-order page previously behaved differently from the create-order page: goods were already using a scoped draft, but contact and remark fields still relied only on local component state.

### Files

- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/sales/order/[orderName].tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/app/common/product-search.tsx`
- `/home/rgc318/python-project/frappe_docker/frontend/myapp-mobile/lib/sales-order-draft.ts`

### What Changed

- `SalesOrderDraftForm` now also stores `deliveryDate`
- edit-order flow now writes contact, phone, address, remark, and delivery date into the scoped form draft `order-edit:${orderName}`
- entering product search from the edit-order page now carries the correct `resumeEdit` hint:
  - `items` when only goods are being edited
  - `all` when goods are being edited together with contact or remarks
- returning from shared product search can now restore both:
  - item draft rows
  - form draft fields
- edit-order save and cancel actions now clear the scoped form draft together with the scoped item draft when appropriate

### Why

- before this change, the create-order page could restore unsaved contact and remark fields because those values were stored in draft form state
- the edit-order page did not have the same protection, so a search-page round trip could keep goods but still lose unsaved receiver, phone, address, remark, or delivery date edits
- aligning the edit-order page with the create-order draft model makes cross-page editing much more predictable
