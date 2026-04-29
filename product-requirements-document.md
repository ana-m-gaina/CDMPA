# Product Requirements Document (PRD)

**Title:** CDM Additional Services Tracker  
**Date:** 2026-04-29  
**Owner:** CDM Product Team  
**Solution Category:** BTP Extension, AI Agent

---

## Product Purpose & Value Proposition

**Elevator Pitch:**  
SAP Customer Delivery Managers (CDMs) coordinate chargeable Additional Services (AS) requests across 7 disconnected platforms — Outlook, SAP4Me, SPC/BCP, BTP, AMS, ServiceNow, and JIRA — with no single system of record. This solution replaces that fragmented workflow with a **customizable AI-powered workspace (Space)** where each Card is a live data surface backed by a specialist AI agent, unified by a conversational orchestrator that sits above them all.

**Business Need:**  
CDMs have no shared tracker, no shared pricing reference, and no automated way to generate the JIRA invoice ticket that triggers revenue collection. Every request lifecycle involves 10 manual steps across multiple platforms, high error risk, and revenue leakage from uncharged or under-charged services. The process breaks when CDMs are unavailable.

**Expected Value:**
- Eliminate manual data aggregation across 7 platforms per AS request
- Eliminate stale pricing risk caused by locally-downloaded Excel pricing sheets
- Reduce JIRA O2I ticket creation time from ~15 minutes (manual) to under 1 minute (auto-generated)
- Provide team-wide visibility into open AS requests, removing single-CDM dependency
- Reduce revenue leakage from uncharged services
- Give each CDM a personalized workspace that surfaces only the data and actions relevant to them

**Product Objectives (Prioritized):**
1. Provide CDMs a single system of record for all AS requests from intake to invoicing
2. Centralise shared pricing and R&R reference data, replacing local Excel files
3. Automate JIRA O2I ticket generation from tracker data
4. Deliver a conversational AI interface that lets CDMs log and manage requests in natural language
5. Give each CDM a **customizable Space** (card-based workspace) with live data per card
6. Give CDM managers cross-team visibility into open AS requests

---

---

## The Space (Workspace) Model

The application UI is a **Space** — a customizable card-based workspace. Each CDM configures their own Space by adding, removing, and repositioning Cards. Card layout preferences are persisted per user in the CAP DB.

### Cards (Phase 1)

| Card | Live Data Source | Specialist Subagent | What the CDM sees |
|---|---|---|---|
| **R&R Reference** | CAP DB — `RRTable` entity | R&R Agent | Searchable list of service codes with chargeability status, description, and R&R category; filters by category/status |
| **Pricing** | CAP DB — `PricingTable` entity | Pricing Agent | Current prices per service code; price history indicator; admin edit inline |
| **Active Requests** | CAP DB — `ASRequest` entity | Request Management Agent | Open AS requests assigned to the CDM; status, age, customer, service code |
| **JIRA O2I** | CAP DB — `ASRequest` (Delivered status) | O2I Agent | Requests ready for invoicing; one-click JIRA ticket body generation |

Each Card:
- Renders **live data** from its connected data source (real-time OData query on card load and on refresh).
- Has a **chat affordance** — the CDM can ask questions in the context of that card ("Is service code XYZ chargeable?" on the R&R card; "What's the price for SC-42?" on the Pricing card).
- Card-level chat is routed by the orchestrator to the card's specialist subagent.
- The global chat (orchestrator) can query across all card-agents.

### Card Customization
- CDMs can toggle any card visible/hidden from a "Manage Space" panel.
- CDMs can drag cards to reorder them.
- Card state (visible, order) is saved per CDM user and restored on next login.
- Phase 3: CDMs can connect additional data sources (SAP4Me, ServiceNow) to a card from a connection picker.

---

## User Profiles & Personas

### Primary Persona: Alex — Customer Delivery Manager

