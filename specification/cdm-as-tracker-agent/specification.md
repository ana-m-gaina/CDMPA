# Specification: cdm-as-tracker-agent

> **Guidelines**: Read [guidelines.md](../guidelines.md) and [guidelines-agent.md](../guidelines-agent.md) before executing ANY tasks below. Follow all constraints described there throughout execution.

## Basic Setup

- [ ] Read `product-requirements-document.md` and `intent.md` thoroughly before starting
- [ ] Bootstrap agent code in `assets/cdm-as-tracker-agent/` using skill `sap-agent-bootstrap` (invoke from inside `assets/cdm-as-tracker-agent/`, use copy commands — do NOT create files manually)
- [ ] Install dependencies; validate agent starts and responds at `/.well-known/agent.json`

## CAP Backend Client

- [ ] Create `app/cap_client.py` — async HTTP client for the CAP OData backend:
  - Base URL from env var `CAP_SERVICE_URL` (default: `http://localhost:4004/odata/v4/CDMService`)
  - Admin URL from env var `CAP_ADMIN_SERVICE_URL` (default: `http://localhost:4004/odata/v4/AdminService`)
  - Use `httpx.AsyncClient`; all methods async; raise `RuntimeError` on non-2xx responses
  - Methods:
    - `get_rr_entries(search=None, category=None, chargeable=None) -> list`
    - `get_rr_entry_by_code(service_code: str) -> dict | None`
    - `get_pricing_entry(service_code: str) -> dict | None`
    - `get_all_pricing(search=None) -> list`
    - `get_as_request(request_id: str) -> dict`
    - `get_open_requests(cdm_email=None) -> list`
    - `create_as_request(data: dict) -> dict`
    - `advance_status(request_id: str, new_status: str, comment="") -> dict`
    - `record_approval(request_id: str, approval_text: str, po_number="") -> dict`
    - `generate_jira_ticket(request_id: str) -> str`
    - `confirm_invoiced(request_id: str) -> dict`
    - `update_pricing_entry(entry_id: str, data: dict) -> dict`

## R&R Specialist Subagent

- [ ] Create `app/agents/rr_agent.py`:
  - Define LangChain tools:

    `lookup_rr_entry(service_code: str = None, search_term: str = None, category: str = None, chargeable_only: bool = False) -> str`
    - Calls `cap_client.get_rr_entry_by_code()` if service_code provided; else `cap_client.get_rr_entries()`
    - Returns formatted result or "No matching R&R entries found."

    `check_chargeability(service_code: str) -> str`
    - Returns "Service code {code}: Chargeable=Yes/No, Category={cat}, Notes={notes}" or not found message

  - Build LangGraph StateGraph agent; system prompt: "You are an expert on CDM Additional Services Roles and Responsibilities. Answer questions about service code chargeability and categories using only R&R table data. Never hallucinate. State clearly when a code is not found."
  - Expose `async def run(query: str) -> str`

## Pricing Specialist Subagent

- [ ] Create `app/agents/pricing_agent.py`:
  - Define LangChain tools:

    `lookup_pricing(service_code: str) -> str`
    - Calls `cap_client.get_pricing_entry()`; returns formatted price or "No pricing found for {code}."

    `search_pricing(search_term: str) -> str`
    - Calls `cap_client.get_all_pricing(search=search_term)`; returns formatted list or "No pricing records found."

    `update_pricing_entry(entry_id: str, price: float, currency: str = "EUR", effective_from: str = None) -> str`
    - Admin-only; checks `admin_context` flag before calling `cap_client.update_pricing_entry()`
    - Returns success message or "Unauthorized: admin access required."

  - System prompt: "You are an expert on CDM Additional Services pricing. Provide accurate price lookups. Never guess prices. The update tool is available only to admin users."
  - Expose `async def run(query: str, admin_context: bool = False) -> str`

## Request Management Specialist Subagent

