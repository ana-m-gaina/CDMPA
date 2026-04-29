# CDM Additional Services Tracker — Workspace ("Space") Edition

SAP BTP application for Customer Delivery Managers to track chargeable Additional Services requests, replacing a fragmented 7-platform manual workflow with a unified CAP backend and a **customizable workspace (Space) UI** backed by a multi-agent AI conversational interface.

## Business challenge

SAP Customer Delivery Managers (CDMs) manage chargeable Additional Services (AS) requests — services delivered outside standard contract scope (system conversions, migration support, special onboarding) — across 7 disconnected platforms: Outlook, SAP4Me, SPC/BCP, BTP, AMS, ServiceNow, and JIRA. There is no single system of record. CDMs rely on personal notes, locally downloaded Excel pricing sheets (no shared version, risk of stale prices), and memory to track each request from intake through delivery to invoicing. Every request lifecycle involves 10 manual steps across multiple platforms, with a JIRA invoice ticket at the end that requires gathering 6+ data points from different sources by hand. The result is high error risk, revenue leakage from uncharged services, inconsistent customer experience, and a fragile process that breaks when CDMs are unavailable.

## Space (Workspace) Model

The application is a **customizable workspace** — a "Space" — composed of **Cards**. Each Card is a live data surface tied to a specific domain (e.g., R&R Reference, Pricing, Active Requests, JIRA O2I). CDMs can add, remove, and arrange Cards to build their personal workspace.

### Card architecture
- Each Card has a **dedicated specialist subagent** that knows deeply about its domain.
- Each Card shows **live data** pulled from its connected data source (CAP DB table, or external SAP system in Phase 3).
- The **Main Orchestrator Agent** sits above all Card-agents, receives CDM natural-language input, and routes queries to the correct Card-agent. The CDM always sees one unified conversation.
- Card-agents return context + data back to the orchestrator, which composes the final response.

### Phase 1 Cards (built-in, customizable)
1. **R&R Reference Card** — Live view of the Roles & Responsibilities table (which services are chargeable). Backed by the R&R subagent. CDMs can query chargeability, view service codes, and filter by category.
2. **Pricing Card** — Live view of the shared pricing table. Backed by the Pricing subagent.
3. **Active Requests Card** — Live view of open AS requests assigned to the CDM. Backed by the Request Management subagent.
4. **JIRA O2I Card** — Displays requests ready for invoicing; triggers ticket generation. Backed by the O2I subagent.

CDMs can hide/show any card and reorder them in their space. Card state (visible, position) is persisted per CDM user.

## Key Milestones

1. **AS Request Logged** — CDM captures a new AS request in the tracker (customer, service type, service code, ticket IDs); service chargeability confirmed against R&R data.
2. **Price Communicated** — CDM looks up price from shared pricing table and communicates it to the customer (email or SR comment); written approval is outstanding.
3. **Customer Approval Received** — Written customer approval and PO number (if required) are recorded in the tracker; delivery can begin.
4. **Delivery Confirmed** — Customer closes their ticket with confirmation comment; CDM closes corresponding AMS ticket; tracker status updated.
5. **JIRA O2I Ticket Generated** — CDM invokes the JIRA ticket generator; all required fields auto-populated from tracker data; ticket submitted to ECS GES team.

## Business Architecture (RBA)

### End-to-End Process

Lead to Cash for Contract Based Services (E2E)

### Process Hierarchy

```
Lead to Cash for Contract Based Services
└── Order to Fulfill (contract based services)
    └── Manage service contracts, requests and orders
        └── Manage service requests
└── Invoice to Cash (physical products and services)
    └── Manage customer invoices (physical products and services)
        └── Prepare billing data
```

### Summary

The CDM AS tracker maps to the Lead to Cash for Contract Based Services E2E process: the intake-to-approval phase covers Manage Service Contracts, Requests and Orders; the JIRA O2I generation phase covers the Invoice to Cash sub-process for preparing billing data. Both phases are currently fully manual with no system of record.

## Fit Gap Analysis