Alex is a mid-career CDM managing 8–15 active customers simultaneously. Each week, 2–4 new AS requests arrive via email, customer SR comments, or verbal discussion. Alex currently tracks each request in a personal notes file, refers to a locally-saved Excel for pricing (often unsure if it's the latest version), and manually gathers 6+ data fields from different platforms to fill a JIRA invoice ticket at the end of the lifecycle. When Alex is on leave, colleagues have no visibility into open requests. Alex is comfortable with SAP tools but frustrated by the lack of a single place to manage AS work. Success for Alex: zero manual platform switching, confidence in pricing accuracy, and JIRA tickets generated in seconds.

### Secondary Persona: Morgan — CDM Team Lead / Manager

Morgan oversees a team of 6 CDMs and is accountable for AS revenue and customer experience. Currently, Morgan has no real-time view of open AS requests across the team — status updates arrive via ad hoc Outlook messages. Morgan needs a dashboard to identify stalled requests, ensure approvals are in place, and flag revenue at risk. Technical proficiency: moderate; prefers list and summary views over raw data.

### Other User Types

- **ECS GES Invoicing Team**: Consumer of the JIRA O2I output generated by the tracker; not a direct app user in Phase 1.
- **Admin / Pricing Owner**: Maintains shared pricing and R&R tables inside the application; one or two authorised users per team.

---

## User Goals & Tasks

### For Alex (CDM):

**Goals:**
- Log a new AS request in under 2 minutes, capturing all required fields in one place
- Look up the correct price for any AS service without switching to a local Excel file
- Record customer approval and PO number against the correct request
- Generate a JIRA O2I ticket body with a single action, pre-populated from tracker data

**Key Tasks:**
- Open the app and use the AI assistant to log a new AS request by describing it in natural language
- Search for a service code to retrieve the current price from the shared pricing table
- Record written customer approval text and PO number in the request record
- Trigger JIRA ticket generation from the request detail view; copy output to JIRA (Phase 1) or push directly (Phase 3)

### For Morgan (CDM Team Lead):

**Goals:**
- View all open AS requests across the CDM team, filtered by status or CDM
- Identify requests that are stalled (e.g., awaiting customer approval for >5 days)

**Key Tasks:**
- Review team-wide AS tracker list view with status and age indicators
- Filter and sort by CDM, status, customer, and service type

---

## Product Principles

1. **Single system of record**: All AS request data lives in one place. No data lives only in email, local files, or memory.
2. **AI assists, CDM decides**: The AI orchestrator drafts, suggests, and generates — the CDM reviews and submits. No autonomous writes to external systems in Phase 1.
3. **Shared, versioned reference data**: Pricing and R&R data is maintained centrally in the app DB; every CDM queries the same version at all times.
4. **Swappable process agents**: Each AI subagent encapsulates one process domain. Changes to SAP pricing or approval processes require updating one agent, not the CDM experience.

---

## Business Context

**Current State:**  
CDMs coordinate AS requests across 7 platforms with no shared tracker. Pricing is maintained in local Excel files with no version control. JIRA O2I ticket creation requires manually gathering 6+ data points from multiple systems. The process is fully manual, error-prone, and breaks when CDMs are unavailable.

**Strategic Alignment:**  
Supports SAP's internal delivery excellence and revenue assurance objectives. Reduces risk of uncharged services and inconsistent customer experience.

**Success Criteria:**
- 100% of AS requests logged in the tracker (zero parallel Excel/notes tracking)
- JIRA O2I ticket generation time under 1 minute per request
- Zero stale pricing incidents within 3 months of go-live
- CDM team adoption: all active CDMs using the app within 4 weeks of release

---

## Goals and Non-Goals

### Goals (In Scope)

- **Space UI**: Customizable card-based workspace; CDMs add/remove/reorder cards; layout persisted per user
- **R&R Reference Card**: Live view of the R&R table with search/filter; backed by R&R specialist subagent
- **Pricing Card**: Live shared pricing table; admin-editable; backed by Pricing specialist subagent
- **Active Requests Card**: Live open AS requests per CDM; backed by Request Management subagent
- **JIRA O2I Card**: Live view of invoicing-ready requests; JIRA ticket generator; backed by O2I subagent
- AS request tracker with full lifecycle status management (intake → approved → in delivery → delivered → invoiced)
- AI conversational interface — global orchestrator + per-card specialist agents
- Team-wide visibility view for CDM managers
- Role-based access (CDM, manager, admin)

### Non-Goals (Out of Scope — Phase 1)

- Mobile-native app

---

## Requirements

### Must-Have Requirements

**R00: Space UI & Card Management**

- **Problem to Solve**: CDMs need a personalized workspace that shows only the data and tools relevant to their current work context.
- **User Story**: As a CDM, I need to customize my Space by adding, removing, and reordering Cards so that my workspace shows the data panels most relevant to my current work.
- **Acceptance Criteria**:
  - Given a logged-in CDM, the Space renders their saved card layout on load.
  - The CDM can open a "Manage Space" panel, toggle cards visible/hidden, and drag to reorder.
  - Card layout changes are persisted to the CAP DB and restored on next login.
  - Each card shows a live data table/list refreshed on card load (with a manual refresh button).
  - Each card has a chat input that sends queries to the card's specialist subagent via the orchestrator.
- **Maps to Objective**: 5
- **Priority Rank**: 1

**R00b: R&R Reference Card**

- **Problem to Solve**: CDMs need to quickly check whether a specific service is chargeable and under which R&R category, without switching to a separate document.
- **User Story**: As a CDM, I need a live R&R Reference card in my Space that shows all service codes with their chargeability status and R&R category, so I can confirm chargeability in seconds during intake.
- **Acceptance Criteria**:
  - The R&R card renders a live, searchable, filterable table of all service codes from the `RRTable` entity.
  - Columns: Service Code, Service Name, Category, Chargeable (Yes/No), Notes.
  - CDM can search by code or name; filter by category or chargeable status.
  - The card chat (R&R Agent) correctly answers questions like "Is service code SC-42 chargeable?" and "Which services fall under migration support?".
  - Admin users can add/edit/deactivate R&R entries from the card (same inline edit pattern as Pricing card).
- **Maps to Objective**: 2
- **Priority Rank**: 2

**R01: AS Request Intake**

- **Problem to Solve**: CDMs have no single place to log a new AS request; intake is scattered across email and notes.
- **User Story**: As a CDM, I need to log a new AS request with all required fields (customer, service type, service code, ticket IDs, description) so that the full request lifecycle is tracked in one place from the start.
- **Acceptance Criteria**:
  - Given a logged-in CDM, when they submit a new request form (or via AI assistant), then a new AS request record is created in the CAP DB with status "New".
  - All required fields are validated before saving.
  - The request is immediately visible in the team tracker list.
- **Maps to Objective**: 1
- **Priority Rank**: 1

**R02: Shared Pricing & R&R Reference**

- **Problem to Solve**: CDMs use locally-saved Excel pricing sheets that may be stale; no shared version exists.
- **User Story**: As a CDM, I need to look up the current price for any AS service code so that I communicate accurate pricing to customers and avoid revenue leakage.
- **Acceptance Criteria**:
  - Given a CDM searches for a service code, when they select it, then the current price from the shared pricing table is displayed.
  - Pricing data is editable only by authorised admin users.
  - Price changes are effective immediately for all users.
- **Maps to Objective**: 2
- **Priority Rank**: 2

**R03: Approval Recording**

- **Problem to Solve**: Written customer approval and PO number are currently tracked only in email; no structured record exists.
- **User Story**: As a CDM, I need to record written customer approval and PO number against an AS request so that there is an auditable record before delivery begins.
- **Acceptance Criteria**:
  - Given an AS request in "Price Communicated" status, when the CDM records approval text and optional PO number, then the request status advances to "Approved" and the timestamp is recorded.
- **Maps to Objective**: 1
- **Priority Rank**: 3

**R04: JIRA O2I Ticket Generator**

- **Problem to Solve**: Creating the JIRA invoice ticket requires manually gathering 6+ data fields from different platforms; it is the highest-friction step in the CDM workflow.
- **User Story**: As a CDM, I need to generate a JIRA O2I ticket body pre-populated from tracker data so that I can submit the invoice ticket in under 1 minute with no manual data gathering.
- **Acceptance Criteria**:
  - Given an AS request in "Delivered" status, when the CDM triggers JIRA ticket generation, then a formatted ticket body is produced with all required fields populated from the tracker record.
  - The CDM can copy the output and paste it into JIRA.
  - The request status advances to "Invoiced" after the CDM confirms submission.
- **Maps to Objective**: 3
- **Priority Rank**: 4

**R05: AI Conversational Interface**

- **Problem to Solve**: CDMs must navigate multiple form screens for routine actions; natural language would reduce friction and speed up intake.
- **User Story**: As a CDM, I need to interact with an AI assistant to log requests, look up pricing, and generate JIRA tickets so that I can complete routine tasks without navigating multiple screens.
- **Acceptance Criteria**:
  - The AI orchestrator correctly routes CDM natural-language requests to the appropriate subagent (intake, pricing, O2I generation).
  - The assistant produces accurate outputs based on tracker and pricing DB data.
  - The CDM can review and confirm all AI-generated content before it is saved or submitted.
- **Maps to Objective**: 4
- **Priority Rank**: 5

**R06: Team Visibility View**

- **Problem to Solve**: CDM managers have no real-time view of open AS requests across the team.
- **User Story**: As a CDM manager, I need to see all open AS requests across my team, filtered by status and CDM, so that I can identify stalled requests and manage delivery risk.
- **Acceptance Criteria**:
  - Given a manager-role user, when they open the team view, they see all AS requests across all CDMs with status, age, and assigned CDM.
  - The view supports filtering by CDM, status, customer, and service type.
- **Maps to Objective**: 5
- **Priority Rank**: 6

### High-Want Requirements

**R07: Activity Log / Audit Trail**

- **Problem to Solve**: No audit trail exists for status changes and approvals; disputes cannot be resolved without email archaeology.
- **User Story**: As a CDM or manager, I need a per-request activity log so that all status changes, approvals, and ticket generations are traceable.
- **Priority Rank**: 1

**R08: Pricing Admin UI**

- **Problem to Solve**: Pricing updates currently require distributing a new Excel file; there is no controlled edit interface.
- **User Story**: As a pricing admin, I need a UI to add, update, and deactivate pricing records so that all CDMs immediately see the latest prices.
- **Priority Rank**: 2

### Nice-to-Have Requirements

**R09: Overdue / Stalled Request Alerts (Phase 2)**

- **Problem to Solve**: Requests awaiting customer approval for extended periods are not surfaced to CDMs proactively.
- **Priority Rank**: 1

**R10: Direct JIRA API Push (Phase 3)**

- **Problem to Solve**: CDMs still have to manually copy the ticket body into JIRA after generation.
- **Priority Rank**: 2

---

## Non-Functional Requirements

### Performance

- **Latency**: AI assistant responses within 5 seconds for standard queries; JIRA ticket generation within 3 seconds.
- **Throughput**: Support up to 50 concurrent CDM users.

### Reliability

- **Availability**: 99.5% uptime during business hours (CET).
- **Fallback**: If the AI assistant is unavailable, CDMs can use the standard form-based UI for all operations.

### Explainability

- **Traceability**: All AI-generated content (pricing lookups, ticket bodies) is presented to the CDM for review before saving; source data is visible.
- **Decision Logging**: All agent tool invocations are logged with input parameters and outputs.
- **Uncertainty Communication**: If the AI assistant cannot confidently resolve a request, it prompts the CDM to use the form UI or provide more detail.

---

## Solution Architecture

**Architecture Overview:**  
A CAP Node.js backend on SAP BTP exposes OData services consumed by a React + SAP UI5 Web Components frontend. A multi-agent Python stack on SAP App Foundation provides the AI conversational layer. The CAP DB (HANA or SQLite for dev) is the single system of record.

**Key Components:**

- **CAP Backend (BTP)**: OData services for AS requests, pricing/R&R tables, card layout preferences, activity log, JIRA ticket template config. Enforces role-based access.
- **React + SAP UI5 Web Components Frontend — Space UI**: Card-based workspace; "Manage Space" panel for add/remove/reorder; per-card live data view; per-card chat affordance; global orchestrator chat panel.
- **Main Orchestrator Agent (Python, App Foundation)**: Stateful CDM personal assistant. Receives natural-language input (global or card-scoped), routes to the correct card specialist, returns unified response. CDM always sees one conversation.
- **Card Specialist Subagents (one per card)**:
  - *R&R Agent*: Knows the R&R table schema and chargeability rules; answers "is X chargeable?", "which codes fall under category Y?".
  - *Pricing Agent*: Knows the pricing table; answers price lookups, flags stale records, supports admin update confirmation.
  - *Request Management Agent*: Knows the AS request lifecycle; supports intake, status advancement, approval recording.
  - *O2I Agent*: Knows the JIRA ticket template; generates ticket body from request data; confirms submission.
- **Task Agents**: Stateless workers — parse request context, draft pricing communication, generate JIRA O2I ticket body.
- **Automation Agents (Phase 2+)**: Event-driven via SAP Event Mesh; fire on status change events.

**Integration Points:**

- **CAP ↔ Frontend**: OData v4 over HTTPS; read/write for all tracker operations.
- **AI Agents ↔ CAP**: REST calls to CAP OData services for data reads/writes during agent tool invocations.
- **JIRA (Phase 1)**: Output only — CDM copies ticket body; no API integration.
- **SAP4Me, AMS, ServiceNow (Phase 3)**: Live API reads for ticket context aggregation.

**Deployment Environments:**

- **Dev**: Local CAP (SQLite) + local agent; no SAP BTP account required.
- **QA**: BTP Cloud Foundry (HANA Cloud) + App Foundation staging.
- **Prod**: BTP Cloud Foundry (HANA Cloud) + App Foundation production.

### Agent Extensibility & Instrumentation

**Agent Extensibility:**
- The Main Orchestrator Agent is designed with explicit extension points: new specialist or task subagents can be registered without modifying orchestrator logic.
- Specialist subagents are independently deployable; process changes (e.g., new approval step) require updating only the relevant subagent.
- Extension points: additional tools (e.g., live SAP4Me API reads in Phase 3), additional instructions (e.g., updated pricing communication templates), and lifecycle hooks (e.g., pre-delivery checklist injection).

**Business Step Instrumentation:**
- Each of the 5 Key Milestones must emit structured log statements on achievement and on miss/skip.
- Log pattern: `[MILESTONE_ID].[achieved|missed]: [description]`
- All agent tool invocations are logged with input, output, and latency for observability in SAP App Foundation dashboards.

### Automation & Agent Behaviour

**Automation Level:** Hybrid (AI-assisted for intake/generation; rule-based for status state machine)

**Actions the system performs without human approval:**
- Pricing lookup from shared pricing table
- Draft JIRA O2I ticket body generation (presented to CDM before use)
- Routing of CDM natural-language input to the correct subagent

**Actions that require human review or approval:**
- Saving a new AS request record (CDM confirms AI-extracted fields)
- Recording customer approval (CDM must paste actual approval text)
- Submitting JIRA ticket (CDM copies/pastes; direct push requires explicit CDM action in Phase 3)
- Any status advancement

**Model or engine used:** GPT-4o via SAP Generative AI Hub (AI Core)

**Knowledge & data sources accessed:**
- CAP DB: AS request records, pricing/R&R table, activity log — owned by CDM team
- JIRA ticket template config — owned by ECS GES team, stored in CAP DB

**Tools or connectors invoked:**

*R&R Agent tools:*
- `lookup_rr_entry`: Query R&R table by service code or category (read-only)
- `check_chargeability`: Return chargeability status and R&R category for a service code (read-only)

*Pricing Agent tools:*
- `lookup_pricing`: Query pricing table by service code (read-only)
- `update_pricing_entry`: Update a price record (admin only, write)

*Request Management Agent tools:*
- `get_as_request`: Read AS request record from CAP DB (read-only)
- `create_as_request`: Create new AS request record (write)
- `update_as_request_status`: Advance request status (write)
- `record_approval`: Save customer approval text and PO number (write)

*O2I Agent tools:*
- `generate_jira_ticket`: Generate JIRA O2I ticket body from request data (read-only, output only)
- `confirm_jira_submission`: Advance request status to "Invoiced" after CDM confirms (write)

**Guardrails & fail-safes:**
- Agent never writes to external systems (JIRA, SAP4Me, AMS) in Phase 1.
- All AI-generated content is surfaced to the CDM for review before any write operation.
- If LLM confidence is low, the agent prompts the CDM to use the form UI.
- Agent cannot delete or retroactively modify approved or invoiced records.

### Configuration & Data

**Configuration Scope:**
- CAP service configuration: roles, destinations, HANA Cloud binding on BTP.
- Pricing and R&R table seed data: migration from existing Excel file by pricing admin before go-live.

**Organisational & Master Data:**
- Pricing / R&R table: master data owned by pricing admin; must be migrated from Excel before go-live.
- AS request data: operational data; no migration required (tracker starts fresh).

**Data Migration & Cutover:**
- Pricing data migration from Excel is a Phase 1 go-live blocker; pricing admin must complete and verify before cutover.
- Open AS requests in flight at go-live: CDMs manually enter them into the tracker during a cutover window (no automated migration of legacy requests).

---

## Governance, Risk & Compliance

**Data Handling:**
- All data resides on SAP BTP (HANA Cloud); subject to SAP BTP data residency policies.
- No personal customer data (PII) is stored beyond customer company name and account ID.
- Customer approval text is stored as free text; CDMs must not paste PII into approval fields.

**Approval Flows:**
- No autonomous external actions in Phase 1; CDM approval is required for all writes to external systems.

---

## Release Criteria

- **Functional**: All must-have requirements (R01–R06) pass acceptance criteria in QA.
- **Pricing migration**: Pricing and R&R table fully populated and verified by pricing admin.
- **Performance**: AI assistant P95 response time < 5 seconds under 20 concurrent users.
- **Fallback**: Form-based UI fully operational independent of AI assistant availability.
- **Onboarding**: CDM quick-start guide and admin pricing guide complete.

---

## Schedule & Timeline Context

**Target Timeline:** Phase 1 go-live within 8 weeks of development start.

**Business Drivers:**
- Revenue leakage risk increases with each billing cycle that AS requests are not tracked centrally.
- CDM team growth increases coordination overhead proportionally under the current manual process.

---

## Milestones

### M1: AS Request Logged

- **Description**: CDM captures a new AS request in the tracker with all required fields; service chargeability confirmed.
- **Achieved when**: A new AS request record is saved in the CAP DB with status "New" and all mandatory fields populated.
- **Log on achievement**: `M1.achieved: AS request logged — requestId={id}, customer={customer}, serviceCode={code}`
- **Log on miss**: `M1.missed: AS request intake did not complete — sessionId={id}, reason={reason}`

### M2: Price Communicated

- **Description**: CDM looks up price from shared pricing table and communicates it to the customer.
- **Achieved when**: Request status is advanced to "Price Communicated" and the price lookup is recorded in the activity log.
- **Log on achievement**: `M2.achieved: Price communicated — requestId={id}, serviceCode={code}, price={price}`
- **Log on miss**: `M2.missed: Price communication step skipped or failed — requestId={id}, reason={reason}`

### M3: Customer Approval Received

- **Description**: Written customer approval and PO number (if required) are recorded in the tracker.
- **Achieved when**: Approval text is saved against the request and status advances to "Approved".
- **Log on achievement**: `M3.achieved: Customer approval recorded — requestId={id}, hasPO={hasPO}`
- **Log on miss**: `M3.missed: Approval not recorded before delivery — requestId={id}, reason={reason}`

### M4: Delivery Confirmed

- **Description**: Customer closes their ticket; CDM closes AMS ticket; tracker status updated.
- **Achieved when**: Request status is advanced to "Delivered" in the tracker.
- **Log on achievement**: `M4.achieved: Delivery confirmed — requestId={id}, deliveryDate={date}`
- **Log on miss**: `M4.missed: Delivery confirmation not recorded — requestId={id}, reason={reason}`

### M5: JIRA O2I Ticket Generated

- **Description**: CDM invokes the JIRA ticket generator; all required fields auto-populated from tracker data.
- **Achieved when**: A JIRA ticket body is generated and the CDM confirms submission; request status advances to "Invoiced".
- **Log on achievement**: `M5.achieved: JIRA O2I ticket generated — requestId={id}, ticketBodyLength={len}`
- **Log on miss**: `M5.missed: JIRA ticket generation did not complete — requestId={id}, reason={reason}`

---

## Risks, Assumptions, and Dependencies

### Risks

- **Pricing data migration blocker**: Go-live depends on the Excel pricing file being fully migrated to the CAP DB. If the pricing admin is unavailable or the Excel is incomplete, go-live is blocked.
- **Sales order / provider contract number source undefined**: Phase 1 treats this as a free-text field. Phase 3 requires SOP clarification and API integration to auto-populate it.
- **SAP internal API access (Phase 3)**: Auth mechanisms for SAP4Me, AMS, ServiceNow, and JIRA are unresolved. Phase 3 scope depends on this being cleared.

### Assumptions (Validate These)

- A designated pricing admin will be available before go-live to migrate and verify the pricing/R&R table.
- CDMs have SAP BTP user accounts and can access the deployed app via browser.
- SAP AI Core (Generative AI Hub) with GPT-4o is available in the target BTP subaccount.
- JIRA O2I ticket template and required fields are stable and agreed with the ECS GES team before spec is finalised.

### Dependencies

- SAP BTP subaccount with HANA Cloud and App Foundation runtime provisioned.
- SAP AI Core with GPT-4o model access.
- ECS GES team sign-off on JIRA O2I ticket field mapping.
- Pricing Excel file made available for migration by pricing admin.

---

## Open Questions

1. What is the exact source of the Sales Order / Provider Contract Number required in the JIRA O2I ticket? Who owns the SOP clarification?
2. Is a PO number always required for AS approval, or only for specific customer types?
3. Should the JIRA ticket template be configurable per service type, or is one template sufficient for all AS types?
4. Are there any data residency constraints (EU-only, etc.) for the BTP deployment?

---

## Appendix

### Glossary

- **AS**: Additional Services — chargeable services delivered outside standard contract scope
- **CDM**: Customer Delivery Manager — SAP internal role accountable for delivery and relationship
- **O2I**: Order to Invoice — the JIRA ticket process that triggers billing by the ECS GES team
- **R&R**: Roles & Responsibilities document defining which services are chargeable
- **SPC/BCP**: SAP support ticketing platforms used alongside SAP4Me and ServiceNow
- **ECS GES**: SAP internal invoicing team that processes O2I tickets

### References

- SAP BTP CAP documentation: https://cap.cloud.sap
- SAP App Foundation agent runtime documentation
- SAP Generative AI Hub / AI Core documentation
- SAP UI5 Web Components: https://sap.github.io/ui5-webcomponents