- [ ] Create `app/agents/request_management_agent.py`:
  - Define LangChain tools:

    `get_as_request(request_id: str) -> str`
    - Returns formatted request details or "Request not found."

    `get_open_requests(cdm_email: str = None) -> str`
    - Returns formatted list: ID, title, customer, service code, status, age in days

    `create_as_request(customer_name: str, service_code: str, description: str, cdm_email: str, customer_account_id: str = "", service_type: str = "", sap4me_ticket_id: str = "", spc_ticket_id: str = "", btp_ticket_id: str = "", ams_ticket_id: str = "", servicenow_ticket_id: str = "", sales_order_number: str = "", provider_contract_number: str = "", confirmed: bool = False) -> str`
    - If `confirmed=False`: return summary of all fields with "[PENDING_CONFIRMATION]" marker; do NOT call cap_client
    - If `confirmed=True`: call `cap_client.create_as_request(data)`; return created request ID

    `advance_request_status(request_id: str, new_status: str, comment: str = "") -> str`
    - Calls `cap_client.advance_status()`; returns updated status or error

    `record_approval(request_id: str, approval_text: str, po_number: str = "") -> str`
    - Calls `cap_client.record_approval()`; returns updated status or error

  - System prompt: "You are an expert on the CDM Additional Services request lifecycle (New→PriceCommunicated→Approved→InDelivery→Delivered→Invoiced). Always present extracted data for CDM confirmation before creating or updating records. Never write without confirmation. Never hallucinate request data."
  - Expose `async def run(query: str, cdm_email: str = None) -> str`

## O2I Specialist Subagent

- [ ] Create `app/agents/o2i_agent.py`:
  - Define LangChain tools:

    `get_invoiceable_requests(cdm_email: str = None) -> str`
    - Returns requests in Delivered status or "No requests ready for invoicing."

    `generate_jira_ticket(request_id: str) -> str`
    - Calls `cap_client.generate_jira_ticket()`; returns full ticket body with note: "Please review and confirm submission to mark as Invoiced."

    `confirm_jira_submission(request_id: str) -> str`
    - Calls `cap_client.confirm_invoiced()`; returns "Request {id} marked as Invoiced."

  - System prompt: "You are an expert on the CDM JIRA Order-to-Invoice process. Generate JIRA ticket bodies and present them for CDM review. Never mark a request as Invoiced without explicit CDM confirmation."
  - Expose `async def run(query: str, cdm_email: str = None) -> str`

## Main Orchestrator Agent

- [ ] Create `app/agents/orchestrator.py`:
  - Import and wrap each subagent's `run` as a LangChain tool:
    - `query_rr_agent(query: str) -> str`
    - `query_pricing_agent(query: str) -> str`
    - `query_request_management_agent(query: str, cdm_email: str = "") -> str`
    - `query_o2i_agent(query: str, cdm_email: str = "") -> str`
  - Routing by `card_context`:
    - `rr-reference` → prefer `query_rr_agent`
    - `pricing` → prefer `query_pricing_agent`
    - `active-requests` → prefer `query_request_management_agent`
    - `jira-o2i` → prefer `query_o2i_agent`
    - `None` → free routing based on query content
  - System prompt: "You are the CDM AS Tracker personal assistant. Route every query to the correct specialist subagent. Never answer data questions yourself — always delegate. The CDM sees one unified conversation. If a query is ambiguous, ask one clarifying question before routing."
  - Expose `async def run(message: str, card_context: str = None, cdm_email: str = None) -> str`

- [ ] Update `app/agent.py`:
  - Wire `orchestrator.run` as the primary entrypoint
  - `@agent_model` → `gpt-4o`
  - `@agent_config` → temperature default 0.1
  - `@prompt_section` → "CDM AS Tracker AI assistant. Routes queries to specialist subagents. Maintains conversation context. Never hallucinates data."
  - Verify exactly 3 decorated functions exist (one each of `@agent_model`, `@agent_config`, `@prompt_section`)

- [ ] Add `POST /api/chat` route in `app/main.py`:
  - Accepts `{message: str, card_context: str|null, cdm_email: str|null}`
  - Calls `orchestrator.run(message, card_context, cdm_email)`; returns string response

## Business Step Instrumentation

- [ ] In `request_management_agent.py`, instrument with milestone logging + OpenTelemetry spans:

  `create_as_request` (after confirmed write):
  - `logger.info(f"[M1.achieved]: AS request logged — requestId={req_id}, customer={customer_name}, serviceCode={service_code}")`
  - On failure: `logger.warning(f"[M1.missed]: AS request intake did not complete — reason={reason}")`
  - Wrap with `@tracer.start_as_current_span("milestone_M1")`

  `advance_request_status` when `new_status == "PriceCommunicated"`:
  - `logger.info(f"[M2.achieved]: Price communicated — requestId={request_id}")`
  - Wrap with `@tracer.start_as_current_span("milestone_M2")`

  `record_approval` on success:
  - `logger.info(f"[M3.achieved]: Customer approval recorded — requestId={request_id}, hasPO={bool(po_number)}")`
  - Wrap with `@tracer.start_as_current_span("milestone_M3")`

  `advance_request_status` when `new_status == "Delivered"`:
  - `logger.info(f"[M4.achieved]: Delivery confirmed — requestId={request_id}")`
  - Wrap with `@tracer.start_as_current_span("milestone_M4")`