| Requirement (business) | Standard asset(s) found | API ORD ID | MCP Server ORD ID | Gap? | Notes / assumptions |
| ---------------------- | ----------------------- | ---------- | ----------------- | ---- | ------------------- |
| Service request intake and tracking | SAP Service Cloud v2 — Service Request Management (SC3411) | `sap.s4:apiResource:OP_API_SERVICE_REQUEST_SRV_0001:v1` | — | Yes | SAP Service Cloud covers generic SR management; CDM workflow is bespoke (multi-platform ticket IDs, AS-specific status states, pricing reference). Custom BTP extension required. |
| Shared pricing and R&R reference | No standard SAP product | — | — | Yes | No SAP product covers CDM-specific AS pricing and R&R lookup. Pricing data to be stored in CAP DB table, editable by authorized users. |
| Approval tracking (written customer approval + PO) | SAP S/4HANA Cloud — Service Contract Management (SC5490 / SC1013) | `sap.s4:apiResource:CE_BILLINGDOCUMENT_0001:v1` | — | Yes | S/4HANA covers formal contract management; CDM approval is a lightweight email-based consent step, not a formal contract. Free-text approval capture in CAP DB is sufficient for Phase 1. |
| JIRA invoice ticket generation (O2I) | No standard SAP product | — | — | Yes | JIRA O2I ticket is CDM-specific; must be generated from tracker data with a structured template. Custom task agent generates the ticket body; Phase 3 will add direct JIRA API push. |
| Multi-platform ticket ID aggregation (SAP4Me, SPC, BTP, AMS, ServiceNow) | SAP Order Management foundation — Customer Order Monitoring (SC3132) | — | — | Yes | No standard product aggregates ticket IDs across these platforms. Phase 1: free-text fields in CAP DB. Phase 3: live API reads via integration agents. |
| Conversational AI intake and orchestration | SAP AI Core (runtime) | — | — | Partial | SAP AI Core provides the LLM runtime. Multi-agent orchestration (Orchestrator PA + specialist/task/automation subagents) must be custom-built on App Foundation. |
| Billing data preparation / invoice trigger | SAP S/4HANA Cloud — Billing Data Management (SC5680 / SC1121) | `sap.s4:apiResource:CE_BILLINGDOCUMENTREQUEST_0001:v1` | — | Yes | Actual billing is downstream (ECS GES O2I team via JIRA). Phase 1: CDM generates JIRA ticket body only. Phase 3: consider direct billing API integration. |

### Key findings

- No standard SAP product covers the CDM-specific AS tracking workflow end to end; custom BTP extension is the correct approach.
- SAP Service Cloud v2 and SAP S/4HANA Cloud Service modules are relevant for future Phase 3 API integration but are not the basis of the Phase 1 build.
- The architecture is a multi-agent system: a stateful personal orchestrator (PA) routes to scoped specialist, task, and automation subagents — keeping token cost predictable and process knowledge swappable independently of the CDM's experience.
- Pricing and R&R data is stored in CAP DB tables editable by authorized users, eliminating the local Excel version fragmentation risk.
- Phase 1 JIRA integration is output-only (generate ticket body); no MCP servers are available for any of the relevant APIs in the current landscape.
- SAP Event Mesh is the target eventing layer for automation agents (Phase 2+) that surface pending CDM actions into the inbox.

## Recommendations

### CDM AS Tracker — BTP Extension with Multi-Agent AI Space

#### Executive Summary

Build a SAP BTP CAP (Node.js) application with a **customizable Space UI** (card-based workspace) and a multi-agent AI conversational interface as the CDM's single system of record for Additional Services requests. Phase 1 delivers: a customizable Space with R&R Reference, Pricing, Active Requests, and JIRA O2I cards — each showing live data and backed by a specialist subagent — plus an AI orchestrator that routes CDM natural-language requests to the right card-agent.

#### Recommended Solution

A CAP Node.js backend on BTP, exposing OData services consumed by a React + SAP UI5 Web Components Space UI. The AI layer is a multi-agent Python stack on SAP App Foundation:

- **Main Orchestrator (PA):** Stateful, personalized CDM personal assistant. Owns the conversational experience. Routes to card-specialists silently. CDM always sees one conversation.
- **Card Specialist subagents:** One per card domain — R&R Agent, Pricing Agent, Request Management Agent, O2I Agent. Each has access to live data from its card's data source.
- **Task agents:** Stateless workers — parse incoming request context, draft pricing communication, generate JIRA O2I ticket body.
- **Automation agents (Phase 2+):** Event-driven via SAP Event Mesh; fire on status change events and surface pending CDM actions into the inbox.

The CAP backend holds: AS request tracker (entity with status state machine), shared pricing table, R&R service code table, card layout preferences (per CDM), audit/activity log, and JIRA ticket template config.

#### Problem Statement

CDMs spend disproportionate time on administrative coordination across 7 platforms per AS request, with no shared visibility, stale pricing risk, and a manual JIRA ticket creation step that requires gathering 6+ fields from memory and multiple systems.

#### Affected User Roles

- Customer Delivery Manager (CDM) — primary user; customizes their Space
- CDM Team Lead / Manager — visibility across team's open requests
- ECS GES (invoicing team) — consumer of the generated JIRA O2I output
- Admin / Pricing Owner — maintains shared pricing and R&R tables in the app

#### Intent fit
92%
