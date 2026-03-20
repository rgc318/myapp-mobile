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

### Recommended verification sequence for this setup

1. verify standalone nginx itself
   - `http://localhost:18080/probe`
2. verify LAN exposure
   - `http://192.168.31.63:18081/probe`
3. verify ERPNext through the bridge
   - `http://192.168.31.63:18081`
4. configure the mobile app base URL to:
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