- [ ] In `o2i_agent.py`, instrument `confirm_jira_submission`:
  - `logger.info(f"[M5.achieved]: JIRA O2I ticket generated — requestId={request_id}")`
  - Wrap with `@tracer.start_as_current_span("milestone_M5")`

- [ ] Verify `auto_instrument()` is called at top of `app/main.py` before any LangChain/LangGraph imports

## Testing

- [ ] In `conftest.py`, patch `app.cap_client` with deterministic mocks:
  - `get_rr_entry_by_code("SC-42")` → `{"serviceCode":"SC-42","serviceName":"System Conversion Support","category":"SystemConversion","chargeable":True,"notes":"Standard scope"}`
  - `get_pricing_entry("SC-42")` → `{"serviceCode":"SC-42","price":5000.00,"currency":"EUR","effectiveFrom":"2024-01-01","lastUpdatedBy":"pricingadmin"}`
  - `get_open_requests()` → 2 sample ASRequest dicts (statuses: New, PriceCommunicated)
  - `create_as_request(...)` → `{"ID":"req-001","status":"New","requestTitle":"Test Request"}`
  - `advance_status(...)` → `{"ID":"req-001","status":"PriceCommunicated"}`
  - `generate_jira_ticket("req-001")` → `"JIRA Ticket Body:\nCustomer: ACME Corp\nService: SC-42\nPrice: EUR 5000"`
  - `confirm_invoiced("req-001")` → `{"ID":"req-001","status":"Invoiced"}`

- [ ] Write unit tests in `assets/cdm-as-tracker-agent/tests/`:

  **`test_rr_tools.py`**
  - `test_lookup_rr_entry_by_code`: pass "SC-42" → response contains "SC-42" and chargeability info
  - `test_check_chargeability`: pass "SC-42" → response contains "Chargeable=Yes"
  - Run immediately; fix failures before proceeding

  **`test_pricing_tools.py`**
  - `test_lookup_pricing`: pass "SC-42" → response contains "5000" and "EUR"
  - `test_search_pricing`: pass search term → response contains at least one row
  - Run immediately

  **`test_request_management_tools.py`**
  - `test_get_as_request`: response contains request title
  - `test_get_open_requests`: formatted string with 2 requests
  - `test_create_as_request_pending`: without `confirmed=True` → "[PENDING_CONFIRMATION]" in response; `cap_client.create_as_request` NOT called
  - `test_create_as_request_confirmed`: with `confirmed=True` → `cap_client.create_as_request` called once; response contains request ID
  - `test_advance_request_status`: mock `advance_status` called with correct args
  - `test_record_approval`: mock `record_approval` called; response contains "Approved"
  - Run immediately

  **`test_o2i_tools.py`**
  - `test_get_invoiceable_requests`: formatted response returned
  - `test_generate_jira_ticket`: response contains "JIRA Ticket Body" and review note
  - `test_confirm_jira_submission`: mock `confirm_invoiced` called; response contains "Invoiced"
  - Run immediately

- [ ] Write integration test `tests/test_integration.py`:
  - `test_chargeability_query`: `orchestrator.run("Is SC-42 chargeable?", card_context="rr-reference")` → response contains "SC-42" and chargeability answer (real LLM, mocked cap_client)
  - `test_pricing_query`: `orchestrator.run("What is the price for SC-42?", card_context="pricing")` → response contains "5000" or "EUR"

- [ ] Run `grep -c "^@agent_model\|^@agent_config\|^@prompt_section" assets/cdm-as-tracker-agent/app/agent.py` — confirm output is `3`
- [ ] Run `pytest` from `assets/cdm-as-tracker-agent/` (no args); coverage ≥ 70%
- [ ] Run `pytest` again (no args) → generates `test_report.json`
- [ ] Verify: `ls assets/cdm-as-tracker-agent/test_report.json`

## Agent Evaluation

- [ ] Invoke `sap-aeval-generate-tool-schema` skill from `assets/cdm-as-tracker-agent/` → generates `tools.json`
- [ ] Invoke `sap-aeval-generate-testcase` skill from `assets/cdm-as-tracker-agent/`, passing this spec and `tools.json`; replace all `<placeholder>` values with realistic CDM data before running evaluations
