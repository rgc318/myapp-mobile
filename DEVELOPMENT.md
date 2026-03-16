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
