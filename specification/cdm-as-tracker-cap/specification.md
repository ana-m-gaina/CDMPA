# Specification: cdm-as-tracker-cap

> **Guidelines**: Read [guidelines.md](../guidelines.md) and [guidelines-cap.md](../guidelines-cap.md) before executing ANY tasks below. Follow all constraints described there throughout execution.

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` thoroughly before starting
- [ ] Invoke the `cap-development` skill from `assets/cdm-as-tracker-cap/` to set up the CAP project structure
- [ ] Install dependencies (`npm install`), validate the project starts (`cds watch`) and responds

## Data Model

- [ ] Define `db/schema.cds` with the following entities:

  **`RRTable`** — R&R service code reference
  - `ID` : UUID (key, managed)
  - `serviceCode` : String(20) not null
  - `serviceName` : String(200) not null
  - `category` : String(100)
  - `chargeable` : Boolean default true
  - `notes` : String(500)
  - `active` : Boolean default true
  - `createdAt`, `modifiedAt` (managed)

  **`PricingTable`** — shared pricing reference
  - `ID` : UUID (key, managed)
  - `serviceCode` : String(20) not null
  - `serviceName` : String(200)
  - `price` : Decimal(10,2) not null
  - `currency` : String(3) default 'EUR'
  - `effectiveFrom` : Date
  - `active` : Boolean default true
  - `lastUpdatedBy` : String(100)
  - `createdAt`, `modifiedAt` (managed)

  **`ASRequest`** — Additional Services request lifecycle tracker
  - `ID` : UUID (key, managed)
  - `requestTitle` : String(200) not null
  - `customerName` : String(200) not null
  - `customerAccountId` : String(50)
  - `serviceCode` : String(20)
  - `serviceType` : String(100)
  - `description` : String(2000)
  - `status` : String(50) default 'New' — enum: New, PriceCommunicated, Approved, InDelivery, Delivered, Invoiced
  - `assignedCDM` : String(100) not null
  - `price` : Decimal(10,2)
  - `currency` : String(3) default 'EUR'
  - `approvalText` : String(2000)
  - `poNumber` : String(100)
  - `approvalDate` : DateTime
  - `deliveryDate` : DateTime
  - `invoiceDate` : DateTime
  - `jiraTicketRef` : String(100)
  - `jiraTicketBody` : String(5000)
  - `sap4MeTicketId` : String(100)
  - `spcTicketId` : String(100)
  - `btpTicketId` : String(100)
  - `amsTicketId` : String(100)
  - `serviceNowTicketId` : String(100)
  - `salesOrderNumber` : String(100)
  - `providerContractNumber` : String(100)
  - `createdAt`, `modifiedAt` (managed)
  - Composition of many `ActivityLog`

  **`ActivityLog`** — per-request audit trail
  - `ID` : UUID (key, managed)
  - `request_ID` : UUID (foreign key to ASRequest)
  - `action` : String(200) not null
  - `description` : String(1000)
  - `performedBy` : String(100)
  - `performedAt` : DateTime not null
  - `oldStatus` : String(50)
  - `newStatus` : String(50)

  **`CardLayout`** — per-CDM Space card preferences
  - `ID` : UUID (key, managed)
  - `userEmail` : String(200) not null
  - `cardId` : String(50) not null — enum: rr-reference, pricing, active-requests, jira-o2i
  - `visible` : Boolean default true
  - `sortOrder` : Integer default 0

  **`JiraTicketTemplate`** — JIRA O2I template configuration
  - `ID` : UUID (key, managed)
  - `serviceType` : String(100) not null
  - `templateBody` : String(5000) not null
  - `active` : Boolean default true

- [ ] Run `cds compile db/` to confirm schema compiles without errors

## Services

- [ ] Define `srv/cdm-service.cds` — main OData service for CDM and Manager users:
  - Expose `ASRequest` (read/write)
  - Expose `RRTable` (read-only)
  - Expose `PricingTable` (read-only)
  - Expose `CardLayout` (read/write)
  - Expose `ActivityLog` as read-only (navigable from `ASRequest`)
  - Annotate with `@requires: ['CDM', 'Manager']`
  - Bound action on `ASRequest`: `generateJiraTicket()` returns `String`
  - Bound action on `ASRequest`: `advanceStatus(newStatus: String, comment: String)` returns `ASRequest`
  - Bound action on `ASRequest`: `recordApproval(approvalText: String, poNumber: String)` returns `ASRequest`
  - Unbound action: `saveCardLayout(layouts: array of {cardId: String, visible: Boolean, sortOrder: Integer})` returns `Boolean`

- [ ] Define `srv/admin-service.cds` — admin-only service:
  - Expose `PricingTable` (read/write)
  - Expose `RRTable` (read/write)
  - Expose `JiraTicketTemplate` (read/write)
  - Annotate with `@requires: ['Admin']`

- [ ] Run `cds compile srv/` to confirm both services compile without errors

## Custom Handler Logic

- [ ] Implement `srv/cdm-service.js` with the following custom handlers:

  **Status State Machine** (`advanceStatus` bound action):
  - Enforce valid transitions only: New→PriceCommunicated, PriceCommunicated→Approved, Approved→InDelivery, InDelivery→Delivered, Delivered→Invoiced
  - Reject invalid transitions with `req.error(400, 'Invalid status transition ...')`
  - On success: insert `ActivityLog` record with `oldStatus`, `newStatus`, `performedBy` = req.user.id, `performedAt` = new Date(), `action` = "Status Advanced", `description` = comment param
  - Set date fields: `approvalDate` on →Approved, `deliveryDate` on →Delivered, `invoiceDate` on →Invoiced

  **Approval Recording** (`recordApproval` bound action):
  - Reject with 400 if request status is not `PriceCommunicated`
  - Save `approvalText` and optional `poNumber` on the request
  - Advance status to `Approved`, set `approvalDate`
  - Insert `ActivityLog` entry: action = "Approval Recorded"

  **JIRA Ticket Generation** (`generateJiraTicket` bound action):
  - Reject with 400 if request status is not `Delivered`
  - Read `JiraTicketTemplate` matching `serviceType`; fall back to `serviceType = 'default'` if no match
  - Replace all `{{placeholder}}` tokens with values from the request: `customerName`, `customerAccountId`, `serviceCode`, `serviceType`, `price`, `currency`, `poNumber`, `approvalText`, `approvalDate`, `deliveryDate`, `sap4MeTicketId`, `spcTicketId`, `amsTicketId`, `salesOrderNumber`, `providerContractNumber`
  - Save populated body to `request.jiraTicketBody`
  - Insert `ActivityLog` entry: action = "JIRA Ticket Generated"
  - Return the populated ticket body string
  - Do NOT advance status (status advances to Invoiced only via `advanceStatus`)

  **Card Layout Save** (`saveCardLayout` unbound action):
  - For each item in `layouts`: upsert `CardLayout` where `userEmail = req.user.id` and `cardId = item.cardId`
  - Return `true` on success

  **CDM Scoping** (before READ on `ASRequest`):
  - If user does NOT have `Manager` role: add filter `req.query.where('assignedCDM =', req.user.id)`
  - Managers see all records

  **Activity Log on Create** (after CREATE on `ASRequest`):
  - Auto-insert `ActivityLog` entry: action = "Request Created", newStatus = "New", performedBy = req.user.id, performedAt = new Date()

- [ ] Run `cds watch` — verify all endpoints respond with correct data

## Seed Data

- [ ] Create `db/data/` CSV files:
  - `RRTable.csv` — 10+ rows across categories SystemConversion, MigrationSupport, SpecialOnboarding; mix chargeable/non-chargeable; include SC-42 (chargeable, SystemConversion)
  - `PricingTable.csv` — matching price rows for all chargeable codes; SC-42 = EUR 5000
  - `JiraTicketTemplate.csv` — one row with `serviceType = 'default'` and a realistic template body using `{{placeholder}}` syntax for: customerName, customerAccountId, serviceCode, serviceType, price, currency, poNumber, approvalText, approvalDate, deliveryDate, sap4MeTicketId, spcTicketId, amsTicketId, salesOrderNumber, providerContractNumber

## Role-Based Access Control

- [ ] Add `@cds.requires` annotations to both services
- [ ] In `package.json` under `cds.requires.auth`, configure mock users:
  - `alex` — roles: `['CDM']`
  - `morgan` — roles: `['CDM', 'Manager']`
  - `pricingadmin` — roles: `['Admin']`
- [ ] Verify: `alex` gets 403 on AdminService; `pricingadmin` gets 403 on CDMService

## Tests

- [ ] Write tests for custom handler logic only (no generic CRUD tests):
  - Valid status transition (New→PriceCommunicated) succeeds and creates `ActivityLog` entry
  - Invalid status transition (New→Invoiced) returns HTTP 400
  - `recordApproval` returns 400 when request is not in `PriceCommunicated` status
  - `recordApproval` succeeds when status is correct; request advances to `Approved`
  - `generateJiraTicket` returns 400 when request is not in `Delivered` status
  - `generateJiraTicket` returns a non-empty string containing `customerName` value
  - CDM-role user cannot read requests assigned to a different CDM
- [ ] Run all tests — confirm all pass

## Frontend — Space UI

- [ ] Invoke the `cap-development` skill to scaffold the React + SAP UI5 Web Components frontend in `assets/cdm-as-tracker-cap/ui/`
- [ ] Implement the following components:

  **App Shell**
  - Top nav: app title "CDM AS Tracker", current user display, "+ New Request" button, "Manage Space" button, global chat toggle
  - Main area: CSS Grid card layout; cards in sortOrder; hidden cards not rendered
  - On load: fetch `CardLayout` for current user; default all 4 cards visible [rr-reference(0), pricing(1), active-requests(2), jira-o2i(3)] if none saved

  **Manage Space Panel**
  - Side panel: list of 4 cards with visible toggle and drag-and-drop reorder
  - "Save" button calls `saveCardLayout` action; closes panel; re-renders grid

  **Shared Card Component**
  - Header: title, refresh icon, chat toggle icon
  - Body: live data table fetched on mount + on refresh
  - Footer: collapsible chat input; sends `{message, card_context, cdm_email}` to `POST /api/chat`

  **R&R Reference Card** (cardId: `rr-reference`)
  - `GET /odata/v4/CDMService/RRTable?$filter=active eq true`
  - Columns: Service Code, Service Name, Category, Chargeable (Yes/No badge), Notes
  - Search (client-side on code+name), Category dropdown, Chargeable dropdown (All/Yes/No)

  **Pricing Card** (cardId: `pricing`)
  - `GET /odata/v4/CDMService/PricingTable?$filter=active eq true`
  - Columns: Service Code, Service Name, Price (formatted EUR), Currency, Effective From, Last Updated By
  - Admin users: inline Edit button per row → form (price, currency, effectiveFrom) → `PATCH /odata/v4/AdminService/PricingTable(ID)` → refresh

  **Active Requests Card** (cardId: `active-requests`)
  - `GET /odata/v4/CDMService/ASRequest?$filter=status ne 'Invoiced'&$expand=ActivityLog&$orderby=createdAt desc`
  - Columns: Request Title, Customer Name, Service Code, Status (coloured badge), Age (days), Assigned CDM (managers only)
  - Click row → opens Request Detail Drawer

  **JIRA O2I Card** (cardId: `jira-o2i`)
  - `GET /odata/v4/CDMService/ASRequest?$filter=status eq 'Delivered'`
  - Columns: Request Title, Customer Name, Service Code, Delivery Date, Age
  - "Generate JIRA Ticket" button → calls `CDMService.generateJiraTicket` → modal with ticket body + copy button
  - Modal footer: "Mark as Invoiced" button → calls `advanceStatus({newStatus:'Invoiced'})` → closes modal; refreshes card

  **Request Detail Drawer**
  - Side drawer: all request fields read-only; status timeline (ActivityLog entries chronological)
  - Contextual action buttons by status:
    - New → "Communicate Price" → inline form (price, currency, comment) → `advanceStatus({newStatus:'PriceCommunicated'})`
    - PriceCommunicated → "Record Approval" → inline form (approvalText, poNumber) → `recordApproval`
    - Approved → "Start Delivery" → confirm dialog → `advanceStatus({newStatus:'InDelivery'})`
    - InDelivery → "Confirm Delivery" → confirm dialog → `advanceStatus({newStatus:'Delivered'})`
    - Delivered → "Go to JIRA O2I" → scrolls to JIRA O2I card

  **New Request Modal**
  - Triggered by "+ New Request" in top nav
  - Fields: Request Title*, Customer Name*, Customer Account ID, Service Type, Service Code (searchable select from RRTable), Description, SAP4Me Ticket ID, SPC Ticket ID, BTP Ticket ID, AMS Ticket ID, ServiceNow Ticket ID, Sales Order Number, Provider Contract Number
  - Submit: `POST /odata/v4/CDMService/ASRequest` → close modal; refresh Active Requests card

  **Global Chat Panel**
  - Right-side panel, toggled from top nav; non-blocking
  - Sends `{message, card_context: null, cdm_email}` to `POST /api/chat`
  - Renders streamed agent responses as chat bubbles with markdown

- [ ] Add CDS middleware to proxy `POST /api/chat` to `AGENT_URL` env var (default `http://localhost:8000/api/chat`)
- [ ] Run `npm run build` in `ui/` — no build errors
- [ ] Run `cds watch` — frontend served at `http://localhost:4004`

## Final Validation

- [ ] `cds compile srv/` — zero errors
- [ ] `cds watch` — all OData endpoints respond
- [ ] All 4 custom actions return expected responses via curl
- [ ] Seed data loads correctly (R&R, Pricing, JIRA template tables non-empty)
- [ ] Role enforcement verified for all 3 mock users
- [ ] All tests pass
